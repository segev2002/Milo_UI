import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metrics } from "../lib/activity";
import { intentLabel } from "../lib/catalog";
import type { ActivityEntry } from "../types";
import { Card, CardHead, Empty, StatusPill, Tag } from "./ui";
import type { View } from "./Sidebar";
import { IconArrow } from "./Icons";

export function Dashboard({
  metrics,
  entries,
  onNavigate,
}: {
  metrics: Metrics;
  entries: ActivityEntry[];
  onNavigate: (view: View) => void;
}) {
  const hasData = metrics.total > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="טופלו היום" value={metrics.today} hint="בקשות שמילו ענה עליהן" />
        <Stat label="7 הימים האחרונים" value={metrics.week} hint="חלון מתגלגל" />
        <Stat
          label="דורש אותך"
          value={metrics.needsSigal}
          hint="ממתין לחתימה, לאדם או לנתון חסר"
          tone={metrics.needsSigal > 0 ? "warm" : "plain"}
        />
        <Stat
          label="זמן תגובה חציוני"
          value={hasData ? `${(metrics.medianMs / 1000).toFixed(1)}s` : "—"}
          hint={hasData ? `${Math.round(metrics.successRate * 100)}% נענו ללא תקלה` : "אין נתונים עדיין"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card className="flex flex-col">
          <CardHead
            title="נפח בקשות"
            hint="14 הימים האחרונים, מהקונסולה הזו"
            right={<Tag tone="ink">{metrics.total} בסך הכול</Tag>}
          />
          <div className="flex min-h-[260px] flex-1 items-stretch px-2 py-4">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                <AreaChart data={metrics.byDay} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#064E3B" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#064E3B" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E7DECD" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#5E6F68" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#5E6F68" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={38}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #E7DECD",
                      fontSize: 12,
                      boxShadow: "0 6px 20px rgba(6,78,59,0.08)",
                    }}
                    labelStyle={{ color: "#064E3B", fontWeight: 600 }}
                    separator=""
                    formatter={(value: number) => [`${value} בקשות`, ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#064E3B"
                    strokeWidth={2}
                    fill="url(#volume)"
                    dot={{ r: 2.5, fill: "#064E3B" }}
                    activeDot={{ r: 4.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                title="עוד לא נרשם דבר"
                hint="כל שאלה שאתם שואלים את מילו מהקונסולה הזו נספרת כאן."
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="במה הוא עסק" hint="מקובץ לפי הכוונה שאליה ניתב" />
          {hasData ? (
            <ul className="space-y-3 px-5 py-4">
              {metrics.byIntent.slice(0, 8).map((row) => {
                const share = Math.round((row.count / metrics.total) * 100);
                return (
                  <li key={row.intent}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-ink-900">
                        {intentLabel(row.intent)}
                      </span>
                      <span className="tabular-nums text-xs text-muted">
                        {row.count} · {share}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-champagne-soft">
                      <div
                        className="h-full rounded-full bg-ink-700"
                        style={{ width: `${Math.max(share, 3)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="עוד לא נותבו כוונות" />
          )}
        </Card>
      </div>

      <Card>
        <CardHead
          title="בקשות אחרונות"
          hint="החדשות ראשונות"
          right={
            <button
              onClick={() => onNavigate("ledger")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700 hover:text-ink-900"
            >
              היומן המלא <IconArrow className="h-3.5 w-3.5 rotate-180" />
            </button>
          }
        />
        {entries.length ? (
          <ul className="divide-y divide-line">
            {entries.slice(0, 6).map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {entry.reportTitle ?? (entry.prompt || intentLabel(entry.intent))}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {intentLabel(entry.intent)} · {when(entry.at)} · {(entry.durationMs / 1000).toFixed(1)}s
                  </p>
                </div>
                {entry.ok ? (
                  entry.reportStatus && <StatusPill status={entry.reportStatus} />
                ) : (
                  <StatusPill status="error">failed</StatusPill>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="אין בקשות עדיין" hint="שאלו את מילו משהו כדי להתחיל את היומן." />
        )}
      </Card>

      <p className="px-1 pb-2 text-xs leading-relaxed text-muted">
        המספרים האלה מתייחסים לבקשות שנעשו מהקונסולה הזו. מילו עונה גם בוואטסאפ ומריץ את
        העבודות המתוזמנות שלו (סיכום 07:00, ימי הולדת, הסריקות השבועיות) — הנפח הזה נמצא בטבלאות
        שלו ואינו נחשף עדיין באף נקודת קצה לקריאה, ולכן הוא במכוון לא נספר כאן במקום להיות מנוחש.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "plain" | "warm";
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        tone === "warm" ? "border-champagne-deep bg-champagne-soft" : "border-line bg-white"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-display text-[30px] font-semibold leading-none tabular-nums text-ink-900">
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-muted">{hint}</p>
    </div>
  );
}

export function when(iso: string): string {
  const then = new Date(iso);
  const diff = Date.now() - then.getTime();
  if (diff < 60_000) return "כרגע";
  if (diff < 3_600_000) return `לפני ${Math.floor(diff / 60_000)} דק'`;
  if (diff < 86_400_000) return `לפני ${Math.floor(diff / 3_600_000)} שע'`;
  return then.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}
