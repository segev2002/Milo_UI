import { SCENARIOS } from "../lib/catalog";
import { useCached } from "../lib/cache";
import type { ScenarioMeta } from "../lib/catalog";
import type { TurnRequest } from "../types";
import { clientReference } from "./Chat";
import { Button, Card, Tag } from "./ui";

export function Playbook({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (prompt: string, request: TurnRequest) => void;
}) {
  return (
    <div className="@container space-y-5">
      <Card>
        <div className="grid gap-4 px-5 py-5 @xl:grid-cols-2 @[56rem]:grid-cols-3">
          {SCENARIOS.map((scenario) => (
            <ScenarioCard key={scenario.intent} scenario={scenario} busy={busy} onRun={onRun} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScenarioCard({
  scenario,
  busy,
  onRun,
}: {
  scenario: ScenarioMeta;
  busy: boolean;
  onRun: (prompt: string, request: TurnRequest) => void;
}) {
  const [client, setClient] = useCached(`playbook.client.${scenario.intent}`, "");
  const [provider, setProvider] = useCached<"polywizz" | "surense">(
    `playbook.provider.${scenario.intent}`,
    "polywizz",
  );
  const blocked = scenario.needsClient && !client.trim();
  const suffix = scenario.providerChoice && provider === "surense" ? " בשורנס" : "";

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-ink-900">{scenario.name}</h3>
        {scenario.scenario ? (
          <Tag tone="ink">#{scenario.scenario}</Tag>
        ) : (
          <Tag tone={scenario.audience === "client" ? "warm" : "neutral"}>
            {scenario.audience === "client" ? "פונה ללקוח" : "תוספת"}
          </Tag>
        )}
      </div>

      <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">{scenario.what}</p>

      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
        {scenario.cadence}
      </p>

      {scenario.needsClient && (
        <input
          value={client}
          onChange={(event) => setClient(event.target.value)}
          placeholder={scenario.phoneInput ? "טלפון הלקוח" : "לקוח — שם, C-1003 או מספר זהות"}
          className="mt-3 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-body placeholder:text-muted/60 focus:border-ink-500 focus:outline-none"
        />
      )}

      {scenario.providerChoice && (
        <div className="mt-2 flex items-center gap-1" role="group" aria-label="איפה לפתוח את הלקוח">
          {(
            [
              ["polywizz", "PolyWizz"],
              ["surense", "שורנס"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setProvider(value)}
              aria-pressed={provider === value}
              className={`rounded-md border px-2 py-0.5 text-xs font-bold transition-colors ${
                provider === value
                  ? "border-ink-900 bg-ink-900 text-champagne"
                  : "border-line text-ink-700 hover:bg-ink-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant={blocked ? "ghost" : "warm"}
        className="mt-3"
        disabled={busy || blocked}
        onClick={() =>
          scenario.phoneInput
            ? onRun(`${scenario.prompt} ${client.trim()}${suffix}`, { intent: scenario.intent })
            : onRun(scenario.prompt, {
                intent: scenario.intent,
                ...clientReference(client),
              })
        }
      >
        {blocked ? "נקבו קודם בלקוח" : "הרץ עכשיו"}
      </Button>
    </div>
  );
}
