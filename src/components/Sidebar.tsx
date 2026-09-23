import type { ReactNode } from "react";
import type { Health, Identity } from "../types";
import { IconChat, IconDashboard, IconLedger, IconPlaybook, IconUsers } from "./Icons";

export type View = "dashboard" | "chat" | "playbook" | "ledger" | "users";

/** `admin` items are hidden from everyone else. Hiding is courtesy, not
    security — the server refuses the calls behind them either way. */
const NAV: { view: View; label: string; icon: ReactNode; admin?: boolean }[] = [
  { view: "dashboard", label: "סקירה", icon: <IconDashboard /> },
  { view: "chat", label: "שאל את מילו", icon: <IconChat /> },
  { view: "playbook", label: "מה הוא יודע לעשות", icon: <IconPlaybook /> },
  { view: "ledger", label: "יומן בקשות", icon: <IconLedger /> },
  { view: "users", label: "ניהול משתמשים", icon: <IconUsers />, admin: true },
];

export function Sidebar({
  view,
  onChange,
  health,
  todayCount,
  me,
  onSignOut,
}: {
  view: View;
  onChange: (view: View) => void;
  health: Health | null;
  todayCount: number;
  me: Identity;
  onSignOut: () => void;
}) {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col bg-ink-900 text-champagne/90">
      <div className="px-6 pb-6 pt-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-champagne font-display text-lg font-semibold text-ink-900">
            M
          </span>
          <div>
            <p className="font-display text-[17px] font-semibold leading-none text-champagne">
              Milo
            </p>
            <p className="mt-1 text-[11px] tracking-wide text-champagne/55">
              סוכנות הביטוח של סיגל
            </p>
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.filter((item) => !item.admin || me.is_admin).map((item) => {
          const active = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onChange(item.view)}
              aria-current={active ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-champagne text-ink-900"
                  : "text-champagne/70 hover:bg-white/8 hover:text-champagne"
              }`}
            >
              <span className={active ? "text-ink-700" : "text-champagne/60"}>{item.icon}</span>
              {item.label}
              {item.view === "ledger" && todayCount > 0 && (
                <span
                  className={`ms-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? "bg-ink-900/10 text-ink-900" : "bg-white/12 text-champagne/80"
                  }`}
                >
                  {todayCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-white/10 px-5 py-5 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-champagne/70" title={me.email}>
            {me.display_name || me.email}
          </span>
          <button
            onClick={onSignOut}
            className="shrink-0 text-champagne/50 underline underline-offset-2 hover:text-champagne"
          >
            יציאה
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${health ? "bg-ink-300" : "bg-[#e0a56b]"}`}
            aria-hidden
          />
          <span className="text-champagne/70">
            {health ? `מחובר · ${health.environment}` : "לא מחובר"}
          </span>
        </div>
        {health?.all_integrations_mocked && (
          <p className="rounded-lg bg-white/8 px-2.5 py-2 leading-relaxed text-champagne/70">
            כל האינטגרציות מדומות — התוצאות הן נתוני דוגמה, לא ה-CRM האמיתי.
          </p>
        )}
      </div>
    </aside>
  );
}