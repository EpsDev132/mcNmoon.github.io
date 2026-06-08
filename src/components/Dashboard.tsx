/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { ServerTelemetry, HistoryRecord } from "../types";
import { TrendingUp, Users, Clock, Award, Activity, Calendar } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface DashboardProps {
  telemetry: ServerTelemetry;
}

export default function Dashboard({ telemetry }: DashboardProps) {
  const [periodDays, setPeriodDays] = useState<number>(1); // default 1 days (today)

  // Filter history records based on selected timeframe
  const filteredHistory = useMemo(() => {
    if (periodDays === 1) {
      if (!telemetry.todayIntervals || telemetry.todayIntervals.length === 0) return [];
      return telemetry.todayIntervals.map(item => ({
        date: item.timestamp,
        max: item.playersOnline,
        avg: item.playersOnline,
        min: item.playersOnline
      }));
    }

    if (!telemetry.history || telemetry.history.length === 0) return [];
    
    // Sort oldest first for correct chronological charting
    const sorted = [...telemetry.history].sort((a, b) => a.date.localeCompare(b.date));
    
    return sorted.slice(-periodDays);
  }, [telemetry.history, telemetry.todayIntervals, periodDays]);

  // Compute stats metrics based on current filtered history
  const stats = useMemo(() => {
    const history = filteredHistory;
    if (history.length === 0) {
      return { max: 0, min: 0, avg: 0, sampleCount: 0 };
    }

    let absoluteMax = 0;
    let absoluteMin = Infinity;
    let sumAvg = 0;

    history.forEach(day => {
      if (day.max > absoluteMax) absoluteMax = day.max;
      if (day.min < absoluteMin) absoluteMin = day.min;
      sumAvg += day.avg;
    });

    return {
      max: absoluteMax,
      min: absoluteMin === Infinity ? 0 : absoluteMin,
      avg: Math.round(sumAvg / history.length),
      sampleCount: history.length
    };
  }, [filteredHistory]);

  const filteredPlayers = useMemo(() => {
    if (!telemetry.players) return [];
    return telemetry.players.filter(p => p.username.toLowerCase() !== "n-server");
  }, [telemetry.players]);

  const totalTrackedPlayers = filteredPlayers.length;
  
  const totalCombinedHours = useMemo(() => {
    const sum = filteredPlayers.reduce((sum, p) => sum + p.totalPlayHours, 0);
    return Math.round(sum);
  }, [filteredPlayers]);

  // Nice date formatter for chart X-Axis
  const formatChartDate = (dateStr: string) => {
    try {
      if (periodDays === 1) {
        // Format ISO timestamp, e.g. "2026-06-07T12:30:00.000Z" to Local Time "12:30"
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        // Return DD.MM format
        return `${parts[2]}.${parts[1]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Custom tooltips aligned with theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isToday = periodDays === 1;
      let labelText = label;
      if (isToday) {
        try {
          const d = new Date(label);
          labelText = d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
          labelText = label;
        }
      }

      return (
        <div className="bg-gray-900 text-white p-4 rounded-lg border border-gray-800 shadow-xl font-sans text-xs space-y-1.5 leading-tight">
          <p className="font-bold text-gray-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>{isToday ? "Метка времени" : "Дата"}: {labelText}</span>
          </p>
          {isToday ? (
            <p className="text-blue-400 font-semibold flex justify-between gap-6">
              <span>Онлайн игроков:</span>
              <span className="text-white font-mono font-bold">{payload[0]?.value ?? 0}</span>
            </p>
          ) : (
            <>
              <p className="text-blue-400 font-semibold flex justify-between gap-6">
                <span>Макс. онлайн:</span>
                <span className="text-white font-mono font-bold">{payload[0]?.value ?? 0}</span>
              </p>
              <p className="text-gray-300 font-semibold flex justify-between gap-6">
                <span>Сред. онлайн:</span>
                <span className="text-white font-mono font-bold">{payload[1]?.value ?? 0}</span>
              </p>
              <p className="text-gray-400 font-semibold flex justify-between gap-6">
                <span>Мин. онлайн:</span>
                <span className="text-white font-mono font-bold">{payload[2]?.value ?? 0}</span>
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Timeframe selector header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-gray-200 p-6 rounded-xl shadow-sm gap-4">
        <div>
          <h2 className="text-xs font-bold text-gray-405 uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <Activity className="w-4.5 h-4.5 text-gray-500" />
            <span>Интерактивная статистика</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            История онлайна по дням: зафиксированные пики, минимумы и средний онлайн
          </p>
        </div>

        <div className="flex flex-wrap bg-gray-50 border border-gray-200 p-1 rounded-lg shrink-0 gap-1 sm:gap-0">
          <button
            id="period-1-btn"
            onClick={() => setPeriodDays(1)}
            className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              periodDays === 1
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Сегодня
          </button>
          <button
            id="period-7-btn"
            onClick={() => setPeriodDays(7)}
            className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              periodDays === 7
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Неделя
          </button>
          <button
            id="period-30-btn"
            onClick={() => setPeriodDays(30)}
            className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              periodDays === 30
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            1 месяц
          </button>
          <button
            id="period-60-btn"
            onClick={() => setPeriodDays(60)}
            className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              periodDays === 60
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            2 месяца
          </button>
          <button
            id="period-90-btn"
            onClick={() => setPeriodDays(90)}
            className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              periodDays === 90
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            3 месяца
          </button>
        </div>
      </div>

      {/* Grid of critical overview metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-600 shrink-0 shadow-sm">
            <TrendingUp className="w-5 h-5 text-gray-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Пиковый онлайн</p>
            <h4 id="peak-online-stat" className="text-3xl font-light text-gray-900 mt-1 tracking-tight">
              {stats.max} <span className="text-xs text-gray-400 font-sans font-medium">игр.</span>
            </h4>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-600 shrink-0 shadow-sm">
            <Activity className="w-5 h-5 text-gray-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Средний онлайн</p>
            <h4 id="avg-online-stat" className="text-3xl font-light text-gray-900 mt-1 tracking-tight">
              {stats.avg} <span className="text-xs text-gray-400 font-sans font-medium">игр.</span>
            </h4>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-600 shrink-0 shadow-sm">
            <Users className="w-5 h-5 text-gray-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Всего игроков</p>
            <h4 id="active-players-stat" className="text-3xl font-light text-gray-900 mt-1 tracking-tight">
              {totalTrackedPlayers} <span className="text-xs text-gray-400 font-sans font-medium">уник.</span>
            </h4>
          </div>
        </div>
      </div>

      {/* Main charting card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <span>График посещаемости</span>
          <span className="normal-case text-gray-400 font-normal">
            ({periodDays === 1 ? `${filteredHistory.length} точек замера` : `${filteredHistory.length} дн. записано`})
          </span>
        </h3>

        {filteredHistory.length === 0 ? (
          <div className="py-24 border border-dashed border-gray-200 rounded-lg text-center text-gray-400 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Начало сбора статистики</p>
              <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 px-4 leading-relaxed">
                База данных мониторинга пуста или только что была сброшена. Нажмите кнопку <strong>«Опросить сейчас»</strong> слева на панели управления, чтобы произвести мгновенный опрос сервера и зафиксировать первые реальные показатели, либо подождите до автоматического срабатывания интервала опроса (каждые 2 минуты).
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[360px] w-full text-gray-600 font-sans select-none my-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredHistory}
                margin={{ top: 10, right: 10, left: -24, bottom: 0 }}
                style={{ outline: "none" }}
                className="outline-none"
              >
                <defs>
                  {/* Minimalistic gradients */}
                  <linearGradient id="colorMax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.06}/>
                    <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e5e7eb" stopOpacity={0.02}/>
                    <stop offset="95%" stopColor="#e5e7eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  tickLine={false}
                  axisLine={{ stroke: "#f3f4f6", strokeWidth: 1.2 }}
                  style={{ fontSize: "10px", fontWeight: "600", fill: "#9ca3af", fontFamily: "monospace" }}
                  dy={10}
                />
                
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: "#f3f4f6", strokeWidth: 1.2 }}
                  style={{ fontSize: "10px", fontWeight: "600", fill: "#9ca3af" }}
                  dx={-5}
                />
                
                <Tooltip content={<CustomTooltip />} />
                
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconSize={8}
                  iconType="circle"
                  style={{ fontSize: "11px", fontWeight: "600" }}
                  wrapperStyle={{ paddingBottom: "20px", color: "#6b7280" }}
                />

                {periodDays === 1 ? (
                  <Area
                    type="monotone"
                    name="Онлайн игроков"
                    dataKey="max"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMax)"
                    connectNulls
                  />
                ) : (
                  <>
                    <Area
                      type="monotone"
                      name="Максимальный онлайн"
                      dataKey="max"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorMax)"
                      connectNulls
                    />
                    
                    <Area
                      type="monotone"
                      name="Средний онлайн"
                      dataKey="avg"
                      stroke="#9ca3af"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAvg)"
                      connectNulls
                    />

                    <Area
                      type="monotone"
                      name="Минимальный онлайн"
                      dataKey="min"
                      stroke="#e5e7eb"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#colorMin)"
                      connectNulls
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
