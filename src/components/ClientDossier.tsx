import { useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import type { ClientDossier, DossierAmount, DossierPolicy } from "../types";
import { StatusPill, Tag } from "./ui";

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

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`text-sm ${muted ? "text-muted" : "font-medium text-ink-900"}`}>
        {value}
      </span>
    </div>
  );
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

/** One policy row, as in Surense: a button that opens its covers. */
function PolicyRow({ policy }: { policy: DossierPolicy }) {
  const [open, setOpen] = useState(false);
  // Savings products carry an accumulation and often no premium; insurance the reverse.
  const money = policy.premium
    ? `${ils.format(policy.premium)}${policy.premium_frequency ? ` · ${policy.premium_frequency}` : ""}`
    : policy.accumulation
      ? `צבירה ${ils.format(policy.accumulation)}`
      : "—";

  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!policy.covers.length}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-right"
      >
        <span className="text-sm font-medium text-ink-900">{policy.company ?? "—"}</span>
        <span className="text-[13px] text-body">{policy.product}</span>
        {policy.policy_number && (
          <span className="text-xs text-muted" dir="ltr">
            {policy.policy_number}
          </span>
        )}
        <StatusPill status={policy.active ? "ok" : "empty"}>{policy.status || "—"}</StatusPill>
        <span className="ms-auto text-sm text-ink-900">{money}</span>
        {policy.covers.length > 0 && (
          <LuChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-right text-xs">
            <thead className="bg-paper text-muted">
              <tr>
                {["סוג כיסוי", "שם כיסוי", "מבוטח", "פרמיה", "סכום ביטוח", "תחילה", "סיום"].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {policy.covers.map((c, i) => (
                <tr key={i} className="text-body">
                  <td className="px-2 py-1.5">{c.type ?? "—"}</td>
                  <td className="px-2 py-1.5">{c.name ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    {c.insured ?? "—"}
                    {c.insured_role ? ` (${c.insured_role})` : ""}
                  </td>
                  <td className="px-2 py-1.5">{ils.format(c.premium)}</td>
                  <td className="px-2 py-1.5">{ils.format(c.amount)}</td>
                  <td className="px-2 py-1.5">{formatDate(c.start)}</td>
                  <td className="px-2 py-1.5">{formatDate(c.end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

/** Policies grouped like Surense's products tab: "בריאות (3)", each group collapsible. */
function PolicyGroup({ group, policies }: { group: string; policies: DossierPolicy[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg bg-paper px-3 py-2 text-right"
      >
        <span className="text-sm font-semibold text-ink-900">
          {group || "אחר"} ({policies.length})
        </span>
        <LuChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="divide-y divide-line/60 px-1">
          {policies.map((p, i) => (
            <PolicyRow key={`${p.policy_number}-${i}`} policy={p} />
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
          </p>
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
        <Block title="פרטי קשר">
          <div className="divide-y divide-line/60">
            <Row label="טלפון" value={client.phone ?? "— לא בתיק —"} muted={!client.phone} />
            <Row label="אימייל" value={client.email ?? "— לא בתיק —"} muted={!client.email} />
            <Row label="עיר" value={client.city ?? "— לא בתיק —"} muted={!client.city} />
          </div>
        </Block>

        {policies && policies.length > 0 && (
          <Block title={`פוליסות · ${policies.length}`}>
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
