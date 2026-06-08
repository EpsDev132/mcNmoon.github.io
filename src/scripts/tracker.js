/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Minecraft Server Telemetry Tracker - Serverless Node Script
 * This script is run automatically by GitHub Actions (e.g., every 30-60 minutes).
 * It reads /public/mc-stats.json, queries mcstatus.io, calculates player playtime log metrics,
 * and updates the JSON file.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Establish __dirname equivalents for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to configurations and data
const statsFilePath = path.join(__dirname, "../../public/mc-stats.json");

// Default configuration settings
const DEFAULT_SERVER_IP = "mc.n-server.org"; // Fallback IP

async function runTracker() {
  console.log("=== Minecraft Server Telemetry Tracker Starting ===");
  
  // 1. Ensure the public directory exists
  const publicDir = path.dirname(statsFilePath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 2. Read existing statistics or prepare empty state
  let telemetry = {
    serverIp: DEFAULT_SERVER_IP,
    lastUpdated: new Date().toISOString(),
    history: [],
    players: []
  };

  if (fs.existsSync(statsFilePath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(statsFilePath, "utf8"));
      telemetry = { ...telemetry, ...existingData };
      if (telemetry.players) {
        telemetry.players = telemetry.players.filter(p => p.username.toLowerCase() !== "n-server");
      }
      console.log(`Loaded existing stats file. Configured IP: ${telemetry.serverIp}`);
    } catch (e) {
      console.warn("Could not parse existing mc-stats.json, initializing fresh templates.", e);
    }
  } else {
    console.log(`No active stats file found. Starting fresh tracker file for: ${telemetry.serverIp}`);
  }

  // Allow overriding Server IP via environment variable
  const activeIp = process.env.MC_SERVER_IP || telemetry.serverIp;
  telemetry.serverIp = activeIp;
  console.log(`Pinging Minecraft server: ${activeIp}`);

  // 3. Fetch current status from mcstatus.io API
  const apiUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(activeIp)}`;
  const now = new Date();
  
  // Shift to UTC+3 timezone for reset/daily boundary calculation
  const nowTz = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const todayStr = nowTz.toISOString().split("T")[0]; // YYYY-MM-DD in UTC+3

  let onlineCount = 0;
  let maxCount = 0;
  let playersList = [];
  let isOnline = false;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    const status = await response.json();
    isOnline = !!status.online;

    if (isOnline) {
      onlineCount = status.players?.online || 0;
      maxCount = status.players?.max || 0;
      playersList = status.players?.list || [];
      console.log(`Server is ONLINE. Players: ${onlineCount}/${maxCount}`);
    } else {
      console.log("Server returned offline status.");
    }
  } catch (error) {
    console.error("Failed to query Minecraft server status API:", error);
    // If the server is offline or query fails, we treat it as onlineCount = 0
    isOnline = false;
  }

  // 4. Calculate elapsed time since last run for reliable playtime logs.
  // GitHub actions schedule can be unpredictable, so measuring actual elapsed time prevents distortion.
  let elapsedHours = 0.5; // default fallback assuming 30 min schedule
  if (telemetry.lastUpdated) {
    const diffMs = now.getTime() - new Date(telemetry.lastUpdated).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Safety check: if time is unreasonable (e.g., first run after many days), limit to 1.5 hours max
    // to avoid crediting offline users with days of fake active playtime.
    elapsedHours = Math.min(diffHours, 1.5);
  }
  
  if (elapsedHours < 0.05) {
    elapsedHours = 0.05; // minimum floor
  }

  console.log(`Elapsed time since last recording: ${elapsedHours.toFixed(3)} hours`);

  // 5. Update Online History metrics (min, average, max tracking per day)
  // Find or create history slot for today (todayStr)
  let historyEntry = telemetry.history.find(h => h.date === todayStr);
  
  if (!historyEntry) {
    historyEntry = {
      date: todayStr,
      min: onlineCount,
      avg: onlineCount,
      max: onlineCount,
      // We keep a private measurements helper counter to calculate a true running average
      _count: 1
    };
    telemetry.history.push(historyEntry);
  } else {
    // Treat online count updates incrementally
    historyEntry.min = Math.min(historyEntry.min, onlineCount);
    historyEntry.max = Math.max(historyEntry.max, onlineCount);
    
    const count = historyEntry._count || 1;
    // Weighted rolling average: (oldAverage * oldCount + currentCount) / (oldCount + 1)
    historyEntry.avg = Math.round(((historyEntry.avg * count) + onlineCount) / (count + 1));
    historyEntry._count = count + 1;
  }

  // Cleanup: only store last 100 days of history to prevent the JSON file from growing indefinitely
  if (telemetry.history.length > 100) {
    // Sort oldest first and keep the last 100 entries
    telemetry.history.sort((a, b) => a.date.localeCompare(b.date));
    telemetry.history = telemetry.history.slice(-100);
  }


  // 1.5. Update Sub-Daily Detailed History for Today view (10-30 min intervals)
  if (!telemetry.todayIntervals) {
    telemetry.todayIntervals = [];
  }
  telemetry.todayIntervals.push({
    timestamp: now.toISOString(),
    playersOnline: onlineCount
  });

  // Keep only the last 24 hours of fine-grained granular logs
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
  telemetry.todayIntervals = telemetry.todayIntervals.filter(item => {
    const itemTime = new Date(item.timestamp).getTime();
    return itemTime >= twentyFourHoursAgo;
  });

  // 6. Update Active Player tracking
  // We keep a detailed private history structure for active days for precise playtime sliding windows.
  // Let's load players.
  const activePlayersMap = new Map(telemetry.players.map(p => [p.username, p]));

  // Log active players seen in this interval
  if (isOnline && playersList.length > 0) {
    console.log(`Logging activity for players: ${playersList.map(p => p.name_clean || p.name_raw).join(", ")}`);
    
    playersList.forEach(player => {
      const username = player.name_clean || player.name_raw || player.name || "Unknown";
      if (!username || username === "Unknown") return;
      if (username.toLowerCase() === "n-server") return;

      let playerActivity = activePlayersMap.get(username);
      
      if (!playerActivity) {
        playerActivity = {
          uuid: player.uuid || "",
          username: username,
          lastSeen: now.toISOString(),
          totalPlayHours: 0,
          // Private helper store play timestamps per date for calculations
          _playDates: {}
        };
        activePlayersMap.set(username, playerActivity);
      }

      // Update basic fields
      playerActivity.lastSeen = now.toISOString();
      playerActivity.uuid = player.uuid || playerActivity.uuid || "";
      
      // Initialize private dates mapping if missing
      if (!playerActivity._playDates) {
        playerActivity._playDates = {};
        // Seed old hours to avoid erasing their total play score if updating
        if (playerActivity.totalPlayHours > 0) {
          playerActivity._playDates[todayStr] = playerActivity.totalPlayHours;
        }
      }

      // Increment today's active play time
      const currentTodayPlay = playerActivity._playDates[todayStr] || 0;
      playerActivity._playDates[todayStr] = parseFloat((currentTodayPlay + elapsedHours).toFixed(3));
    });
  }

  // Recalculate 7d, 30d, 90d, and total playtimes for all tracked players
  const updatedPlayers = Array.from(activePlayersMap.values()).map(player => {
    const playDates = player._playDates || {};
    
    // Clean up play dates older than 90 days to keep JSON slim
    const keys = Object.keys(playDates);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    let totalPlayHours = 0;
    let playHoursToday = 0;
    let playHoursLast7Days = 0;
    let playHoursLast30Days = 0;
    let playHoursLast90Days = 0;

    keys.forEach(dateKey => {
      const entryDate = new Date(dateKey);
      const hoursValue = playDates[dateKey] || 0;
      
      if (entryDate < ninetyDaysAgo) {
        delete playDates[dateKey]; // prune
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

    // Make totals presentable with decimal rounding
    return {
      uuid: player.uuid,
      username: player.username,
      lastSeen: player.lastSeen,
      totalPlayHours: parseFloat(totalPlayHours.toFixed(1)),
      playHoursToday: parseFloat(playHoursToday.toFixed(3)),
      playHoursLast7Days: parseFloat(playHoursLast7Days.toFixed(1)),
      playHoursLast30Days: parseFloat(playHoursLast30Days.toFixed(1)),
      playHoursLast90Days: parseFloat(playHoursLast90Days.toFixed(1)),
      _playDates: playDates // Retain private map for the next run
    };
  });

  // Sort players list by last active or descendant playtime to present
  telemetry.players = updatedPlayers;
  telemetry.lastUpdated = now.toISOString();

  // Save telemetry to public assets file
  fs.writeFileSync(statsFilePath, JSON.stringify(telemetry, null, 2), "utf8");
  console.log(`Successfully completed tracking cycle. Statistics updated in: ${statsFilePath}`);
  console.log("=== Minecraft Server Telemetry Tracker Completed ===");
}

runTracker().catch(err => {
  console.error("Fatal error during tracking script runner:", err);
  process.exit(1);
});
