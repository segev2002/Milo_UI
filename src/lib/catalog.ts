import type { Intent } from "../types";

export interface ScenarioMeta {
  intent: Intent;
  scenario: number | null;
  name: string;
  what: string;
  cadence: string;
  needsClient: boolean;
  prompt: string;
  audience: "sigal" | "client";
}

/** Mirrors agent-spec.md's ten scenarios plus the conversational extras. */
export const SCENARIOS: ScenarioMeta[] = [
  {
    intent: "missing_products",
    scenario: 1,
    name: "Missing products",
    what: "Clients with no pension, provident fund or savings plan — which one is missing, per client.",
    cadence: "Weekly · on request",
    needsClient: false,
    prompt: "who's missing products?",
    audience: "sigal",
  },
  {
    intent: "birthdays",
    scenario: 2,
    name: "Birthdays today",
    what: "Whose birthday it is today, with contact details. Says so explicitly when nobody's is.",
    cadence: "08:00 daily",
    needsClient: false,
    prompt: "any birthdays today?",
    audience: "sigal",
  },
  {
    intent: "discount_check",
    scenario: 3,
    name: "Discount check",
    what: "Every active policy checked with its insurer. 'No discount' and 'couldn't find out' stay different answers.",
    cadence: "On request",
    needsClient: true,
    prompt: "check for discounts on his policies",
    audience: "sigal",
  },
  {
    intent: "reverify_insurance_file",
    scenario: 4,
    name: "Re-verify insurance file",
    what: "Har HaBituach + Maslaka, staged. Stops dead for a real signature.",
    cadence: "Hourly resume",
    needsClient: true,
    prompt: "re-verify her insurance file",
    audience: "sigal",
  },
  {
    intent: "reimbursement_documents",
    scenario: 5,
    name: "Reimbursement documents",
    what: "Exactly the documents a treatment type needs, plus the bank confirmation. Nothing irrelevant.",
    cadence: "On request",
    needsClient: false,
    prompt: "what documents are needed for a surgery reimbursement?",
    audience: "sigal",
  },
  {
    intent: "life_insurance_milestone",
    scenario: 6,
    name: "Life insurance, 3 years",
    what: "Policies hitting their 3-year mark — once per milestone, not once a day.",
    cadence: "Daily",
    needsClient: false,
    prompt: "which life policies are due a review?",
    audience: "sigal",
  },
  {
    intent: "tax_certificates",
    scenario: 7,
    name: "Tax certificates",
    what: "A certificate per product and managing body, and the ones it could not produce with the reason.",
    cadence: "On request",
    needsClient: true,
    prompt: "produce his tax certificates",
    audience: "sigal",
  },
  {
    intent: "inactive_clients",
    scenario: 8,
    name: "Inactive clients",
    what: "No conversation, or no action, in 24 months — the two axes counted independently.",
    cadence: "Weekly",
    needsClient: false,
    prompt: "which clients are inactive?",
    audience: "sigal",
  },
  {
    intent: "daily_digest",
    scenario: 9,
    name: "Daily task digest",
    what: "Open tasks by priority, each with a one-line reason for its place in the queue.",
    cadence: "07:00 daily",
    needsClient: false,
    prompt: "my tasks for today",
    audience: "sigal",
  },
  {
    intent: "client_activity_log",
    scenario: 10,
    name: "Client activity log",
    what: "What Milo has written onto a client's CRM card — the read side of the action log.",
    cadence: "On request",
    needsClient: true,
    prompt: "show me the activity log",
    audience: "sigal",
  },
  {
    intent: "client_overview",
    scenario: null,
    name: "Client overview",
    what: "Products, policies, contact details, and what is missing from the file.",
    cadence: "On request",
    needsClient: true,
    prompt: "what does she have?",
    audience: "sigal",
  },
  {
    intent: "process_status",
    scenario: null,
    name: "Process status",
    what: "Where a file re-check has got to, and what it is waiting on.",
    cadence: "On request",
    needsClient: true,
    prompt: "has he signed yet?",
    audience: "sigal",
  },
  {
    intent: "appointment_booking",
    scenario: null,
    name: "Appointments",
    what: "Checks the real diary and offers only times that are genuinely free. Never says a time is free without asking.",
    cadence: "On request",
    needsClient: true,
    prompt: "book her a policy review",
    audience: "client",
  },
];

export const INTENT_LABELS: Record<string, string> = {
  ...Object.fromEntries(SCENARIOS.map((s) => [s.intent, s.name])),
  restart: "Restart thread",
  help: "Help",
  unknown: "Conversational",
};

export function intentLabel(intent: string | null | undefined): string {
  if (!intent) return "Unrouted";
  return INTENT_LABELS[intent] ?? intent.replace(/_/g, " ");
}

/** Phrasings Milo's keyword router actually matches (graph/router.py), so a
    suggestion never lands on "I'm not sure what you're asking". */
export const SUGGESTED_PROMPTS = [
  "my tasks for today",
  "any birthdays today?",
  "who's missing products?",
  "what does Dana Cohen have?",
  "which clients are inactive?",
  "what documents for a surgery reimbursement?",
  "did Israel sign yet?",
  "when are we open on Friday?",
];
