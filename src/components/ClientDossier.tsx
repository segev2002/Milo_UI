import { useState } from "react";
import type { ClientDossier, DossierAmount, DossierProcess } from "../types";
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

function Processes({ items }: { items: DossierProcess[] }) {
  const [expanded, setExpanded] = useState(false);
  // Long histories are the norm — show the recent few and let her ask for more.
  const shown = expanded ? items : items.slice(0, 4);
  const open = items.filter((p) => !p.is_closed).length;

  return (
    <Block title={`תהליכים · ${items.length}${open ? ` · ${open} פתוחים` : ""}`}>
      <ol className="space-y-0">
        {shown.map((p, i) => (
          <li key={p.id ?? i} className="flex gap-3 py-2">
            <div className="flex flex-col items-center pt-1">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  p.is_closed ? "bg-ink-300" : "bg-ink-900"
                }`}
              />
              {i < shown.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-ink-900">{p.type ?? "תהליך"}</span>
                {p.company && <span className="text-[13px] text-muted">· {p.company}</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span>{formatDate(p.opened_on)}</span>
                {p.status && <span>· {p.status}</span>}
                {p.assignee && <span>· {p.assignee}</span>}
              </div>
              {p.notes && <p className="mt-1 text-[13px] leading-relaxed text-body">{p.notes}</p>}
            </div>
          </li>
        ))}
      </ol>
      {items.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[13px] font-medium text-ink-700 underline underline-offset-2"
        >
          {expanded ? "הצג פחות" : `הצג את כל ${items.length} התהליכים`}
        </button>
      )}
    </Block>
  );
}

export function ClientDossierView({ dossier }: { dossier: ClientDossier }) {
  const { client, covers, amounts, processes, related } = dossier;
  const held = covers.filter((c) => c.held);
  const notHeld = covers.filter((c) => !c.held);
  const premium = headlinePremium(amounts);
  const otherAmounts = amounts.filter((a) => a.value > 0 && a !== premium);
  const years = age(client.date_of_birth);
  const [showGaps, setShowGaps] = useState(false);

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

        {held.length > 0 && (
          <Block title={`מוצרים בתיק · ${held.length}`}>
            <div className="flex flex-wrap gap-1.5">
              {held.map((c) => (
                <Tag key={c.label} tone="ink">
                  {c.label}
                </Tag>
              ))}
            </div>
            {notHeld.length > 0 && (
              <button
                type="button"
                onClick={() => setShowGaps((v) => !v)}
                className="text-[13px] font-medium text-ink-700 underline underline-offset-2"
              >
                {showGaps ? "הסתר" : `${notHeld.length} מוצרים שאין לו/ה`}
              </button>
            )}
            {showGaps && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {notHeld.map((c) => (
                  <Tag key={c.label}>{c.label}</Tag>
                ))}
              </div>
            )}
          </Block>
        )}

        {otherAmounts.length > 0 && (
          <Block title="סכומים">
            <div className="divide-y divide-line/60">
              {otherAmounts.map((a) => (
                <Row key={a.label} label={a.label} value={ils.format(a.value)} />
              ))}
            </div>
          </Block>
        )}

        {processes.length > 0 && <Processes items={processes} />}

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
          {!dossier.policy_level_available && (
            <p>ה-CRM מחזיר מוצרים ופרמיות, אך לא מספר פוליסה או תאריך הנפקה לכל פוליסה.</p>
          )}
          {dossier.calculated_at && <p>נתוני המוצרים חושבו ב-{formatDate(dossier.calculated_at)}.</p>}
        </div>
      </div>
    </div>
  );
}

export { StatusPill };
