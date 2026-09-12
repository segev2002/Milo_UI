import { useMemo, useState } from "react";
import { activityStore } from "../lib/activity";
import { intentLabel } from "../lib/catalog";
import type { ActivityEntry } from "../types";
import { Button, Card, CardHead, Empty, StatusPill } from "./ui";
import { when } from "./Dashboard";

type Filter = "all" | "needs" | "failed";

export function Ledger({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [intent, setIntent] = useState("all");

  const intents = useMemo(
    () => [...new Set(entries.map((entry) => entry.intent ?? "unknown"))].sort(),
    [entries],
  );

  const rows = entries.filter((entry) => {
    if (intent !== "all" && (entry.intent ?? "unknown") !== intent) return false;
    if (filter === "failed") return !entry.ok;
    if (filter === "needs")
      return entry.awaitingCount > 0 || entry.missingCount > 0 || entry.reportStatus === "blocked";
    return true;
  });

  return (
    <Card>
      <CardHead
        title="יומן בקשות"
        hint={`${rows.length} מתוך ${entries.length} בקשות`}
        right={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => exportCsv(rows)} disabled={!rows.length}>
              ייצוא CSV
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (confirm("לנקות את יומן הבקשות המקומי? הרשומות של מילו עצמו לא ייפגעו.")) {
                  activityStore.clear();
                }
              }}
              disabled={!entries.length}
            >
              נקה
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-5 py-3">
        {(["all", "needs", "failed"] as Filter[]).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === option
                ? "border-ink-900 bg-ink-900 text-champagne"
                : "border-line bg-white text-body hover:border-ink-300"
            }`}
          >
            {{ all: "הכול", needs: "דורש את סיגל", failed: "נכשלו" }[option]}
          </button>
        ))}
        <select
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          className="ms-auto rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-body focus:border-ink-500 focus:outline-none"
        >
          <option value="all">כל הכוונות</option>
          {intents.map((value) => (
            <option key={value} value={value}>
              {intentLabel(value)}
            </option>
          ))}
        </select>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-start text-[11px] uppercase tracking-[0.06em] text-muted">
                <th className="px-5 py-2.5 font-semibold">מתי</th>
                <th className="px-3 py-2.5 font-semibold">מה נשאל</th>
                <th className="px-3 py-2.5 font-semibold">נותב אל</th>
                <th className="px-3 py-2.5 font-semibold">תוצאה</th>
                <th className="px-3 py-2.5 text-end font-semibold">לקח</th>
                <th className="px-5 py-2.5 font-semibold">סימונים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((entry) => (
                <tr key={entry.id} className="align-top hover:bg-paper">
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                    {when(entry.at)}
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <p className="truncate text-body">{entry.prompt || "—"}</p>
                    {entry.reportTitle && (
                      <p className="mt-0.5 truncate text-xs text-muted">{entry.reportTitle}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-700">
                    {intentLabel(entry.intent)}
                  </td>
                  <td className="px-3 py-3">
                    {entry.ok ? (
                      entry.reportStatus ? (
                        <StatusPill status={entry.reportStatus} />
                      ) : (
                        <span className="text-xs text-muted">נענה</span>
                      )
                    ) : (
                      <StatusPill status="error">נכשל</StatusPill>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-end text-xs tabular-nums text-muted">
                    {(entry.durationMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {[
                      entry.missingCount && `${entry.missingCount} חסרים`,
                      entry.awaitingCount && `${entry.awaitingCount} ממתינים`,
                      entry.withheldCount && `${entry.withheldCount} הוסתרו`,
                      entry.source === "scenario" && "הורץ מהתרחישים",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="אין התאמות"
          hint={entries.length ? "נסו סינון אחר." : "שאלו קודם את מילו משהו."}
        />
      )}
    </Card>
  );
}

function exportCsv(rows: ActivityEntry[]): void {
  const header = [
    "at",
    "source",
    "prompt",
    "intent",
    "status",
    "report_title",
    "report_status",
    "ok",
    "duration_ms",
    "missing",
    "awaiting",
    "withheld",
  ];
  const body = rows.map((entry) =>
    [
      entry.at,
      entry.source,
      entry.prompt,
      entry.intent ?? "",
      entry.status ?? "",
      entry.reportTitle ?? "",
      entry.reportStatus ?? "",
      String(entry.ok),
      String(entry.durationMs),
      String(entry.missingCount),
      String(entry.awaitingCount),
      String(entry.withheldCount),
    ]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(","),
  );

  const blob = new Blob([[header.join(","), ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `milo-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
