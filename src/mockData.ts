/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerTelemetry, HistoryRecord, PlayerActivity } from "./types";

// Generates daily records for the last 91 days
export function generateMockHistory(serverIp: string): ServerTelemetry {
  const history: HistoryRecord[] = [];
  const players: PlayerActivity[] = [];
  const now = new Date();

  // 1. Generate daily history (min, avg, max) with weekly seasonality (weekends are busier)
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateString = date.toISOString().split("T")[0];
    
    // Day of week: 0 = Sunday, 6 = Saturday
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Base multipliers
    const boost = isWeekend ? 1.4 : 1.0;
    const randomFactor = 0.85 + Math.random() * 0.3; // ±15% randomness

    const min = Math.round((5 + Math.random() * 5) * boost * randomFactor);
    const max = Math.round((35 + Math.random() * 20) * boost * randomFactor);
    const avg = Math.round(((min + max) / 2) * (0.9 + Math.random() * 0.2));

    history.push({
      date: dateString,
      min: Math.min(min, avg),
      max: Math.max(max, avg),
      avg,
    });
  }

  // 2. Generate players dataset (Top-60 players so we can show a robust top-50 active list)
  const playerFirstNames = [
    "Steve", "Alex", "Notch", "Herobrine", "CreepHunter", "DiamondDigger", "RedstonePro",
    "NetherFarer", "EnderVanquisher", "MinerX", "LapisLover", "CraftyCat", "BlockBuilder",
    "MelonFarmer", "PumpkinKing", "WitherSlayer", "GhastBlaster", "SkeletonSniper",
    "ZombieMashing", "SpiderClimber", "SlimeSplitter", "PhantomFlyer", "DolphinRider",
    "PandaTamer", "AxolotlWhisperer", "FoxInSocks", "BeeBkeeper", "PiglinTrader",
    "StriderRider", "BlazeBurner", "MagmaCube", "IronGolemMaster", "VillagerHelper",
    "WanderingMerchant", "IllagerHunter", "VexTerminator", "EvokerBuster", "RavagerRumble",
    "ShulkerSheller", "ElytraGlider", "BeaconLighter", "ConduitPower", "TridentTosser",
    "SpyglassSpy", "AmethystGeode", "CopperOxidizer", "GoatRammer", "FrogLeaper",
    "AllayFriend", "WardenWatch", "SnifferSnout", "CamelRider", "SherdCollector",
    "BreezeBreeze", "ArmadilloRoll", "BoggedBog", "TrialChamber", "WindCharge"
  ];

  const mcrand = (min: number, max: number) => Math.random() * (max - min) + min;

  playerFirstNames.forEach((name, idx) => {
    // Generate playtime curves (exponentially fewer highly active players, typical in gaming servers)
    const positionMultiplier = Math.pow(0.95, idx);
    const totalPlayHours = Math.round(mcrand(2, 180) * positionMultiplier);
    
    // Distribute hours logically across 7, 30, and 90 days
    const playHoursLast7Days = Math.min(
      totalPlayHours,
      Math.round(totalPlayHours * mcrand(0.1, 0.4))
    );
    const playHoursLast30Days = Math.min(
      totalPlayHours,
      playHoursLast7Days + Math.round((totalPlayHours - playHoursLast7Days) * mcrand(0.2, 0.6))
    );
    const playHoursLast90Days = totalPlayHours;

    // Distribute last seen timestamps
    let lastSeenDaysAgo = Math.pow(Math.random(), 3) * 60; // Bias towards being seen recently
    // Top active players seen very recently
    if (idx < 5) lastSeenDaysAgo = Math.random() * 0.2; // online today or in last few hours
    else if (idx < 15) lastSeenDaysAgo = Math.random() * 2; // last 2 days

    const lastSeenDate = new Date(now.getTime() - lastSeenDaysAgo * 24 * 60 * 60 * 1000);

    const playHoursToday = parseFloat((playHoursLast7Days * (Math.random() * 0.25)).toFixed(3));

    players.push({
      username: name,
      lastSeen: lastSeenDate.toISOString(),
      totalPlayHours,
      playHoursToday,
      playHoursLast7Days,
      playHoursLast30Days,
      playHoursLast90Days,
    });
  });

  // Sort players by descendant activity during last 30 days by default
  players.sort((a, b) => b.playHoursLast30Days - a.playHoursLast30Days);

  const todayIntervals = [];
  // Generate intervals for last 24 hours (every 20 minutes)
  for (let i = 72; i >= 0; i--) {
    const itemTime = new Date(now.getTime() - i * 20 * 60 * 1000);
    const hour = itemTime.getHours();
    
    // Daily swing simulation
    const wave = Math.cos((hour - 20) * Math.PI / 12); // ranges from -1 to 1
    const basePlayers = 15 + (wave + 1) * 12; // ranges from 15 to 39
    const noise = Math.floor(mcrand(-3, 4));
    const playersOnline = Math.max(0, Math.round(basePlayers + noise));

    todayIntervals.push({
      timestamp: itemTime.toISOString(),
      playersOnline
    });
  }

  return {
    serverIp,
    lastUpdated: now.toISOString(),
    history,
    players,
    todayIntervals,
  };
}

export const defaultMockData = generateMockHistory("mc.n-server.org");
