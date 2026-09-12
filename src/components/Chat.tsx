import { useEffect, useRef, useState } from "react";
import type { ChatMessage, TurnRequest } from "../types";
import { session } from "../lib/api";
import { SUGGESTED_PROMPTS, intentLabel } from "../lib/catalog";
import { ReportView, Callout } from "./ReportView";
import { Button, Card, Tag, Typing } from "./ui";
import { IconSend, IconSpark } from "./Icons";

export function Chat({
  messages,
  busy,
  onAsk,
  onRestart,
}: {
  messages: ChatMessage[];
  busy: boolean;
  onAsk: (prompt: string, request?: TurnRequest) => void;
  onRestart: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [client, setClient] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function submit() {
    const prompt = draft.trim();
    if (!prompt || busy) return;
    onAsk(prompt, clientReference(client));
    setDraft("");
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink-900">שאל את מילו</h2>
          <p className="mt-0.5 text-xs text-muted">
            אותו גרף, אותן הרשאות כמו בוואטסאפ — השיחה הזו היא עוד ערוץ.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRestart} disabled={busy}>
          נקה שיחה
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="shrink-0 border-t border-line bg-paper px-5 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            <IconSpark className="h-3.5 w-3.5" /> נסו
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onAsk(prompt, clientReference(client))}
                disabled={busy}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-body transition-colors hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-line bg-white px-5 py-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder={
                session.demo
                  ? "נתוני דוגמה — התשובות כאן מומצאות, לא ממילו"
                  : "שאלו על לקוח, על הרשימה שלכם, על הנחה, על מסמך…"
              }
              className="w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-body placeholder:text-muted/70 focus:border-ink-500 focus:bg-white focus:outline-none"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <span className="shrink-0">בנוגע ללקוח</span>
              <input
                value={client}
                onChange={(event) => setClient(event.target.value)}
                placeholder="לא חובה — שם, C-1003 או מספר זהות"
                className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-body placeholder:text-muted/60 focus:border-ink-500 focus:outline-none"
              />
            </label>
          </div>
          <Button onClick={submit} disabled={busy || !draft.trim()} className="mb-[38px]">
            <IconSend className="h-4 w-4" />
            שלח
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === "sigal") {
    return (
      <div className="fade-in flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-ee-md bg-ink-900 px-4 py-2.5 text-sm leading-relaxed text-champagne">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in flex gap-3">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold ${
          message.demo
            ? "border border-dashed border-champagne-deep bg-white text-champagne-deep"
            : "bg-champagne text-ink-900"
        }`}
      >
        M
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {message.pending ? (
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-ss-md border border-line bg-white px-4 py-3 text-xs text-muted">
            <Typing /> בודק
          </div>
        ) : (
          <>
            {/* With a report, his reply is that same report as Markdown —
                rendering both would say everything twice. */}
            {message.text && !message.report && (
              <div
                className={`whitespace-pre-wrap rounded-2xl rounded-ss-md border px-4 py-3 text-sm leading-relaxed ${
                  message.failed
                    ? "border-[#f3d3d0] bg-[#fbeceb] text-blocked"
                    : "border-line bg-white text-body"
                }`}
              >
                {message.text}
              </div>
            )}

            {message.report && <ReportView report={message.report} />}

            {!message.report && !!message.missing_information?.length && (
              <Callout tone="warm" title="מידע חסר">
                {message.missing_information}
              </Callout>
            )}
            {!message.report && !!message.awaiting?.length && (
              <Callout tone="ink" title="ממתין ל">
                {message.awaiting}
              </Callout>
            )}
            {!!message.withheld?.length && (
              <Callout tone="red" title="הוסתר">
                {message.withheld}
              </Callout>
            )}

            {!message.failed && (message.intent || message.durationMs || message.demo) && (
              <div className="flex flex-wrap items-center gap-2">
                {message.demo && <Tag tone="warm">דוגמה — לא ממילו</Tag>}
                {message.intent && <Tag tone="ink">{intentLabel(message.intent)}</Tag>}
                {message.durationMs != null && (
                  <span className="text-[11px] text-muted">
                    {(message.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Turn whatever Sigal typed in the client box into the right request field. */
export function clientReference(value: string): TurnRequest {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (/^[Cc]-?\d+$/.test(trimmed)) return { client_crm_id: trimmed.toUpperCase() };
  if (/^\d{9}$/.test(trimmed)) return { client_id_number: trimmed };
  return { client_name: trimmed };
}
