/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { ServerTelemetry, PlayerActivity } from "../types";
import { Download, Search, Award, Clock, ArrowUpDown, Calendar, HelpCircle, Shield, Users } from "lucide-react";
import { CONFIG } from "../config";

interface LeaderboardProps {
  telemetry: ServerTelemetry;
}

export default function Leaderboard({ telemetry }: LeaderboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [period, setPeriod] = useState<"1d" | "7d" | "30d" | "90d" | "total">("30d");
  const [leaderboardType, setLeaderboardType] = useState<"players" | "moderators">("players");

  // Format relative last seen timestamp in Russian
  const formatLastSeen = (timestampStr: string) => {
    if (!timestampStr) return "Никогда";
    try {
      const lastSeenDate = new Date(timestampStr);
      const now = new Date();
      const diffMs = now.getTime() - lastSeenDate.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return "Только что";
      if (diffMinutes < 60) {
        // Handle minutes endings
        const minMod = diffMinutes % 10;
        if (minMod === 1 && diffMinutes !== 11) return `${diffMinutes} минуту назад`;
        if (minMod >= 2 && minMod <= 4 && (diffMinutes < 10 || diffMinutes > 20)) return `${diffMinutes} минуты назад`;
        return `${diffMinutes} минут назад`;
      }
      if (diffHours < 24) {
        // Handle hours endings
        const hourMod = diffHours % 10;
        if (hourMod === 1 && diffHours !== 11) return `${diffHours} час назад`;
        if (hourMod >= 2 && hourMod <= 4 && (diffHours < 10 || diffHours > 20)) return `${diffHours} часа назад`;
        return `${diffHours} часов назад`;
      }
      if (diffDays === 1) {
        const timeStr = lastSeenDate.toTimeString().split(" ")[0].substring(0, 5);
        return `Вчера в ${timeStr}`;
      }
      if (diffDays === 2) {
        const timeStr = lastSeenDate.toTimeString().split(" ")[0].substring(0, 5);
        return `Позавчера в ${timeStr}`;
      }
      // Handle days endings
      const dayMod = diffDays % 10;
      if (dayMod === 1 && diffDays !== 11) return `${diffDays} день назад`;
      if (dayMod >= 2 && dayMod <= 4 && (diffDays < 10 || diffDays > 20)) return `${diffDays} дня назад`;
      return `${diffDays} дней назад`;
    } catch {
      return "Ранее";
    }
  };

  // 1. Sort and filter players list
  const processedPlayers = useMemo(() => {
    const modNicknames = (CONFIG.moderators || []).map(m => m.toLowerCase());

    if (leaderboardType === "moderators") {
      // Build moderators list, preloaded with all configured moderators at 0.0h if not yet active
      const modPlayersMap = new Map<string, PlayerActivity>();

      (CONFIG.moderators || []).forEach(name => {
        const cleanName = name.trim();
        if (cleanName && cleanName.toLowerCase() !== "n-server") {
          modPlayersMap.set(cleanName.toLowerCase(), {
            username: cleanName,
            lastSeen: "",
            totalPlayHours: 0,
            playHoursToday: 0,
            playHoursLast7Days: 0,
            playHoursLast30Days: 0,
            playHoursLast90Days: 0,
          });
        }
      });

      // Merge with actual telemetry data if exists
      if (telemetry.players) {
        telemetry.players.forEach(p => {
          if (p.username.toLowerCase() !== "n-server" && modNicknames.includes(p.username.toLowerCase())) {
            modPlayersMap.set(p.username.toLowerCase(), p);
          }
        });
      }

      let list = Array.from(modPlayersMap.values());

      // Filter by search username (case insensitive)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        list = list.filter(p => p.username.toLowerCase().includes(term));
      }

      // Sort descending by selected timeframe playing hours
      list.sort((a, b) => {
        const valA =
          period === "1d" ? a.playHoursToday :
          period === "7d" ? a.playHoursLast7Days :
          period === "30d" ? a.playHoursLast30Days :
          period === "90d" ? a.playHoursLast90Days : a.totalPlayHours;
        const valB =
          period === "1d" ? b.playHoursToday :
          period === "7d" ? b.playHoursLast7Days :
          period === "30d" ? b.playHoursLast30Days :
          period === "90d" ? b.playHoursLast90Days : b.totalPlayHours;
        return valB - valA;
      });

      return list;
    } else {
      if (!telemetry.players) return [];

      // Show general players ONLY (excluding moderators and N-server)
      let list = telemetry.players.filter(p => {
        const lowerName = p.username.toLowerCase();
        return lowerName !== "n-server" && !modNicknames.includes(lowerName);
      });

      // Filter by search username (case insensitive)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        list = list.filter(p => p.username.toLowerCase().includes(term));
      }

      // Sort descending by selected timeframe playing hours
      list.sort((a, b) => {
        const valA =
          period === "1d" ? a.playHoursToday :
          period === "7d" ? a.playHoursLast7Days :
          period === "30d" ? a.playHoursLast30Days :
          period === "90d" ? a.playHoursLast90Days : a.totalPlayHours;
        const valB =
          period === "1d" ? b.playHoursToday :
          period === "7d" ? b.playHoursLast7Days :
          period === "30d" ? b.playHoursLast30Days :
          period === "90d" ? b.playHoursLast90Days : b.totalPlayHours;
        return valB - valA;
      });

      // Take top 50
      return list.slice(0, 50);
    }
  }, [telemetry.players, searchTerm, period, leaderboardType]);

  // Export report of Top-50 active players to CSV
  const exportToCSV = () => {
    if (processedPlayers.length === 0) return;

    let csvContent = "\uFEFF"; // UTF-8 BOM for correct Excel encoding
    csvContent += "Ранг,Никнейм,Сыграно Часов (" + 
      (period === "1d" ? "Сегодня" : period === "7d" ? "7 Дней" : period === "30d" ? "30 Дней" : period === "90d" ? "90 Дней" : "Все Время") + 
      "),Последний Разделенный Визит (UTC),Статус за выбранный период\n";

    processedPlayers.forEach((player, idx) => {
      const activeHours = 
        period === "1d" ? player.playHoursToday :
        period === "7d" ? player.playHoursLast7Days :
        period === "30d" ? player.playHoursLast30Days :
        period === "90d" ? player.playHoursLast90Days : player.totalPlayHours;

      csvContent += `${idx + 1},${player.username},${activeHours},${player.lastSeen || "Н/Д"},${activeHours > 0 ? "Активен" : "Неактивен"}\n`;
    });

    // Create file trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mc_leaderboard_${telemetry.serverIp}_${period}_top50.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const periodLabel = {
    "1d": "сегодня",
    "7d": "7 дней",
    "30d": "30 дней",
    "90d": "90 дней",
    "total": "всё время"
  }[period];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
      {/* Top filter Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            {leaderboardType === "moderators" ? (
              <>
                <Shield className="w-4.5 h-4.5 text-amber-500" />
                <span>Рейтинг активности модераторов</span>
              </>
            ) : (
              <>
                <Award className="w-4.5 h-4.5 text-gray-500" />
                <span>Рейтинг активности игроков (Топ-50)</span>
              </>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {leaderboardType === "moderators"
              ? `Сводная статистика игрового времени состава модерации на сервере ${telemetry.serverIp}`
              : `Сортировка по количеству часов игры на сервере ${telemetry.serverIp} за выбранный диапазон`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <div className="flex bg-gray-50 border border-gray-200 p-1 rounded-lg text-xs">
            <button
              id="period-1d-btn"
              onClick={() => setPeriod("1d")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === "1d" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Сегодня
            </button>
            <button
              id="period-7d-btn"
              onClick={() => setPeriod("7d")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === "7d" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              7 дн.
            </button>
            <button
              id="period-30d-btn"
              onClick={() => setPeriod("30d")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === "30d" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              30 дн.
            </button>
            <button
              id="period-90d-btn"
              onClick={() => setPeriod("90d")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === "90d" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              90 дн.
            </button>
            <button
              id="period-total-btn"
              onClick={() => setPeriod("total")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === "total" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Всё время
            </button>
          </div>

          <button
            id="export-csv-btn"
            onClick={exportToCSV}
            disabled={processedPlayers.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Экспорт CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Players vs Moderators Leaderboard Choice */}
      <div className="flex border-b border-gray-200">
        <button
          id="leaderboard-players-tab"
          onClick={() => setLeaderboardType("players")}
          className={`cursor-pointer flex items-center gap-2 px-6 py-2.5 border-b-2 font-bold text-xs transition-all uppercase tracking-wider ${
            leaderboardType === "players"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Игроки</span>
        </button>
        <button
          id="leaderboard-moderators-tab"
          onClick={() => setLeaderboardType("moderators")}
          className={`cursor-pointer flex items-center gap-2 px-6 py-2.5 border-b-2 font-bold text-xs transition-all uppercase tracking-wider ${
            leaderboardType === "moderators"
              ? "border-amber-500 text-amber-700 bg-amber-50/20"
              : "border-transparent text-gray-400 hover:text-gray-650"
          }`}
        >
          <Shield className="w-4 h-4 text-amber-500" />
          <span>Модераторы</span>
        </button>
      </div>

      {/* Search filter input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          id="player-search-input"
          type="text"
          placeholder={leaderboardType === "moderators" ? "Поиск модератора по никнейму..." : "Поиск игрока по никнейму на сервере..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50/80 border border-gray-200 focus:border-gray-450 placeholder:text-gray-400 text-xs font-medium rounded-lg focus:outline-none transition-all"
        />
      </div>

      {/* Leaderboard Table */}
      {processedPlayers.length === 0 ? (
        <div className="py-20 border border-dashed border-gray-200 rounded-lg text-center text-gray-400 text-xs px-4">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">Рейтинг пока пуст</p>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto leading-relaxed">
            Игроки с активностью за период "{periodLabel}" не найдены. Как только игроки зайдут на сервер и система зафиксирует их онлайн (при автоматическом фоновом мониторинге или ручном запуске), здесь начнется аккумулирование и детальный расчет их игрового времени!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse text-left text-xs text-gray-650">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-16 text-center">Ранг</th>
                <th className="py-3.5 px-4 min-w-[200px]">Никнейм</th>
                <th className="py-3.5 px-4 w-40 text-center">Last Seen (Активность)</th>
                <th className="py-3.5 px-4 w-40 text-right">Наиграно за {periodLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {processedPlayers.map((player, idx) => {
                const playTime =
                  period === "1d" ? player.playHoursToday :
                  period === "7d" ? player.playHoursLast7Days :
                  period === "30d" ? player.playHoursLast30Days :
                  period === "90d" ? player.playHoursLast90Days : player.totalPlayHours;

                // Color rank numbers for top 3
                let rankStyle = "text-gray-500 bg-gray-50 border border-gray-100";
                if (idx === 0) rankStyle = "text-amber-800 bg-amber-50 border border-amber-200/50 shadow-inner";
                if (idx === 1) rankStyle = "text-slate-800 bg-slate-50 border border-slate-200 shadow-inner";
                if (idx === 2) rankStyle = "text-orange-850 bg-orange-50 border border-orange-200/50 shadow-inner";

                return (
                  <tr key={player.username} className="hover:bg-gray-50/40 transition-colors">
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${rankStyle}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/32`}
                          alt={player.username}
                          className="w-6 h-6 rounded border border-gray-200 bg-gray-50 shadow-sm shrink-0 font-sans"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://minotar.net/helm/${encodeURIComponent(player.username)}/32.png`;
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900 text-sm leading-tight">{player.username}</p>
                            {leaderboardType === "moderators" && (
                              <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                <Shield className="w-2.5 h-2.5 text-amber-500 fill-amber-500/10" />
                                Мод
                              </span>
                            )}
                          </div>
                          
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-gray-600 font-medium">{formatLastSeen(player.lastSeen)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 font-bold font-mono text-gray-800 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md shadow-sm">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{playTime.toFixed(1)}ч</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
