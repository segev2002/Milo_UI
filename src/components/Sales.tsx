import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { CircleDollarSign } from "lucide-react";
import { LuCheck, LuChevronDown, LuPencil, LuPlus, LuTarget, LuX } from "react-icons/lu";
import {
  ApiError,
  addSale,
  createCampaign,
  createSalesSheet,
  getSalesSheet,
  listCampaigns,
  listSalesSheets,
  renameSalesSheet,
  updateCampaign,
  updateSale,
} from "../lib/api";
import { INSURER_NAMES, insurerLogo } from "../lib/insurers";
import { useCached } from "../lib/cache";
import type { Campaign, CampaignCategory, SaleRow, SalesSheet, SalesSheetRows } from "../types";
import "../sheet.css";
import { Modal } from "./Tasks";
import { Button, Card, CardHead, DateField, Empty, FIELD, InsurerName, Select, Tag } from "./ui";

export const CATEGORY_LABEL: Record<CampaignCategory, string> = {
  premium: "פרמיה",
  pension: "ניוד קרן פנסיה",
  gemel: "ניוד קופות גמל",
  salary: "גובה שכר",
};

const ils = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;
const heDate = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString("he-IL");
const message = (exc: unknown, fallback: string) => (exc instanceof ApiError ? exc.message : fallback);

/**
 * The sales log — the spreadsheet Sigal used to keep ("הצעות 2026"), now kept
 * here — and her campaigns. Admins only; the server refuses everyone else.
 */
export function Sales({ focusCampaign }: { focusCampaign?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  //: Bumped on every saved cell, so the campaigns' totals follow the sheet.
  const [edits, setEdits] = useState(0);
  const changed = useCallback(() => setEdits((n) => n + 1), []);
  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
          {error}
        </p>
      )}
      <SalesSheetView onError={setError} onChange={changed} />
      <Campaigns onError={setError} focus={focusCampaign} edits={edits} />
    </div>
  );
}

/* --- campaigns ------------------------------------------------------------ */

function Campaigns({
  onError,
  focus,
  edits,
}: {
  onError: (e: string | null) => void;
  focus?: string | null;
  edits: number;
}) {
  const [campaigns, setCampaigns] = useCached<Campaign[] | null>("sales.campaigns", null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCampaigns(await listCampaigns());
    } catch (exc) {
      onError(message(exc, "לא הצלחתי לטעון את המבצעים."));
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, edits]);

  /** "הושלם": the campaign leaves the console, and Milo stops checking it. */
  async function complete(c: Campaign) {
    if (!confirm(`לסמן את "${campaignName(c)}" כהושלם? הוא יוסר מהקונסולה ומילו יפסיק לעדכן עליו.`)) return;
    try {
      await updateCampaign(c.id, { archived: true });
      await refresh();
    } catch (exc) {
      onError(message(exc, "העדכון נכשל."));
    }
  }

  return (
    <Card>
      <CardHead
        hint='כל בוקר ב-08:00 מילו בודק כל מבצע ומעדכן אותך בהתראות. נספרות רק מכירות בסטטוס "פוליסה", לפי תאריך המכירה.'
        right={
          <Button onClick={() => setCreating(true)}>
            <LuTarget className="h-4 w-4" />
            ליצור מבצע
          </Button>
        }
      />
      {campaigns === null ? (
        <p className="px-5 py-6 text-sm text-muted">טוען…</p>
      ) : campaigns.length === 0 ? (
        <Empty title="אין מבצעים פעילים" hint='לחצו "ליצור מבצע" כדי להגדיר יעד — למשל פרמיה של ₪100,000 בהראל בשלושה חודשים.' />
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              highlighted={focus === c.id}
              onEdit={() => setEditing(c)}
              onComplete={() => void complete(c)}
            />
          ))}
        </div>
      )}
      {(creating || editing) && (
        <CampaignForm
          campaign={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </Card>
  );
}

/** "פרמיה וניוד קרן פנסיה בהראל", or the title Sigal gave it. */
export function campaignName(c: { title?: string | null; insurer: string; goals: { category: CampaignCategory }[] }): string {
  if (c.title) return c.title;
  const labels = c.goals.map((g) => CATEGORY_LABEL[g.category]);
  const joined = labels.length <= 2 ? labels.join(" ו") : `${labels.slice(0, -1).join(", ")} ו${labels.at(-1)}`;
  return `${joined} ב${c.insurer}`;
}

function CampaignCard({
  campaign: c,
  highlighted,
  onEdit,
  onComplete,
}: {
  campaign: Campaign;
  highlighted: boolean;
  onEdit: () => void;
  onComplete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const state = c.achieved
    ? { text: "הושג היעד 🎉", tone: "ink" as const }
    : c.ended
      ? { text: "הסתיים", tone: "neutral" as const }
      : !c.started
        ? { text: `מתחיל ב-${heDate(c.start_date)}`, tone: "neutral" as const }
        : { text: `נותרו ${c.days_left} ימים`, tone: "warm" as const };

  return (
    <div
      ref={ref}
      className={`space-y-3 rounded-2xl border bg-white p-4 ${highlighted ? "border-ink-500 ring-2 ring-ink-100" : "border-line"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-semibold text-ink-900">{campaignName(c)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {heDate(c.start_date)} – {heDate(c.end_date)}
          </p>
        </div>
        <InsurerName name={c.insurer} className="text-sm font-medium text-ink-900" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag tone={state.tone}>{state.text}</Tag>
        {c.goals.length > 1 && (
          <Tag tone="ink">
            {c.goals.filter((g) => g.achieved).length} מתוך {c.goals.length} יעדים
          </Tag>
        )}
      </div>
      {/* A bar per category. */}
      {c.goals.map((g) => (
        <div key={g.category}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-ink-900">
              {CATEGORY_LABEL[g.category]}
              {g.achieved && " ✓"}
            </span>
            <span className="text-xs text-muted">
              <span className="font-semibold text-ink-900">{ils(g.total)}</span> מתוך {ils(g.target)}
            </span>
          </div>
          <div
            className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink-50"
            role="progressbar"
            aria-label={CATEGORY_LABEL[g.category]}
            aria-valuenow={g.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full ${g.achieved ? "bg-ink-700" : "bg-champagne-deep"}`}
              style={{ width: `${Math.max(g.percent, 1.5)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {g.achieved ? `${g.percent}% — הושג` : `${g.percent}% · חסרים ${ils(g.remaining)}`}
          </p>
        </div>
      ))}
      <div className="flex gap-2 border-t border-line pt-3">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <LuPencil className="h-3.5 w-3.5" />
          עריכה
        </Button>
        <Button size="sm" onClick={onComplete}>
          <LuCheck className="h-3.5 w-3.5" />
          הושלם
        </Button>
      </div>
    </div>
  );
}

/** A new campaign, or — with `campaign` — the edit of an existing one. */
const CATEGORIES = Object.keys(CATEGORY_LABEL) as CampaignCategory[];

/** A new campaign, or — with `campaign` — the edit of an existing one. */
function CampaignForm({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [insurer, setInsurer] = useState(campaign?.insurer ?? INSURER_NAMES[1] ?? INSURER_NAMES[0]);
  const [start, setStart] = useState(campaign?.start_date ?? "");
  const [end, setEnd] = useState(campaign?.end_date ?? "");
  //: A target per category; the amount is kept as typed until it is sent.
  const [goals, setGoals] = useState<{ category: CampaignCategory; target: string }[]>(
    campaign?.goals.map((g) => ({ category: g.category, target: String(g.target) })) ?? [
      { category: "premium", target: "" },
    ],
  );
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unused = CATEGORIES.filter((k) => !goals.some((g) => g.category === k));
  const setGoal = (i: number, change: Partial<(typeof goals)[number]>) =>
    setGoals(goals.map((g, j) => (j === i ? { ...g, ...change } : g)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!start || !end) return setError("בחרו תאריך התחלה ותאריך סיום.");
    if (end < start) return setError("תאריך הסיום לפני תאריך ההתחלה.");
    const parsed = goals.map((g) => ({ category: g.category, target: Number(g.target.replace(/[,₪\s]/g, "")) }));
    if (parsed.some((g) => !(g.target > 0))) return setError("הזינו לכל קטגוריה יעד בשקלים, מספר גדול מאפס.");
    setBusy(true);
    setError(null);
    try {
      const fields = { insurer, start_date: start, end_date: end, goals: parsed };
      if (campaign) await updateCampaign(campaign.id, { ...fields, title: title.trim() || null });
      else await createCampaign({ ...fields, title: title.trim() || undefined });
      onSaved();
    } catch (exc) {
      setError(message(exc, campaign ? "שמירת המבצע נכשלה." : "יצירת המבצע נכשלה."));
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-5 p-5 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{campaign ? "עריכת המבצע" : "מבצע חדש"}</h2>
        <Labelled label="חברת ביטוח">
          <Select value={insurer} onChange={setInsurer} options={INSURER_NAMES.map((n) => ({ value: n, label: n }))} />
        </Labelled>
        <div className="grid gap-5 sm:grid-cols-2">
          <Labelled label="מתאריך">
            <DateField value={start} onChange={setStart} />
          </Labelled>
          <Labelled label="עד תאריך">
            <DateField value={end} onChange={setEnd} />
          </Labelled>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-900">
            קטגוריות ויעדים
            <span className="mr-2 text-xs font-normal text-muted">יעד בשקלים לכל קטגוריה</span>
          </span>
          {/* Category | target | remove — a grid, so every row lines up. */}
          <div className="grid grid-cols-[minmax(0,1fr)_10rem_2.25rem] items-center gap-x-2 gap-y-2">
            {goals.map((g, i) => (
              <Fragment key={g.category}>
                <div className="min-w-0">
                  <Select
                    value={g.category}
                    onChange={(category) => setGoal(i, { category })}
                    options={[g.category, ...unused].map((k) => ({ value: k, label: CATEGORY_LABEL[k] }))}
                  />
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-sm font-semibold text-muted">₪</span>
                  <input
                    inputMode="numeric"
                    required
                    value={g.target}
                    onChange={(e) => setGoal(i, { target: e.target.value })}
                    placeholder="100,000"
                    aria-label={`היעד ל${CATEGORY_LABEL[g.category]}`}
                    className={`${FIELD} pl-7`}
                  />
                </div>
                {goals.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                    aria-label={`הסרת ${CATEGORY_LABEL[g.category]}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-paper hover:text-blocked"
                  >
                    <LuX className="h-4 w-4" />
                  </button>
                ) : (
                  <span />
                )}
              </Fragment>
            ))}
          </div>
          {unused.length > 0 && (
            <button
              type="button"
              onClick={() => setGoals([...goals, { category: unused[0], target: "" }])}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-ink-300 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              <LuPlus className="h-3.5 w-3.5" />
              קטגוריה נוספת
            </button>
          )}
        </div>
        <Labelled label="שם המבצע" hint="לא חובה">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={campaignName({ insurer, goals })}
            className={`${FIELD} text-base`}
          />
        </Labelled>
        {error && <p className="text-sm text-blocked">{error}</p>}
        <div className="flex gap-2 border-t border-line pt-5">
          <Button type="submit" disabled={busy}>
            {campaign ? "שמירה" : "יצירת המבצע"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* --- the sheet ------------------------------------------------------------ */

/** A column of the sheet. */
type Column = {
  letter: string;
  label: string;
  width: number;
  key: string;
  kind?: "date" | "ltr" | "insurer" | "status" | "choice";
  /** A money column: grouped at the left end, with a money icon on its header. */
  money?: boolean;
};

/** The sales columns, right to left: the sale, then the four money columns at the left end. */
const COLUMNS: Column[] = [
  { letter: "A", label: "תאריך מכירה", width: 104, key: "sale_date", kind: "date" },
  { letter: "B", label: "תאריך הפקה", width: 104, key: "production_date", kind: "date" },
  { letter: "C", label: "שם מבוטח", width: 140, key: "insured_name" },
  { letter: "D", label: "ת.ז", width: 104, key: "id_number", kind: "ltr" },
  { letter: "E", label: "סוג המוצר", width: 190, key: "product" },
  { letter: "F", label: "חברה", width: 92, key: "insurer", kind: "insurer" },
  { letter: "G", label: "סטטוס", width: 116, key: "status", kind: "choice" },
  { letter: "H", label: "מספר סוכן", width: 92, key: "agent_number", kind: "ltr" },
  { letter: "I", label: "סטטוס", width: 200, key: "notes", kind: "status" },
  { letter: "J", label: "פרמיה", width: 96, key: "premium", money: true },
  { letter: "K", label: "ניוד קרן פנסיה", width: 140, key: "pension", money: true },
  { letter: "L", label: "ניוד קופות גמל", width: 140, key: "gemel", money: true },
  { letter: "M", label: "גובה שכר", width: 110, key: "salary", money: true },
];
/** The statuses the status column offers. A row with another (older) one keeps it as an option. */
const STATUSES = ["פוליסה", "הצעה", "מינוי סוכן", "טרם נשלח", "הפקדה"];

/** One number of the tab's summary. */
function Stat({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
        {money && <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-ink-900">{value}</p>
    </div>
  );
}

/** The status filter's value for rows with no status. */
const NO_STATUS = "__none__";
/** Rows drawn even when the tab is short, so it reads as a sheet. */
const MIN_ROWS = 25;

/** "2026-01-05" → "5.1.2026", the way the sheet always wrote dates. */
function sheetDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

/** Every amount looks the same — "₪12,700" — whether "12700", "12.7K" or "12,700 ₪" was
    typed. Text that is not an amount ("עצמאי", "398$") is shown as typed. */
const amount = (n: number | null, raw: string | null) =>
  n != null ? `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}` : (raw ?? "");

function saleValue(row: SaleRow, key: string): string {
  switch (key) {
    case "sale_date":
      return sheetDate(row.sale_date);
    case "production_date":
      return sheetDate(row.production_date);
    case "premium":
      return amount(row.premium, row.premium_raw);
    case "pension":
      return amount(row.pension_amount, row.pension_raw);
    case "gemel":
      return amount(row.gemel_amount, row.gemel_raw);
    case "salary":
      return amount(row.salary, row.salary_raw);
    default:
      return (row[key as keyof SaleRow] as string | null) ?? "";
  }
}

/** A cell's automatic colour, from its text — in any column. */
function tone(text: string): string {
  const t = text.trim();
  if (["פוליסה", "בוצע", "הפקדה"].includes(t)) return "is-green";
  if (t === "טרם נשלח") return "is-red";
  if (t === "מינוי סוכן") return "is-pink";
  // "מסלקה", "מסלקה אצל איתמר" (and the sheet's "מסלקה אצלך איתמר").
  if (t.startsWith("מסלקה")) return "is-blue";
  return "";
}

/** "2026-10-01" for any day in October 2026 — how a tab's month is stored. */
function monthStart(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-01`;
}

/** "נובמבר 2026" for the month after the last tab. */
function nextMonth(sheets: SalesSheet[]): { title: string; month: string } {
  const months = sheets.map((s) => s.month).filter((m): m is string => !!m).sort();
  const last = months.at(-1);
  const base = last ? new Date(`${last}T00:00`) : new Date();
  const next = last ? new Date(base.getFullYear(), base.getMonth() + 1, 1) : new Date(base.getFullYear(), base.getMonth(), 1);
  const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { title: next.toLocaleDateString("he-IL", { month: "long", year: "numeric" }), month: iso };
}

/**
 * The log as a spreadsheet: the same columns as the workbook, a tab per month
 * along the bottom. Each cell is saved when it is left; typing into the first
 * empty row adds a row. Amounts are typed as before ("177K ₪") — the server
 * reads the number and keeps the text.
 */
function SalesSheetView({ onError, onChange }: { onError: (e: string | null) => void; onChange: () => void }) {
  const [sheets, setSheets] = useCached<SalesSheet[] | null>("sales.sheets", null);
  const [current, setCurrent] = useCached<string | null>("sales.current", null);
  const [sheet, setSheet] = useCached<SalesSheetRows | null>("sales.sheet", null);
  const [renaming, setRenaming] = useState(false);
  //: "" is every company.
  const [insurer, setInsurer] = useCached("sales.insurer", "");
  //: "" is every status; NO_STATUS the rows with none.
  const [status, setStatus] = useCached("sales.status", "");
  //: The cell the paint applies to — the last one clicked, kept after it loses focus.
  const [selected, setSelected] = useState<{ r: number; key: string } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  //: The empty row's sale while it is being created, so a second cell typed
  //  in quickly fills the same row instead of adding another.
  const creating = useRef<Promise<SaleRow> | undefined>(undefined);

  /** `opening`: the page was just opened, so show this month's tab (else the latest). */
  const loadSheets = useCallback(async (opening = false) => {
    try {
      const list = await listSalesSheets();
      setSheets(list);
      const thisMonth = list.find((s) => s.month === monthStart(new Date()))?.id;
      const fallback = thisMonth ?? list.at(-1)?.id ?? null;
      setCurrent((prev) => (!opening && prev && list.some((s) => s.id === prev) ? prev : fallback));
    } catch (exc) {
      onError(message(exc, "לא הצלחתי לטעון את הטבלאות."));
    }
  }, [onError]);

  const loadSheet = useCallback(async () => {
    if (!current) return setSheet(null);
    try {
      setSheet(await getSalesSheet(current));
    } catch (exc) {
      onError(message(exc, "לא הצלחתי לטעון את הטבלה."));
    }
  }, [current, onError]);

  useEffect(() => {
    void loadSheets(true);
  }, [loadSheets]);
  useEffect(() => {
    void loadSheet();
    setSelected(null);
  }, [loadSheet]);

  async function act(work: () => Promise<unknown>, fallback: string) {
    onError(null);
    try {
      await work();
    } catch (exc) {
      onError(message(exc, fallback));
    }
  }

  /** A cell left with new text: update its row, or add one when it was the empty row. */
  async function save(r: number, column: Column, text: string) {
    if (!sheet) return;
    const fields = { [column.key]: text || null };
    await act(async () => {
      const pending = !sheet.sales[r] ? creating.current : undefined;
      const row = sheet.sales[r] ?? (pending && (await pending));
      if (!row) {
        const adding = addSale(sheet.id, fields);
        creating.current = adding;
        const saved = await adding.finally(() => (creating.current = undefined));
        setSheet((s) => s && { ...s, sales: [...s.sales, saved] });
      } else {
        const saved = await updateSale(row.id, fields);
        setSheet((s) => s && { ...s, sales: s.sales.map((x) => (x.id === row.id ? saved : x)) });
      }
      onChange();
    }, "השמירה נכשלה.");
  }

  /** The chosen cell's background, or none (back to the automatic colour). */
  async function paint(color: string | null) {
    const row = selected && sheet?.sales[selected.r];
    if (!row || !selected) return;
    const colors = { ...(row.colors ?? {}) };
    if (color) colors[selected.key] = color;
    else delete colors[selected.key];
    await act(async () => {
      const saved = await updateSale(row.id, { colors });
      setSheet((s) => s && { ...s, sales: s.sales.map((x) => (x.id === row.id ? saved : x)) });
    }, "שמירת הצבע נכשלה.");
  }

  async function addTab() {
    if (!sheets) return;
    const { title, month } = nextMonth(sheets);
    await act(async () => {
      const created = await createSalesSheet(title, month);
      await loadSheets();
      setCurrent(created.id);
    }, "הוספת הגיליון נכשלה.");
  }

  async function rename(title: string) {
    setRenaming(false);
    if (!sheet || !title.trim() || title.trim() === sheet.title) return;
    await act(async () => {
      await renameSalesSheet(sheet.id, title.trim());
      await loadSheets();
      await loadSheet();
    }, "שינוי השם נכשל.");
  }

  /** Enter and the arrows move between rows, as in a spreadsheet. */
  /** Enter and the arrows move to the cell above or below on screen — with a
      filter on, that is not always the next row of the sheet. */
  function move(event: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" || event.key === "Enter" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    event.currentTarget.blur();
    // After the blur's save, which may have added the row the next cell belongs to.
    window.setTimeout(() => {
      const column = [...(grid.current?.querySelectorAll<HTMLElement>(`[data-cell$=":${c}"]`) ?? [])];
      const here = column.findIndex((el) => el.dataset.cell === `${r}:${c}`);
      column[here + step]?.focus();
    }, 60);
  }

  //: The filters: the sheet's rows of that company and status only (and the empty row, to add one).
  const statusOf = (s: SaleRow) => s.status?.trim() || NO_STATUS;
  const matches = (s: SaleRow) => (!insurer || s.insurer === insurer) && (!status || statusOf(s) === status);
  const shown = sheet ? sheet.sales.flatMap((s, i) => (matches(s) ? [i] : [])) : [];
  if (sheet) shown.push(sheet.sales.length);
  //: Padded with blank lines (-1) so a short tab still reads as a sheet.
  const lines = [...shown, ...Array.from({ length: Math.max(MIN_ROWS - shown.length, 0) }, () => -1)];
  //: Every company the console knows (מיטב among them, even in a month without it), then any other in the tab.
  const insurers = [
    ...INSURER_NAMES,
    ...[...new Set(sheet?.sales.map((s) => s.insurer).filter((n): n is string => !!n && !INSURER_NAMES.includes(n)) ?? [])].sort(),
  ];
  const statuses = [...new Set(sheet?.sales.map(statusOf) ?? [])].sort((a, b) =>
    a === NO_STATUS ? 1 : b === NO_STATUS ? -1 : a.localeCompare(b, "he"),
  );
  const policies = sheet?.sales.filter((r) => matches(r) && r.status?.trim() === "פוליסה") ?? [];
  const proposals = sheet?.sales.filter((r) => matches(r) && r.status?.trim() === "הצעה") ?? [];
  //: The summary's money: every row on screen, whatever its status.
  const counted = sheet?.sales.filter(matches) ?? [];
  const sum = (pick: (r: SaleRow) => number | null) => counted.reduce((n, r) => n + (pick(r) ?? 0), 0);
  const width = COLUMNS.reduce((n, c) => n + c.width, 0);

  return (
    <Card className="milo-sheet overflow-hidden">
      {/* The month on screen, where the explanation used to be. */}
      {sheets?.find((s) => s.id === current) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-base font-bold text-ink-900">{sheets.find((s) => s.id === current)!.title}</p>
            <div className="w-44">
              <Select
                value={insurer}
                onChange={setInsurer}
                options={[{ value: "", label: "כל החברות" }, ...insurers.map((n) => ({ value: n, label: n }))]}
                className="py-1.5 font-bold"
              />
            </div>
            <div className="w-44">
              <Select
                value={status}
                onChange={setStatus}
                options={[
                  { value: "", label: "כל הסטטוסים" },
                  ...statuses.map((s) => ({ value: s, label: s === NO_STATUS ? "ללא סטטוס" : s })),
                ]}
                className="py-1.5 font-bold"
              />
            </div>
          </div>
          <PaintBar enabled={!!(selected && sheet?.sales[selected.r])} onPaint={(color) => void paint(color)} />
        </div>
      )}

      {sheets === null ? (
        <p className="px-5 py-6 text-sm text-muted">טוען…</p>
      ) : sheets.length === 0 ? (
        <Empty title="אין עדיין גיליונות" hint='לחצו "+" למטה כדי לפתוח גיליון לחודש.' />
      ) : (
        <div ref={grid} className="overflow-x-auto px-5 pb-5">
          <table style={{ width: "100%", minWidth: width }}>
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.letter} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.letter} className="sheet-head" title={c.label}>
                    {c.money ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CircleDollarSign className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                        {c.label}
                      </span>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet &&
                lines.map((r, n) => {
                  const sale = r >= 0 ? sheet.sales[r] : undefined;
                  return (
                    <tr key={r >= 0 ? r : `blank-${n}`}>
                      {COLUMNS.map((c, ci) => {
                        // Only the existing rows and the first empty one can be typed in.
                        if (!sale && r !== sheet.sales.length) return <td key={c.letter} className="is-disabled" />;
                        const value = sale ? saleValue(sale, c.key) : "";
                        const painted = sale?.colors?.[c.key];
                        const look = {
                          className: `${painted ? "is-painted" : c.kind === "insurer" ? "" : tone(value)} ${
                            selected?.r === r && selected.key === c.key ? "is-selected" : ""
                          }`,
                          style: painted ? { background: painted, color: textOn(painted) } : undefined,
                        };
                        const pick = () => setSelected({ r, key: c.key });
                        if (c.kind === "choice")
                          return (
                            <td key={c.letter} {...look} className={`${look.className} relative`}>
                              <select
                                key={`${sale?.id ?? "new"}:${value}`}
                                data-cell={`${r}:${ci}`}
                                defaultValue={value}
                                onFocus={pick}
                                onChange={(e) => void save(r, c, e.target.value)}
                                className="sheet-cell sheet-select"
                                aria-label="סטטוס"
                              >
                                <option value="" />
                                {[...STATUSES, ...(value && !STATUSES.includes(value) ? [value] : [])].map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <LuChevronDown
                                aria-hidden
                                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70"
                              />
                            </td>
                          );
                        if (c.kind === "insurer")
                          return (
                            <td key={c.letter} {...look}>
                              <InsurerCell
                                key={`${sale?.id ?? "new"}:${value}`}
                                cell={`${r}:${ci}`}
                                value={value}
                                onFocus={pick}
                                onSave={(text) => void save(r, c, text)}
                                onKeyDown={(e) => move(e, r, ci)}
                              />
                            </td>
                          );
                        return (
                          <td key={c.letter} {...look}>
                            <input
                              onFocus={pick}
                              // Re-mounted when the saved value changes, so the cell shows what was kept.
                              key={`${sale?.id ?? "new"}:${value}`}
                              data-cell={`${r}:${ci}`}
                              defaultValue={value}
                              dir={c.kind === "ltr" ? "ltr" : undefined}
                              onBlur={(e) => {
                                const text = e.target.value.trim();
                                if (text !== value) void save(r, c, text);
                              }}
                              onKeyDown={(e) => move(e, r, ci)}
                              className={`sheet-cell ${c.kind === "ltr" ? "text-right" : ""}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <datalist id="sheet-insurers">
            {INSURER_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      )}

      {/* The sheet tabs along the bottom, and the tab's totals. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2">
        <button
          onClick={() => void addTab()}
          aria-label="גיליון חדש"
          title="גיליון לחודש הבא"
          className="rounded-lg p-1.5 text-ink-700 transition-colors hover:bg-ink-50"
        >
          <LuPlus className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {sheets?.map((s) =>
            s.id === current && renaming ? (
              <input
                key={s.id}
                autoFocus
                defaultValue={s.title}
                onBlur={(e) => void rename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="w-32 shrink-0 rounded-lg border border-ink-300 bg-transparent px-3 py-1.5 text-sm outline-none"
              />
            ) : (
              <span
                key={s.id}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  s.id === current ? "bg-ink-900 text-champagne" : "text-ink-700 hover:bg-ink-50"
                }`}
              >
                <button
                  onClick={() => (s.id === current ? setRenaming(true) : setCurrent(s.id))}
                  title={s.id === current ? "לחיצה לשינוי השם" : undefined}
                >
                  {s.title}
                </button>
              </span>
            ),
          )}
        </div>
      </div>

      {/* The tab's summary, on its own strip below the tabs. Its money adds up
          every row on screen (the filters apply), whatever its status. */}
      {sheet && (
        <div className="border-t border-line px-5 py-4">
          {(insurer || status) && (
            <p className="mb-3 text-sm font-bold text-ink-700">
              {[insurer, status && (status === NO_STATUS ? "ללא סטטוס" : status)].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="פוליסות" value={String(policies.length)} />
            <Stat label="הצעות" value={String(proposals.length)} />
            <Stat label="פרמיה" value={ils(sum((r) => r.premium))} money />
            <Stat label="ניוד קרן פנסיה" value={ils(sum((r) => r.pension_amount))} money />
            <Stat label="ניוד קופות גמל" value={ils(sum((r) => r.gemel_amount))} money />
            <Stat label="גובה שכר" value={ils(sum((r) => r.salary))} money />
          </div>
          <p className="mt-2 text-xs text-muted">הסכומים כוללים את כל השורות, בכל סטטוס.</p>
        </div>
      )}
    </Card>
  );
}

/** Strong colours first, then their light shades — the swatches of the paint bar. */
const PAINTS = [
  "#16a34a", "#dc2626", "#f59e0b", "#2563eb", "#7c3aed", "#db2777", "#0d9488", "#4b5563",
  "#bbf7d0", "#fecaca", "#fef08a", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#99f6e4", "#e5e7eb",
];  // prettier-ignore

/** White text on a dark colour, dark text on a light one. */
function textOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? "#1f2937" : "#ffffff";
}

/**
 * Paint the chosen cell: a swatch, any colour from the picker, or none — which
 * gives a status cell its automatic green / red back. The swatches do not take
 * focus, so the cell being typed in keeps it.
 */
function PaintBar({ enabled, onPaint }: { enabled: boolean; onPaint: (color: string | null) => void }) {
  //: The picker reports every colour it passes through; only the one it settles on is saved.
  const settle = useRef<number | undefined>(undefined);
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${enabled ? "" : "pointer-events-none opacity-40"}`}
      title={enabled ? undefined : "בחרו תא כדי לצבוע אותו"}
    >
      <span className="me-1 text-xs font-bold text-muted">צבע לתא</span>
      {PAINTS.map((color) => (
        <button
          key={color}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPaint(color)}
          aria-label={`צביעה ב-${color}`}
          className="h-6 w-6 rounded-md border border-black/10 transition-transform hover:scale-110"
          style={{ background: color }}
        />
      ))}
      <label
        className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-md border border-black/10"
        title="צבע אחר"
        style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
      >
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const color = e.target.value;
            window.clearTimeout(settle.current);
            settle.current = window.setTimeout(() => onPaint(color), 400);
          }}
          aria-label="צבע אחר"
        />
      </label>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPaint(null)}
        className="ms-1 rounded-md border border-line px-2 py-0.5 text-xs font-bold text-ink-700 hover:bg-ink-50"
      >
        ללא צבע
      </button>
    </div>
  );
}

/**
 * The company column: the insurer's logo when it is one we know, the name
 * otherwise. Clicking (or arriving by keyboard) turns it back into text to
 * edit; once a known name is typed and the cell left, its logo takes its place.
 */
function InsurerCell({
  cell,
  value,
  onSave,
  onKeyDown,
  onFocus,
}: {
  cell: string;
  value: string;
  onSave: (text: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
}) {
  const logo = insurerLogo(value);
  const [editing, setEditing] = useState(!logo);
  if (!editing && logo)
    return (
      <button
        data-cell={cell}
        onFocus={() => {
          onFocus();
          setEditing(true);
        }}
        onClick={() => setEditing(true)}
        title={value}
        className="sheet-cell flex items-center justify-center"
      >
        <img src={logo} alt={value} className="h-5 w-auto max-w-full object-contain" />
      </button>
    );
  return (
    <input
      data-cell={cell}
      autoFocus={!!logo}
      defaultValue={value}
      list="sheet-insurers"
      onFocus={onFocus}
      onBlur={(e) => {
        const text = e.target.value.trim();
        if (text !== value) onSave(text);
        else if (logo) setEditing(false);
      }}
      onKeyDown={onKeyDown}
      className="sheet-cell"
    />
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-900">
        {label}
        {hint && <span className="mr-2 text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
