/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ServerTelemetry } from "./types";
import { defaultMockData, generateMockHistory } from "./mockData";
import LiveStatus from "./components/LiveStatus";
import Dashboard from "./components/Dashboard";
import Leaderboard from "./components/Leaderboard";
import ActionGuide from "./components/ActionGuide";
import { CONFIG } from "./config";

import {
  Activity,
  Award,
  BookOpen,
  CloudLightning,
  Database,
  Download,
  FileCode,
  Globe,
  RefreshCw,
  Settings,
  Shield,
  Upload,
  Wifi,
  CheckCircle2,
  XCircle,
  Info
} from "lucide-react";

export default function App() {
  const [telemetry, setTelemetry] = useState<ServerTelemetry>(defaultMockData);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "leaderboard" | "checker" | "guide">("dashboard");
  const [loading, setLoading] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Trigger stylish notifications in-app (non-blocking)
  const triggerNotification = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  // Load telemetry from backend
  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      console.group("🧭 Minecraft Server Monitor: Initialization Diagnostics");
      try {
        const origin = window.location.origin;
        let pName = window.location.pathname;
        
        // Dynamic path sanitization for SPA routing and static hosts
        if (pName.endsWith(".html") || pName.endsWith(".php") || pName.endsWith(".htm")) {
          pName = pName.substring(0, pName.lastIndexOf("/") + 1);
        }
        if (!pName.endsWith("/")) {
          pName = pName + "/";
        }
        
        const absoluteUrl = `${origin}${pName}mc-stats.json`;
        console.log("Calculated canonical stats URL:", absoluteUrl);
        
        // We will try in order: Absolute computed URL, Relative subpath, and general fallback
        const urlsToTry = [
          absoluteUrl,
          "mc-stats.json"
        ];
        
        let loadedData: ServerTelemetry | null = null;
        for (const url of urlsToTry) {
          try {
            console.log(`Attempting stats load from URL: "${url}"`);
            const response = await fetch(url, { cache: "no-store" });
            console.log(`Fetch outcome for "${url}": Status Code ${response.status} (${response.statusText})`);
            
            if (response.ok) {
              const data: ServerTelemetry = await response.json();
              console.log("Parsed telemetry response structure:", data);
              if (data && data.serverIp && data.history) {
                loadedData = data;
                console.log(`✅ MATCH SUCCESS: Valid production telemetry loaded for server IP: "${data.serverIp}"!`);
                break;
              } else {
                console.warn("⚠️ MATCH WARNING: Structure inside JSON didn't contain required telemetry properties ('serverIp' and 'history'). Schema:", data);
              }
            } else {
              console.log(`❌ FETCH REJECTION: File not accessible. Status: ${response.status}`);
            }
          } catch (e) {
            console.warn(`⏳ FETCH EXCEPTION for "${url}":`, e);
          }
        }

        if (loadedData) {
          setTelemetry(loadedData);
          setIsDemoMode(false);
          console.log(`Success! Settled telemetry monitoring target to: ${loadedData.serverIp}`);
        } else {
          console.log("No custom or production mc-stats.json was found in the public folder. Falling back to default simulation dataset.");
        }
      } catch (err) {
        console.error("Critical exception caught during loadStats execution phase:", err);
      } finally {
        console.groupEnd();
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // Force actual background poll in real-time
  const handleForcePoll = async () => {
    setIsPolling(true);
    console.group("🔍 Minecraft Server Monitor: Live Polling Diagnostics");
    console.log("Starting forced live poll...");
    try {
      let isBackendOk = false;
      let resultData: any = null;

      const isGitHubPages = window.location.hostname.endsWith("github.io");
      console.log("Environment: ", {
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        isGitHubPages,
        currentTrackingIp: telemetry.serverIp
      });

      // 1. First attempt: Try to call local Express backend endpoint ONLY if not on static GitHub Pages
      if (!isGitHubPages) {
        console.log("Not on GitHub Pages. Attempting to trigger local Express backend API /api/poll...");
        try {
          const res = await fetch("/api/poll", { method: "POST" });
          console.log("Express backend response metadata:", { status: res.status, ok: res.ok });
          if (res.ok) {
            resultData = await res.json();
            console.log("Express backend response body parsed:", resultData);
            if (resultData && resultData.success) {
              isBackendOk = true;
            }
          }
        } catch (backendErr) {
          console.warn("Express backend API request threw network error (normal if on statics):", backendErr);
        }
      } else {
        console.log("Skipping Express backend API /api/poll proactively (static GitHub Pages detected).");
      }

      if (isBackendOk && resultData && resultData.success) {
        setTelemetry(resultData.telemetry);
        setIsDemoMode(false);
        console.log("Successfully updated telemetry via custom Express backend!");
        triggerNotification("Опрос сервера успешно произведен через бэкенд! Данные обновлены в реальном времени.", "success");
        console.groupEnd();
        return;
      }

      // 2. Second attempt: Client-side direct poll from external public APIs (for static GitHub Pages)
      console.log("Executing direct client-side fallback polling with public API wrappers...");
      let statusHost: any = null;
      let isOnline = false;
      let onlineCount = 0;
      let playerList: any[] = [];

      // Try API 1: mcstatus.io
      try {
        const mcstatusUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(telemetry.serverIp)}`;
        console.log(`Polling API 1: Fetching ${mcstatusUrl}`);
        const response = await fetch(mcstatusUrl);
        console.log("mcstatus.io response status:", response.status);
        if (response.ok) {
          const resJson = await response.json();
          console.log("mcstatus.io payload acquired:", resJson);
          statusHost = resJson;
          isOnline = !!resJson.online;
          onlineCount = isOnline ? (resJson.players?.online || 0) : 0;
          playerList = resJson.players?.list || [];
        }
      } catch (e) {
        console.warn("mcstatus.io request failed, will attempt mcsrvstat.us fallback. Error details:", e);
      }

      // Try API 2: mcsrvstat.us as a beautiful fallback
      if (statusHost === null) {
        try {
          const mcsrvstatUrl = `https://api.mcsrvstat.us/2/${encodeURIComponent(telemetry.serverIp)}`;
          console.log(`Polling API 2: Fetching ${mcsrvstatUrl}`);
          const response = await fetch(mcsrvstatUrl);
          console.log("mcsrvstat.us response status:", response.status);
          if (response.ok) {
            const resJson = await response.json();
            console.log("mcsrvstat.us payload acquired:", resJson);
            statusHost = resJson;
            isOnline = !!resJson.online;
            onlineCount = isOnline ? (resJson.players?.online || 0) : 0;
            playerList = resJson.players?.list || [];
          }
        } catch (e) {
          console.error("All direct polling APIs failed to execute. Error details:", e);
        }
      }

      if (statusHost !== null) {
        console.log("Raw player list parsed from API:", playerList);
        const now = new Date();
        
        // Shift to UTC+3 timezone for reset/daily boundary calculation
        const nowTz = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        const todayStr = nowTz.toISOString().split("T")[0]; // YYYY-MM-DD in UTC+3

        // PERFORM A DEEP CLONE to completely free ourselves from read-only/frozen objects in reactive state!
        console.log("Surgically cloning telemetry state to avoid immutable/frozen mutations...");
        const updatedTelemetry: ServerTelemetry = JSON.parse(JSON.stringify(telemetry));
        updatedTelemetry.lastUpdated = now.toISOString();

        // Update/create history slot safely
        if (!updatedTelemetry.history) {
          updatedTelemetry.history = [];
        }
        
        console.log("Calculating history slots for date:", todayStr);
        let historyEntry = updatedTelemetry.history.find(h => h.date === todayStr);
        if (!historyEntry) {
          console.log("No history entry existed for today. Creating a fresh entry.");
          historyEntry = {
            date: todayStr,
            min: onlineCount,
            avg: onlineCount,
            max: onlineCount,
          };
          updatedTelemetry.history.push(historyEntry);
        } else {
          console.log("Existing entry found. Adjusting boundaries with new data point:", onlineCount);
          historyEntry.min = Math.min(Number(historyEntry.min || 0), onlineCount);
          historyEntry.max = Math.max(Number(historyEntry.max || 0), onlineCount);
          historyEntry.avg = Math.round(((historyEntry.avg || 0) + onlineCount) / 2);
        }

        // Update/append granular intervals for "Today" chart
        if (!updatedTelemetry.todayIntervals) {
          updatedTelemetry.todayIntervals = [];
        }
        updatedTelemetry.todayIntervals.push({
          timestamp: now.toISOString(),
          playersOnline: onlineCount
        });
        
        const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
        updatedTelemetry.todayIntervals = updatedTelemetry.todayIntervals.filter((item: any) => {
          return new Date(item.timestamp).getTime() >= twentyFourHoursAgo;
        });

        // Track newly encountered players locally in the leaderboard
        if (isOnline && playerList.length > 0) {
          if (!updatedTelemetry.players) {
            updatedTelemetry.players = [];
          }
          const activeMap = new Map<string, any>(updatedTelemetry.players.map((p: any) => [p.username, p]));

          for (const onlinePlayer of playerList) {
            let username = "";
            if (typeof onlinePlayer === "string") {
              username = onlinePlayer;
            } else if (onlinePlayer && typeof onlinePlayer === "object") {
              username = onlinePlayer.name_clean || onlinePlayer.name_raw || onlinePlayer.name || "";
            }
            
            if (!username) continue;
            if (username.toLowerCase() === "n-server") continue;

            if (activeMap.has(username)) {
              const p = activeMap.get(username);
              p.lastSeen = now.toISOString();
            } else {
              console.log(`New player detected: "${username}". Registering with baseline values.`);
              updatedTelemetry.players.push({
                username,
                lastSeen: now.toISOString(),
                totalPlayHours: 0.1,
                playHoursToday: 0.1,
                playHoursLast7Days: 0.1,
                playHoursLast30Days: 0.1,
                playHoursLast90Days: 0.1,
              });
            }
          }
        }

        console.log("State updates finalized. Applying new deep cloned telemetry:", updatedTelemetry);
        setTelemetry(updatedTelemetry);
        setIsDemoMode(false);
        console.groupEnd();

        triggerNotification(
          `Опрос произведен напрямую из браузера!\n\n` +
          `• Сервер: ${telemetry.serverIp} (${isOnline ? "В СЕТИ" : "ВЫКЛЮЧЕН"})\n` +
          `• Онлайн игроков: ${onlineCount}\n\n` +
          `Этот замер сохранен в памяти браузера. Постоянный лог истории обновляется каждые 30 минут через GitHub Actions автоматически.`,
          "success"
        );
      } else {
        console.groupEnd();
        triggerNotification("Не удалось опросить сервер статуса напрямую из браузера через публичные API. Проверьте подключение к сети.", "error");
      }
    } catch (err: any) {
      console.error("Critical error in handleForcePoll handler:", err);
      console.groupEnd();
      triggerNotification(`Ошибка при опросе: ${err?.message || err || "Неизвестная ошибка"}.`, "error");
    } finally {
      setIsPolling(false);
    }
  };

  // Set the current Minecraft IP for monitoring and reset historical data if changed
  const handleTrackingIpChange = async (newIp: string) => {
    if (!newIp.trim()) return;

    const confirmation = window.confirm(
      `Вы действительно хотите переключить мониторинг на сервер "${newIp}"?\nЭто действие сбросит текущую историю графиков и начнет сохранение логов заново.`
    );

    if (confirmation) {
      setLoading(true);
      try {
        let isBackendOk = false;
        let resultData: any = null;

        try {
          const res = await fetch("/api/set-ip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ip: newIp.trim() })
          });
          if (res.ok) {
            resultData = await res.json();
            isBackendOk = true;
          }
        } catch (backendErr) {
          console.warn("Express backend /api is not available on static host, falling back locally.", backendErr);
        }

        if (isBackendOk && resultData && resultData.success) {
          setTelemetry(resultData.telemetry);
          setIsDemoMode(false);
        } else {
          // GitHub Pages static mode local fallback
          const freshStats: ServerTelemetry = {
            serverIp: newIp.trim(),
            lastUpdated: new Date().toISOString(),
            history: [],
            players: [],
            todayIntervals: []
          };
          setTelemetry(freshStats);
          setIsDemoMode(false);
          triggerNotification(
            `Сервер изменен на «${newIp.trim()}» в вашем браузере!\n\nРегулярный опрос GitHub Actions начнется после указания IP в MC_SERVER_IP в GitHub Secrets.`,
            "success"
          );
        }
      } catch (err) {
        console.error("Failed to update target IP, falling back locally", err);
        const freshStats: ServerTelemetry = {
          serverIp: newIp.trim(),
          lastUpdated: new Date().toISOString(),
          history: [],
          players: [],
          todayIntervals: []
        };
        setTelemetry(freshStats);
      } finally {
        setLoading(false);
        setActiveTab("dashboard");
      }
    }
  };

  // Allows injecting custom telemetry JSON file
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.serverIp && parsed.history) {
            setTelemetry(parsed);
            setIsDemoMode(false);
            triggerNotification("Файл статистики успешно импортирован локально!", "success");
          } else {
            triggerNotification("Ошибка: Неподдерживаемый формат JSON. Файл должен иметь формат mc-stats.", "error");
          }
        } catch (error) {
          triggerNotification("Не удалось прочитать загруженный файл JSON. Убедитесь в валидности структуры.", "error");
        }
      };
    }
  };

  // Exports the current telemetry state as mc-stats.json file
  const downloadTelemetryJson = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(telemetry, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", "mc-stats.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] text-gray-900 font-sans flex flex-col selection:bg-gray-200 selection:text-gray-900">
      
      {/* Banner indicating simulation demo mode to make things highly intuitive */}
      {isDemoMode && CONFIG.showDemoBanner && CONFIG.showGithubGuideTab && (
        <div className="bg-gray-900 text-gray-100 px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2 border-b border-gray-800 shadow-sm">
          <Database className="w-4 h-4 text-gray-400 opacity-90" />
          <span>Вы находитесь в демо-режиме с демонстрационными данными для сервера «{telemetry.serverIp}».</span>
          <button
            id="activate-tracking-btn"
            onClick={() => {
              setActiveTab("guide");
            }}
            className="underline hover:text-white cursor-pointer ml-1.5 transition-colors font-bold"
          >
            Узнать, как автоматизировать сбор для своего сервера →
          </button>
        </div>
      )}

      {/* Primary header navbar controls */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-gray-900 flex items-center justify-center text-white shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 tracking-wider uppercase">
                Minecraft Server Monitor
              </h1>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                Серверлесс Телеметрия &amp; Сводка Активности
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex bg-gray-50 border border-gray-200 p-1 rounded-lg text-xs font-bold text-gray-500">
              <button
                id="tab-dashboard"
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-1.5 cursor-pointer px-4 py-2 rounded text-xs font-medium transition-colors ${
                  activeTab === "dashboard"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "hover:text-gray-900"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Статистика</span>
              </button>
              <button
                id="tab-leaderboard"
                onClick={() => setActiveTab("leaderboard")}
                className={`flex items-center gap-1.5 cursor-pointer px-4 py-2 rounded text-xs font-medium transition-colors ${
                  activeTab === "leaderboard"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "hover:text-gray-900"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Активность игроков</span>
              </button>
              <button
                id="tab-checker"
                onClick={() => setActiveTab("checker")}
                className={`flex items-center gap-1.5 cursor-pointer px-4 py-2 rounded text-xs font-medium transition-colors ${
                  activeTab === "checker"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "hover:text-gray-900"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Опрос сервера</span>
              </button>
              {CONFIG.showGithubGuideTab && (
                <button
                  id="tab-guide"
                  onClick={() => setActiveTab("guide")}
                  className={`flex items-center gap-1.5 cursor-pointer px-4 py-2 rounded text-xs font-medium transition-colors ${
                    activeTab === "guide"
                      ? "bg-gray-900 text-white shadow-sm"
                      : "hover:text-gray-900"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Инструкция Гитхаб</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main body content area with fluid container constraints */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        
        {/* Quick telemetry controller widget sidebar component */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          
          <div className="w-full md:w-64 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-5 shrink-0">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Отслеживаемый сервер</p>
              <h3 className="text-base font-bold text-gray-900 break-all mt-1">{telemetry.serverIp}</h3>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                Обновлено: {new Date(telemetry.lastUpdated).toLocaleDateString()} в {new Date(telemetry.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
              <button
                id="force-poll-btn"
                onClick={handleForcePoll}
                disabled={isPolling}
                className="w-full mt-3.5 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 text-white font-semibold text-xs rounded shadow-sm hover:bg-gray-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? "animate-spin" : ""}`} />
                <span>{isPolling ? "Опрос..." : "Опросить сейчас"}</span>
              </button>
            </div>

            <hr className="border-gray-100" />

            <div className="space-y-2.5">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Управление данными</p>
              
              <button
                id="download-telemetry-btn"
                onClick={downloadTelemetryJson}
                className="w-full flex items-center justify-between text-left px-3.5 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-semibold text-xs rounded shadow-sm transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-gray-400" />
                  <span>Скачать mc-stats.json</span>
                </span>
              </button>

              <label
                id="upload-telemetry-label"
                className="w-full flex items-center justify-between text-left px-3.5 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-semibold text-xs rounded shadow-sm transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span>Загрузить свой JSON</span>
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJsonUpload}
                  className="hidden"
                />
              </label>
            </div>

            <hr className="border-gray-100" />

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-[11px] text-gray-600 leading-relaxed font-semibold">
              <p className="font-bold flex items-center gap-1.5 text-gray-900 mb-1.5">
                <CloudLightning className="w-4 h-4 text-gray-400" />
                <span>Как это работает?</span>
              </p>
              Скрипт GitHub Actions периодически делает запрос к серверу и фиксирует состояние. Графики плавно обновляются при каждом автоматическом пуше данных в ваш репозиторий!
            </div>
          </div>

          {/* Active view panels according to selected tab index status */}
          <div className="flex-1 w-full space-y-6">
            
            {activeTab === "dashboard" && (
              <Dashboard telemetry={telemetry} />
            )}

            {activeTab === "leaderboard" && (
              <Leaderboard telemetry={telemetry} />
            )}

            {activeTab === "checker" && (
              <LiveStatus
                initialIp={telemetry.serverIp}
                onIpTrackingChange={handleTrackingIpChange}
                isTrackingIp={true}
              />
            )}

            {activeTab === "guide" && (
              <ActionGuide />
            )}

          </div>

        </div>

      </main>

      {/* Clean footer decoration */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <p>Minecraft Server Telemetry Utility • 2026</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <Shield className="w-4 h-4 text-gray-400" />
            <span>Полностью автономный мониторинг на GitHub Actions</span>
          </div>
        </div>
      </footer>

      {/* Dynamic modern in-app Toast notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white border border-gray-200 shadow-xl rounded-xl p-4 flex items-start gap-3 animate-fade-in-up md:max-w-md">
          {toast.type === "success" && (
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
          {toast.type === "error" && (
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
          )}
          {toast.type === "info" && (
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-bold text-gray-900 block uppercase tracking-wider">
              {toast.type === "success" ? "Успешно" : toast.type === "error" ? "Ошибка" : "Справка"}
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-line font-medium break-words">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold shrink-0 cursor-pointer self-start -mt-1 hover:bg-gray-50 rounded px-1.5 transition-colors"
          >
            &times;
          </button>
        </div>
      )}

    </div>
  );
}
