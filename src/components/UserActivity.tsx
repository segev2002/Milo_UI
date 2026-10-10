import { useEffect, useState } from "react";
import { ApiError, listActivity, listUsers } from "../lib/api";
import type { AllowedUser, ConsoleActivity } from "../types";
import { Card, Empty, Tag } from "./ui";

const ACTION_LABEL = { chat: "שאלה למילו", resolve_task: "סימן משימה כטופלה" } as const;

/**
 * Every action console users took — a question to Milo, a task marked done —
 * who took it and when, filtered by user and date. Admin-only; the server
 * enforces that, as with "ניהול משתמשים".
 */
export function UserActivity() {
  const [rows, setRows] = useState<ConsoleActivity[] | null>(null);
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    })
      .then((result) => {
        setRows(result);
        setError(null);
      })
      .catch((exc) => {
        setRows([]);
        setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את הפעולות.");
      });
  }, [email, from, to]);

  // Everyone on the allowlist, plus anyone who acted but is not on it (e.g. the
  // admin set in the server's settings).
  const names = new Map(users.map((user) => [user.email, user.display_name || user.email]));
  for (const row of rows ?? []) {
    if (!names.has(row.user_email)) names.set(row.user_email, row.user_name || row.user_email);
  }

  const field =
    "rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-body focus:border-ink-500 focus:outline-none";

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 text-xs text-muted">
        <label className="flex items-center gap-2">
          משתמש
          <select value={email} onChange={(event) => setEmail(event.target.value)} className={field}>
            <option value="">כולם</option>
            {[...names].map(([address, name]) => (
              <option key={address} value={address}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          מתאריך
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={field} />
        </label>
        <label className="flex items-center gap-2">
          עד תאריך
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={field} />
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
            <li key={row.id} className="px-5 py-3">
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
                <Tag tone={row.action === "chat" ? "ink" : "warm"}>{ACTION_LABEL[row.action]}</Tag>
                {row.customer && <p className="text-xs text-muted">לקוח: {row.customer}</p>}
              </div>
              {row.detail && <p className="mt-1 whitespace-pre-line text-sm text-body">{row.detail}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="אין פעולות" hint="אין פעולות שתואמות את הסינון." />
      )}
    </Card>
  );
}
