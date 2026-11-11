import { useEffect, useState } from "react";
import { ApiError, listActivity, listUsers } from "../lib/api";
import { useCached } from "../lib/cache";
import type { AllowedUser, ConsoleActivity } from "../types";
import { Card, DateField, Empty, Select, Tag } from "./ui";

/** Every action the server records (see the API's 0022 migration), grouped as the filter shows them. */
const GROUPS: { label: string; tone: "ink" | "warm" | "milo" | "claim"; actions: Record<string, string> }[] = [
  { label: "שאלות למילו", tone: "ink", actions: { chat: "שאלה למילו" } },
  {
    label: "משימות",
    tone: "warm",
    actions: {
      create_task: "יצירת משימה",
      resolve_task: "סימון משימה כטופלה",
      task_status: "שינוי סטטוס",
      task_assignee: "שיוך משימה",
      task_edit: "עריכת משימה",
      task_file: "צירוף קובץ",
      task_email: "פתיחת מייל",
      task_meeting: "קביעת פגישה",
    },
  },
  { label: "שיחות", tone: "milo", actions: { call_upload: "שליחת שיחה לתמלול", call_retry: "תמלול מחדש", call_delete: "מחיקת שיחה" } },
  {
    label: "מכירות",
    tone: "claim",
    actions: {
      sale_add: "הוספת שורה",
      sale_edit: "עריכת שורה",
      sale_delete: "מחיקת שורה",
      sheet_add: "פתיחת גיליון",
      sheet_edit: "שינוי שם גיליון",
      sheet_delete: "מחיקת גיליון",
      campaign_add: "יצירת מבצע",
      campaign_edit: "עריכת מבצע",
    },
  },
];
const groupOf = (action: string) => GROUPS.find((g) => action in g.actions);

/** The filter: a whole group (its actions, comma-separated), or one action in it. */
const ACTION_OPTIONS = [
  { value: "", label: "כל הפעולות" },
  ...GROUPS.flatMap((g) => {
    const keys = Object.keys(g.actions);
    return keys.length === 1
      ? [{ value: keys[0], label: g.label }]
      : [{ value: keys.join(","), label: `${g.label} — הכל` }, ...keys.map((k) => ({ value: k, label: `· ${g.actions[k]}` }))];
  }),
];

/**
 * Every action console users took — a question to Milo, a task marked done —
 * who took it and when, filtered by user and date. Admin-only; the server
 * enforces that, as with "ניהול משתמשים".
 */
export function UserActivity() {
  const [rows, setRows] = useCached<ConsoleActivity[] | null>("activity.rows", null);
  const [users, setUsers] = useCached<AllowedUser[]>("activity.users", []);
  const [email, setEmail] = useCached("activity.email", "");
  const [from, setFrom] = useCached("activity.from", "");
  const [to, setTo] = useCached("activity.to", "");
  const [action, setAction] = useCached("activity.action", "");
  const [error, setError] = useState<string | null>(null);
  //: The line clicked open, showing its request.
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    listUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    setRows(null);
    listActivity({
      email,
      // Whole local days: from the start of `from` to the end of `to`.
      since: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      until: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      action,
    })
      .then((result) => {
        setRows(result);
        setError(null);
      })
      .catch((exc) => {
        setRows([]);
        setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את הפעולות.");
      });
  }, [email, from, to, action]);

  // Everyone on the allowlist, plus anyone who acted but is not on it (e.g. the
  // admin set in the server's settings).
  const names = new Map(users.map((user) => [user.email, user.display_name || user.email]));
  for (const row of rows ?? []) {
    if (!names.has(row.user_email)) names.set(row.user_email, row.user_name || row.user_email);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-6 border-b border-line px-5 py-3 text-xs text-muted">
        <label className="flex w-full items-center gap-3 sm:w-auto">
          משתמש
          {/* The width sits on a wrapper: the field's own w-full overrides a width class. Full width on a phone. */}
          <div className="min-w-0 flex-1 sm:w-80 sm:flex-none">
            <Select
              value={email}
              onChange={setEmail}
              options={[{ value: "", label: "כולם" }, ...[...names].map(([address, name]) => ({ value: address, label: name }))]}
              className="py-1.5 text-xs"
            />
          </div>
        </label>
        <label className="flex w-full items-center gap-3 sm:w-auto">
          פעולה
          <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Select value={action} onChange={setAction} options={ACTION_OPTIONS} className="py-1.5 text-xs" />
          </div>
        </label>
        <label className="flex items-center gap-3">
          מתאריך
          <DateField value={from} onChange={setFrom} className="w-48" />
        </label>
        <label className="flex items-center gap-3">
          עד תאריך
          <DateField value={to} onChange={setTo} className="w-48" />
        </label>
      </div>
      {error && (
        <p className="mx-5 mt-5 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
          {error}
        </p>
      )}
      {rows === null ? (
        <p className="px-5 py-12 text-center text-sm text-muted">טוען…</p>
      ) : rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.id}
              onClick={() => setOpen(open === row.id ? null : row.id)}
              className="cursor-pointer px-5 py-3 hover:bg-paper/60"
            >
              <div className="flex flex-wrap items-baseline gap-x-3">
                <p className="text-sm font-medium text-ink-900">{row.user_name || row.user_email}</p>
                <p className="text-xs text-muted">
                  {new Date(row.at).toLocaleString("he-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <Tag tone={groupOf(row.action)?.tone ?? "neutral"}>{groupOf(row.action)?.actions[row.action] ?? row.action}</Tag>
                {row.customer && <p className="text-xs text-muted">לקוח: {row.customer}</p>}
              </div>
              {row.detail && <p className="mt-1 whitespace-pre-line text-sm text-body">{row.detail}</p>}
              {open === row.id && (
                <pre
                  dir="ltr"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 cursor-text overflow-x-auto rounded-xl border border-line bg-paper p-3 text-left font-mono text-xs leading-relaxed text-ink-900"
                >
                  {row.request ? JSON.stringify(row.request, null, 2) : "null"}
                </pre>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="אין פעולות" />
      )}
    </Card>
  );
}
