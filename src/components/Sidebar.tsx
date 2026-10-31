import type { ReactNode } from "react";
import type { Health, Identity } from "../types";
import { MiloNotifications } from "./Notifications";
import {
  LuActivity,
  LuBookOpen,
  LuBotMessageSquare,
  LuChartColumn,
  LuClipboardList,
  LuLogOut,
  LuUsers,
  LuX,
} from "react-icons/lu";

export type View = "activity" | "chat" | "playbook" | "sales" | "tasks" | "users";

const ICON = "h-[18px] w-[18px]";

/** `admin` items are hidden from everyone else. Hiding is courtesy, not
    security — the server refuses the calls behind them either way. */
const NAV: { view: View; label: string; icon: ReactNode; admin?: boolean }[] = [
  { view: "tasks", label: "משימות", icon: <LuClipboardList className={ICON} /> },
  { view: "chat", label: "שאל את מילו", icon: <LuBotMessageSquare className={ICON} /> },
  { view: "users", label: "ניהול משתמשים", icon: <LuUsers className={ICON} />, admin: true },
  { view: "playbook", label: "מה הוא יודע לעשות", icon: <LuBookOpen className={ICON} /> },
  { view: "activity", label: "מעקב משתמשים", icon: <LuActivity className={ICON} />, admin: true },
  { view: "sales", label: "מכירות", icon: <LuChartColumn className={ICON} />, admin: true },
];

export function Sidebar({
  view,
  onChange,
  health,
  me,
  onSignOut,
  onOpenCampaign,
  collapsed,
  onClose,
  className = "",
}: {
  view: View;
  onChange: (view: View) => void;
  health: Health | null;
  me: Identity;
  onSignOut: () => void;
  /** A notification's "למבצע" — the campaign on the sales page. */
  onOpenCampaign: (campaignId: string) => void;
  /** Desktop only: a narrow rail of icons. On a phone the sidebar is a drawer and always full. */
  collapsed: boolean;
  /** Closes the drawer on a phone. */
  onClose: () => void;
  className?: string;
}) {
  //: Applied from md up, so the phone drawer never shows the rail.
  const hide = collapsed ? "md:hidden" : "";
  //: Text that fades out while the rail narrows, instead of vanishing at the start.
  const fade = `transition-opacity duration-300 ${collapsed ? "md:opacity-0" : ""}`;

  return (
    <aside
      className={`flex w-[248px] shrink-0 flex-col bg-ink-900 text-champagne/90 overflow-hidden transition-[width,transform] duration-500 ease-in-out ${
        collapsed ? "md:w-[72px]" : ""
      } ${className}`}
    >
      {/* 18px either side centres the logo in the 72px rail. */}
      <div
        className={`flex items-center gap-2.5 px-6 pb-6 pt-7 transition-[padding] duration-500 ease-in-out ${
          collapsed ? "md:px-[18px]" : ""
        }`}
      >
        <MiloNotifications enabled={me.is_admin} onOpenCampaign={onOpenCampaign} />
        <div className={`min-w-0 flex-1 whitespace-nowrap ${fade}`}>
          <p className="font-display text-[17px] font-semibold leading-none text-champagne">Milo</p>
          <p className="mt-1 text-[11px] tracking-wide text-champagne/55">סוכנות הביטוח של סיגל</p>
        </div>
        <button
          onClick={onClose}
          aria-label="סגירת התפריט"
          className="rounded-lg p-1.5 text-champagne/60 transition-colors hover:bg-white/8 hover:text-champagne md:hidden"
        >
          <LuX className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3">
        {NAV.filter((item) => !item.admin || me.is_admin).map((item) => {
          const active = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onChange(item.view)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              // 15px keeps the icon centred in the rail, so it stays put while the labels fade.
              className={`flex w-full items-center gap-3 rounded-xl px-[15px] py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-champagne text-ink-900"
                  : "text-champagne/70 hover:bg-white/8 hover:text-champagne"
              }`}
            >
              <span className={active ? "text-ink-700" : "text-champagne/60"}>{item.icon}</span>
              <span className={`whitespace-nowrap ${fade}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-white/10 px-3 py-4">
        {/* Built like a menu item, so it lines up with them in the rail too. */}
        <button
          onClick={onSignOut}
          aria-label="יציאה"
          title={collapsed ? "יציאה" : undefined}
          className="flex w-full items-center gap-3 rounded-xl px-[15px] py-2.5 text-sm font-medium text-champagne/70 transition-colors hover:bg-white/8 hover:text-champagne"
        >
          <LuLogOut className={`${ICON} shrink-0 text-champagne/60`} />
          <span className={`whitespace-nowrap ${fade}`}>יציאה</span>
        </button>
        {health?.all_integrations_mocked && (
          <p className={`rounded-lg bg-white/8 px-2.5 py-2 text-[11px] leading-relaxed text-champagne/70 ${hide}`}>
            כל האינטגרציות מדומות — התוצאות הן נתוני דוגמה, לא ה-CRM האמיתי.
          </p>
        )}
      </div>
    </aside>
  );
}