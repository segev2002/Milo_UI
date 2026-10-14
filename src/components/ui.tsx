import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import type { ReactNode } from "react";
import { DayPicker } from "react-day-picker";
import { he } from "react-day-picker/locale";
import { LuCalendarDays, LuCheck, LuChevronDown } from "react-icons/lu";
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

export function CardHead({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden>{STATUS_MARK[status]}</span>
      {children ?? STATUS_TEXT[status]}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warm" | "ink" }) {
  const tones = {
    neutral: "border-line bg-paper text-muted",
    warm: "border-champagne-deep bg-champagne-soft text-[#7a5a1a]",
    ink: "border-ink-100 bg-ink-50 text-ink-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
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
  variant?: "primary" | "ghost" | "warm" | "danger";
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
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
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
