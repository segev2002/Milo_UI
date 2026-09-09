/**
 * Demo mode. Nothing here talks to Milo — it replays the *shape* of his
 * answers so the console can be reviewed before the API is reachable.
 * Every string is invented sample data.
 */
import type { Health, Intent, Report, TurnRequest, TurnResponse, WhoAmI } from "../types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockWhoAmI(): Promise<WhoAmI> {
  await wait(120);
  return {
    subject: "demo:sigal",
    display_name: "Sigal (demo)",
    role: "agent",
    max_sensitivity: "high",
    client_crm_id: null,
    channel: "api",
  };
}

export async function mockHealth(): Promise<Health> {
  await wait(80);
  return {
    status: "ok",
    environment: "demo",
    timezone: "Asia/Jerusalem",
    dry_run: true,
    all_integrations_mocked: true,
  };
}

export async function mockTurn(body: TurnRequest): Promise<TurnResponse> {
  await wait(500 + Math.random() * 700);
  const text = (body.message ?? "").toLowerCase();
  const intent = body.intent ?? classify(text);
  const build = REPLIES[intent];
  if (!build) return conversational(body.message ?? "");
  return build();
}

function classify(text: string): Intent {
  if (/(birthday|יום הולדת)/.test(text)) return "birthdays";
  if (/(missing|gap|no pension)/.test(text)) return "missing_products";
  if (/(discount|expensive|cheaper)/.test(text)) return "discount_check";
  if (/(document|reimburs|surgery|refund)/.test(text)) return "reimbursement_documents";
  if (/(tax|certificate)/.test(text)) return "tax_certificates";
  if (/(quiet|inactive|dormant)/.test(text)) return "inactive_clients";
  if (/(task|list|today|digest)/.test(text)) return "daily_digest";
  if (/(sign|re-?verify|reverify|file check)/.test(text)) return "process_status";
  if (/(book|meeting|appointment)/.test(text)) return "appointment_booking";
  if (/(what does|what do .* have|overview)/.test(text)) return "client_overview";
  return "unknown";
}

function response(report: Report, extra: Partial<TurnResponse> = {}): TurnResponse {
  return {
    reply: renderMarkdown(report),
    intent: extra.intent ?? null,
    status: report.status,
    missing_information: report.missing_information,
    awaiting: report.awaiting,
    withheld: [],
    report,
    ...extra,
  };
}

const REPLIES: Partial<Record<Intent, () => TurnResponse>> = {
  daily_digest: () =>
    response(
      {
        title: "Your tasks — Tuesday",
        status: "attention",
        summary: "4 open tasks. Two are waiting on someone else, not on you.",
        sections: [
          {
            title: "In priority order",
            lines: [],
            table: {
              headers: ["Task", "Client", "Why here"],
              rows: [
                ["Signature outstanding", "Israel Ben-Ami", "Blocks the Har HaBituach pull — 6 days old"],
                ["Life policy 3-year mark", "Dana Cohen", "Milestone reached yesterday"],
                ["Discount recheck", "Moshe Levi", "Two insurers returned 'unknown' last week"],
                ["Missing provident fund", "Rina Azulai", "Gap flagged in the weekly sweep"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: [],
        awaiting: ["Israel Ben-Ami's signature", "Migdal's discount desk"],
        footnotes: ["Priority weights are still SCH-1 — provisional."],
      },
      { intent: "daily_digest" },
    ),
  birthdays: () =>
    response(
      {
        title: "Birthdays today",
        status: "ok",
        summary: "One client has a birthday today.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["Client", "Turns", "Phone"],
              rows: [["Rina Azulai", "54", "052-000-0000"]],
              caption: null,
            },
          },
        ],
        missing_information: [],
        awaiting: [],
        footnotes: [],
      },
      { intent: "birthdays" },
    ),
  missing_products: () =>
    response(
      {
        title: "Clients missing core products",
        status: "attention",
        summary: "3 of 12 active clients have a gap in pension, provident fund or savings.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["Client", "Missing", "Last spoke"],
              rows: [
                ["Rina Azulai", "Provident fund", "4 months ago"],
                ["Yossi Mizrahi", "Savings plan", "11 months ago"],
                ["Tal Barak", "Pension, savings plan", "2 months ago"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: ["Tal Barak has no date of birth on file"],
        awaiting: [],
        footnotes: [],
      },
      { intent: "missing_products" },
    ),
  discount_check: () =>
    response(
      {
        title: "Discount check — Moshe Levi",
        status: "attention",
        summary: "4 active policies checked. One discount available, two insurers could not be reached.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["Policy", "Insurer", "Result"],
              rows: [
                ["Life cover", "Harel", "8% available on annual payment"],
                ["Health", "Clal", "No discount"],
                ["Pension", "Migdal", "Could not find out — portal timed out"],
                ["Disability", "Menora Mivtachim", "Could not find out — no credentials"],
              ],
              caption: "'No discount' and 'could not find out' are different answers.",
            },
          },
        ],
        missing_information: [],
        awaiting: ["Migdal portal", "Menora credentials"],
        footnotes: [],
      },
      { intent: "discount_check" },
    ),
  reimbursement_documents: () =>
    response(
      {
        title: "Documents for a surgery reimbursement",
        status: "ok",
        summary: "Five documents. Anything not on this list is not needed.",
        sections: [
          {
            title: "Required",
            lines: [
              "Surgery report from the treating hospital",
              "Original receipts for every amount claimed",
              "Referral from the treating physician",
              "Discharge summary",
              "Bank account confirmation in the client's name",
            ],
            table: null,
          },
        ],
        missing_information: [],
        awaiting: [],
        footnotes: [],
      },
      { intent: "reimbursement_documents" },
    ),
  inactive_clients: () =>
    response(
      {
        title: "Inactive clients",
        status: "attention",
        summary: "Counted on two axes independently: no conversation, and no action.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["Client", "No conversation since", "No action since"],
              rows: [
                ["Yossi Mizrahi", "26 months", "13 months"],
                ["Nurit Shalev", "9 months", "31 months"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: [],
        awaiting: [],
        footnotes: [],
      },
      { intent: "inactive_clients" },
    ),
  tax_certificates: () =>
    response(
      {
        title: "Tax certificates — Moshe Levi",
        status: "attention",
        summary: "3 of 4 produced. One failed, with the reason.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["Product", "Managing body", "Result"],
              rows: [
                ["Pension fund", "Migdal", "Produced"],
                ["Provident fund", "Altshuler Shaham", "Produced"],
                ["Study fund", "Altshuler Shaham", "Produced"],
                ["Executive insurance", "The Phoenix", "Not produced — 2025 not published yet"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: [],
        awaiting: ["The Phoenix — 2025 certificates"],
        footnotes: ["Certificates for the previous year are generally available from February."],
      },
      { intent: "tax_certificates" },
    ),
  process_status: () =>
    response(
      {
        title: "File re-verification — Israel Ben-Ami",
        status: "blocked",
        summary: "Stopped at step B. Both ID photos are in; the form is filled and unsigned.",
        sections: [
          {
            title: "Where it has got to",
            lines: [
              "Step A — ID photos collected (both sides) ✓",
              "Step B — PoliVision form filled, awaiting signature",
              "Step C — Har HaBituach + Maslaka pull (not started)",
            ],
            table: null,
          },
        ],
        missing_information: [],
        awaiting: ["Israel Ben-Ami's signature — cannot be skipped or signed on his behalf"],
        footnotes: [],
      },
      { intent: "process_status" },
    ),
  client_overview: () =>
    response(
      {
        title: "Dana Cohen",
        status: "ok",
        summary: "052-000-0000 · dana@example.co.il · client since 2019",
        sections: [
          {
            title: "Holds",
            lines: [],
            table: {
              headers: ["Product", "Insurer", "Since"],
              rows: [
                ["Pension fund", "Migdal", "2019"],
                ["Life insurance", "Harel", "2022"],
                ["Health insurance", "Clal", "2021"],
              ],
              caption: null,
            },
          },
          { title: "Not on file", lines: ["Provident fund", "Study fund"], table: null },
        ],
        missing_information: [],
        awaiting: [],
        footnotes: [],
      },
      { intent: "client_overview" },
    ),
  life_insurance_milestone: () =>
    response(
      {
        title: "Life policies at their 3-year mark",
        status: "ok",
        summary: "One policy reached its milestone yesterday.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["Client", "Insurer", "Issued"],
              rows: [["Dana Cohen", "Harel", "3 years ago yesterday"]],
              caption: null,
            },
          },
        ],
        missing_information: ["Tal Barak's life policy has no issue date — reported, not skipped"],
        awaiting: [],
        footnotes: [],
      },
      { intent: "life_insurance_milestone" },
    ),
  client_activity_log: () =>
    response(
      {
        title: "Activity log — C-1003",
        status: "ok",
        summary: "Everything Milo has written onto this card.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["When", "Action", "Outcome"],
              rows: [
                ["Today 09:12", "Tax certificates produced (3 of 4)", "success"],
                ["Yesterday 14:40", "Discount check across 4 insurers", "partial"],
                ["3 days ago", "Documents received over WhatsApp", "success"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: [],
        awaiting: [],
        footnotes: [],
      },
      { intent: "client_activity_log" },
    ),
  appointment_booking: () =>
    response(
      {
        title: "Policy review — times that are actually free",
        status: "ok",
        summary: "45 minutes. Checked against the diary just now.",
        sections: [
          {
            title: "Offered",
            lines: ["Wednesday 11:00", "Thursday 15:30"],
            table: null,
          },
        ],
        missing_information: [],
        awaiting: ["Which of the two the client prefers"],
        footnotes: ["A time that was not offered cannot be booked."],
      },
      { intent: "appointment_booking" },
    ),
};

function conversational(message: string): TurnResponse {
  const text = message.toLowerCase();
  if (/friday|open|hours/.test(text)) {
    return {
      reply:
        "We're open Friday 09:00–12:30, and closed Saturday. Sunday to Thursday it's 09:00–17:00, Israel time.",
      intent: "unknown",
      status: "ok",
      missing_information: [],
      awaiting: [],
      withheld: [],
      report: null,
    };
  }
  return {
    reply:
      "I don't have that from the CRM, so I won't guess. Tell me the client and what you need, and I'll go and get it — or I'll hand it to you with the context I do have.",
    intent: "unknown",
    status: "ok",
    missing_information: [],
    awaiting: [],
    withheld: [],
    report: null,
  };
}

function renderMarkdown(report: Report): string {
  const mark = { ok: "✅", attention: "⚠️", blocked: "⛔", empty: "ℹ️" }[report.status];
  return `${mark} ${report.title}${report.summary ? `\n\n${report.summary}` : ""}`;
}

/** Sample ledger rows, so the dashboard can be reviewed with something in it. */
export function sampleActivity() {
  const intents: Intent[] = [
    "daily_digest",
    "birthdays",
    "missing_products",
    "discount_check",
    "tax_certificates",
    "client_overview",
    "appointment_booking",
    "reimbursement_documents",
    "process_status",
    "inactive_clients",
    "unknown",
  ];
  const rows = [];
  for (let day = 13; day >= 0; day -= 1) {
    const count = 2 + Math.floor(Math.random() * 7);
    for (let i = 0; i < count; i += 1) {
      const intent = intents[Math.floor(Math.random() * intents.length)];
      const at = new Date(Date.now() - day * 86_400_000 + i * 40 * 60_000);
      at.setHours(8 + Math.floor(Math.random() * 9));
      const blocked = Math.random() < 0.12;
      rows.push({
        id: `sample-${day}-${i}`,
        at: at.toISOString(),
        source: (Math.random() < 0.7 ? "chat" : "scenario") as "chat" | "scenario",
        prompt: "(sample)",
        intent,
        status: blocked ? "blocked" : "ok",
        reportTitle: null,
        reportStatus: (blocked ? "blocked" : Math.random() < 0.3 ? "attention" : "ok") as Report["status"],
        ok: Math.random() > 0.04,
        durationMs: 600 + Math.floor(Math.random() * 2200),
        missingCount: Math.random() < 0.2 ? 1 : 0,
        awaitingCount: blocked ? 1 : 0,
        withheldCount: 0,
      });
    }
  }
  return rows;
}
