import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuBotMessageSquare, LuChartColumn, LuClipboardList, LuEllipsis, LuMic } from "react-icons/lu";
import type { Identity } from "../types";
import type { View } from "./Sidebar";

type Tab = { view: View | "more"; label: string; icon: ReactNode };

const ICON = "h-[22px] w-[22px]";

/**
 * The phone's navigation, as an app has it: a glass bar at the bottom with the
 * daily screens, and "עוד" for the rest (the sidebar, as a drawer). Tap a tab,
 * or press and slide along the bar — the lens follows the finger and the page
 * switches as it passes each tab. Hidden from md up, where the sidebar is.
 */
export function MobileTabBar({
  view,
  me,
  onChange,
  onMore,
}: {
  view: View;
  me: Identity;
  onChange: (view: View) => void;
  onMore: () => void;
}) {
  const tabs: Tab[] = [
    { view: "tasks", label: "משימות", icon: <LuClipboardList className={ICON} /> },
    { view: "calls", label: "שיחות", icon: <LuMic className={ICON} /> },
    { view: "chat", label: "מילו", icon: <LuBotMessageSquare className={ICON} /> },
    ...(me.is_admin ? [{ view: "sales" as const, label: "מכירות", icon: <LuChartColumn className={ICON} /> }] : []),
    { view: "more", label: "עוד", icon: <LuEllipsis className={ICON} /> },
  ];
  const n = tabs.length;
  //: A screen with no tab of its own (users, activity, playbook) lights "עוד".
  const found = tabs.findIndex((t) => t.view === view);
  const active = found === -1 ? n - 1 : found;

  const bar = useRef<HTMLElement>(null);
  //: The lens while a finger is on the bar: 0..n-1, fractional while sliding.
  const [drag, setDrag] = useState<number | null>(null);
  //: The latest values, for handlers registered once.
  const live = useRef({ tabs, active, onChange, onMore });
  live.current = { tabs, active, onChange, onMore };

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const state = { startX: 0, moved: false, down: false };

    // RTL: the first tab is on the right.
    const position = (clientX: number) => {
      const count = live.current.tabs.length;
      const r = el.getBoundingClientRect();
      const pad = 6;
      const ratio = (r.right - pad - clientX) / (r.width - pad * 2);
      return Math.min(count - 1, Math.max(0, ratio * count - 0.5));
    };
    /** Switches to tab i. "עוד" opens only on release, never while sliding past. */
    const go = (i: number, released: boolean) => {
      const { tabs: list, active: current, onChange: change, onMore: more } = live.current;
      const tab = list[i];
      if (!tab) return;
      if (tab.view === "more") {
        if (released) more();
        return;
      }
      if (i !== current) {
        change(tab.view);
        navigator.vibrate?.(8);
      }
    };
    const down = (e: PointerEvent) => {
      state.startX = e.clientX;
      state.moved = false;
      state.down = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      setDrag(position(e.clientX));
    };
    const move = (e: PointerEvent) => {
      if (!state.down) return;
      if (Math.abs(e.clientX - state.startX) > 6) state.moved = true;
      const p = position(e.clientX);
      setDrag(p);
      if (state.moved) go(Math.round(p), false);
    };
    const up = (e: PointerEvent) => {
      if (!state.down) return;
      state.down = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* not captured */
      }
      go(Math.round(position(e.clientX)), true);
      setDrag(null);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  const lens = drag ?? active;
  const lit = drag === null ? active : Math.round(drag);

  return (
    <nav
      ref={bar}
      aria-label="ניווט"
      className={`milo-tabbar md:hidden ${drag !== null ? "is-dragging" : ""}`}
      style={{ "--n": n, "--pos": lens } as React.CSSProperties}
    >
      <span className="milo-tabbar-lens" aria-hidden="true" />
      {tabs.map((tab, i) => (
        <button
          key={tab.view}
          type="button"
          aria-label={tab.label}
          aria-current={i === active && tab.view !== "more" ? "page" : undefined}
          className={`milo-tab ${i === lit ? "is-on" : ""}`}
          // Keyboard only: the pointer is handled on the bar, for sliding.
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            if (tab.view === "more") onMore();
            else onChange(tab.view);
          }}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
