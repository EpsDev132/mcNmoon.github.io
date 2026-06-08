/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

const statsFilePath = path.join(process.cwd(), "public/mc-stats.json");

// Default starter state for mc.n-server.org
let telemetry = {
  serverIp: "mc.n-server.org",
  lastUpdated: new Date().toISOString(),
  history: [] as any[],
  players: [] as any[],
  todayIntervals: [] as any[]
};

// 1. Ensure the directory exists and load stats on boot
function ensureDirectoryExists(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

function loadStats() {
  try {
    ensureDirectoryExists(statsFilePath);
    if (fs.existsSync(statsFilePath)) {
      const existingData = JSON.parse(fs.readFileSync(statsFilePath, "utf8"));
      
      // Safety check: if loaded data contains mock data (e.g. player names from the mock generator list)
      // or if it doesn't match the new target IP "mc.n-server.org", we clean up mock-related elements.
      const mockIdentifiers = ["Notch", "Steve", "Alex", "Herobrine", "CreepHunter"];
      const hasMockData = existingData.players?.some((p: any) => 
        mockIdentifiers.includes(p.username)
      );

      if (hasMockData || existingData.serverIp !== "mc.n-server.org") {
        console.log("Mock data or old IP detected in mc-stats.json. Resetting telemetry to fresh database.");
        telemetry = {
          serverIp: "mc.n-server.org",
          lastUpdated: new Date().toISOString(),
          history: [],
          players: [],
          todayIntervals: []
        };
        saveStats();
      } else {
        if (existingData.players) {
          existingData.players = existingData.players.filter((p: any) => p.username.toLowerCase() !== "n-server");
        }
        telemetry = { ...telemetry, ...existingData };
        console.log(`Loaded existing stats. Tracked IP: ${telemetry.serverIp}. Total history items: ${telemetry.history.length}. Players tracked: ${telemetry.players.length}`);
      }
    } else {
      console.log("No existing mc-stats.json found. Initializing a clean state.");
      saveStats();
    }
  } catch (err) {
    console.error("Error reading or parsing mc-stats.json, starting fresh.", err);
  }
}

function saveStats() {
  try {
    ensureDirectoryExists(statsFilePath);
    fs.writeFileSync(statsFilePath, JSON.stringify(telemetry, null, 2), "utf8");
    console.log("Saved updated telemetry to disk:", statsFilePath);
  } catch (err) {
    console.error("Failed to write mc-stats.json to disk:", err);
  }
}

// 2. Perform background tracking poll cycle
async function performTrackerPoll() {
  const activeIp = telemetry.serverIp || "mc.n-server.org";
  console.log(`[POLL CYCLE] Querying status for: ${activeIp}`);

  const apiUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(activeIp)}`;
  const now = new Date();
  
  // Shift to UTC+3 timezone for reset/daily boundary calculation
  const nowTz = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const todayStr = nowTz.toISOString().split("T")[0]; // YYYY-MM-DD in UTC+3

  let onlineCount = 0;
  let maxCount = 0;
  let playersList: any[] = [];
  let isOnline = false;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`mcstatus.io returned HTTP ${response.status}`);
    }
    const status = await response.json();
    isOnline = !!status.online;

    if (isOnline) {
      onlineCount = status.players?.online || 0;
      maxCount = status.players?.max || 0;
      playersList = status.players?.list || [];
      console.log(`[POLL CYCLE] Online status: ONLINE. Players: ${onlineCount}/${maxCount}`);
    } else {
      console.log("[POLL CYCLE] Online status: OFFLINE.");
    }
  } catch (err) {
    console.error("[POLL CYCLE] Failed to fetch server status:", err);
    // Maintain offline status, but do not clear history
    isOnline = false;
  }

  // Calculate elapsed hours since last update for player playtime accumulator
  let elapsedHours = 2 / 60; // default assuming 2-minute interval if first poll
  if (telemetry.lastUpdated) {
    const lastTime = new Date(telemetry.lastUpdated).getTime();
    const diffMs = now.getTime() - lastTime;
    const diffHours = diffMs / (1000 * 60 * 60);

    // Filter out huge spikes if server has been down for hours/days
    elapsedHours = Math.min(diffHours, 0.5);
  }
  if (elapsedHours < 0.001) elapsedHours = 0.001;

  // 1. Update Daily Online History (min, avg, max)
  let historyEntry = telemetry.history.find((h: any) => h.date === todayStr);
  if (!historyEntry) {
    historyEntry = {
      date: todayStr,
      min: onlineCount,
      avg: onlineCount,
      max: onlineCount,
      _count: 1
    };
    telemetry.history.push(historyEntry);
  } else {
    // Increment stats for today
    historyEntry.min = Math.min(historyEntry.min, onlineCount);
    historyEntry.max = Math.max(historyEntry.max, onlineCount);
    
    const count = historyEntry._count || 1;
    // Rolling weighted average
    historyEntry.avg = Math.round(((historyEntry.avg * count) + onlineCount) / (count + 1));
    historyEntry._count = count + 1;
  }

  // Keep a maximum of last 100 days of history
  if (telemetry.history.length > 100) {
    telemetry.history.sort((a, b) => a.date.localeCompare(b.date));
    telemetry.history = telemetry.history.slice(-100);
  }

  // 1.5. Update Sub-Daily Detailed History for Today view
  if (!telemetry.todayIntervals) {
    telemetry.todayIntervals = [];
  }
  telemetry.todayIntervals.push({
    timestamp: now.toISOString(),
    playersOnline: onlineCount
  });

  // Keep only the last 24 hours of fine-grained granular logs
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
  telemetry.todayIntervals = telemetry.todayIntervals.filter((item: any) => {
    const itemTime = new Date(item.timestamp).getTime();
    return itemTime >= twentyFourHoursAgo;
  });

  // 2. Update player activity log
  const activePlayersMap = new Map(telemetry.players.map((p: any) => [p.username, p]));

  if (isOnline && playersList.length > 0) {
    console.log(`[POLL CYCLE] Live online players detected:`, playersList.map(p => p.name_clean || p.name_raw).join(", "));
    
    playersList.forEach((player: any) => {
      const username = player.name_clean || player.name_raw || player.name;
      if (!username) return;
      if (username.toLowerCase() === "n-server") return;

      let playerActivity = activePlayersMap.get(username);
      if (!playerActivity) {
        playerActivity = {
          uuid: player.uuid || "",
          username: username,
          lastSeen: now.toISOString(),
          totalPlayHours: 0,
          _playDates: {} as Record<string, number>
        };
        activePlayersMap.set(username, playerActivity);
      }

      // Update fields
      playerActivity.lastSeen = now.toISOString();
      playerActivity.uuid = player.uuid || playerActivity.uuid || "";
      
      if (!playerActivity._playDates) {
        playerActivity._playDates = {};
      }

      // Add tracked time to today's bucket
      const todayHours = playerActivity._playDates[todayStr] || 0;
      playerActivity._playDates[todayStr] = parseFloat((todayHours + elapsedHours).toFixed(4));
    });
  }

  // Recalculate 7d, 30d, 90d, and total playtimes for all players
  const updatedPlayers = Array.from(activePlayersMap.values()).map((player: any) => {
    const playDates = player._playDates || {};
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    let totalPlayHours = 0;
    let playHoursToday = 0;
    let playHoursLast7Days = 0;
    let playHoursLast30Days = 0;
    let playHoursLast90Days = 0;

    Object.keys(playDates).forEach(dateKey => {
      const entryDate = new Date(dateKey);
      const hoursValue = playDates[dateKey] || 0;

      if (entryDate < ninetyDaysAgo) {
        delete playDates[dateKey];
      } else {
        totalPlayHours += hoursValue;

        if (dateKey === todayStr) {
          playHoursToday += hoursValue;
        }

        const diffDays = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diffDays <= 7) {
          playHoursLast7Days += hoursValue;
        }
        if (diffDays <= 30) {
          playHoursLast30Days += hoursValue;
        }
        if (diffDays <= 90) {
          playHoursLast90Days += hoursValue;
        }
      }
    });

    // Handle initial migration or fallback where no play dates are recorded yet but total hours existed
    if (totalPlayHours === 0 && player.totalPlayHours > 0) {
      totalPlayHours = player.totalPlayHours;
      playHoursToday = player.playHoursToday || 0;
      playHoursLast7Days = player.playHoursLast7Days || 0;
      playHoursLast30Days = player.playHoursLast30Days || 0;
      playHoursLast90Days = player.playHoursLast90Days || 0;
    }

    return {
      uuid: player.uuid,
      username: player.username,
      lastSeen: player.lastSeen,
      totalPlayHours: parseFloat(totalPlayHours.toFixed(3)),
      playHoursToday: parseFloat(playHoursToday.toFixed(3)),
      playHoursLast7Days: parseFloat(playHoursLast7Days.toFixed(3)),
      playHoursLast30Days: parseFloat(playHoursLast30Days.toFixed(3)),
      playHoursLast90Days: parseFloat(playHoursLast90Days.toFixed(3)),
      _playDates: playDates
    };
  });

  // Sort players list descendants by total/recent activity
  telemetry.players = updatedPlayers;
  telemetry.lastUpdated = now.toISOString();

  // Save changes to JSON file
  saveStats();
  console.log(`[POLL CYCLE] Active Player list size now: ${telemetry.players.length}`);
}

// Automatically load stats on launch
loadStats();

// Immediate tracking call and then setup a recurring interval (every 2 minutes)
performTrackerPoll();
const pollInterval = setInterval(performTrackerPoll, 120000);

// API Routes
// Serve stats directly from mock or file database
app.get("/mc-stats.json", (req, res) => {
  // Return telemetry without internal helper attributes
  const cleanHistory = telemetry.history.map(({ _count, ...rest }) => rest);
  res.json({
    ...telemetry,
    history: cleanHistory
  });
});

app.get("/api/telemetry", (req, res) => {
  res.json(telemetry);
});

// Force tracking poll cycle immediately (invoked when clicking a refresh/force trigger in UI)
app.post("/api/poll", async (req, res) => {
  try {
    await performTrackerPoll();
    res.json({ success: true, telemetry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Switch IP settings route
app.post("/api/set-ip", async (req, res) => {
  const { ip } = req.body;
  if (!ip || typeof ip !== "string") {
    res.status(400).json({ success: false, error: "Invalid IP string specified." });
    return;
  }

  console.log(`[API] Configuration change received. Switching server IP tracking to: "${ip}"`);
  
  // Clear any existing telemetry records when setting a fresh server block
  telemetry = {
    serverIp: ip.trim(),
    lastUpdated: new Date().toISOString(),
    history: [],
    players: [],
    todayIntervals: []
  };

  try {
    await performTrackerPoll();
    res.json({ success: true, telemetry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Configure Vite middleware in development or direct static distribution path in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets compiled inside dist/
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[EXPRESS SERVER] Multi-user telemetry running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
