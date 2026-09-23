import { useCallback, useEffect, useState } from "react";
import { health as fetchHealth, logout, me as fetchMe, setUnauthorizedHandler } from "./lib/api";
import { useActivity } from "./hooks/useActivity";
import { useMilo } from "./hooks/useMilo";
import type { Health, Identity, TurnRequest } from "./types";
import { Chat } from "./components/Chat";
import { Dashboard } from "./components/Dashboard";
import { Ledger } from "./components/Ledger";
import { Login } from "./components/Login";
import { Playbook } from "./components/Playbook";
import { Sidebar } from "./components/Sidebar";
import { Users } from "./components/Users";
import type { View } from "./components/Sidebar";

const TITLES: Record<View, { title: string; hint: string }> = {
  dashboard: { title: "סקירה", hint: "במה מילו טיפל" },
  chat: { title: "שאל את מילו", hint: "יש לו את התיקים, המערכות והיומן" },
  playbook: { title: "מה הוא יודע לעשות", hint: "התרחישים מהמפרט, לפי דרישה" },
  ledger: { title: "יומן בקשות", hint: "כל פנייה שהקונסולה הזו שלחה" },
  users: { title: "ניהול משתמשים", hint: "מי מורשה להיכנס לקונסולה" },
};

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [health, setHealth] = useState<Health | null>(null);
  const [me, setMe] = useState<Identity | null>(null);
  //: Until the cookie has been checked, showing either the console or the
  //  sign-in page would be a guess — and a visible flash of the wrong one.
  const [checking, setChecking] = useState(true);

  const { entries, metrics } = useActivity();
  const { messages, busy, ask, reset } = useMilo();

  /** Health is best-effort: the console stays usable when the API is briefly
      unreachable, and the sidebar carries the status quietly. */
  const refresh = useCallback(async () => {
    const result = await fetchHealth().catch(() => null);
    setHealth(result);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** One 401, from any screen, means the same thing: the session is over. */
  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    fetchMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  const signOut = async () => {
    await logout().catch(() => null);
    setMe(null);
    setView("dashboard");
  };

  const run = (prompt: string, request: TurnRequest = {}) => {
    setView("chat");
    void ask(prompt, request, request.intent ? "scenario" : "chat");
  };

  const head = TITLES[view];

  if (checking) return <div className="h-screen bg-ink-900" />;
  if (!me) return <Login onSignedIn={setMe} />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        view={view}
        onChange={setView}
        health={health}
        todayCount={metrics.today}
        me={me}
        onSignOut={() => void signOut()}
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
            {new Date().toLocaleDateString("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </header>

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
          {view === "users" && me.is_admin && <Users me={me} />}
        </div>
      </main>
    </div>
  );
}