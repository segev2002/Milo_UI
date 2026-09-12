import { useState } from "react";
import { SCENARIOS } from "../lib/catalog";
import type { ScenarioMeta } from "../lib/catalog";
import type { TurnRequest } from "../types";
import { clientReference } from "./Chat";
import { Button, Card, CardHead, Tag } from "./ui";

export function Playbook({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (prompt: string, request: TurnRequest) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHead
          title="מה מילו יודע לעשות"
          hint="עשרת התרחישים מהמפרט, ועוד התוספות השיחתיות. הרצה כאן עוברת באותו גרף כמו בוואטסאפ."
        />
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
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
  const [client, setClient] = useState("");
  const blocked = scenario.needsClient && !client.trim();

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
          placeholder="לקוח — שם, C-1003 או מספר זהות"
          className="mt-3 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-body placeholder:text-muted/60 focus:border-ink-500 focus:outline-none"
        />
      )}

      <Button
        size="sm"
        variant={blocked ? "ghost" : "warm"}
        className="mt-3"
        disabled={busy || blocked}
        onClick={() =>
          onRun(scenario.prompt, {
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
