import { useCallback, useEffect, useState } from "react";
import { health as fetchHealth, session, whoami } from "./lib/api";
import { useActivity } from "./hooks/useActivity";
import { useMilo } from "./hooks/useMilo";
import type { Health, TurnRequest, WhoAmI } from "./types";
import { Chat } from "./components/Chat";
import { Dashboard } from "./components/Dashboard";
import { Ledger } from "./components/Ledger";
import { Playbook } from "./components/Playbook";
import { Settings } from "./components/Settings";
import { Sidebar } from "./components/Sidebar";
import type { View } from "./components/Sidebar";

const TITLES: Record<View, { title: string; hint: string }> = {
  dashboard: { title: "Overview", hint: "What Milo has been handling" },
  chat: { title: "Ask Milo", hint: "He has the book, the systems and the diary" },
  playbook: { title: "What he can do", hint: "The spec's scenarios, on demand" },
  ledger: { title: "Request log", hint: "Every turn this console has sent" },
  settings: { title: "Connection", hint: "Token, environment and local data" },
};

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [mode, setMode] = useState(session.mode);
  const [who, setWho] = useState<WhoAmI | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const { entries, metrics } = useActivity();
  const { messages, busy, ask, reset } = useMilo();

  const refresh = useCallback(async () => {
    setConnectionError(null);
    setMode(session.mode);
    const [healthResult, whoResult] = await Promise.allSettled([fetchHealth(), whoami()]);
    setHealth(healthResult.status === "fulfilled" ? healthResult.value : null);
    if (whoResult.status === "fulfilled") {
      setWho(whoResult.value);
    } else {
      setWho(null);
      const message =
        whoResult.reason instanceof Error ? whoResult.reason.message : "Could not reach Milo.";
      setConnectionError(message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Switching between the live API and sample data restarts the thread:
      a half-real conversation would be worse than none. */
  const switchMode = (next: "live" | "demo") => {
    session.use(next);
    setMode(next);
    reset();
    void refresh();
  };

  const run = (prompt: string, request: TurnRequest = {}) => {
    setView("chat");
    void ask(prompt, request, request.intent ? "scenario" : "chat");
  };

  const head = TITLES[view];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        view={view}
        onChange={setView}
        who={who}
        health={health}
        todayCount={metrics.today}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-8 pb-5 pt-7">
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-none text-ink-900">
              {head.title}
            </h1>
            <p className="mt-2 text-sm text-muted">{head.hint}</p>
          </div>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </header>

        {connectionError && view !== "settings" && (
          <div className="mx-8 mb-4 shrink-0 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-sm text-blocked">
            {connectionError}{" "}
            <button onClick={() => setView("settings")} className="underline">
              Check the connection
            </button>
          </div>
        )}

        {mode === "demo" && (
          <div className="mx-8 mb-4 shrink-0 rounded-xl border border-champagne-deep bg-champagne-soft px-4 py-3 text-sm text-[#7a5a1a]">
            Sample data — nothing here comes from Milo. Add a token under Connection to point the
            console at the API.
          </div>
        )}

        <div
          className={
            view === "chat"
              ? "min-h-0 flex-1 overflow-hidden px-8 pb-6"
              : "min-h-0 flex-1 overflow-y-auto px-8 pb-10"
          }
        >
          {view === "dashboard" && (
            <Dashboard metrics={metrics} entries={entries} onNavigate={setView} />
          )}
          {view === "chat" && (
            <Chat
              messages={messages}
              busy={busy}
              onAsk={(prompt, request) => void ask(prompt, request)}
              onRestart={reset}
            />
          )}
          {view === "playbook" && <Playbook busy={busy} onRun={run} />}
          {view === "ledger" && <Ledger entries={entries} />}
          {view === "settings" && (
            <Settings
              who={who}
              health={health}
              mode={mode}
              error={connectionError}
              onRefresh={() => void refresh()}
              onSwitchMode={switchMode}
            />
          )}
        </div>
      </main>
    </div>
  );
}
