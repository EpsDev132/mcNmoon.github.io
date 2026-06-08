/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MCPlayer {
  uuid?: string;
  name_clean: string;
}

export interface MCStatusResponse {
  online: boolean;
  host: string;
  port: number;
  ip_address?: string;
  version?: {
    name_clean: string;
    protocol: number;
  };
  players?: {
    online: number;
    max: number;
    list?: MCPlayer[];
  };
  motd?: {
    clean: string;
    html: string;
  };
  icon?: string; // Base64 png data
}

export interface HistoryRecord {
  date: string; // YYYY-MM-DD
  min: number;
  avg: number;
  max: number;
}

export interface TodayIntervalRecord {
  timestamp: string; // ISO String
  playersOnline: number;
}

export interface PlayerActivity {
  uuid?: string;
  username: string;
  lastSeen: string; // ISO String
  totalPlayHours: number;
  playHoursToday: number;
  playHoursLast7Days: number;
  playHoursLast30Days: number;
  playHoursLast90Days: number;
}

export interface ServerTelemetry {
  serverIp: string;
  lastUpdated: string; // ISO String
  history: HistoryRecord[];
  players: PlayerActivity[];
  todayIntervals?: TodayIntervalRecord[];
}
