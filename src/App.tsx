import { useCallback, useEffect, useState } from "react";
import { health as fetchHealth, logout, me as fetchMe, setUnauthorizedHandler } from "./lib/api";
import { useMilo } from "./hooks/useMilo";
import type { Health, Identity, TurnRequest } from "./types";
import { Chat } from "./components/Chat";
import { Login } from "./components/Login";
import { Playbook } from "./components/Playbook";
import { Sidebar } from "./components/Sidebar";
import { Tasks } from "./components/Tasks";
import { UserActivity } from "./components/UserActivity";
import { Users } from "./components/Users";
import { DevBanner } from "./components/ui";
import type { View } from "./components/Sidebar";

const TITLES: Record<View, { title: string; hint: string }> = {
  chat: { title: "שאל את מילו", hint: "יש לו את התיקים, המערכות והיומן" },
  playbook: { title: "מה הוא יודע לעשות", hint: "התרחישים מהמפרט, לפי דרישה" },
  tasks: { title: "משימות פתוחות", hint: "פניות של לקוחות ולקוחות חדשים שממתינות לסיגל" },
  done: { title: "משימות שטופלו", hint: "פניות שכבר סומנו כטופלו" },
  users: { title: "ניהול משתמשים", hint: "מי מורשה להיכנס לקונסולה" },
  activity: { title: "מעקב משתמשים", hint: "כל פעולה של משתמשי הקונסולה — מול מילו ומול לקוחות" },
};

export default function App() {
  const [view, setView] = useState<View>("tasks");
  const [health, setHealth] = useState<Health | null>(null);
  const [me, setMe] = useState<Identity | null>(null);
  //: Until the cookie has been checked, showing either the console or the
  //  sign-in page would be a guess — and a visible flash of the wrong one.
  const [checking, setChecking] = useState(true);

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
    setView("tasks");
  };

  const run = (prompt: string, request: TurnRequest = {}) => {
    setView("chat");
    void ask(prompt, request);
  };

  const head = TITLES[view];

  if (checking) return <div className="h-screen bg-ink-900" />;
  if (!me)
    return (
      <>
        <DevBanner />
        <Login onSignedIn={setMe} />
      </>
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
    <DevBanner />
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Sidebar
        view={view}
        onChange={setView}
        health={health}
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
          {view === "chat" && (
            <Chat
              messages={messages}
              busy={busy}
              onAsk={(prompt, request) => void ask(prompt, request)}
              onRestart={reset}
            />
          )}
          {view === "playbook" && <Playbook busy={busy} onRun={run} />}
          {view === "tasks" && <Tasks key="open" status="open" />}
          {view === "done" && <Tasks key="done" status="done" />}
          {view === "users" && me.is_admin && <Users me={me} />}
          {view === "activity" && me.is_admin && <UserActivity />}
        </div>
      </main>
    </div>
    </div>
  );
}