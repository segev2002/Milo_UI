import { useState, type ReactNode } from "react";
import {
  LuCake,
  LuClipboardList,
  LuFileSpreadsheet,
  LuListChecks,
  LuPackageSearch,
  LuUserPlus,
  LuUserSearch,
  LuUserX,
} from "react-icons/lu";
import { SiWhatsapp } from "react-icons/si";
import { SCENARIOS } from "../lib/catalog";
import { useCached } from "../lib/cache";
import type { ScenarioMeta } from "../lib/catalog";
import type { TurnRequest } from "../types";
import { clientReference } from "./Chat";
import { Window } from "./Systems";
import { Button, TiltCard } from "./ui";

/** Each skill's card: an icon on the white tile and a face colour, in the console's own greens and blues. */
const LOOK: Record<string, { icon: ReactNode; color: string }> = {
  missing_products: { icon: <LuPackageSearch className="h-full w-full text-[#0b6b57]" />, color: "linear-gradient(135deg, #0b6b57, #063d33)" },
  birthdays: { icon: <LuCake className="h-full w-full text-[#c2410c]" />, color: "linear-gradient(135deg, #d97706, #9a3412)" },
  inactive_clients: { icon: <LuUserX className="h-full w-full text-[#475569]" />, color: "linear-gradient(135deg, #475569, #1e293b)" },
  client_overview: { icon: <LuUserSearch className="h-full w-full text-[#1d4ed8]" />, color: "linear-gradient(135deg, #2563eb, #1e3a8a)" },
  process_status: { icon: <LuListChecks className="h-full w-full text-[#0e7490]" />, color: "linear-gradient(135deg, #0891b2, #155e75)" },
  whatsapp_conversation: { icon: <SiWhatsapp className="h-full w-full text-[#25d366]" />, color: "linear-gradient(135deg, #25d366, #128c7e)" },
  open_tasks: { icon: <LuClipboardList className="h-full w-full text-[#6d28d9]" />, color: "linear-gradient(135deg, #7c3aed, #4c1d95)" },
  create_client: { icon: <LuUserPlus className="h-full w-full text-[#0f766e]" />, color: "linear-gradient(135deg, #14b8a6, #0f5f59)" },
  analyze_client: { icon: <LuFileSpreadsheet className="h-full w-full text-[#15803d]" />, color: "linear-gradient(135deg, #16a34a, #14532d)" },
};
const FALLBACK = { icon: <LuListChecks className="h-full w-full text-ink-700" />, color: "linear-gradient(135deg, #0b6b57, #063d33)" };

/**
 * מה הוא יודע לעשות — every skill Milo has, as the same 3D card as חיבורים.
 * A skill that needs a client (or a phone) asks for it in a window before it runs.
 */
export function Playbook({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (prompt: string, request: TurnRequest) => void;
}) {
  const [open, setOpen] = useState<ScenarioMeta | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((scenario) => {
          const look = LOOK[scenario.intent] ?? FALLBACK;
          return (
            <TiltCard
              key={scenario.intent}
              title={scenario.name}
              subtitle={subtitleOf(scenario)}
              description={scenario.what}
              logo={look.icon}
              color={look.color}
              actionText={scenario.needsClient ? (scenario.phoneInput ? "הרץ עם טלפון" : "בחירת לקוח והרצה") : "הרץ עכשיו"}
              disabled={busy}
              onAction={() =>
                scenario.needsClient ? setOpen(scenario) : onRun(scenario.prompt, { intent: scenario.intent })
              }
            />
          );
        })}
      </div>

      {open && (
        <ClientWindow
          scenario={open}
          busy={busy}
          onClose={() => setOpen(null)}
          onRun={(prompt, request) => {
            setOpen(null);
            onRun(prompt, request);
          }}
        />
      )}
    </div>
  );
}

/** "#1 · שבועי · לפי בקשה", or who it is for when it has no scenario number. */
function subtitleOf(scenario: ScenarioMeta): string {
  const tag = scenario.scenario ? `#${scenario.scenario}` : scenario.audience === "client" ? "פונה ללקוח" : null;
  return [tag, scenario.cadence].filter(Boolean).join(" · ");
}

/** The client (or phone) a skill runs on, then run it. Remembers the last one per skill. */
function ClientWindow({
  scenario,
  busy,
  onClose,
  onRun,
}: {
  scenario: ScenarioMeta;
  busy: boolean;
  onClose: () => void;
  onRun: (prompt: string, request: TurnRequest) => void;
}) {
  const [client, setClient] = useCached(`playbook.client.${scenario.intent}`, "");
  //: Where a new client is opened: PolyWizz, or Surense ("בשורנס" added to the prompt).
  const [provider, setProvider] = useCached<"polywizz" | "surense">(
    `playbook.provider.${scenario.intent}`,
    "polywizz",
  );
  const look = LOOK[scenario.intent] ?? FALLBACK;
  const value = client.trim();
  const suffix = scenario.providerChoice && provider === "surense" ? " בשורנס" : "";

  function run() {
    if (!value) return;
    if (scenario.phoneInput) onRun(`${scenario.prompt} ${value}${suffix}`, { intent: scenario.intent });
    else onRun(scenario.prompt, { intent: scenario.intent, ...clientReference(client) });
  }

  return (
    <Window title={scenario.name} logo={<span className="h-9 w-9">{look.icon}</span>} onClose={onClose}>
      <p className="text-body">{scenario.what}</p>
      <div>
        <label htmlFor={`playbook-${scenario.intent}`} className="block text-sm font-semibold text-ink-900">
          {scenario.phoneInput ? "טלפון הלקוח" : "לקוח"}
        </label>
        <input
          id={`playbook-${scenario.intent}`}
          autoFocus
          value={client}
          dir={scenario.phoneInput ? "ltr" : undefined}
          onChange={(event) => setClient(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && run()}
          placeholder={scenario.phoneInput ? "050-0000000" : "שם, C-1003 או מספר זהות"}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base text-body outline-none placeholder:text-muted/60 focus:border-ink-500 focus:bg-white"
        />
      </div>
      {scenario.providerChoice && (
        <div>
          <p className="text-sm font-semibold text-ink-900">איפה לפתוח את הלקוח</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="איפה לפתוח את הלקוח">
            {(
              [
                ["polywizz", "PolyWizz"],
                ["surense", "שורנס"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setProvider(id)}
                aria-pressed={provider === id}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-semibold transition-colors ${
                  provider === id
                    ? "border-ink-900 bg-ink-900 text-champagne"
                    : "border-line bg-paper text-ink-700 hover:bg-white"
                }`}
              >
                <img src={`/systems/${id}.png`} alt="" className="h-6 w-6 rounded-md bg-white object-contain p-0.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          ביטול
        </Button>
        <Button disabled={busy || !value} onClick={run}>
          הרץ עכשיו
        </Button>
      </div>
    </Window>
  );
}
