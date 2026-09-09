import { useState } from "react";
import type { ReactNode } from "react";
import { session } from "../lib/api";
import type { Mode } from "../lib/api";
import { activityStore } from "../lib/activity";
import { sampleActivity } from "../lib/mock";
import type { Health, WhoAmI } from "../types";
import { Button, Card, CardHead, Tag } from "./ui";

export function Settings({
  who,
  health,
  mode,
  error,
  onRefresh,
  onSwitchMode,
}: {
  who: WhoAmI | null;
  health: Health | null;
  mode: Mode;
  error: string | null;
  onRefresh: () => void;
  onSwitchMode: (mode: Mode) => void;
}) {
  const [token, setToken] = useState(session.token);
  const [baseUrl, setBaseUrl] = useState(session.baseUrl);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card>
          <CardHead
            title="Connection"
            hint="Where this console is pointed and what the token authorizes"
            right={
              <Button size="sm" variant="ghost" onClick={onRefresh}>
                Re-check
              </Button>
            }
          />
          <dl className="divide-y divide-line text-sm">
            <Row label="Mode">
              {mode === "demo" ? (
                <Tag tone="warm">Sample data</Tag>
              ) : (
                <Tag tone="ink">Live API</Tag>
              )}
            </Row>
            <Row label="API base">
              {mode === "demo" ? "—" : session.baseUrl || "same origin (dev proxy)"}
            </Row>
            <Row label="Health">
              {health
                ? `${health.status} · ${health.environment} · ${health.timezone}`
                : (error ?? "unknown")}
            </Row>
            <Row label="Integrations">
              {health
                ? health.all_integrations_mocked
                  ? "all mocked — results are sample data"
                  : "live"
                : "—"}
            </Row>
            <Row label="Dry run">
              {health ? (health.dry_run ? "on — nothing is sent" : "off") : "—"}
            </Row>
            <Row label="Signed in as">{who ? `${who.display_name} (${who.subject})` : "—"}</Row>
            <Row label="Role">{who ? `${who.role} · ceiling ${who.max_sensitivity}` : "—"}</Row>
          </dl>
        </Card>

        <Card>
          <CardHead
            title="Token"
            hint="Milo authenticates every caller — paste the token he issued for Sigal"
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              session.setBaseUrl(baseUrl);
              session.setToken(token);
              onSwitchMode(token.trim() ? "live" : "demo");
            }}
            className="space-y-4 px-5 py-4"
          >
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Bearer token
              </span>
              <textarea
                value={token}
                onChange={(event) => setToken(event.target.value)}
                rows={3}
                placeholder="eyJhbGciOi…"
                className="mt-1.5 w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 font-mono text-xs text-body placeholder:text-muted/60 focus:border-ink-500 focus:bg-white focus:outline-none"
              />
              <span className="mt-1.5 block text-[11px] leading-relaxed text-muted">
                <code>python -m scripts.issue_token --subject dev:sigal</code>
              </span>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                API base URL
              </span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="empty = same origin (the dev proxy)"
                className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-body placeholder:text-muted/60 focus:border-ink-500 focus:bg-white focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save and use the API</Button>
              {mode === "live" ? (
                <Button variant="ghost" onClick={() => onSwitchMode("demo")}>
                  Switch to sample data
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  disabled={!session.token}
                  onClick={() => onSwitchMode("live")}
                >
                  Use the saved token
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHead title="Request log" hint="Kept in this browser only" />
          <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-muted">
            <p>
              The console records every turn it sends: what was asked, which intent Milo routed to,
              how long he took, and whether anything was missing, waiting or withheld. It lives in
              this browser's local storage — clearing it does not touch Milo's own tables.
            </p>
            <div className="flex flex-wrap gap-2">
              {mode === "demo" && (
                <Button
                  size="sm"
                  variant="warm"
                  onClick={() => sampleActivity().forEach((row) => activityStore.add(row))}
                >
                  Load two weeks of sample rows
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm("Clear the local request log?")) activityStore.clear();
                }}
              >
                Clear log
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="What this console does not change" />
          <ul className="space-y-2 px-5 py-4 text-sm leading-relaxed text-muted">
            <li>
              It is a client of <code className="text-ink-700">POST /agent/turn</code> — the same
              endpoint and the same permission gate as WhatsApp. No business logic here.
            </li>
            <li>
              Historical volume from WhatsApp and the scheduled jobs is not shown: no read endpoint
              exposes it yet, and Milo's counts are not something to estimate.
            </li>
            <li>
              Reports are rendered from the structured <code className="text-ink-700">report</code>{" "}
              field, so nothing is re-worded on the way to the screen.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">{label}</dt>
      <dd className="text-right text-sm text-body">{children}</dd>
    </div>
  );
}
