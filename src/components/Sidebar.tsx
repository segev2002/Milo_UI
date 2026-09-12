import type { ReactNode } from "react";
import { session } from "../lib/api";
import type { Health, WhoAmI } from "../types";
import {
  IconChat,
  IconDashboard,
  IconLedger,
  IconPlaybook,
  IconSettings,
} from "./Icons";

export type View = "dashboard" | "chat" | "playbook" | "ledger" | "settings";

const NAV: { view: View; label: string; icon: ReactNode }[] = [
  { view: "dashboard", label: "סקירה", icon: <IconDashboard /> },
  { view: "chat", label: "שאל את מילו", icon: <IconChat /> },
  { view: "playbook", label: "מה הוא יודע לעשות", icon: <IconPlaybook /> },
  { view: "ledger", label: "יומן בקשות", icon: <IconLedger /> },
  { view: "settings", label: "חיבור", icon: <IconSettings /> },
];

export function Sidebar({
  view,
  onChange,
  who,
  health,
  todayCount,
  onSignOut,
}: {
  view: View;
  onChange: (view: View) => void;
  who: WhoAmI | null;
  health: Health | null;
  todayCount: number;
  onSignOut: () => void;
}) {
  // Falls back to the identity cached at sign-in, so the footer still names the
  // person while /agent/whoami is in flight or the API is briefly unreachable.
  const account = session.user;
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
        {NAV.map((item) => {
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
        {(who || account) && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-champagne/70">
                {who?.display_name ?? account?.display_name}
              </p>
              <p className="truncate text-champagne/40" dir="ltr">
                {account?.email ?? who?.role}
              </p>
            </div>
            <button
              onClick={onSignOut}
              className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-champagne/60 underline underline-offset-2 transition-colors hover:bg-white/8 hover:text-champagne"
            >
              יציאה
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
