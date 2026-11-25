import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { animate, useReducedMotion } from "motion/react";
import {
  LuActivity,
  LuArrowDownLeft,
  LuArrowUpLeft,
  LuChevronLeft,
  LuChevronRight,
  LuDownload,
  LuLayoutDashboard,
  LuSearch,
  LuTrophy,
  LuUsersRound,
  LuX,
} from "react-icons/lu";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { agencySummary, ApiError, listPeople, listTasks } from "../lib/api";
import { useCached } from "../lib/cache";
import { insurerLogo } from "../lib/insurers";
import type { AgencyPeriod, AgencySummary, Identity, Person as TaskPerson, Task } from "../types";
import { TaskDetails } from "./TaskDetails";
import { Modal } from "./Tasks";
import { Card, DateRangeField, Empty, Select } from "./ui";
import { UserActivity } from "./UserActivity";
import { Users } from "./Users";

const TABS = [
  { value: "overview", label: "סקירה", icon: <LuLayoutDashboard className="h-4 w-4" /> },
  { value: "users", label: "ניהול העובדים", icon: <LuUsersRound className="h-4 w-4" /> },
  { value: "activity", label: "מעקב אחר העובדים", icon: <LuActivity className="h-4 w-4" /> },
] as const;
type TabId = (typeof TABS)[number]["value"];

/**
 * "ניהול הסוכנות" — the admin's one page about the agency: the overview of
 * sales and the team (סקירה), the allowlist (ניהול העובדים) and every action
 * taken (מעקב אחר העובדים). The tab is in the address (?tab=), so a reload keeps it.
 */
export function Agency({ me }: { me: Identity }) {
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab: TabId = TABS.find((t) => t.value === asked)?.value ?? "overview";

  const tabs = (
    <Pills
      label="אזור בעמוד"
      value={tab}
      options={TABS}
      onChange={(next) => setParams(next === "overview" ? {} : { tab: next }, { replace: true })}
    />
  );
  // The overview puts the tabs in its own toolbar row, so it all fits on the first screen.
  if (tab === "overview") return <Overview tabs={tabs} me={me} />;
  return (
    <div className="space-y-5">
      {tabs}
      {tab === "users" && <Users me={me} />}
      {tab === "activity" && <UserActivity />}
    </div>
  );
}

/* --- formatting ----------------------------------------------------------- */

const PERIODS: { value: AgencyPeriod; label: string }[] = [
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
  { value: "quarter", label: "רבעון" },
  { value: "year", label: "שנה" },
  { value: "custom", label: "טווח תאריכים" },
];

const ils = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format;
const ilsShort = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  notation: "compact",
  maximumFractionDigits: 1,
}).format;
const whole = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
//: Whole numbers — also while they count up (27, not 27.014).
const count = (n: number) => whole.format(Math.round(n));

/** "2026-11-05" as a local date (new Date("2026-11-05") would be UTC midnight). */
function day(text: string): Date {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shift(text: string, days: number): string {
  const d = day(text);
  d.setDate(d.getDate() + days);
  return iso(d);
}

/** "נובמבר 2026", "רבעון 4 · 2026", "2026", "22 בנוב׳ – 28 בנוב׳". */
function periodName(kind: AgencyPeriod, from: string, to: string): string {
  const start = day(from);
  if (kind === "month") return start.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  if (kind === "quarter") return `רבעון ${Math.floor(start.getMonth() / 3) + 1} · ${start.getFullYear()}`;
  if (kind === "year") return String(start.getFullYear());
  if (kind === "custom") {
    const full = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
    return `${full(start)} – ${full(day(to))}`;
  }
  const short = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  return `${short(start)} – ${short(day(to))}`;
}

/** What "לעומת …" names: the period before. */
function previousName(s: AgencySummary): string {
  if (s.period.kind === "week") return "השבוע הקודם";
  if (s.period.kind === "quarter") return "הרבעון הקודם";
  if (s.period.kind === "custom") return "התקופה הקודמת";
  return periodName(s.period.kind, s.previous.from, s.previous.to);
}

/** "ב" before a name; a maqaf before a number ("ב־2025"). */
function inside(name: string): string {
  return /^\d/.test(name) ? `ב־${name}` : `ב${name}`;
}

/** The change in percent, or null when there was nothing before to compare with. */
function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

function monthName(month: string, long = false): string {
  return day(`${month}-01`).toLocaleDateString("he-IL", long ? { month: "long", year: "numeric" } : { month: "short" });
}

/* --- סקירה ---------------------------------------------------------------- */

function Overview({ tabs, me }: { tabs: ReactNode; me: Identity }) {
  const [period, setPeriod] = useCached<AgencyPeriod>("agency.period", "month");
  //: Any day in the period shown; "" is today.
  const [at, setAt] = useCached("agency.at", "");
  //: "טווח": the days picked in the calendar.
  const [start, setStart] = useCached("agency.start", "");
  const [end, setEnd] = useCached("agency.end", "");
  //: What is on screen; kept while the console is open, so coming back shows it at once.
  const [summary, setSummary] = useCached<AgencySummary | null>("agency.summary", null);
  //: Every period already loaded: going back to one shows it at once, then refreshes it.
  const [loaded, setLoaded] = useCached<Record<string, AgencySummary>>("agency.loaded", {});
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useCached<Date | null>("agency.loadedAt", null);
  const report = useRef<HTMLDivElement>(null);

  const custom = period === "custom";
  const key = custom ? `custom:${start}:${end}` : `${period}:${at}`;
  useEffect(() => {
    if (custom && (!start || !end || end < start)) return;
    if (loaded[key]) setSummary(loaded[key]);
    let live = true;
    setError(null);
    agencySummary(period, at || undefined, { start, end })
      .then((result) => {
        setLoaded((all) => ({ ...all, [key]: result }));
        if (!live) return;
        setSummary(result);
        setLoadedAt(new Date());
      })
      .catch((exc) => {
        if (live) setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את הסקירה.");
      });
    return () => {
      live = false;
    };
    // `loaded` is read, not watched: each answer would fetch again.
  }, [key]);

  const today = iso(new Date());
  // Until the new period arrives, the last one stays on screen, dimmed.
  const stale =
    !!summary &&
    (summary.period.kind !== period ||
      (custom ? summary.period.from !== start || summary.period.to !== end : !!at && (at < summary.period.from || at > summary.period.to)));
  const name = summary ? periodName(summary.period.kind, summary.period.from, summary.period.to) : "";

  return (
    <div className="@container space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
          {tabs}
          <div className="no-print w-28">
            <Select
              value={period}
              options={PERIODS}
              className="!rounded-full py-2 text-[0.82rem] font-medium"
              onChange={(next) => {
                setAt("");
                // A range with nothing picked yet: the month so far.
                if (next === "custom" && (!start || !end)) {
                  setStart(`${today.slice(0, 8)}01`);
                  setEnd(today);
                }
                setPeriod(next);
              }}
            />
          </div>
          {custom ? (
            <p className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-900">
              {start && end ? periodName("custom", start, end) : "…"}
            </p>
          ) : (
          <div className="flex items-center rounded-full border border-line bg-white p-1">
            <RoundButton
              label="התקופה הקודמת"
              disabled={!summary}
              onClick={() => summary && setAt(shift(summary.period.from, -1))}
            >
              <LuChevronRight className="h-4 w-4" />
            </RoundButton>
            <p className="min-w-[4.5rem] whitespace-nowrap px-1 text-center text-[0.82rem] font-semibold text-ink-900">{name || "…"}</p>
            <RoundButton
              label="התקופה הבאה"
              disabled={!summary || summary.period.to >= today}
              onClick={() => summary && setAt(shift(summary.period.to, 1))}
            >
              <LuChevronLeft className="h-4 w-4" />
            </RoundButton>
          </div>
          )}
          <DateRangeField
            icon
            className="no-print"
            placeholder="בחירת טווח תאריכים"
            start={custom ? start : ""}
            end={custom ? end : ""}
            onChange={(from, to) => {
              if (!from) return;
              setStart(from);
              setEnd(to);
              setAt("");
              setPeriod("custom");
            }}
          />
        <button
          type="button"
          disabled={!summary}
          onClick={() => report.current && printReport(report.current, name)}
          aria-label="ייצוא PDF"
          title="ייצוא PDF"
          className="no-print ms-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-900 text-champagne transition hover:bg-ink-800 disabled:opacity-50"
        >
          <LuDownload className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[0.875rem] leading-relaxed text-blocked">{error}</p>
      )}

      {!summary ? (
        !error && <Skeleton />
      ) : (
        <div ref={report} className="space-y-3" aria-busy={stale}>
          <PrintHeader name={name} />
          {/* The whole overview on one screen from tablet width up, at any height (a laptop or
              a TV): the premium, the trend (it takes what height is left) and its two numbers on
              one side; the companies the full height on the other. Narrower: one column. */}
          <div className="agency-overview grid gap-3 @2xl:h-[calc(100dvh-14.5rem)] @2xl:min-h-[30rem] @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="flex min-h-0 min-w-0 flex-col gap-3">
              <Headline s={summary} loadedAt={loadedAt} />
              <Trend s={summary} />
              <Metrics s={summary} />
            </div>
            <Insurers s={summary} />
          </div>
          <Team s={summary} name={name} me={me} />
        </div>
      )}
    </div>
  );
}

/** Milo's quiet signature: he gathered these numbers. */
function MiloMark({ at }: { at: Date }) {
  return (
    <img
      src="/milo.png"
      alt="מילו ריכז את הנתונים"
      title={`מילו ריכז את הנתונים · ${at.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`}
      className="no-print h-6 w-6 shrink-0 rounded-full bg-champagne object-cover ring-2 ring-white/70"
    />
  );
}

function PrintHeader({ name }: { name: string }) {
  return (
    <div className="print-only hidden">
      <div className="mb-2 flex items-center justify-between border-b border-line pb-3">
        <p className="text-xl font-semibold text-ink-900">סקירת הסוכנות · {name}</p>
        <p className="inline-flex items-center gap-2 text-xs text-muted">
          <img src="/milo.png" alt="" className="h-5 w-5 rounded-full bg-champagne object-cover" />
          הוכן ע״י מילו · {new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

/* The first row: the one number that matters, then four that explain it. */

function Headline({ s, loadedAt }: { s: AgencySummary; loadedAt: Date | null }) {
  const t = s.totals;
  const before = s.previous_totals;
  const versus = previousName(s);
  const average = t.policies ? t.premium / t.policies : 0;

  return (
    <Panel delay={0} className="flex flex-col justify-between gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium text-muted">פרמיה חודשית שנמכרה</p>
          {loadedAt && <MiloMark at={loadedAt} />}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="text-[clamp(1.6rem,2.6vw,2.2rem)] font-bold leading-none tracking-tight text-ink-900 tabular-nums">
            <Count value={t.premium} format={ils} />
          </p>
          <Change now={t.premium} before={before.premium} versus={versus} />
        </div>
        <dl className="flex divide-x divide-x-reverse divide-line rounded-xl bg-paper py-1.5">
          <Stream label="פוליסות" value={count(t.policies)} />
          <Stream label="ממוצע לפוליסה" value={t.policies ? ils(average) : "—"} />
          <Stream label="חברה מובילה" value={s.insurers[0]?.insurer ?? "—"} />
        </dl>
    </Panel>
  );
}

/** Under the trend: tasks closed, and transfers and savings. */
function Metrics({ s }: { s: AgencySummary }) {
  const t = s.totals;
  const before = s.previous_totals;
  const versus = previousName(s);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Metric delay={80} hero title="משימות שנסגרו" value={t.tasks_done} now={t.tasks_done} before={before.tasks_done} versus={versus} />
      <Metric delay={140} title="ניוד וחיסכון" value={t.transfers} format={ilsShort} now={t.transfers} before={before.transfers} versus={versus} />
    </div>
  );
}

function Stream({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-auto px-2.5">
      <dt className="whitespace-nowrap text-[0.7rem] leading-tight text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-ink-900 tabular-nums">{value}</dd>
    </div>
  );
}

function Metric({
  title,
  value,
  format = count,
  now,
  before,
  versus,
  note,
  hero,
  delay,
}: {
  delay: number;
  title: string;
  value: number;
  format?: (n: number) => string;
  now?: number;
  before?: number;
  versus?: string;
  note?: string;
  hero?: boolean;
}) {
  return (
    <div
      style={after(delay)}
      className={`agency-panel flex flex-col justify-between gap-1.5 rounded-[var(--radius-2xl)] px-3.5 py-3 ${
        hero
          ? // Fixed brand colours: the theme's ink/champagne swap places in dark.
            "border border-[#7fbcaa]/40 bg-[linear-gradient(145deg,#12876a,#064e3b)] text-[#f8e7c9] shadow-[0_6px_14px_rgb(6_78_59/0.18)]"
          : "border border-line bg-white"
      }`}
    >
      <p className={`text-xs font-medium leading-tight ${hero ? "text-[#f8e7c9]/80" : "text-muted"}`}>{title}</p>
      <p className={`text-[clamp(1.25rem,1.8vw,1.6rem)] font-bold leading-none tracking-tight tabular-nums ${hero ? "" : "text-ink-900"}`}>
        <Count value={value} format={format} delay={delay} />
      </p>
      {now !== undefined && before !== undefined && versus ? (
        <Change now={now} before={before} versus={versus} small hero={hero} />
      ) : (
        <p className={`text-[0.7rem] ${hero ? "text-[#f8e7c9]/75" : "text-muted"}`}>{note}</p>
      )}
    </div>
  );
}

/** The ↑/↓ chip and what it is against. */
function Change({
  now,
  before,
  versus,
  small,
  hero,
}: {
  now: number;
  before: number;
  versus: string;
  small?: boolean;
  hero?: boolean;
}) {
  const pct = change(now, before);
  const muted = hero ? "text-[#f8e7c9]/75" : "text-muted";
  if (pct === null) return <p className={`mt-2 text-[0.7rem] ${muted}`}>{now ? `${inside(versus)}: 0` : `גם ${inside(versus)}: 0`}</p>;
  const up = pct >= 0;
  const tone = hero ? "bg-white/15 text-[#f8e7c9]" : up ? "bg-ink-50 text-ink-700" : "bg-claim/10 text-claim";
  return (
    <p className={`mt-2 flex flex-wrap items-center gap-1.5 ${small ? "text-[0.7rem]" : "text-xs"} ${muted}`}>
      <span dir="ltr" className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold ${tone}`}>
        {up ? <LuArrowUpLeft className="h-3 w-3" /> : <LuArrowDownLeft className="h-3 w-3" />}
        {up ? "+" : "−"}
        {Math.abs(pct)}%
      </span>
      לעומת {versus}
    </p>
  );
}

/* The second row: how sales move, and where they come from. */

const THIS_YEAR = "var(--color-ink-600)";
const LAST_YEAR = "var(--color-muted)";

function Trend({ s }: { s: AgencySummary }) {
  const data = s.monthly;
  const lastYear = data.reduce((sum, m) => sum + m.premium_last_year, 0);
  return (
    <Panel delay={320} outer="@2xl:min-h-0 @2xl:flex-1" className="flex flex-col p-4">
      <PanelHead
        title="מגמת מכירות"
        right={
          <div className="flex items-center gap-3 text-[0.7rem] text-muted">
            <Dot color={THIS_YEAR} label="השנה" />
            {lastYear > 0 && <Dot color={LAST_YEAR} label="שנה קודמת" dashed />}
          </div>
        }
      />
      <div className="agency-chart h-[196px] @2xl:h-auto @2xl:min-h-[120px] @2xl:flex-1" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="agency-trend" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={THIS_YEAR} stopOpacity={0.28} />
                <stop offset="1" stopColor={THIS_YEAR} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 4" />
            {/* Reversed: in Hebrew the earliest month is on the right. */}
            <XAxis
              dataKey="month"
              reversed
              tickFormatter={(m: string) => monthName(m)}
              tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              orientation="right"
              width={56}
              tickFormatter={(v: number) => ilsShort(v)}
              tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<TrendTip />} cursor={{ stroke: "var(--color-muted)", strokeDasharray: "2 4" }} />
            {lastYear > 0 && (
              <Area
                dataKey="premium_last_year"
                type="monotone"
                stroke={LAST_YEAR}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                animationDuration={CHART_MS}
                animationBegin={320}
                animationEasing="ease-out"
              />
            )}
            <Area
              dataKey="premium"
              type="monotone"
              stroke={THIS_YEAR}
              strokeWidth={2.5}
              fill="url(#agency-trend)"
              activeDot={{ r: 4 }}
              animationDuration={CHART_MS}
              animationBegin={320}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function TrendTip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  const value = (key: string) => payload.find((p) => p.dataKey === key)?.value;
  const last = value("premium_last_year");
  return (
    <div dir="rtl" className="min-w-[9rem] rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-ink-900">{monthName(label, true)}</p>
      <p className="flex justify-between gap-4 text-body">
        השנה <b className="tabular-nums">{ils(value("premium") ?? 0)}</b>
      </p>
      {last !== undefined && (
        <p className="flex justify-between gap-4 text-muted">
          שנה קודמת <b className="tabular-nums">{ils(last)}</b>
        </p>
      )}
    </div>
  );
}

const SLICES = [
  "var(--color-ink-600)",
  "var(--color-attention)",
  "var(--color-milo)",
  "var(--color-claim)",
  "var(--color-ink-300)",
  "var(--color-muted)",
];

function Insurers({ s }: { s: AgencySummary }) {
  const [active, setActive] = useState<number | null>(null);
  // Largest first (the leading company on top of the list), four of them, the rest as one.
  const slices = useMemo(() => {
    const sorted = [...s.insurers].sort((a, b) => b.premium - a.premium);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4);
    return rest.length
      ? [
          ...top,
          {
            insurer: "אחרות",
            premium: rest.reduce((sum, r) => sum + r.premium, 0),
            policies: rest.reduce((sum, r) => sum + r.policies, 0),
          },
        ]
      : top;
  }, [s.insurers]);
  const total = slices.reduce((sum, r) => sum + r.premium, 0);
  const shown = active === null ? null : slices[active];

  return (
    <Panel delay={380} outer="@2xl:min-h-0" className="flex flex-col p-4">
      <PanelHead title="לפי חברת ביטוח" />
      {!total ? (
        <Empty title="אין מכירות בתקופה הזו" />
      ) : (
        // Upright: the chart large on top, the companies listed under it.
        <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
          <div className="agency-pie relative aspect-square w-full max-w-[300px] shrink-0 @2xl:aspect-auto @2xl:min-h-[140px] @2xl:max-w-none @2xl:flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="premium"
                  nameKey="insurer"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={1.5}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  animationDuration={CHART_MS}
                  animationBegin={380}
                  animationEasing="ease-out"
                  onMouseLeave={() => setActive(null)}
                >
                  {slices.map((slice, i) => (
                    <Cell
                      key={slice.insurer}
                      fill={SLICES[i]}
                      opacity={active === null || active === i ? 1 : 0.3}
                      style={{ transition: "opacity 0.2s" }}
                      onMouseEnter={() => setActive(i)}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-xl font-bold leading-tight text-ink-900 tabular-nums">{ils(shown?.premium ?? total)}</p>
              <p className="mt-0.5 max-w-[9rem] truncate text-xs text-muted">{shown?.insurer ?? "סה״כ"}</p>
            </div>
          </div>
          <ul className="grid w-full min-w-0 gap-0.5">
            {slices.map((slice, i) => {
              const share = Math.round((slice.premium / total) * 100);
              const logo = insurerLogo(slice.insurer);
              return (
                <li key={slice.insurer}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    aria-pressed={active === i}
                    className="block w-full rounded-lg px-2 py-0.5 text-right transition-colors hover:bg-paper aria-pressed:bg-paper"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink-900">
                        <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: SLICES[i] }} />
                        {logo ? (
                          <img src={logo} alt={slice.insurer} title={slice.insurer} className="h-4 w-auto max-w-[5rem] object-contain" />
                        ) : (
                          <span className="truncate">{slice.insurer}</span>
                        )}
                      </span>
                      <span className="text-xs font-bold text-ink-900 tabular-nums">{share}%</span>
                    </span>
                    <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-ink-50">
                      <span className="agency-grow block h-full rounded-full" style={{ width: `${share}%`, background: SLICES[i], ...after(500 + i * 60) }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/* The third row: who did what. */

type Person = AgencySummary["people"][number];
type Column = "tasks_done" | "tasks_created" | "sale_rows" | "chats" | "actions";

/** Each measure in its own colour, the same in the header dot and the cell. */
const COLUMNS: { key: Column; label: string; dot: string }[] = [
  { key: "tasks_done", label: "משימות שנסגרו", dot: "bg-ink-600" },
  { key: "tasks_created", label: "משימות שנפתחו", dot: "bg-attention" },
  { key: "sale_rows", label: "שורות מכירה", dot: "bg-claim" },
  { key: "chats", label: "שאלות למילו", dot: "bg-milo" },
  { key: "actions", label: "סה״כ פעולות", dot: "bg-muted" },
];

function Team({ s, name, me }: { s: AgencySummary; name: string; me: Identity }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Column>("tasks_done");
  const [open, setOpen] = useState<Person | null>(null);
  const rows = s.people
    .filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b[sort] - a[sort]);
  // The winner: most tasks closed in the period.
  const best = Math.max(0, ...s.people.map((p) => p.tasks_done));
  const winner = best ? s.people.find((p) => p.tasks_done === best)?.email : undefined;
  // Each column's largest number: its bars are drawn against it.
  const top = Object.fromEntries(COLUMNS.map((c) => [c.key, Math.max(1, ...s.people.map((p) => p[c.key]))])) as Record<Column, number>;

  return (
    <Panel delay={440} className="p-5">
      <PanelHead
        title="הצוות"
        right={
          <label className="no-print flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5">
            <LuSearch className="h-3.5 w-3.5 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש עובד"
              aria-label="חיפוש עובד"
              className="w-32 bg-transparent text-xs text-ink-900 outline-none placeholder:text-muted"
            />
          </label>
        }
      />
      {s.people.length === 0 ? (
        <Empty title="אף אחד עוד לא פעל בתקופה הזו" />
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-line text-right text-[0.7rem] text-muted">
                <th className="px-3 pb-3 font-medium">עובד</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 pb-3 font-medium">
                    <button
                      type="button"
                      onClick={() => setSort(c.key)}
                      aria-pressed={sort === c.key}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-ink-900 ${
                        sort === c.key ? "font-semibold text-ink-900" : ""
                      }`}
                    >
                      <i className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                      {c.label}
                      {sort === c.key && <LuChevronLeft className="h-3 w-3 -rotate-90" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const first = p.email === winner;
                return (
                  <tr
                    key={p.email}
                    onClick={() => setOpen(p)}
                    className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-paper/70"
                  >
                    <td className="px-3 py-3.5">
                      <button type="button" className="flex items-center gap-3 text-right" aria-label={`המשימות ש${p.name} סגר/ה`}>
                        {first ? (
                          <span
                            title="סגר/ה הכי הרבה משימות"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f3c969] to-[#b4761b] text-white shadow-[0_3px_10px_rgb(180_118_27/0.3)]"
                          >
                            <LuTrophy className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-paper text-xs font-semibold text-ink-700">
                            {p.name.trim().charAt(0) || "?"}
                          </span>
                        )}
                        <span className="truncate font-medium text-ink-900 group-hover:underline group-hover:underline-offset-4">{p.name}</span>
                      </button>
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-3.5">
                        {p[c.key] ? (
                          <div className="w-24">
                            <p className={`tabular-nums text-ink-900 ${sort === c.key ? "font-bold" : "font-medium"}`}>{count(p[c.key])}</p>
                            <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-line/60">
                              <span
                                className={`agency-grow block h-full rounded-full ${c.dot}`}
                                style={{ width: `${(p[c.key] / top[c.key]) * 100}%`, ...after(560) }}
                              />
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-3 py-4 text-xs text-muted">אין עובד בשם הזה.</p>}
        </div>
      )}
      {open && <Finished person={open} period={name} winner={open.email === winner} me={me} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

/** How long a done task stays on the board (the API's DONE_DAYS): older ones cannot open there. */
const ON_BOARD_DAYS = 14;

/** The tasks one person closed in the period. */
function Finished({
  person,
  period,
  winner,
  me,
  onClose,
}: {
  person: Person;
  period: string;
  winner: boolean;
  me: Identity;
  onClose: () => void;
}) {
  //: A task opened from the list, over this page — closing it comes back here, not to the board.
  const [task, setTask] = useState<Task | null>(null);
  const [people, setPeople] = useState<TaskPerson[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  async function openTask(id: string) {
    setFailed(null);
    try {
      const [tasks, list] = await Promise.all([listTasks(), people.length ? Promise.resolve(people) : listPeople()]);
      setPeople(list);
      const found = tasks.find((t) => t.id === id);
      if (found) setTask(found);
      else setFailed("המשימה כבר לא על הלוח.");
    } catch (exc) {
      setFailed(exc instanceof ApiError ? exc.message : "לא הצלחתי לפתוח את המשימה.");
    }
  }
  const onBoard = (at: string) => Date.now() - new Date(at).getTime() < ON_BOARD_DAYS * 86_400_000;
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-11 w-11 place-items-center rounded-full ${
                winner ? "bg-gradient-to-br from-[#f3c969] to-[#b4761b] text-white" : "bg-ink-50 text-sm font-bold text-ink-700"
              }`}
            >
              {winner ? <LuTrophy className="h-5 w-5" /> : person.name.trim().charAt(0) || "?"}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-900">{person.name}</h2>
              <p className="text-xs text-muted">
                {count(person.tasks_done)} משימות שנסגרו · {period}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-full p-1.5 text-muted hover:bg-paper hover:text-ink-900">
            <LuX className="h-4 w-4" />
          </button>
        </header>
        {person.done.length === 0 ? (
          <Empty title="לא נסגרו משימות בתקופה הזו" />
        ) : (
          <ul className="space-y-2">
            {person.done.map((t) => {
              const openable = onBoard(t.resolved_at);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={!openable}
                    onClick={() => void openTask(t.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper/60 px-3.5 py-3 text-right transition-colors enabled:hover:bg-ink-50 disabled:cursor-default"
                  >
                    <span className="h-8 w-1 shrink-0 rounded-full bg-ink-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">{t.title || "משימה ללא כותרת"}</span>
                      {t.client && <span className="block truncate text-xs text-muted">{t.client}</span>}
                    </span>
                    {t.by_milo && <img src="/milo.png" alt="מילו" title="מילו פתח" className="h-6 w-6 shrink-0 rounded-md bg-champagne object-cover" />}
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {new Date(t.resolved_at).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                    </span>
                    {openable && <LuChevronLeft className="h-4 w-4 shrink-0 text-muted" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {failed && <p className="mt-3 text-sm text-blocked">{failed}</p>}
      </div>
      {task && (
        <TaskDetails
          key={task.id}
          task={task}
          people={people}
          me={me}
          onChange={setTask}
          onClose={() => setTask(null)}
        />
      )}
    </Modal>
  );
}

/* --- small pieces --------------------------------------------------------- */

/** A frosted card. Not faded or slid in: moving glass re-blurs what is behind it on
    every frame, and the animation stutters (as liquid-glass.css notes for the sidebar). */
function Panel({
  className = "",
  outer = "",
  delay = 0,
  children,
}: {
  className?: string;
  /** Classes for the panel's own box in the page's layout (e.g. how much of a column it takes). */
  outer?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <section style={after(delay)} className={outer}>
      <Card className={`agency-panel h-full ${className}`}>{children}</Card>
    </section>
  );
}

/** When a card's contents start rising, or a bar starts growing (index.css): the
    cards follow one another, as in the reference. */
function after(ms: number): CSSProperties {
  return { "--delay": `${ms}ms` } as CSSProperties;
}

function PanelHead({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-[0.95rem] font-semibold text-ink-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {right}
    </header>
  );
}

//: How long the numbers count and the charts draw — on opening, and on another period.
const CHART_MS = 1000;

/**
 * A shekel amount that counts up when it appears, and rolls to its new value when the
 * period changes. Whole counts (tasks, people) are written as they are.
 * Each frame writes the text directly — no React render per frame — and a roll
 * cut short by another change carries on from where it is, without a jump.
 */
function Count({ value, format, delay = 0 }: { value: number; format: (n: number) => string; delay?: number }) {
  // Only shekel amounts count up; a count of tasks or people is shown as it is.
  const still = useReducedMotion() || format === count;
  const el = useRef<HTMLSpanElement>(null);
  //: On opening it counts up from 0, as in the reference; later, from where it is.
  const shown = useRef(still ? value : 0);
  useEffect(() => {
    const write = (v: number) => {
      shown.current = v;
      if (el.current) el.current.textContent = format(v);
    };
    if (still || shown.current === value) return write(value);
    const controls = animate(shown.current, value, {
      duration: CHART_MS / 1000,
      // The first count waits for its card to rise.
      delay: shown.current === 0 ? delay / 1000 : 0,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: write,
    });
    return () => controls.stop();
  }, [value, still, format]);
  return <span ref={el}>{format(shown.current)}</span>;
}

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="no-print inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.82rem] font-medium transition-colors ${
            o.value === value ? "bg-ink-900 text-champagne" : "text-ink-900 hover:bg-paper"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RoundButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-ink-900 transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Dot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`h-0 w-3.5 border-t-2 ${dashed ? "border-dashed" : ""}`} style={{ borderColor: color }} />
      {label}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="@container space-y-3" aria-busy="true" aria-label="טוען">
      <div className="h-[130px] animate-pulse rounded-[var(--radius-2xl)] bg-paper" />
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="h-[250px] animate-pulse rounded-[var(--radius-2xl)] bg-paper" />
        <div className="h-[250px] animate-pulse rounded-[var(--radius-2xl)] bg-paper" />
      </div>
    </div>
  );
}

/**
 * The overview as a PDF: the report is copied into a hidden frame with the
 * console's styles, in the light theme, and the browser's print dialog opens on
 * it — "Save as PDF" keeps the Hebrew exactly as on screen.
 */
function printReport(report: HTMLElement, name: string) {
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join("");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px";
  frame.srcdoc = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>סקירת הסוכנות — ${name}</title>${styles}
<style>
  @page { size: A4; margin: 12mm; }
  body { background: #fff; font-size: 12px; }
  .print-only { display: block !important; }
  .no-print { display: none !important; }
  /* The screen layout follows the window's height; on paper every box takes its content's. */
  .agency-overview { height: auto !important; min-height: 0 !important; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) !important; }
  .agency-overview section { min-height: 0 !important; flex: none !important; }
  .agency-chart { height: auto !important; min-height: 0 !important; flex: none !important; }
  .agency-pie { height: auto !important; min-height: 0 !important; flex: none !important; width: 100% !important; max-width: 230px !important; aspect-ratio: auto !important; margin: 0 auto; }
  .recharts-responsive-container, .recharts-wrapper { width: 100% !important; height: auto !important; }
  .recharts-surface { width: 100% !important; height: auto !important; display: block; }
  .agency-pie .text-xl { font-size: 13px !important; }
  .agency-pie .text-xs { font-size: 9px !important; }
  /* The team table: every column on the page, narrower, instead of scrolling sideways. */
  .overflow-x-auto { overflow: visible !important; }
  table { min-width: 0 !important; width: 100% !important; font-size: 10px !important; }
  table th, table td { padding-left: 4px !important; padding-right: 4px !important; }
  table .w-24 { width: auto !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* The screen's entrance (panels rising in one after another) would be caught half-way:
     on paper everything is there from the start. */
  *, *::before, *::after { animation: none !important; transition: none !important; }
  /* A panel of the overview is never split between pages; the team table may continue. */
  .agency-overview section { break-inside: avoid; }
  tr { break-inside: avoid; }
</style></head><body>${printable(report).outerHTML}</body></html>`;
  frame.onload = async () => {
    const win = frame.contentWindow;
    if (!win) return;
    await win.document.fonts.ready;
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  };
  document.body.appendChild(frame);
}

/** A copy of the report for paper: each chart keeps the shape it has on screen when it is
    scaled to the page's width (an SVG without a viewBox would not scale, only crop). */
function printable(report: HTMLElement): HTMLElement {
  const copy = report.cloneNode(true) as HTMLElement;
  const shown = report.querySelectorAll("svg.recharts-surface");
  copy.querySelectorAll("svg.recharts-surface").forEach((svg, i) => {
    const box = shown[i]?.getBoundingClientRect();
    const width = Number(svg.getAttribute("width")) || box?.width || 0;
    const height = Number(svg.getAttribute("height")) || box?.height || 0;
    if (width && height) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  });
  return copy;
}
