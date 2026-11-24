import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LuPanelRightClose, LuPanelRightOpen } from "react-icons/lu";
import { SiGmail, SiGooglecalendar } from "react-icons/si";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { getSystems, health as fetchHealth, listTasks, logout, me as fetchMe, setUnauthorizedHandler } from "./lib/api";
import { useMilo } from "./hooks/useMilo";
import { clearCache } from "./lib/cache";
import type { Health, Identity, Task, TurnRequest } from "./types";
import { Agency } from "./components/Agency";
import { Calls } from "./components/Calls";
import { Chat } from "./components/Chat";
import { Intro } from "./components/Intro";
import { Login } from "./components/Login";
import { MobileTabBar } from "./components/MobileTabBar";
import { DesktopNotificationsPrompt } from "./components/Notifications";
import { Playbook } from "./components/Playbook";
import { Sales } from "./components/Sales";
import { Sidebar } from "./components/Sidebar";
import { Tasks } from "./components/Tasks";
import { Owner } from "./components/Owner";
import { Systems } from "./components/Systems";
import { DevBanner, LoadingBar, openGoogle, OverflowTip } from "./components/ui";
import { THEMES, ThemeSwitcher, type Theme } from "./components/ThemeSwitcher";
import type { View } from "./components/Sidebar";

const TITLES: Record<View, { title: string }> = {
  chat: { title: "שאל את מילו" },
  playbook: { title: "מה הוא יודע לעשות" },
  tasks: { title: "משימות" },
  calls: { title: "תמלול שיחות" },
  agency: { title: "ניהול הסוכנות" },
  owner: { title: "עלויות ומפתחות" },
  systems: { title: "חיבורים" },
  sales: { title: "מכירות" },
};

export default function App() {
  //: The page is the first part of the path: /tasks, /chat …
  const navigate = useNavigate();
  const location = useLocation();
  const view = (location.pathname.split("/")[1] || "tasks") as View;
  //: /sales?campaign=… — a notification's campaign, scrolled to and outlined.
  const focusCampaign = new URLSearchParams(location.search).get("campaign");
  const [health, setHealth] = useState<Health | null>(null);
  const [me, setMe] = useState<Identity | null>(null);
  //: Until the cookie has been checked, showing either the console or the
  //  sign-in page would be a guess — and a visible flash of the wrong one.
  const [checking, setChecking] = useState(true);
  //: Milo's hello, played once right after a Google sign-in.
  const [intro, setIntro] = useState(false);
  const endIntro = useCallback(() => setIntro(false), []);
  //: The sidebar is a drawer on a phone.
  const [menuOpen, setMenuOpen] = useState(false);
  //: On a wide screen it can shrink to icons; remembered per browser.
  const savedCollapsed = () => {
    try {
      return localStorage.getItem("milo.sidebar") === "collapsed";
    } catch {
      return false;
    }
  };
  //: The sales sheet is wide, so the sidebar starts closed there (it can still be opened).
  const [collapsed, setCollapsed] = useState(() => view === "sales" || savedCollapsed());
  useEffect(() => {
    setCollapsed(view === "sales" || savedCollapsed());
  }, [view]);
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    // The glass blur is paused while the width animates (liquid-glass.css).
    document.documentElement.dataset.resizing = "";
    window.setTimeout(() => delete document.documentElement.dataset.resizing, 550);
    // Opening it on the sales page is for that visit only, not the remembered choice.
    if (view === "sales") return;
    try {
      localStorage.setItem("milo.sidebar", collapsed ? "open" : "collapsed");
    } catch {
      // Private window: it just isn't remembered.
    }
  };

  //: Light or dark — remembered per browser, like the sidebar.
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("milo.theme") as Theme;
      return THEMES.includes(saved) ? saved : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("milo.theme", theme);
    } catch {
      // Private window: it just isn't remembered.
    }
  }, [theme]);

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

  //: First sign-in of an agency admin with nothing connected yet: open חיבורים, once per visit.
  useEffect(() => {
    if (!me?.is_admin) return;
    try {
      if (sessionStorage.getItem("systems.checked")) return;
      sessionStorage.setItem("systems.checked", "1");
    } catch {
      /* storage blocked: check on every load */
    }
    getSystems()
      .then((state) => {
        const nothing = !state.systems.some((s) => s.connected) || !state.google.connected;
        if (nothing && state.can_write) navigate("/systems");
      })
      .catch(() => undefined);
  }, [me, navigate]);

  /** One 401, from any screen, means the same thing: the session is over. */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearCache();
      setMe(null);
    });
    fetchMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  /** Desktop notifications while the console is open: a new task, one given to me, a new message. */
  useEffect(() => {
    if (!me || !("Notification" in window)) return;
    //: The last list, in memory only. The first one is the baseline, so opening the console is quiet.
    let seen: Map<string, Task> | null = null;
    const check = async () => {
      let tasks: Task[];
      try {
        tasks = await listTasks();
      } catch {
        return;
      }
      const before = seen;
      seen = new Map(tasks.map((t) => [t.id, t]));
      if (!before || Notification.permission !== "granted") return;
      for (const t of tasks) {
        const old = before.get(t.id);
        const mine = t.assignee === me.email;
        //: What I did myself is no news to me.
        const byMe = (old ? t.events.at(-1)?.by : t.created_by) === me.email;
        let title: string | null = null;
        if (!old) title = (me.is_admin || mine) && !byMe ? "משימה חדשה" : null;
        else if (mine && old.assignee !== me.email) title = byMe ? null : "שויכה אליך משימה";
        else if (t.last_message_at > old.last_message_at && (mine || (me.is_admin && !t.assignee))) title = "הודעה חדשה";
        if (!title) continue;
        const note = new Notification(title, { body: t.title || t.name || t.phone || "", tag: t.id });
        note.onclick = () => {
          window.focus();
          navigate("/tasks");
          note.close();
        };
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(timer);
  }, [me, navigate]);

  const signOut = async () => {
    await logout().catch(() => null);
    clearCache();
    setMe(null);
    navigate("/tasks");
  };

  const run = (prompt: string, request: TurnRequest = {}) => {
    navigate("/chat");
    void ask(prompt, request);
  };

  //: /chat?client=C-1234 — the link Milo sends the agent on WhatsApp: open that
  //  client's file in the chat, once, then drop the parameter.
  const linkedClient = view === "chat" ? new URLSearchParams(location.search).get("client") : null;
  useEffect(() => {
    if (!me || !linkedClient || !/^C-?\d+$/i.test(linkedClient)) return;
    navigate("/chat", { replace: true });
    void ask(`סקירה על ${linkedClient}`, { intent: "client_overview", client_crm_id: linkedClient.toUpperCase() });
  }, [me, linkedClient, navigate, ask]);

  const head = TITLES[view] ?? TITLES.tasks;

  if (checking) return <div className="h-screen" />;
  if (!me)
    return (
      <>
        <DevBanner />
        <Login
          onSignedIn={(identity) => {
            setMe(identity);
            setIntro(true);
          }}
        />
      </>
    );

  return (
    // dvh: a phone's browser bars are not counted, so nothing hides behind them. The notch's inset on top.
    <div className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
    <LoadingBar />
    <OverflowTip />
    {intro && <Intro name={me.display_name} onDone={endIntro} />}
    {!intro && <DesktopNotificationsPrompt name={me.display_name} />}
    <DevBanner />
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {menuOpen && <div className="fixed inset-0 z-[45] bg-ink-950/40 md:hidden" onClick={() => setMenuOpen(false)} />}
      <Sidebar
        view={view}
        onChange={(next) => {
          navigate(`/${next}`);
          setMenuOpen(false);
        }}
        health={health}
        me={me}
        onSignOut={() => void signOut()}
        onOpenCampaign={(id) => {
          navigate(`/sales?campaign=${encodeURIComponent(id)}`);
          setMenuOpen(false);
        }}
        collapsed={collapsed}
        onClose={() => setMenuOpen(false)}
        // On a phone the drawer runs edge to edge: clear of the notch and the home bar.
        className={`fixed inset-y-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:static md:translate-x-0 md:p-0 ${
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
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-4 pt-4 md:flex-wrap md:gap-4 md:px-8 md:pb-5 md:pt-7">
          <div className="flex items-center gap-3">
            <div>
            <h1 className="font-display text-[1.625rem] font-semibold leading-none text-ink-900">
              {head.title}
            </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher value={theme} onValueChange={setTheme} />
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
              ? "min-h-0 flex-1 overflow-hidden px-4 pb-[calc(5.625rem+env(safe-area-inset-bottom))] md:px-8 md:pb-6"
              : // On a phone, room at the bottom for the tab bar.
                "min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10"
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
            {/* Rendered below, always: a recording goes on while the user works elsewhere. */}
            <Route path="/calls" element={null} />
            <Route path="/agency" element={me.is_admin ? <Agency me={me} /> : <Navigate to="/tasks" replace />} />
            <Route path="/owner" element={me.is_owner ? <Owner /> : <Navigate to="/tasks" replace />} />
            <Route
              path="/systems"
              element={
                me.is_admin ? (
                  <Systems />
                ) : (
                  <Navigate to="/tasks" replace />
                )
              }
            />
            <Route
              path="/sales"
              element={me.is_admin ? <Sales focusCampaign={focusCampaign} /> : <Navigate to="/tasks" replace />}
            />
            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Routes>
          <div hidden={view !== "calls"}>
            <Calls active={view === "calls"} />
          </div>
        </div>
      </main>
    </div>
    <MobileTabBar view={view} me={me} onChange={(next) => navigate(`/${next}`)} onMore={() => setMenuOpen(true)} />
    </div>
  );
}

function GoogleApp({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-medium text-ink-900 transition-colors hover:bg-paper sm:px-3"
    >
      {icon}
      {/* Just the logo on a phone. */}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
