/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Github, Calendar, ShieldAlert, Key, Terminal, ArrowRight, HelpCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export default function ActionGuide() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      title: "Шаг 1. Импорт или загрузка кода в GitHub репозиторий",
      icon: <Github className="w-4 h-4 text-gray-500" />,
      content: (
        <div className="space-y-2 text-gray-600 text-xs leading-relaxed">
          <p>
            Создайте новый репозиторий на GitHub и отправьте в него исходный код данного приложения.
            Убедитесь, что вы скопировали все директории, включая скрытую папку <code className="bg-gray-100 text-gray-800 px-1 rounded font-mono font-semibold">.github/workflows</code> со сценарием автоматизации.
          </p>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-lg font-mono text-[10px] space-y-1 block leading-tight overflow-x-auto shadow-sm border border-gray-800">
            <p className="text-gray-500"># Инициализируйте локальный гит и отправьте в GitHub</p>
            <p>git init</p>
            <p>git add .</p>
            <p>git commit -m "feat: init serverless minecraft status monitor"</p>
            <p>git branch -M main</p>
            <p>git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПОЗИТОРИЙ.git</p>
            <p>git push -u origin main</p>
          </div>
        </div>
      )
    },
    {
      title: "Шаг 2. Предоставление разрешений на запись для GitHub Action",
      icon: <ShieldAlert className="w-4 h-4 text-gray-500" />,
      content: (
        <div className="space-y-2 text-gray-600 text-xs leading-relaxed">
          <p>
            По умолчанию скрипты GitHub Actions не могут коммитить обновленные данные обратно в ветку. Чтобы дать им необходимые права:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Перейдите во вкладку <strong className="text-gray-900">Settings</strong> вашего репозитория на GitHub.</li>
            <li>В меню слева выберите подраздел <strong className="text-gray-900">Actions &gt; General</strong>.</li>
            <li>Прокрутите страницу вниз до пункта <strong className="text-gray-900">Workflow permissions</strong>.</li>
            <li>Выберите переключатель <strong className="text-gray-900">Read and write permissions</strong>.</li>
            <li>Нажмите <strong className="text-gray-900">Save</strong>.</li>
          </ol>
          <p className="text-gray-650 bg-gray-50 p-3 rounded-lg border border-gray-200 font-medium text-[11px] flex gap-2">
            <span>💡</span>
            <span>Это позволит Action обновлять файл <code className="bg-gray-100 p-0.5 rounded text-gray-800 font-mono">public/mc-stats.json</code> каждые 30-60 минут!</span>
          </p>
        </div>
      )
    },
    {
      title: "Шаг 3. (Опционально) Настройка секретов репозитория",
      icon: <Key className="w-4 h-4 text-gray-500" />,
      content: (
        <div className="space-y-2 text-gray-600 text-xs leading-relaxed">
          <p>
            Вы можете хранить IP-адрес отслеживаемого майнкрафт-сервера прямо в веб-интерфейсе или
            переопределить его через секреты GitHub Action для безопасности:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>В настройках репозитория зайдите в <strong className="text-gray-900">Settings &gt; Secrets and variables &gt; Actions</strong>.</li>
            <li>Нажмите кнопку <strong className="text-gray-900">New repository secret</strong>.</li>
            <li>Создайте переменную с именем <code className="bg-gray-100 text-gray-850 px-1 rounded font-mono font-bold">MC_SERVER_IP</code>.</li>
            <li>В поле значения введите IP вашего сервера (например: <code className="bg-gray-100 text-gray-850 px-1 rounded font-mono font-bold">mc.hypixel.net</code>) и сохраните.</li>
          </ol>
        </div>
      )
    },
    {
      title: "Шаг 4. Автоматический запуск и публикация через GitHub Pages",
      icon: <Terminal className="w-4 h-4 text-gray-500" />,
      content: (
        <div className="space-y-2 text-gray-600 text-xs leading-relaxed">
          <p>
            После включения прав сценарий начнет выполняться на серверах GitHub каждые 30 минут:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Он опрашивает сервер, дополняет массив онлайна в графиках.</li>
            <li>Накапливает минуты заходов тех участников, которые были в сети в момент опроса.</li>
            <li>Вы можете бесплатно разместить скомпилированный сайт прямо на <strong className="text-gray-900">GitHub Pages</strong>!</li>
          </ul>
          <p className="bg-gray-50 text-gray-700 p-3 rounded-lg border border-gray-200 font-medium text-[11px] flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <span>Больше не нужно никаких серверов, хостингов и баз данных — всё работает абсолютно бесплатно и автономно внутри экосистемы GitHub!</span>
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <HelpCircle className="w-4.5 h-4.5 text-gray-500" />
          <span>Инструкция по развертыванию на GitHub Actions</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Как настроить автоматический сбор исторической статистики и трекинг онлайна без сторонних серверов
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isOpen = activeStep === idx;
          return (
            <div
              key={idx}
              className={`border rounded-lg transition-all overflow-hidden ${
                isOpen ? "border-gray-300 bg-gray-50/30" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <button
                id={`step-header-${idx}`}
                onClick={() => setActiveStep(isOpen ? -1 : idx)}
                className="w-full flex items-center justify-between p-4 focus:outline-none cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${isOpen ? "bg-gray-100 text-gray-800" : "bg-gray-50 text-gray-400"}`}>
                    {step.icon}
                  </div>
                  <span className="font-bold text-gray-700 text-xs sm:text-sm">
                    {step.title}
                  </span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-200/50 pt-3">
                  {step.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
