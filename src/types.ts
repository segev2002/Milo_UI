export type ReportStatus = "ok" | "attention" | "blocked" | "empty";

export interface ReportTable {
  headers: string[];
  rows: string[][];
  caption: string | null;
}

export interface ReportSection {
  title: string | null;
  lines: string[];
  table: ReportTable | null;
}

export interface Report {
  title: string;
  status: ReportStatus;
  summary: string | null;
  sections: ReportSection[];
  missing_information: string[];
  awaiting: string[];
  footnotes: string[];
}

/** POST /agent/turn response — api/routes/agent.py::TurnResponse */
export interface TurnResponse {
  reply: string;
  intent: string | null;
  status: string | null;
  missing_information: string[];
  awaiting: string[];
  withheld: string[];
  report: Report | null;
}

export interface TurnRequest {
  message?: string;
  intent?: Intent | null;
  client_crm_id?: string | null;
  client_id_number?: string | null;
  client_name?: string | null;
  parameters?: Record<string, unknown>;
}

/** GET /agent/whoami */
export interface WhoAmI {
  subject: string;
  display_name: string;
  role: string;
  max_sensitivity: string;
  client_crm_id: string | null;
  channel: string;
}

/** GET /health */
export interface Health {
  status: string;
  environment: string;
  timezone: string;
  dry_run: boolean;
  all_integrations_mocked: boolean;
}

/** graph/state.py::Intent */
export type Intent =
  | "missing_products"
  | "birthdays"
  | "discount_check"
  | "reverify_insurance_file"
  | "reimbursement_documents"
  | "life_insurance_milestone"
  | "tax_certificates"
  | "inactive_clients"
  | "daily_digest"
  | "client_activity_log"
  | "appointment_booking"
  | "process_status"
  | "client_overview"
  | "restart"
  | "help"
  | "unknown";

export interface ChatMessage {
  id: string;
  role: "sigal" | "milo";
  text: string;
  at: string;
  pending?: boolean;
  failed?: boolean;
  /** True when this reply came from mock.ts and never touched the API. */
  demo?: boolean;
  intent?: string | null;
  status?: string | null;
  report?: Report | null;
  missing_information?: string[];
  awaiting?: string[];
  withheld?: string[];
  durationMs?: number;
}

/** One row of the local ledger — what this console asked Milo and what came back. */
export interface ActivityEntry {
  id: string;
  at: string;
  source: "chat" | "scenario";
  prompt: string;
  intent: string | null;
  status: string | null;
  reportTitle: string | null;
  reportStatus: ReportStatus | null;
  ok: boolean;
  durationMs: number;
  missingCount: number;
  awaitingCount: number;
  withheldCount: number;
}

/** GET /auth/config — what the sign-in page needs to render itself. */
export interface AuthConfig {
  google_client_id: string | null;
  google_sign_in_enabled: boolean;
}

/** POST /auth/google — api/routes/auth.py::LoginResponse */
export interface LoginResponse {
  token: string;
  expires_in: number;
  subject: string;
  display_name: string;
  role: string;
  email: string;
  picture: string | null;
}

/** The signed-in person, cached locally so the shell can greet without a round trip. */
export interface SignedInUser {
  display_name: string;
  email: string;
  role: string;
  picture: string | null;
}
