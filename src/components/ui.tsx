import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { ArrowUpRight } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { DayPicker } from "react-day-picker";
import { he } from "react-day-picker/locale";
import { LuCalendarDays, LuCheck, LuChevronDown } from "react-icons/lu";
import { loading } from "../lib/api";
import { insurerLogo } from "../lib/insurers";
import type { ReportStatus } from "../types";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-white ${className}`}>{children}</div>
  );
}

/** The top strip of a card: its explanation and actions. Pages carry one title
    only — the header's — so a card has no heading of its own. */
export function CardHead({
  hint,
  right,
}: {
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {right}
    </div>
  );
}

const STATUS_STYLE: Record<ReportStatus | "error", string> = {
  ok: "bg-ink-50 text-ink-700 border-ink-100",
  attention: "bg-[#fdf3e2] text-attention border-[#f0dcb8]",
  blocked: "bg-[#fbeceb] text-blocked border-[#f3d3d0]",
  empty: "bg-paper text-muted border-line",
  error: "bg-[#fbeceb] text-blocked border-[#f3d3d0]",
};

const STATUS_TEXT: Record<ReportStatus | "error", string> = {
  ok: "תקין",
  attention: "לתשומת לב",
  blocked: "חסום",
  empty: "ריק",
  error: "שגיאה",
};

const STATUS_MARK: Record<ReportStatus | "error", string> = {
  ok: "✅",
  attention: "⚠️",
  blocked: "⛔",
  empty: "ℹ️",
  error: "⛔",
};

export function StatusPill({
  status,
  children,
}: {
  status: ReportStatus | "error";
  children?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden>{STATUS_MARK[status]}</span>
      {children ?? STATUS_TEXT[status]}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warm" | "ink" | "milo" | "claim" }) {
  const tones = {
    neutral: "border-line bg-paper text-muted",
    warm: "border-champagne-deep bg-champagne-soft text-[#7a5a1a]",
    ink: "border-ink-100 bg-ink-50 text-ink-700",
    milo: "border-milo/30 bg-milo/10 text-milo",
    claim: "border-claim/30 bg-claim/10 text-claim",
  };
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[0.75rem] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** An insurer's logo (which carries its name) when it is one we know; otherwise the name. */
export function InsurerName({ name, className = "" }: { name: string; className?: string }) {
  const logo = insurerLogo(name);
  if (!logo) return <span className={className}>{name}</span>;
  return <img src={logo} alt={name} title={name} className="h-7 w-auto max-w-[6.875rem] shrink-0 object-contain" />;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "warm" | "danger" | "claim" | "task";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const variants = {
    primary: "bg-ink-900 text-champagne hover:bg-ink-800 disabled:bg-ink-900/40",
    warm: "bg-champagne text-ink-900 hover:bg-champagne-deep border border-champagne-deep",
    ghost: "border border-line bg-white text-ink-900 hover:bg-paper",
    danger: "border border-[#f3d3d0] bg-white text-blocked hover:bg-[#fbeceb]",
    claim: "border border-claim bg-claim/15 text-claim hover:bg-claim/25",
    task: "border border-ink-900 bg-white text-ink-900 hover:bg-paper",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-900">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Shown only on the dev console (and `npm run dev`), never in production:
    VITE_MILO_ENV is baked in at build time by the deploy workflow. */
export const IS_DEV = import.meta.env.VITE_MILO_ENV === "development" || import.meta.env.DEV;

export function DevBanner() {
  if (!IS_DEV) return null;
  return (
    <div className="shrink-0 bg-blocked px-4 py-1.5 text-center text-xs font-semibold text-champagne">
      סביבת פיתוח — זו לא הגרסה החיה של הקונסולה
    </div>
  );
}

export function Typing() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-500" />
      ))}
    </span>
  );
}

/** "כרגע", "לפני 5 דק'", or a date for anything older than a day. */
export function when(iso: string): string {
  const then = new Date(iso);
  const diff = Date.now() - then.getTime();
  if (diff < 60_000) return "כרגע";
  if (diff < 3_600_000) return `לפני ${Math.floor(diff / 60_000)} דק'`;
  if (diff < 86_400_000) return `לפני ${Math.floor(diff / 3_600_000)} שע'`;
  return then.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

/** The look of every text field, dropdown and date field in the console. */
export const FIELD =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-300";

/** A dropdown in the console's own design — the browser's native one cannot be styled. */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  disabled,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <ListboxButton className={`${FIELD} flex items-center justify-between gap-2 text-right disabled:opacity-60 ${className}`}>
        <span className="truncate">{current?.label ?? ""}</span>
        <LuChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom start"
        className="z-[60] mt-1 max-h-64 w-[var(--button-width)] overflow-y-auto rounded-xl border border-line bg-white p-1 text-sm shadow-lg outline-none"
      >
        {options.map((option) => (
          <ListboxOption
            key={option.value}
            value={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-ink-900 data-[focus]:bg-ink-50 data-[selected]:font-semibold"
          >
            <LuCheck className="h-4 w-4 shrink-0 text-ink-700 opacity-0 [[data-selected]_&]:opacity-100" />
            <span className="truncate">{option.label}</span>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

/** Every quarter hour of the day, "00:00" … "23:45". */
const TIMES = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
);

/**
 * A date — and with `withTime`, a time — in the console's design. The value is
 * the same string a native input gives: "YYYY-MM-DD", or "YYYY-MM-DDTHH:mm".
 */
export function DateField({
  value,
  onChange,
  withTime,
  placeholder = "בחירת תאריך",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [date, time = "09:00"] = value.split("T");
  const selected = date ? new Date(`${date}T00:00`) : undefined;
  const set = (day: string, at: string) => onChange(withTime ? `${day}T${at}` : day);
  const label = selected
    ? selected.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
      (withTime ? ` · ${time}` : "")
    : placeholder;

  return (
    <Popover className={`relative ${className}`}>
      <PopoverButton className={`${FIELD} flex items-center justify-between gap-2 text-right ${selected ? "" : "text-muted"}`}>
        <span className="truncate">{label}</span>
        <LuCalendarDays className="h-4 w-4 shrink-0 text-muted" />
      </PopoverButton>
      <PopoverPanel
        anchor="bottom start"
        className="milo-calendar z-[60] mt-1 rounded-xl border border-line bg-white p-3 shadow-lg outline-none"
      >
        {({ close }) => (
          <div className="space-y-3">
            <DayPicker
              mode="single"
              dir="rtl"
              locale={he}
              selected={selected}
              defaultMonth={selected}
              onSelect={(day) => {
                if (!day) return;
                set(isoDay(day), time);
                if (!withTime) close();
              }}
            />
            {withTime && (
              <div className="flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
                שעה
                <Select
                  value={time}
                  onChange={(at) => set(date || isoDay(new Date()), at)}
                  options={TIMES.map((t) => ({ value: t, label: t }))}
                  className="py-1.5"
                />
              </div>
            )}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="text-xs text-muted underline underline-offset-2 hover:text-ink-900"
              >
                ניקוי
              </button>
            )}
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}

/** "YYYY-MM-DD" in local time — toISOString would shift it by the timezone. */
function isoDay(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/** "17 בנוב׳ 2026 – 23 בנוב׳ 2026" — or one day when both ends are the same. */
export function rangeLabel(start: string, end: string): string {
  const show = (text: string) =>
    new Date(`${text}T00:00`).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
  return start === end ? show(start) : `${show(start)} – ${show(end)}`;
}

/**
 * Two dates — from and to — picked in one calendar: the first click is the start,
 * the second the end, the days between a green band. Values are "YYYY-MM-DD" ("" =
 * not set). `icon` shows only a calendar button (the range is shown elsewhere).
 */
export function DateRangeField({
  start,
  end,
  onChange,
  icon,
  placeholder = "בחירת תאריכים",
  className = "",
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  icon?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Popover className={`relative ${className}`}>
      {icon ? (
        <PopoverButton
          aria-label={placeholder}
          title={placeholder}
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink-900 transition-colors hover:bg-paper data-[open]:bg-ink-900 data-[open]:text-champagne"
        >
          <LuCalendarDays className="h-[1.125rem] w-[1.125rem]" />
        </PopoverButton>
      ) : (
        <PopoverButton className={`${FIELD} flex items-center justify-between gap-2 text-right ${start ? "" : "text-muted"}`}>
          <span className="truncate">{start && end ? rangeLabel(start, end) : placeholder}</span>
          <LuCalendarDays className="h-4 w-4 shrink-0 text-muted" />
        </PopoverButton>
      )}
      <PopoverPanel
        anchor="bottom start"
        className="milo-calendar z-[60] mt-1 rounded-2xl border border-line bg-white p-3 shadow-lg outline-none"
      >
        {({ close }) => <RangeCalendar start={start} end={end} onChange={(a, b) => (onChange(a, b), close())} />}
      </PopoverPanel>
    </Popover>
  );
}

function RangeCalendar({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  const day = (text: string) => (text ? new Date(`${text}T00:00`) : undefined);
  const [range, setRange] = useState<{ from: Date | undefined; to?: Date } | undefined>(
    start ? { from: day(start), to: day(end || start) } : undefined,
  );
  return (
    <div className="space-y-3">
      <DayPicker
        mode="range"
        dir="rtl"
        locale={he}
        resetOnSelect
        selected={range}
        defaultMonth={range?.to ?? range?.from}
        onSelect={setRange}
      />
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs font-medium text-ink-900">
          {range?.from && rangeLabel(isoDay(range.from), isoDay(range.to ?? range.from))}
        </p>
        <div className="flex items-center gap-3">
          {(start || range) && (
            <button
              type="button"
              onClick={() => {
                setRange(undefined);
                onChange("", "");
              }}
              className="text-xs text-muted underline underline-offset-2 hover:text-ink-900"
            >
              ניקוי
            </button>
          )}
          <button
            type="button"
            disabled={!range?.from}
            onClick={() => range?.from && onChange(isoDay(range.from), isoDay(range.to ?? range.from))}
            className="rounded-full bg-ink-900 px-4 py-1.5 text-xs font-medium text-champagne transition hover:bg-ink-800 disabled:opacity-40"
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Gmail or Google Calendar in a small window over the console, centred — Google
 * cannot be shown inside the page. `authuser` opens the account the user signed in
 * to the console with, not whichever is the browser's default. An empty new mail,
 * or a new event (`event` fills its title and details).
 */
export function openGoogle(app: "mail" | "calendar", email: string, event?: { title: string; details: string }) {
  const url =
    app === "mail"
      ? `https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", authuser: email })}`
      : `https://calendar.google.com/calendar/render?${new URLSearchParams({
          action: "TEMPLATE",
          authuser: email,
          ...(event && { text: event.title, details: event.details }),
        })}`;
  const [width, height] = app === "mail" ? [600, 650] : [900, 720];
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  window.open(url, `milo-${app}`, `popup,noopener,width=${width},height=${height},left=${left},top=${top}`);
}

/**
 * The console's own "are you sure?", in place of the browser's confirm(): Milo's
 * face, the question, and two buttons. Resolves true on the confirm button or
 * Enter, false on cancel, Escape or a click outside.
 */
export function confirmDialog(options: { title: string; confirmLabel: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (answer: boolean) => {
      root.unmount();
      host.remove();
      resolve(answer);
    };
    root.render(<ConfirmDialog {...options} onDone={done} />);
  });
}

function ConfirmDialog({
  title,
  confirmLabel,
  danger,
  onDone,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  onDone: (answer: boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      // Answers this dialog only, not a window open behind it.
      e.preventDefault();
      e.stopImmediatePropagation();
      onDone(e.key === "Enter");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onDone(false)}
    >
      <div role="alertdialog" aria-label={title} className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <img src="/milo.png" alt="מילו" className="mx-auto h-14 w-14 rounded-xl bg-champagne object-cover" />
        <p className="mt-4 text-base font-semibold text-ink-900">{title}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant={danger ? "danger" : "primary"} onClick={() => onDone(true)}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={() => onDone(false)}>
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A card that tilts toward the pointer in 3D: a brand-coloured face with a big
 * logo, a title and a status on top, an optional link in the corner, and one
 * glass action button at the bottom. Used for every connection on חיבורים, so
 * they all look the same. Still for people who prefer reduced motion.
 */
export function TiltCard({
  title,
  subtitle,
  logo,
  color,
  href,
  actionText,
  onAction,
  disabled = false,
  description,
}: {
  title: string;
  subtitle: ReactNode;
  /** A line or two under the logo: what this card does. */
  description?: string;
  /** The logo, shown large on a white tile. */
  logo: ReactNode;
  /** The face's colour (any CSS colour): the vendor's own. */
  color: string;
  /** The vendor's site, opened from the corner arrow. */
  href?: string;
  actionText: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  const still = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const spring = { damping: 15, stiffness: 150 };
  const rotateX = useTransform(useSpring(y, spring), [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(useSpring(x, spring), [-0.5, 0.5], ["-10deg", "10deg"]);

  return (
    <div style={{ perspective: "1000px" }}>
      <motion.div
        onMouseMove={(event) => {
          if (still) return;
          const box = event.currentTarget.getBoundingClientRect();
          x.set((event.clientX - box.left) / box.width - 0.5);
          y.set((event.clientY - box.top) / box.height - 0.5);
        }}
        onMouseLeave={() => {
          x.set(0);
          y.set(0);
        }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative h-[21rem] w-full rounded-2xl border border-line bg-white shadow-xl"
      >
        <div
          style={{ transform: "translateZ(40px)", transformStyle: "preserve-3d", background: color }}
          className="absolute inset-3 grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl p-4 text-white shadow-lg"
        >
          {/* Darker at the bottom, so white text reads on any brand colour. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 style={{ transform: "translateZ(40px)" }} className="truncate font-display text-2xl font-bold">
                {title}
              </h3>
              <div style={{ transform: "translateZ(30px)" }} className="mt-1 text-base text-white/90">
                {subtitle}
              </div>
            </div>
            {href && (
              <motion.a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={still ? undefined : { scale: 1.1, rotate: "2.5deg" }}
                whileTap={still ? undefined : { scale: 0.9 }}
                aria-label={`האתר של ${title}`}
                style={{ transform: "translateZ(50px)" }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <ArrowUpRight className="h-4 w-4" />
              </motion.a>
            )}
          </div>

          <div className="relative flex flex-col items-center justify-center gap-3">
            <div
              // Solid white: the console's glass theme would turn bg-white translucent.
              style={{ transform: "translateZ(60px)", background: "#fff", backdropFilter: "none" }}
              className="flex h-24 w-24 items-center justify-center rounded-2xl p-3 shadow-lg"
            >
              {logo}
            </div>
            {description && (
              <p
                style={{ transform: "translateZ(30px)" }}
                className="line-clamp-2 max-w-[22rem] text-center text-sm leading-relaxed text-white/85"
              >
                {description}
              </p>
            )}
          </div>

          <motion.button
            type="button"
            onClick={onAction}
            disabled={disabled}
            whileHover={still || disabled ? undefined : { scale: 1.04 }}
            whileTap={still || disabled ? undefined : { scale: 0.96 }}
            style={{ transform: "translateZ(40px)" }}
            className="relative w-full rounded-lg bg-white/15 py-3 text-center text-base font-semibold ring-1 ring-inset ring-white/25 backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionText}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * A thin bar sliding along the top of the console while it waits for Milo — so a
 * page that is still loading (the sales sheet, the tasks) says so. It shows only
 * after a short wait, so quick calls and the background refreshes don't flicker it.
 */
export function LoadingBar() {
  const busy = useSyncExternalStore(loading.subscribe, () => loading.get() > 0);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!busy) return setShown(false);
    const timer = window.setTimeout(() => setShown(true), 250);
    return () => window.clearTimeout(timer);
  }, [busy]);
  return (
    <div
      role="progressbar"
      aria-label="טוען"
      aria-hidden={!shown}
      className={`loading-bar pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px] overflow-hidden transition-opacity duration-200 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      <span />
    </div>
  );
}

/** What may be cut short on screen: a cell of the sales sheet, and any text the
    console truncates (`truncate`, `line-clamp-*`). */
const CUT = ".milo-sheet .sheet-cell, .truncate, [class*='line-clamp-']";

/**
 * The whole text of a box that is too small for it, in the console's own tooltip —
 * on hovering it for a moment. Mounted once (App.tsx); it watches the whole page,
 * and shows only when the text really is cut.
 */
export function OverflowTip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  useEffect(() => {
    let timer = 0;
    let current: HTMLElement | null = null;
    const hide = () => {
      window.clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const over = (event: PointerEvent) => {
      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(CUT) ?? null;
      if (el === current) return;
      hide();
      if (!el) return;
      current = el;
      timer = window.setTimeout(() => {
        const cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        const text = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.innerText).trim();
        // Not while typing in it: the caret already shows the text.
        if (!cut || !text || document.activeElement === el) return;
        const box = el.getBoundingClientRect();
        const below = box.top < 80;
        setTip({ text, x: box.left + box.width / 2, y: below ? box.bottom + 8 : box.top - 8, below });
      }, 350);
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", hide, true);
    };
  }, []);
  if (!tip) return null;
  return createPortal(
    <div
      role="tooltip"
      className="overflow-tip pointer-events-none fixed z-[90] max-w-sm rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium leading-snug whitespace-pre-wrap text-champagne shadow-lg ring-1 ring-champagne/50"
      style={{
        left: Math.min(Math.max(tip.x, 200), window.innerWidth - 200),
        top: tip.y,
        transform: `translate(-50%, ${tip.below ? "0" : "-100%"})`,
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
