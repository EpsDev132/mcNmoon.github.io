/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { MCStatusResponse } from "../types";
import { Wifi, WifiOff, Users, Server, Search, RefreshCw, AlertCircle, Copy, Check, Shield } from "lucide-react";
import { CONFIG } from "../config";

interface LiveStatusProps {
  initialIp: string;
  onIpTrackingChange?: (newIp: string) => void;
  isTrackingIp: boolean;
}

export default function LiveStatus({ initialIp, onIpTrackingChange, isTrackingIp }: LiveStatusProps) {
  const [ipInput, setIpInput] = useState(initialIp);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<MCStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const modNicknames = useMemo(() => {
    return (CONFIG.moderators || []).map(m => m.toLowerCase());
  }, []);

  const onlinePlayersFiltered = useMemo(() => {
    if (!status?.players?.list) return [];
    return status.players.list.filter(p => {
      const username = p.name_clean || "";
      return username.toLowerCase() !== "n-server";
    });
  }, [status?.players?.list]);

  const onlinePlayersSorted = useMemo(() => {
    return [...onlinePlayersFiltered].sort((a, b) => {
      const aName = (a.name_clean || "").toLowerCase();
      const bName = (b.name_clean || "").toLowerCase();
      const isAMod = modNicknames.includes(aName) ? 1 : 0;
      const isBMod = modNicknames.includes(bName) ? 1 : 0;
      return isBMod - isAMod; // Moderators first!
    });
  }, [onlinePlayersFiltered, modNicknames]);

  const activeOnlineCount = useMemo(() => {
    if (!status?.players) return 0;
    const baseCount = status.players.online;
    if (!status.players.list) return baseCount;
    const hasNServer = status.players.list.some(p => (p.name_clean || "").toLowerCase() === "n-server");
    return hasNServer ? Math.max(0, baseCount - 1) : baseCount;
  }, [status?.players]);

  // Sync with main app configured IP
  useEffect(() => {
    setIpInput(initialIp);
    queryServer(initialIp);
  }, [initialIp]);

  async function queryServer(ipToQuery: string) {
    if (!ipToQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(ipToQuery.trim())}`);
      if (!response.ok) {
        throw new Error(`Ошибка сервиса (Код ${response.status})`);
      }
      const data: MCStatusResponse = await response.json();
      setStatus(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Не удалось связаться с сервером статуса. Проверьте подключение к интернету.");
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    queryServer(ipInput);
  };

  const copyIp = () => {
    navigator.clipboard.writeText(ipInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <form onSubmit={handleSearch} className="flex gap-2.5 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
          <input
            id="mc-server-ip-input"
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="Введите IP Minecraft сервера (например, mc.n-server.org)..."
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50/80 border border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-200 placeholder:text-gray-400 text-sm font-medium rounded-lg transition-all focus:outline-none"
          />
        </div>
        <button
          id="query-server-btn"
          type="submit"
          disabled={loading}
          className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 text-white font-medium text-sm px-5 rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <span>Проверить</span>
          )}
        </button>
      </form>

      {error && (
        <div className="flex gap-3 items-start bg-rose-50 text-rose-700 p-4 rounded-lg border border-rose-100 mb-6 font-medium">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Произошла ошибка при запросе:</p>
            <p className="text-xs mt-0.5 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {loading && !status && (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
          <p className="text-xs font-semibold uppercase tracking-wider">Запрос данных с mcstatus.io...</p>
        </div>
      )}

      {status && (
        <div className="space-y-6">
          {/* Header information card */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-gray-50/50 border border-gray-100 rounded-xl gap-4">
            <div className="flex items-center gap-4">
              {status.icon ? (
                <img
                  src={status.icon}
                  alt="Server icon"
                  className="w-14 h-14 rounded-lg border border-gray-200 shadow-inner bg-gray-800 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-800 flex items-center justify-center text-white shrink-0 shadow-inner">
                  <Server className="w-6 h-6 opacity-60" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="live-server-title" className="text-lg font-bold text-gray-900 tracking-tight">{status.host}</h3>
                  <button
                    id="copy-ip-btn"
                    onClick={copyIp}
                    className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors"
                    title="Копировать IP"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                  <span>IP: {status.ip_address || "Определяется"}</span>
                  {status.port && status.port !== 25565 && <span>:{status.port}</span>}
                </p>
                {status.version && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 bg-gray-200/50 text-gray-600 font-mono text-[10px] rounded font-semibold">
                    Версия: {status.version.name_clean}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              {status.online ? (
                <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ring-1 ring-green-600/10">
                  <Wifi className="w-3.5 h-3.5" /> В СЕТИ
                </span>
              ) : (
                <span className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ring-1 ring-red-600/10">
                  <WifiOff className="w-3.5 h-3.5" /> ВЫКЛЮЧЕН
                </span>
              )}

              {onIpTrackingChange && (
                <button
                  id="set-tracking-ip-btn"
                  onClick={() => onIpTrackingChange(status.host)}
                  disabled={isTrackingIp}
                  className={`mt-2.5 text-[10px] uppercase tracking-wider px-2.5 py-1 text-gray-600 font-bold border rounded transition-all cursor-pointer ${
                    isTrackingIp
                      ? "bg-gray-100 text-gray-400 border-gray-200"
                      : "bg-white hover:bg-gray-50 border-gray-200 active:scale-95 shadow-sm"
                  }`}
                >
                  {isTrackingIp ? "Активный сервер" : "Отслеживать"}
                </button>
              )}
            </div>
          </div>

          {/* MOTD box */}
          {status.online && status.motd && (
            <div className="p-4 bg-gray-950 rounded-xl font-mono text-xs text-gray-200 border border-gray-800 leading-relaxed shadow-sm">
              <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1 tracking-wider">Описание (MOTD)</span>
              {status.motd.html ? (
                <div
                  dangerouslySetInnerHTML={{ __html: status.motd.html }}
                  className="mc-motd whitespace-pre-wrap leading-tight text-xs tracking-wide text-left"
                />
              ) : (
                <div className="whitespace-pre-wrap">{status.motd.clean}</div>
              )}
            </div>
          )}

          {/* Player statistics */}
          {status.online && status.players && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50/50 p-4 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-2 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>Игроки онлайн</span>
                </div>
                <span className="text-gray-900 font-bold text-sm bg-white border border-gray-200 px-3 py-1 rounded-lg shadow-sm">
                  {activeOnlineCount} / {status.players.max}
                </span>
              </div>

              {/* Player names lists with custom skin support */}
              {onlinePlayersFiltered.length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Список игроков ({onlinePlayersFiltered.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {onlinePlayersSorted.map((player, idx) => {
                      const username = player.name_clean;
                      const isMod = modNicknames.includes(username.toLowerCase());
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm ${
                            isMod
                              ? "bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 ring-1 ring-amber-200 hover:border-amber-400 scale-[1.02] relative"
                              : "bg-white border border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <img
                            src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/32`}
                            alt={username}
                            className="w-5 h-5 rounded shadow-sm shrink-0"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://minotar.net/helm/${encodeURIComponent(username)}/32.png`;
                            }}
                          />
                          <span
                            className={`text-xs font-semibold truncate ${
                              isMod ? "text-amber-800 font-bold" : "text-gray-800"
                            }`}
                            title={username}
                          >
                            {username}
                          </span>
                          {isMod && (
                            <Shield className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 shrink-0 ml-auto" title="Модератор" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeOnlineCount > 0 ? (
                <div className="p-4 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 text-center text-gray-400 text-xs">
                  Сервер скрывает список игроков (настройки query выключены). Текущий онлайн: {activeOnlineCount}
                </div>
              ) : (
                <div className="p-4 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 text-center text-gray-400 text-xs">
                  На сервере никого нет. Пригласите друзей!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
