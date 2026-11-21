import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type WheelEvent as ReactWheelEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { CircleDollarSign } from "lucide-react";
import {
  LuCalculator,
  LuCalendarDays,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTarget,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import {
  ApiError,
  addSale,
  createCampaign,
  createSalesSheet,
  deleteSale,
  deleteSalesSheet,
  getSalesSheet,
  listCampaigns,
  listSalesSheets,
  renameSalesSheet,
  updateCampaign,
  updateSale,
  updateSalesSheet,
} from "../lib/api";
import { INSURER_NAMES, insurerLogo } from "../lib/insurers";
import { useCached } from "../lib/cache";
import type { Campaign, CampaignCategory, SaleRow, SalesSheet, SalesSheetRows, SheetColumn, SheetStat } from "../types";
import "../sheet.css";
import { Modal } from "./Tasks";
import { Button, Card, CardHead, confirmDialog, DateField, Empty, FIELD, InsurerName, Select, Tag } from "./ui";

export const CATEGORY_LABEL: Record<CampaignCategory, string> = {
  premium: "פרמיה",
  savings: "תוכניות חסכון",
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
        <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[0.875rem] leading-relaxed text-blocked">
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
    if (!(await confirmDialog({ title: `לסמן את "${campaignName(c)}" כהושלם?`, confirmLabel: "הושלם" }))) return;
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
        <Empty title="אין מבצעים פעילים" />
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
          <p className="truncate font-display text-[1rem] font-semibold text-ink-900">{campaignName(c)}</p>
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
/** The insurer picker's "אחר": any company or agency, typed. */
const OTHER = "__other__";

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
  const initial = campaign?.insurer ?? INSURER_NAMES[1] ?? INSURER_NAMES[0];
  const known = INSURER_NAMES.includes(initial);
  //: The picker's choice: a company, or OTHER — then `other` is the name typed (e.g. "ONE סוכנות").
  const [picked, setPicked] = useState(known ? initial : OTHER);
  const [other, setOther] = useState(known ? "" : initial);
  const insurer = picked === OTHER ? other.trim() : picked;
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
    if (!insurer) return setError('כתבו את שם החברה או הסוכנות של המבצע.');
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
          <Select
            value={picked}
            onChange={setPicked}
            options={[...INSURER_NAMES.map((n) => ({ value: n, label: n })), { value: OTHER, label: "אחר" }]}
          />
          {picked === OTHER && (
            <input
              autoFocus
              required
              maxLength={60}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="למשל: ONE סוכנות"
              aria-label="שם החברה או הסוכנות"
              className={`${FIELD} mt-2 text-base`}
            />
          )}
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

type Kind = "date" | "ltr" | "insurer" | "status" | "choice";

/** A column on screen: the tab's own (its id, name and width), and how its cells work. */
type Column = SheetColumn & {
  kind?: Kind;
  /** A money column: a money icon on its header, its amounts summed as numbers. */
  money?: boolean;
  /** One an admin added: its cells are text, kept in the row's `extra`. */
  added: boolean;
};

/** The standard columns — each a field of the sale — right to left as Sigal's workbook had them. */
const STANDARD: Record<string, { label: string; width: number; kind?: Kind; money?: boolean }> = {
  sale_date: { label: "תאריך מכירה", width: 100, kind: "date" },
  production_date: { label: "תאריך הפקה", width: 100, kind: "date" },
  insured_name: { label: "שם מבוטח", width: 136 },
  id_number: { label: "ת.ז", width: 100, kind: "ltr" },
  product: { label: "סוג המוצר", width: 164 },
  insurer: { label: "חברה", width: 92, kind: "insurer" },
  status: { label: "סטטוס", width: 112, kind: "choice" },
  agent_number: { label: "מספר סוכן", width: 88, kind: "ltr" },
  notes: { label: "סטטוס", width: 176, kind: "status" },
  premium: { label: "פרמיה", width: 112, money: true },
  savings: { label: "תוכניות חסכון", width: 128, money: true },
  pension: { label: "ניוד קרן פנסיה", width: 128, money: true },
  gemel: { label: "ניוד קופות גמל", width: 128, money: true },
  salary: { label: "גובה שכר", width: 104, money: true },
};
/** A tab no admin has changed has these columns. */
const DEFAULT_COLUMNS: SheetColumn[] = Object.entries(STANDARD).map(([id, c]) => ({ id, label: c.label, width: c.width }));
/** …and this summary: the policies and proposals, and each money column's total. */
const DEFAULT_SUMMARY: SheetStat[] = [
  { label: "פוליסות", op: "count_value", column: "status", value: "פוליסה" },
  { label: "הצעות", op: "count_value", column: "status", value: "הצעה" },
  ...(["premium", "savings", "pension", "gemel", "salary"] as const).map((id) => ({
    label: STANDARD[id].label,
    op: "sum" as const,
    column: id,
  })),
];
const OPS: { value: SheetStat["op"]; label: string }[] = [
  { value: "sum", label: "סכום" },
  { value: "avg", label: "ממוצע" },
  { value: "min", label: "הכי נמוך" },
  { value: "max", label: "הכי גבוה" },
  { value: "count", label: "כמה תאים מלאים" },
  { value: "count_value", label: "כמה פעמים מופיע…" },
];
/** The narrowest and widest a column may be dragged to. */
const MIN_WIDTH = 48;
const MAX_WIDTH = 600;

function columnsOf(sheet: SalesSheet): Column[] {
  return (sheet.columns ?? DEFAULT_COLUMNS)
    .filter((c) => c.id in STANDARD || c.id.startsWith("x_"))
    .map((c) => {
      const money = STANDARD[c.id]?.money;
      // Never narrower than its title: titles stay on one line.
      return { ...c, width: Math.max(c.width, titleWidth(c.label, !!money)), kind: STANDARD[c.id]?.kind, money, added: !(c.id in STANDARD) };
    });
}

const titleWidths = new Map<string, number>();
/** How wide a title is on one line, in 16px-text pixels (as widths are kept): its bold
    text, the money icon if it has one, and the cell's padding. */
function titleWidth(label: string, money: boolean): number {
  const key = `${money}:${label}`;
  let width = titleWidths.get(key);
  if (width === undefined) {
    const context = document.createElement("canvas").getContext("2d");
    if (context) context.font = `700 16px ${getComputedStyle(document.body).fontFamily}`;
    // Padding 0.875rem a side, and room for the pencil and the + on hover.
    width = Math.ceil((context?.measureText(label).width ?? label.length * 9) + 28 + 12 + (money ? 22 : 0));
    titleWidths.set(key, width);
  }
  return width;
}

/** A new column's id — "x_" and a short random one, as the server expects. */
const newColumnId = () => `x_${Math.random().toString(36).slice(2, 10)}`;

/** Pixels at 16px text, drawn in rem so a column grows with the console's text. */
const rem = (px: number) => `${px / 16}rem`;

/** How small the sheet may be drawn, so more of it fits on a laptop screen. */
const ZOOMS = [1, 0.9, 0.8, 0.7];
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

/** The number a money column keeps, by the column's id. */
const MONEY_FIELD: Record<string, keyof SaleRow> = {
  premium: "premium",
  savings: "savings",
  pension: "pension_amount",
  gemel: "gemel_amount",
  salary: "salary",
};

function saleValue(row: SaleRow, key: string): string {
  switch (key) {
    case "sale_date":
      return sheetDate(row.sale_date);
    case "production_date":
      return sheetDate(row.production_date);
    case "premium":
      return amount(row.premium, row.premium_raw);
    case "savings":
      return amount(row.savings, row.savings_raw);
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

/** What a cell shows: a standard column's field, or what was typed in an added one. */
function cellText(row: SaleRow, column: string): string {
  return column.startsWith("x_") ? (row.extra?.[column] ?? "") : saleValue(row, column);
}

/** A cell as a number for the summary: "12,700", "₪12.7K", "1.2M" — or null when it is not one. */
function cellNumber(row: SaleRow, column: string): number | null {
  if (MONEY_FIELD[column]) return (row[MONEY_FIELD[column]] as number | null) ?? null;
  const match = cellText(row, column)
    .replace(/[₪,\s]/g, "")
    .match(/^(-?\d+(?:\.\d+)?)([kK]|[mM])?$/);
  if (!match) return null;
  return Number(match[1]) * (match[2] ? (/k/i.test(match[2]) ? 1_000 : 1_000_000) : 1);
}

/** A summary box's value over the rows on screen. */
function statValue(stat: SheetStat, rows: SaleRow[]): string {
  if (stat.op === "count") return String(rows.filter((r) => cellText(r, stat.column).trim()).length);
  if (stat.op === "count_value")
    return String(rows.filter((r) => cellText(r, stat.column).trim() === (stat.value ?? "").trim()).length);
  const numbers = rows.map((r) => cellNumber(r, stat.column)).filter((n): n is number => n != null);
  const total = numbers.reduce((n, x) => n + x, 0);
  const result =
    stat.op === "sum"
      ? total
      : !numbers.length
        ? 0
        : stat.op === "avg"
          ? total / numbers.length
          : stat.op === "min"
            ? Math.min(...numbers)
            : Math.max(...numbers);
  return MONEY_FIELD[stat.column] ? ils(result) : result.toLocaleString("he-IL", { maximumFractionDigits: 2 });
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

/** "נובמבר 2026" — a month tab's name, from its "YYYY-MM-01". */
function monthTitle(month: string): string {
  return new Date(`${month}T00:00`).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

/** Moving the sheet sideways (from the scrollbar pinned under it). The sheet's box only
    clips — a box that scrolls can't have titles that stick to the page — so the table is
    slid inside it instead. RTL: scrolling toward the start (negative) slides it right. */
function slide(table: HTMLTableElement | null, rail: HTMLElement | null, zoom: number) {
  if (table && rail) table.style.transform = `translateX(${-rail.scrollLeft / zoom}px)`;
}

/** A right-click menu: what can be done to a column, a row or a tab. */
type MenuItem = { label: string; onClick: () => void; danger?: boolean; disabled?: boolean };
type OpenMenu = { x: number; y: number; items: MenuItem[] };

/**
 * The log as a spreadsheet: a tab per month along the bottom. Each cell is saved
 * when it is left; typing into the first empty row adds a row. Amounts are typed
 * as before ("177K ₪") — the server reads the number and keeps the text.
 *
 * Like a spreadsheet, the admins shape each tab: a title's pencil renames its
 * column, a + on either side adds one there, dragging a title moves the column and
 * dragging its edge resizes it; right-click a row to delete it, a tab to rename or
 * delete it. The summary under the tabs is theirs too ("התאמת הסיכום"). All of it
 * is saved with the tab, for every admin, and a new tab starts with the same.
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
  //: A client's name or ID number.
  const [query, setQuery] = useState("");
  //: The cell the paint applies to — the last one clicked, kept after it loses focus.
  const [selected, setSelected] = useState<{ r: number; key: string } | null>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  //: The column whose title is being typed.
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null);
  //: The title being dragged, and the one it is over.
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useSheetZoom();
  const toolbar = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  //: How wide the pinned scrollbar's track is: the sheet's width with its padding.
  const [railWidth, setRailWidth] = useState(0);
  //: The toolbar's height: the titles stick just under it.
  const [toolbarHeight, setToolbarHeight] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setRailWidth((table.current?.getBoundingClientRect().width ?? 0) + 40);
      setToolbarHeight(toolbar.current?.offsetHeight ?? 0);
    });
    if (table.current) observer.observe(table.current);
    if (toolbar.current) observer.observe(toolbar.current);
    return () => observer.disconnect();
  });
  useEffect(() => slide(table.current, rail.current, zoom), [zoom]);

  /** A trackpad's sideways swipe over the sheet moves it, as on any scrolling box. */
  function swipe(event: ReactWheelEvent) {
    const x = event.shiftKey ? event.deltaY : event.deltaX;
    if (rail.current && Math.abs(x) > Math.abs(event.shiftKey ? 0 : event.deltaY)) rail.current.scrollLeft += x;
  }

  /** A cell reached by keyboard (Tab, the arrows) is slid into view. */
  function reveal(event: ReactFocusEvent) {
    const box = grid.current?.getBoundingClientRect();
    const cell = (event.target as HTMLElement).getBoundingClientRect();
    if (!box || !rail.current) return;
    const margin = 24;
    if (cell.left < box.left + margin) rail.current.scrollLeft -= box.left + margin - cell.left;
    else if (cell.right > box.right - margin) rail.current.scrollLeft += cell.right - (box.right - margin);
  }
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
    // An added column's cells travel together, as the row's whole `extra`.
    const fields = (row?: SaleRow) =>
      column.added ? { extra: { ...(row?.extra ?? {}), [column.id]: text } } : { [column.id]: text || null };
    await act(async () => {
      const pending = !sheet.sales[r] ? creating.current : undefined;
      const row = sheet.sales[r] ?? (pending && (await pending));
      if (!row) {
        const adding = addSale(sheet.id, fields());
        creating.current = adding;
        const saved = await adding.finally(() => (creating.current = undefined));
        setSheet((s) => s && { ...s, sales: [...s.sales, saved] });
      } else {
        const saved = await updateSale(row.id, fields(row));
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
    // On screen at once; saved behind it, and put back if the save fails.
    const swap = (to: Record<string, string>) =>
      setSheet((s) => s && { ...s, sales: s.sales.map((x) => (x.id === row.id ? { ...x, colors: to } : x)) });
    swap(colors);
    await act(async () => {
      try {
        await updateSale(row.id, { colors });
      } catch (exc) {
        swap(row.colors ?? {});
        throw exc;
      }
    }, "שמירת הצבע נכשלה.");
  }

  /** A new tab for the next month — with the current tab's columns and summary, as a copied sheet would have. */
  /** A tab for `month` ("YYYY-MM-01") — with the current tab's columns and summary, as a copied sheet would have. */
  async function addMonth(month: string) {
    await act(async () => {
      const created = await createSalesSheet(monthTitle(month), month);
      const shape = { ...(sheet?.columns ? { columns: sheet.columns } : {}), ...(sheet?.summary ? { summary: sheet.summary } : {}) };
      if (Object.keys(shape).length) await updateSalesSheet(created.id, shape);
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

  async function deleteTab(tab: SalesSheet) {
    const ok = await confirmDialog({ title: `למחוק את הגיליון "${tab.title}" וכל השורות בו?`, confirmLabel: "מחיקה", danger: true });
    if (!ok) return;
    await act(async () => {
      await deleteSalesSheet(tab.id);
      if (tab.id === current) setCurrent(null);
      await loadSheets();
      onChange();
    }, "מחיקת הגיליון נכשלה.");
  }

  async function deleteRow(row: SaleRow) {
    const who = row.insured_name || row.product || "השורה";
    if (!(await confirmDialog({ title: `למחוק את השורה של ${who}?`, confirmLabel: "מחיקה", danger: true }))) return;
    await act(async () => {
      await deleteSale(row.id);
      setSheet((s) => s && { ...s, sales: s.sales.filter((x) => x.id !== row.id) });
      setSelected(null);
      onChange();
    }, "מחיקת השורה נכשלה.");
  }

  /** The tab's columns, changed: on screen at once, then saved (and reloaded if that fails). */
  async function saveColumns(next: SheetColumn[]) {
    if (!sheet) return;
    setSheet((s) => s && { ...s, columns: next });
    await act(async () => {
      try {
        await updateSalesSheet(sheet.id, { columns: next });
      } catch (exc) {
        await loadSheet();
        throw exc;
      }
    }, "שמירת העמודות נכשלה.");
  }

  async function saveSummary(next: SheetStat[]) {
    if (!sheet) return;
    setEditingSummary(false);
    setSheet((s) => s && { ...s, summary: next });
    await act(async () => {
      try {
        await updateSalesSheet(sheet.id, { summary: next });
      } catch (exc) {
        await loadSheet();
        throw exc;
      }
    }, "שמירת הסיכום נכשלה.");
  }

  /** A new column next to the one at `at`: on its right ("right") or its left. */
  function addColumn(at: number, side: "right" | "left") {
    if (!sheet) return;
    const list = sheet.columns ?? DEFAULT_COLUMNS;
    const index = side === "right" ? at : at + 1;
    const added: SheetColumn = { id: newColumnId(), label: "עמודה חדשה", width: 120 };
    void saveColumns([...list.slice(0, index), added, ...list.slice(index)]);
    // Its name is the first thing to type.
    setRenamingColumn(added.id);
  }

  /** A title dragged onto another: the column moves to that place. */
  function moveColumn(id: string, to: number) {
    if (!sheet) return;
    const list = [...(sheet.columns ?? DEFAULT_COLUMNS)];
    const from = list.findIndex((c) => c.id === id);
    if (from < 0 || from === to) return;
    const [moving] = list.splice(from, 1);
    list.splice(to, 0, moving);
    void saveColumns(list);
  }

  function renameColumn(id: string, label: string) {
    setRenamingColumn(null);
    const list = sheet?.columns ?? DEFAULT_COLUMNS;
    const clean = label.trim().slice(0, 60);
    if (!clean || list.find((c) => c.id === id)?.label === clean) return;
    void saveColumns(list.map((c) => (c.id === id ? { ...c, label: clean } : c)));
  }

  /** Dragging a title's edge: the width follows the pointer, and is saved on letting go. */
  function startResize(event: ReactPointerEvent<HTMLSpanElement>, id: string) {
    if (!sheet) return;
    event.preventDefault();
    event.stopPropagation();
    const list = sheet.columns ?? DEFAULT_COLUMNS;
    const startX = event.clientX;
    const startWidth = list.find((c) => c.id === id)?.width ?? 100;
    // Pixels on screen → the 16px-text pixels a width is kept in.
    const scale = (parseFloat(getComputedStyle(document.documentElement).fontSize) / 16) * zoom;
    let width = startWidth;
    const resize = (e: PointerEvent) => {
      // RTL: a column's end is its left edge, so dragging left widens it.
      width = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (startX - e.clientX) / scale)));
      setSheet((s) => s && { ...s, columns: list.map((c) => (c.id === id ? { ...c, width } : c)) });
    };
    const stop = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
      if (width !== startWidth) void saveColumns(list.map((c) => (c.id === id ? { ...c, width } : c)));
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop);
  }

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

  const columns = sheet ? columnsOf(sheet) : [];
  //: The filters: the sheet's rows of that company, status and client only (and the empty row, to add one).
  const statusOf = (s: SaleRow) => s.status?.trim() || NO_STATUS;
  const q = query.trim().toLowerCase();
  const matches = (s: SaleRow) =>
    (!insurer || s.insurer === insurer) &&
    (!status || statusOf(s) === status) &&
    (!q || (s.insured_name ?? "").toLowerCase().includes(q) || (s.id_number ?? "").includes(q));
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
  //: The summary adds up every row on screen (the filters apply), whatever its status.
  const counted = sheet?.sales.filter(matches) ?? [];
  const summary = sheet?.summary ?? DEFAULT_SUMMARY;
  const width = columns.reduce((n, c) => n + c.width, 0);
  const openMenu = (event: ReactMouseEvent, items: MenuItem[]) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, items });
  };

  return (
    // As wide as its columns (the page scrolls sideways), and never narrower than the page.
    <>
    {/* Not overflow-hidden: that would stop its bar sticking to the top of the page. */}
    <Card className="milo-sheet">
      {/* The month on screen, where the explanation used to be. */}
      {sheets?.find((s) => s.id === current) && (
        // The sheet scrolls in its own box below, so this bar stays in view above it.
        // Sticks to the top of the page while the rows scroll by (the page is the one scroll).
        <div ref={toolbar} className="sheet-toolbar sticky top-0 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <MonthSwitcher
              sheets={sheets}
              current={current!}
              renaming={renaming}
              onPick={setCurrent}
              onAdd={(month) => void addMonth(month)}
              onRename={(title) => void rename(title)}
              onStartRename={() => setRenaming(true)}
              onCancelRename={() => setRenaming(false)}
              onDelete={(tab) => void deleteTab(tab)}
            />
            <label className="relative w-60">
              <LuSearch className="pointer-events-none absolute inset-y-0 right-3 z-10 my-auto h-4 w-4 text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לקוח לפי שם או ת.ז"
                aria-label="חיפוש לקוח"
                className={`${FIELD} py-1.5 pr-9 text-sm`}
              />
            </label>
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
          {/* The colour and the size, right after the filters. */}
          <div className="flex flex-wrap items-center gap-4">
            <PaintBar enabled={!!(selected && sheet?.sales[selected.r])} onPaint={(color) => void paint(color)} />
            <ZoomBar zoom={zoom} onZoom={setZoom} />
          </div>
        </div>
      )}

      {sheets === null || (current && sheet?.id !== current) ? (
        // The tab on its way (and never the last tab's rows under this one's name).
        <SheetLoading />
      ) : sheets.length === 0 ? (
        <Empty title="אין עדיין גיליונות" />
      ) : (
        // Clips the sheet sideways; the page scrolls down. The scrollbar pinned to the bottom
        // of the screen (below) slides it, and so do a sideways swipe and the keyboard.
        <div ref={grid} onWheel={swipe} onFocus={reveal} className="sheet-scroll overflow-x-clip px-5 pb-5">
          <table
            ref={table}
            style={{ width: rem(width), minWidth: "100%", zoom, "--sheet-toolbar-h": `${toolbarHeight / zoom}px` } as CSSProperties}
          >
            <colgroup>
              {columns.map((c) => (
                <col key={c.id} style={{ width: rem(c.width) }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((c, ci) => (
                  <th
                    key={c.id}
                    className={`sheet-head group ${dropAt === ci && dragging !== c.id ? "is-drop" : ""} ${dragging === c.id ? "is-dragging" : ""}`}
                    title={c.label}
                    onDragOver={(e) => {
                      if (!dragging) return;
                      e.preventDefault();
                      setDropAt(ci);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging) moveColumn(dragging, ci);
                      setDragging(null);
                      setDropAt(null);
                    }}
                  >
                    {renamingColumn === c.id ? (
                      <input
                        autoFocus
                        defaultValue={c.label}
                        maxLength={60}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => renameColumn(c.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setRenamingColumn(null);
                        }}
                        aria-label="שם העמודה"
                        className="w-full rounded bg-white/15 px-1 text-center outline-none"
                      />
                    ) : (
                      // Grab a title to slide its column to another place.
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", c.id);
                          setDragging(c.id);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropAt(null);
                        }}
                        className="sheet-head-label"
                      >
                        {c.money && <CircleDollarSign className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
                        {c.label}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setRenamingColumn(c.id)}
                      aria-label={`שינוי השם של ${c.label}`}
                      title="שינוי שם"
                      className="sheet-head-edit"
                    >
                      <LuPencil className="h-3 w-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => addColumn(ci, "right")}
                      aria-label={`עמודה חדשה מימין ל${c.label}`}
                      title="עמודה חדשה מימין"
                      className="sheet-head-add is-right"
                    >
                      <LuPlus className="h-3 w-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => addColumn(ci, "left")}
                      aria-label={`עמודה חדשה משמאל ל${c.label}`}
                      title="עמודה חדשה משמאל"
                      className="sheet-head-add is-left"
                    >
                      <LuPlus className="h-3 w-3" aria-hidden />
                    </button>
                    <span className="sheet-resize" onPointerDown={(e) => startResize(e, c.id)} aria-hidden />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet &&
                lines.map((r, n) => {
                  const sale = r >= 0 ? sheet.sales[r] : undefined;
                  return (
                    <tr
                      key={r >= 0 ? r : `blank-${n}`}
                      onContextMenu={
                        sale ? (e) => openMenu(e, [{ label: "מחיקת השורה", danger: true, onClick: () => void deleteRow(sale) }]) : undefined
                      }
                    >
                      {columns.map((c, ci) => {
                        // Only the existing rows and the first empty one can be typed in.
                        if (!sale && r !== sheet.sales.length) return <td key={c.id} className="is-disabled" />;
                        const value = sale ? cellText(sale, c.id) : "";
                        const painted = sale?.colors?.[c.id];
                        const look = {
                          className: `${painted ? "is-painted" : c.kind === "insurer" ? "" : tone(value)} ${
                            selected?.r === r && selected.key === c.id ? "is-selected" : ""
                          }`,
                          style: painted ? { background: painted, color: textOn(painted) } : undefined,
                        };
                        const pick = () => setSelected({ r, key: c.id });
                        if (c.kind === "choice")
                          return (
                            <td key={c.id} {...look} className={`${look.className} relative`}>
                              <select
                                key={`${sale?.id ?? "new"}:${value}`}
                                data-cell={`${r}:${ci}`}
                                defaultValue={value}
                                onFocus={pick}
                                onChange={(e) => void save(r, c, e.target.value)}
                                className="sheet-cell sheet-select"
                                aria-label={c.label}
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
                            <td key={c.id} {...look}>
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
                          <td key={c.id} {...look}>
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
                              aria-label={c.label}
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
          {sheet && q && shown.length === 1 && <p className="px-1 py-3 text-sm text-muted">לא נמצא לקוח בשם או בת.ז "{query.trim()}"</p>}
          <datalist id="sheet-insurers">
            {INSURER_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      )}
      {/* The sheet's sideways scrollbar, pinned to the bottom of the screen so it is in
          reach without scrolling down to the last row. Kept in step with the sheet. On a
          wide screen it sits in the page's bottom padding (App.tsx md:pb-10), at the very
          edge; on a phone it stays above the tab bar. */}
      <div
        ref={rail}
        onScroll={(e) => slide(table.current, e.currentTarget, zoom)}
        className="sheet-rail sticky bottom-0 overflow-x-auto md:-bottom-10"
        aria-hidden
      >
        <div style={{ width: railWidth, height: 1 }} />
      </div>

    </Card>

    {/* The tab's summary, a card of its own — the boxes the admins chose. It adds up every
        row on screen (the filters apply), whatever its status. */}
    {sheet && (
      <Card className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-ink-700">
            {[insurer, status && (status === NO_STATUS ? "ללא סטטוס" : status), q && `"${query.trim()}"`].filter(Boolean).join(" · ")}
          </p>
          <Button variant="ghost" onClick={() => setEditingSummary(true)}>
            <LuCalculator className="h-4 w-4" />
            התאמת הסיכום
          </Button>
        </div>
        {summary.length > 0 && (
          // As many boxes a row as fit; the rest wrap onto the next row.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            {summary.map((stat, i) => (
              <Stat key={i} label={stat.label} value={statValue(stat, counted)} money={!!MONEY_FIELD[stat.column] && stat.op !== "count" && stat.op !== "count_value"} />
            ))}
          </div>
        )}
      </Card>
    )}

      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
      {editingSummary && sheet && (
        <SummaryEditor
          summary={summary}
          columns={columns}
          onSave={(next) => void saveSummary(next)}
          onReset={() => void saveSummary(DEFAULT_SUMMARY)}
          onClose={() => setEditingSummary(false)}
        />
      )}
    </>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString("he-IL", { month: "short" }));
const monthKey = (year: number, index: number) => `${year}-${String(index + 1).padStart(2, "0")}-01`;

/**
 * The tab's name at the top of the sheet, with the month before and after on either
 * side, and a calendar of months (a year at a time) to jump to — or to open a month
 * that has no tab yet. Renaming and deleting the tab are at its bottom.
 */
function MonthSwitcher({
  sheets,
  current,
  renaming,
  onPick,
  onAdd,
  onRename,
  onStartRename,
  onCancelRename,
  onDelete,
}: {
  sheets: SalesSheet[];
  current: string;
  renaming: boolean;
  onPick: (id: string) => void;
  onAdd: (month: string) => void;
  onRename: (title: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onDelete: (tab: SalesSheet) => void;
}) {
  const index = sheets.findIndex((s) => s.id === current);
  const tab = sheets[index];
  const shownYear = () => Number((tab?.month ?? monthKey(new Date().getFullYear(), 0)).slice(0, 4));
  const [year, setYear] = useState(shownYear);
  const byMonth = new Map(sheets.filter((s) => s.month).map((s) => [s.month!, s]));
  const others = sheets.filter((s) => !s.month);
  const step = (by: number) => sheets[index + by] && onPick(sheets[index + by].id);
  const arrow = "rounded-lg p-1.5 text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-30 disabled:hover:bg-transparent";

  if (renaming && tab)
    return (
      <input
        autoFocus
        defaultValue={tab.title}
        maxLength={80}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => onRename(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") onCancelRename();
        }}
        aria-label="שם הגיליון"
        className={`${FIELD} w-48 py-1.5 text-base font-bold`}
      />
    );

  return (
    <div className="flex items-center gap-0.5">
      {/* Right to left: the earlier month on the right. */}
      <button type="button" onClick={() => step(-1)} disabled={index <= 0} aria-label="החודש הקודם" title="החודש הקודם" className={arrow}>
        <LuChevronRight className="h-5 w-5" />
      </button>
      <Popover className="relative">
        <PopoverButton
          onClick={() => setYear(shownYear())}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-base font-bold text-ink-900 transition-colors hover:bg-ink-50"
        >
          <LuCalendarDays className="h-4 w-4 text-ink-600" aria-hidden />
          {tab?.title}
          <LuChevronDown className="h-4 w-4 text-muted" aria-hidden />
        </PopoverButton>
        <PopoverPanel anchor="bottom start" className="z-[60] mt-1 w-72 rounded-xl border border-line bg-white p-3 shadow-lg outline-none">
          {({ close }) => (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setYear(year - 1)} aria-label="השנה הקודמת" className={arrow}>
                  <LuChevronRight className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-ink-900">{year}</span>
                <button type="button" onClick={() => setYear(year + 1)} aria-label="השנה הבאה" className={arrow}>
                  <LuChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((name, i) => {
                  const key = monthKey(year, i);
                  const sheet = byMonth.get(key);
                  const chosen = sheet?.id === current;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (sheet) onPick(sheet.id);
                        else onAdd(key);
                        close();
                      }}
                      title={sheet ? sheet.title : `פתיחת גיליון ל${monthTitle(key)}`}
                      className={`relative rounded-lg py-2 text-sm transition-colors ${
                        chosen
                          ? "bg-ink-900 font-semibold text-champagne"
                          : sheet
                            ? "font-semibold text-ink-900 hover:bg-ink-50"
                            : "text-muted hover:bg-ink-50 hover:text-ink-900"
                      }`}
                    >
                      {name}
                      {/* A month with no tab yet: a + says choosing it opens one. */}
                      {!sheet && <LuPlus className="absolute left-1.5 top-1.5 h-3 w-3 opacity-50" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              {others.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {others.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onPick(s.id);
                        close();
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        s.id === current ? "bg-ink-900 text-champagne" : "text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
              {tab && (
                <div className="flex items-center justify-between border-t border-line pt-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onStartRename();
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink-700 hover:bg-ink-50"
                  >
                    <LuPencil className="h-3.5 w-3.5" />
                    שינוי שם
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onDelete(tab);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-blocked hover:bg-blocked/10"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" />
                    מחיקת הגיליון
                  </button>
                </div>
              )}
            </div>
          )}
        </PopoverPanel>
      </Popover>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={index < 0 || index >= sheets.length - 1}
        aria-label="החודש הבא"
        title="החודש הבא"
        className={arrow}
      >
        <LuChevronLeft className="h-5 w-5" />
      </button>
    </div>
  );
}

/** The sheet while it loads: its outline, shimmering, and a word saying so. */
function SheetLoading() {
  return (
    <div className="space-y-2 px-5 pb-5" role="status">
      <p className="flex items-center gap-2 py-1 text-sm font-semibold text-muted">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-ink-700" aria-hidden />
        טוען את הגיליון…
      </p>
      <div className="h-11 rounded-t-xl bg-ink-900/80" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-champagne-deep/40" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

/** A small menu at the pointer; closes on a choice, a click elsewhere, Escape or scrolling. */
function ContextMenu({ x, y, items, onClose }: OpenMenu & { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  //: Kept inside the window, however near its edge the click was.
  const [at, setAt] = useState({ x, y });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setAt({
      x: Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8)),
    });
  }, [x, y]);
  useEffect(() => {
    const away = (e: Event) => !box.current?.contains(e.target as Node) && onClose();
    const key = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={box}
      role="menu"
      style={{ position: "fixed", left: at.x, top: at.y }}
      className="z-[70] min-w-44 rounded-xl border border-line bg-white p-1 shadow-lg"
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          type="button"
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onClick();
          }}
          className={`block w-full rounded-lg px-3 py-1.5 text-right text-sm transition-colors disabled:opacity-40 ${
            item.danger ? "text-blocked hover:bg-blocked/10" : "text-ink-900 hover:bg-ink-50"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** The summary's boxes, as the admins want them: what each counts or adds up, over which column. */
function SummaryEditor({
  summary,
  columns,
  onSave,
  onReset,
  onClose,
}: {
  summary: SheetStat[];
  columns: Column[];
  onSave: (summary: SheetStat[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<SheetStat[]>(summary);
  const set = (i: number, change: Partial<SheetStat>) => setStats(stats.map((s, j) => (j === i ? { ...s, ...change } : s)));
  const options = columns.map((c) => ({ value: c.id, label: c.label }));
  const valid = stats.every((s) => s.label.trim() && (s.op !== "count_value" || s.value?.trim()));

  return (
    <Modal onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(stats.map((s) => ({ ...s, label: s.label.trim(), value: s.op === "count_value" ? s.value?.trim() : null })));
        }}
        className="space-y-5 p-5 sm:p-8"
      >
        <h2 className="font-display text-2xl font-semibold text-ink-900">התאמת הסיכום</h2>
        <p className="text-sm text-muted">כל תיבה מחשבת את השורות שעל המסך (אחרי הסינון). השינוי נשמר לגיליון הזה, לכל המנהלים.</p>
        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-xs font-semibold text-muted sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <span>שם התיבה</span>
            <span>חישוב</span>
            <span>עמודה</span>
            <span>ערך לספירה</span>
            <span className="w-8" />
          </div>
          {stats.map((stat, i) => (
            // One line a box: its name, how it is worked out, over which column — and, to count a word, which.
            <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <input value={stat.label} maxLength={60} onChange={(e) => set(i, { label: e.target.value })} aria-label="שם התיבה" className={FIELD} />
              <Select value={stat.op} onChange={(op) => set(i, { op })} options={OPS} />
              <Select
                value={stat.column}
                onChange={(column) => set(i, { column })}
                options={options.some((o) => o.value === stat.column) ? options : [{ value: stat.column, label: "(עמודה שהוסתרה)" }, ...options]}
              />
              {stat.op === "count_value" ? (
                <input
                  value={stat.value ?? ""}
                  maxLength={100}
                  placeholder='הערך, למשל "פוליסה"'
                  onChange={(e) => set(i, { value: e.target.value })}
                  aria-label="הערך לספירה"
                  className={FIELD}
                />
              ) : (
                <span className="hidden sm:block" />
              )}
              <button
                type="button"
                onClick={() => setStats(stats.filter((_, j) => j !== i))}
                aria-label={`הסרת ${stat.label}`}
                className="justify-self-start rounded-lg p-2 text-muted hover:bg-blocked/10 hover:text-blocked"
              >
                <LuTrash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            disabled={stats.length >= 20}
            onClick={() => setStats([...stats, { label: "תיבה חדשה", op: "sum", column: columns.find((c) => c.money)?.id ?? columns[0]?.id ?? "premium" }])}
          >
            <LuPlus className="h-4 w-4" />
            הוספת תיבה
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <Button type="submit" disabled={!valid}>
            שמירה
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button variant="ghost" className="mr-auto" onClick={onReset}>
            חזרה לסיכום הרגיל
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Strong colours first, then their light shades — the swatches of the paint bar. */
const PAINTS = [
  "#16a34a", "#dc2626", "#f59e0b", "#2563eb", "#7c3aed", "#db2777", "#0d9488", "#4b5563",
  "#bbf7d0", "#fecaca", "#fef08a", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#99f6e4", "#e5e7eb",
];  // prettier-ignore

/** The sheet's zoom, remembered in this browser (a display preference, no client data). */
function useSheetZoom(): [number, (zoom: number) => void] {
  const KEY = "milo.sheet.zoom";
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      return ZOOMS.includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const set = (next: number) => {
    setZoom(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      // Storage blocked: the zoom just isn't remembered.
    }
  };
  return [zoom, set];
}

/** 100% / 90% / 80% / 70% — draw the sheet smaller so more columns fit. */
function ZoomBar({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="גודל הטבלה">
      <span className="me-1 text-xs font-bold text-muted">גודל</span>
      {ZOOMS.map((z) => (
        <button
          key={z}
          onClick={() => onZoom(z)}
          aria-pressed={zoom === z}
          className={`rounded-md border px-2 py-0.5 text-xs font-bold transition-colors ${
            zoom === z ? "border-ink-900 bg-ink-900 text-champagne" : "border-line text-ink-700 hover:bg-ink-50"
          }`}
        >
          {Math.round(z * 100)}%
        </button>
      ))}
    </div>
  );
}

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
    // Closed by default: a "צבע לתא" button that opens the swatches.
    <Popover className="relative">
      <PopoverButton
        disabled={!enabled}
        // Keeps the chosen cell chosen.
        onMouseDown={(e) => e.preventDefault()}
        title={enabled ? undefined : "בחרו תא כדי לצבוע אותו"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-40"
      >
        <span
          className="h-3.5 w-3.5 rounded-sm border border-black/10"
          style={{ background: "conic-gradient(#16a34a, #f59e0b, #dc2626, #7c3aed, #2563eb, #16a34a)" }}
          aria-hidden
        />
        צבע לתא
        <LuChevronDown className="h-3.5 w-3.5" aria-hidden />
      </PopoverButton>
      <PopoverPanel anchor="bottom end" className="z-[60] mt-1 rounded-xl border border-line bg-white p-3 shadow-lg outline-none">
        {({ close }) => (
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-1.5">
              {PAINTS.map((color) => (
                <button
                  key={color}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPaint(color);
                    close();
                  }}
                  aria-label={`צביעה ב-${color}`}
                  className="h-6 w-6 rounded-md border border-black/10 transition-transform hover:scale-110"
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label
                className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs font-bold text-ink-700 hover:bg-ink-50"
                title="צבע אחר"
              >
                <span
                  className="h-3.5 w-3.5 rounded-sm"
                  style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
                  aria-hidden
                />
                צבע אחר
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
                onClick={() => {
                  onPaint(null);
                  close();
                }}
                className="rounded-md border border-line px-2 py-0.5 text-xs font-bold text-ink-700 hover:bg-ink-50"
              >
                ללא צבע
              </button>
            </div>
          </div>
        )}
      </PopoverPanel>
    </Popover>
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
