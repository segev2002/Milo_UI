import { useEffect, useState } from "react";
import { ApiError, ownerKeys, ownerUsage, setKeyExpiry } from "../lib/api";
import type { ApiKeyExpiry, UsageMonth, UsageRow } from "../types";
import { Button, Card, CardHead, Empty, Tag } from "./ui";

/** The monthly fee each agency pays, against which its cost is shown. */
const FEE_ILS = 500;
/** USD → ₪ for the comparison only. An estimate: the costs themselves are in USD. */
const USD_TO_ILS = 3.7;

const KINDS: { kind: UsageRow["kind"]; label: string }[] = [
  { kind: "chat", label: "שיחות AI" },
  { kind: "pdf", label: "קריאת PDF" },
  { kind: "transcription", label: "תמלול" },
  { kind: "whatsapp", label: "וואטסאפ" },
  { kind: "sms", label: "SMS" },
];

const thisMonth = () => new Date().toISOString().slice(0, 7);
const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * עלויות ומפתחות — Milo's owner only (the server refuses everyone else): what
 * each agency cost this month against its fee, and when its API keys expire.
 */
export function Owner() {
  const [month, setMonth] = useState(thisMonth());
  const [usage, setUsage] = useState<UsageMonth | null>(null);
  const [keys, setKeys] = useState<ApiKeyExpiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ agencyId: number; key: string; date: string } | null>(null);

  useEffect(() => {
    setUsage(null);
    ownerUsage(month)
      .then(setUsage)
      .catch((exc) => setError(exc instanceof ApiError ? exc.message : "הטעינה נכשלה."));
  }, [month]);

  const loadKeys = () =>
    ownerKeys()
      .then(setKeys)
      .catch(() => setKeys([]));
  useEffect(() => void loadKeys(), []);

  async function saveKey() {
    if (!editing?.date || !editing.key.trim()) return;
    try {
      await setKeyExpiry(editing.agencyId, editing.key.trim(), editing.date);
      setEditing(null);
      await loadKeys();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "השמירה נכשלה.");
    }
  }

  const agencies = usage ? [...usage.agencies.map((a) => ({ id: a.id as number | null, name: a.name }))] : [];
  if (usage?.rows.some((r) => r.agency_id === null)) agencies.push({ id: null, name: "לפני בחירת סוכנות" });
  const cost = (id: number | null, kind?: string) =>
    (usage?.rows ?? [])
      .filter((r) => r.agency_id === id && (!kind || r.kind === kind))
      .reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const calls = (id: number | null, kind: string) =>
    (usage?.rows ?? []).filter((r) => r.agency_id === id && r.kind === kind).reduce((sum, r) => sum + r.calls, 0);

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[0.875rem] text-blocked">{error}</p>
      )}

      <Card>
        <CardHead
          hint={`עלות לכל סוכנות בחודש, מול דמי המנוי (₪${FEE_ILS}). ₪ לפי $1 = ₪${USD_TO_ILS}, הערכה בלבד.`}
          right={
            <input
              type="month"
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-sm"
              dir="ltr"
            />
          }
        />
        {!usage ? (
          <Empty title="טוען…" />
        ) : agencies.length === 0 ? (
          <Empty title="אין סוכנויות" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-right text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">סוכנות</th>
                  {KINDS.map((k) => (
                    <th key={k.kind} className="px-3 py-3 font-medium">
                      {k.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium">סה״כ</th>
                  <th className="px-5 py-3 font-medium">מתוך ₪{FEE_ILS}</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => {
                  const total = cost(a.id);
                  const ils = total * USD_TO_ILS;
                  const share = Math.round((ils / FEE_ILS) * 100);
                  return (
                    <tr key={a.id ?? "none"} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium text-ink-900">{a.name}</td>
                      {KINDS.map((k) => (
                        <td key={k.kind} className="px-3 py-3 tabular-nums" title={`${calls(a.id, k.kind)} קריאות`}>
                          {usd(cost(a.id, k.kind))}
                          <span className="block text-[0.75rem] text-muted">{calls(a.id, k.kind)}</span>
                        </td>
                      ))}
                      <td className="px-3 py-3 font-medium tabular-nums">
                        {usd(total)}
                        <span className="block text-[0.75rem] text-muted">≈ ₪{ils.toFixed(0)}</span>
                      </td>
                      <td className="px-5 py-3">
                        {a.id === null ? "—" : <Tag tone={share >= 50 ? "claim" : share >= 20 ? "warm" : "ink"}>{share}%</Tag>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          hint="מפתחות שפגים (Surense: 180 יום). 14 יום לפני — מייל אליך. אחרי חידוש: עדכנו את התאריך."
          right={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing({ agencyId: usage?.agencies[0]?.id ?? 0, key: "surense", date: "" })}
            >
              מפתח חדש
            </Button>
          }
        />
        {editing && (
          <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
            <select
              value={editing.agencyId}
              onChange={(event) => setEditing({ ...editing, agencyId: Number(event.target.value) })}
              className="rounded-xl border border-line bg-paper px-3 py-2 text-sm"
            >
              {(usage?.agencies ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              value={editing.key}
              onChange={(event) => setEditing({ ...editing, key: event.target.value })}
              className="w-32 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
              dir="ltr"
            />
            <input
              type="date"
              value={editing.date}
              onChange={(event) => setEditing({ ...editing, date: event.target.value })}
              className="rounded-xl border border-line bg-paper px-3 py-2 text-sm"
              dir="ltr"
            />
            <Button size="sm" onClick={() => void saveKey()} disabled={!editing.date}>
              שמירה
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              ביטול
            </Button>
          </div>
        )}
        {!keys ? (
          <Empty title="טוען…" />
        ) : keys.length === 0 ? (
          <Empty title="אין מפתחות במעקב" hint="הוסיפו את מפתח ה-Surense של כל סוכנות עם תאריך התפוגה שלו." />
        ) : (
          <ul className="divide-y divide-line">
            {keys.map((k) => (
              <li key={`${k.agency_id}-${k.key_name}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-medium text-ink-900">{k.agency}</span>
                <span className="text-muted" dir="ltr">
                  {k.key_name}
                </span>
                <span className="text-muted" dir="ltr">
                  {k.expires_at}
                </span>
                <Tag tone={k.days_left <= 14 ? "claim" : k.days_left <= 30 ? "warm" : "ink"}>
                  {k.days_left < 0 ? "פג" : `עוד ${k.days_left} ימים`}
                </Tag>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => setEditing({ agencyId: k.agency_id, key: k.key_name, date: k.expires_at })}
                >
                  עדכון תאריך
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
