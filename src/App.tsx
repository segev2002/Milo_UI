import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LuMenu, LuPanelRightClose, LuPanelRightOpen } from "react-icons/lu";
import { SiGmail, SiGooglecalendar } from "react-icons/si";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
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
import { DevBanner, openGoogle } from "./components/ui";
import type { View } from "./components/Sidebar";

const TITLES: Record<View, { title: string }> = {
  chat: { title: "שאל את מילו" },
  playbook: { title: "מה הוא יודע לעשות" },
  tasks: { title: "משימות" },
  users: { title: "ניהול משתמשים" },
  activity: { title: "מעקב משתמשים" },
};

export default function App() {
  //: The page is the first part of the path: /tasks, /chat …
  const navigate = useNavigate();
  const view = (useLocation().pathname.split("/")[1] || "tasks") as View;
  const [health, setHealth] = useState<Health | null>(null);
  const [me, setMe] = useState<Identity | null>(null);
  //: Until the cookie has been checked, showing either the console or the
  //  sign-in page would be a guess — and a visible flash of the wrong one.
  const [checking, setChecking] = useState(true);
  //: The sidebar is a drawer on a phone.
  const [menuOpen, setMenuOpen] = useState(false);
  //: On a wide screen it can shrink to icons; remembered per browser.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("milo.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("milo.sidebar", collapsed ? "open" : "collapsed");
    } catch {
      // Private window: it just isn't remembered.
    }
  };

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
    navigate("/tasks");
  };

  const run = (prompt: string, request: TurnRequest = {}) => {
    navigate("/chat");
    void ask(prompt, request);
  };

  const head = TITLES[view] ?? TITLES.tasks;

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
      {menuOpen && <div className="fixed inset-0 z-40 bg-ink-950/40 md:hidden" onClick={() => setMenuOpen(false)} />}
      <Sidebar
        view={view}
        onChange={(next) => {
          navigate(`/${next}`);
          setMenuOpen(false);
        }}
        health={health}
        me={me}
        onSignOut={() => void signOut()}
        collapsed={collapsed}
        onClose={() => setMenuOpen(false)}
        className={`fixed inset-y-0 right-0 z-50 md:static md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Just the icon, in the gutter by the sidebar's edge. */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "הרחבת התפריט" : "כיווץ התפריט"}
          title={collapsed ? "הרחבת התפריט" : "כיווץ התפריט"}
          className="absolute right-1.5 top-2 z-10 hidden p-1 text-ink-900 transition-colors hover:text-ink-600 md:block"
        >
          {collapsed ? <LuPanelRightOpen className="h-4 w-4" /> : <LuPanelRightClose className="h-4 w-4" />}
        </button>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 pb-5 pt-5 md:px-8 md:pt-7">
          <div className="flex items-center gap-3">
            {/* A phone has no sidebar, only this drawer. */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="תפריט"
              className="rounded-lg bg-ink-900 p-2 text-champagne transition-colors hover:bg-ink-800 md:hidden"
            >
              <LuMenu className="h-5 w-5" />
            </button>
            <div>
            <h1 className="font-display text-[26px] font-semibold leading-none text-ink-900">
              {head.title}
            </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === "tasks" && (
              <>
                <GoogleApp
                  onClick={() => openGoogle("mail", me.email)}
                  label="Gmail"
                  icon={<SiGmail className="h-4 w-4 text-[#EA4335]" />}
                />
                <GoogleApp
                  onClick={() => openGoogle("calendar", me.email)}
                  label="יומן"
                  icon={<SiGooglecalendar className="h-4 w-4 text-[#4285F4]" />}
                />
              </>
            )}
            <p className="hidden text-sm text-muted sm:block">
              {new Date().toLocaleDateString("he-IL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </header>

        <div
          data-scroll-root
          className={
            view === "chat"
              ? "min-h-0 flex-1 overflow-hidden px-4 pb-4 md:px-8 md:pb-6"
              : "min-h-0 flex-1 overflow-y-auto px-4 pb-10 md:px-8"
          }
        >
          <Routes>
            <Route
              path="/chat"
              element={
                <Chat
                  messages={messages}
                  busy={busy}
                  onAsk={(prompt, request) => void ask(prompt, request)}
                  onRestart={reset}
                />
              }
            />
            <Route path="/playbook" element={<Playbook busy={busy} onRun={run} />} />
            <Route path="/tasks" element={<Tasks me={me} />} />
            <Route path="/users" element={me.is_admin ? <Users me={me} /> : <Navigate to="/tasks" replace />} />
            <Route path="/activity" element={me.is_admin ? <UserActivity /> : <Navigate to="/tasks" replace />} />
            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Routes>
        </div>
      </main>
    </div>
    </div>
  );
}

function GoogleApp({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-ink-900 transition-colors hover:bg-paper"
    >
      {icon}
      {label}
    </button>
  );
}
