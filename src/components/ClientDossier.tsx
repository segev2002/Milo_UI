import { useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import type { ClientDossier, DossierAmount, DossierPolicy, DossierPolicyCover } from "../types";
import { InsurerName, StatusPill, Tag } from "./ui";

/* Formatting lives here, not in the backend. The API sends ISO dates and raw
   numbers; how they read is this console's decision. */

const ils = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("he-IL");
}

function age(iso: string | null): number | null {
  if (!iso) return null;
  const born = new Date(iso);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const before =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  return before ? years - 1 : years;
}

/** The headline premium, if the CRM sent one, so it doesn't hide in a long list. */
function headlinePremium(amounts: DossierAmount[]): DossierAmount | null {
  return amounts.find((a) => a.label === "פרמיה חודשית" && a.value > 0) ?? null;
}

/** A zero means "not set" in the CRM, not a cover worth ₪0. */
function money(value: number): string {
  return value ? ils.format(value) : "—";
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

type Metric = "premium" | "accumulation";

/** The columns of a policy's covers. Those marked `same` move above the table when every row agrees. */
const COVER_COLUMNS: { head: string; cell: (c: DossierPolicyCover) => string; same?: (v: string) => string }[] = [
  { head: "סוג כיסוי", cell: (c) => c.type ?? "—", same: (v) => `סוג כיסוי: ${v}` },
  { head: "שם כיסוי", cell: (c) => c.name ?? "—" },
  {
    head: "מבוטח",
    cell: (c) => `${c.insured ?? "—"}${c.insured_role ? ` (${c.insured_role})` : ""}`,
    same: (v) => `מבוטח: ${v}`,
  },
  { head: "פרמיה", cell: (c) => money(c.premium) },
  { head: "סכום ביטוח", cell: (c) => money(c.amount) },
  { head: "תחילה", cell: (c) => formatDate(c.start), same: (v) => `תחילה ${v}` },
  { head: "סיום", cell: (c) => formatDate(c.end), same: (v) => `סיום ${v}` },
];

function Covers({ policy }: { policy: DossierPolicy }) {
  const shared = COVER_COLUMNS.filter((col) => {
    if (!col.same || !policy.covers.length) return false;
    const first = col.cell(policy.covers[0]);
    return policy.covers.every((c) => col.cell(c) === first);
  });
  const columns = COVER_COLUMNS.filter((col) => !shared.includes(col));
  const facts = [policy.policy_number ? `פוליסה ${policy.policy_number}` : ""];
  for (const col of shared) {
    const value = col.cell(policy.covers[0]);
    if (value !== "—") facts.push(col.same!(value));
  }
  const shown = facts.filter(Boolean);

  return (
    <div className="mb-2 mt-1 rounded-lg border border-line">
      {shown.length > 0 && <p className="bg-paper px-3 py-1.5 text-xs text-muted">{shown.join(" · ")}</p>}
      {policy.covers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="text-muted">
              <tr>
                {columns.map((col) => (
                  <th key={col.head} className="px-3 py-1.5 font-medium">
                    {col.head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {policy.covers.map((c, i) => (
                <tr key={i} className="text-body">
                  {columns.map((col) => (
                    <td key={col.head} className="px-3 py-1.5">
                      {col.cell(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** One policy row, as in Surense: a button that opens its number and covers. */
function PolicyRow({ policy, metric }: { policy: DossierPolicy; metric: Metric }) {
  const [open, setOpen] = useState(false);
  const expandable = policy.covers.length > 0 || !!policy.policy_number;
  // The group names the metric; a row only says so when it shows the other one.
  const amount =
    metric === "premium" && policy.premium
      ? ils.format(policy.premium)
      : policy.accumulation
        ? `${metric === "premium" ? "צבירה " : ""}${ils.format(policy.accumulation)}`
        : "—";

  return (
    <li className={policy.active ? "" : "opacity-60"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!expandable}
        className="grid w-full grid-cols-[110px_minmax(0,1fr)_auto_7.5rem_1rem] items-center gap-3 py-2 text-right"
      >
        <InsurerName name={policy.company ?? "—"} className="truncate text-sm font-medium text-ink-900" />
        <span className="truncate text-[13px] text-body">{policy.product}</span>
        {/* Active is the norm, so only the exceptions carry a status. */}
        <span>{!policy.active && <StatusPill status="empty">{policy.status || "לא פעיל"}</StatusPill>}</span>
        <span className="text-end text-sm font-medium tabular-nums text-ink-900">{amount}</span>
        {expandable && (
          <LuChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && <Covers policy={policy} />}
    </li>
  );
}

/** Policies grouped like Surense's products tab, each group with its total. */
function PolicyGroup({ group, policies }: { group: string; policies: DossierPolicy[] }) {
  const [open, setOpen] = useState(true);
  // Insurance is read by its premium, savings by what they have accumulated.
  const metric: Metric = policies.some((p) => p.premium > 0) ? "premium" : "accumulation";
  const active = policies.filter((p) => p.active);
  const total = active.reduce((sum, p) => sum + p[metric], 0);
  const monthly = active.every((p) => !p.premium || p.premium_frequency === "חודשית");
  const unit = metric === "accumulation" ? "צבירה" : monthly ? "לחודש" : "פרמיה";
  // Inactive policies sink to the bottom; otherwise Surense's order.
  const sorted = [...policies].sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg bg-paper px-3 py-2 text-right"
      >
        <span className="text-sm font-semibold text-ink-900">
          {group || "אחר"} · {policies.length}
        </span>
        {total > 0 && (
          <span className="ms-auto text-sm font-semibold tabular-nums text-ink-900">
            {ils.format(total)} <span className="text-xs font-normal text-muted">{unit}</span>
          </span>
        )}
        <LuChevronDown
          className={`h-4 w-4 text-muted transition-transform ${total > 0 ? "" : "ms-auto"} ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="divide-y divide-line/60 px-3">
          {sorted.map((p, i) => (
            <PolicyRow key={`${p.policy_number}-${i}`} policy={p} metric={metric} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ClientDossierView({ dossier }: { dossier: ClientDossier }) {
  const { client, amounts, related, policies } = dossier;
  const premium = headlinePremium(amounts);
  const years = age(client.date_of_birth);
  const inactive = (policies ?? []).filter((p) => !p.active).length;
  // Groups in the order Surense's own list puts them.
  const groups = new Map<string, DossierPolicy[]>();
  for (const p of policies ?? []) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-ink-900">{client.full_name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {client.id_number ? `ת.ז ${client.id_number}` : "אין ת.ז בתיק"}
            {years !== null && ` · בן/בת ${years}`}
            {client.last_action_at && ` · פעילות אחרונה ${formatDate(client.last_action_at)}`}
          </p>
          {/* Contact sits with the name: only what the file has, each one a link. */}
          {(client.phone || client.email || client.city) && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-body">
              {client.phone && (
                <a href={`tel:${client.phone}`} dir="ltr" className="hover:underline">
                  {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} dir="ltr" className="hover:underline">
                  {client.email}
                </a>
              )}
              {client.city && <span>{client.city}</span>}
            </p>
          )}
        </div>
        {premium && (
          <div className="text-end">
            <div className="font-display text-lg font-semibold text-ink-900">
              {ils.format(premium.value)}
            </div>
            <div className="text-[11px] text-muted">פרמיה חודשית</div>
          </div>
        )}
      </div>

      <div className="space-y-5 px-4 py-4">
        {policies && policies.length > 0 && (
          <Block title={`פוליסות · ${policies.length}${inactive ? ` · ${inactive} לא פעילות` : ""}`}>
            <div className="space-y-2">
              {[...groups].map(([group, items]) => (
                <PolicyGroup key={group} group={group} policies={items} />
              ))}
            </div>
          </Block>
        )}

        {related.length > 0 && (
          <Block title="קשורים">
            <div className="flex flex-wrap gap-1.5">
              {related.map((r) => (
                <Tag key={r.crm_id ?? r.name}>
                  {r.name}
                  {r.relationship ? ` · ${r.relationship}` : ""}
                </Tag>
              ))}
            </div>
          </Block>
        )}

        <div className="space-y-1 border-t border-line pt-3 text-xs text-muted">
          {!dossier.policy_level_available && <p>לא הצלחתי לטעון את הפוליסות מה-CRM.</p>}
          {dossier.calculated_at && <p>נתוני המוצרים חושבו ב-{formatDate(dossier.calculated_at)}.</p>}
        </div>
      </div>
    </div>
  );
}

export { StatusPill };
