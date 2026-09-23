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
  /** Not sent by every build — the UI treats absence as "none". */
  awaiting?: string[];
  //: Same for withheld. Kept so both old and new backends render.
  withheld?: string[];
  report: Report | null;
  /** Structured answer. Prefer this over `report` when present.
   *  Optional: older builds and the mock transport do not send it. */
  data?: TurnData | null;
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

/** GET /auth/config — what the sign-in page needs before anyone is signed in. */
export interface AuthConfig {
  google_client_id: string | null;
  google_sign_in_enabled: boolean;
}

/** GET /auth/me, POST /auth/google — who the session cookie says this is. */
export interface Identity {
  email: string;
  display_name: string;
  is_admin: boolean;
}

/** One row of the allowlist — GET /auth/users. */
export interface AllowedUser {
  email: string;
  display_name: string | null;
  is_admin: boolean;
  active: boolean;
  added_by: string | null;
  created_at: string;
  last_login_at: string | null;
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
  data?: TurnData | null;
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

/* --------------------------------------------------------------------------
 * Structured answers — POST /agent/turn `data`
 *
 * A `Report` is a rendering: the backend picked sections, wrote Hebrew labels
 * and formatted the numbers, because WhatsApp can only carry text. `data` is
 * the same answer before any of that, so this console decides what to show,
 * in what order, and how to format it.
 * ----------------------------------------------------------------------- */

export interface DossierClient {
  crm_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  id_number: string | null;
  /** ISO date. */
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  /** ISO datetime. */
  last_action_at: string | null;
  last_conversation_at: string | null;
  created_at: string | null;
}

/** One cover flag. The label is the CRM's own wording, not ours. */
export interface DossierCover {
  label: string;
  held: boolean;
}

/** A premium or a balance. Unformatted on purpose — see the note above. */
export interface DossierAmount {
  label: string;
  value: number;
  currency: "ILS";
}

/** `held: null` means the CRM never computed it — distinct from "does not hold". */
export interface DossierPresence {
  product: string;
  held: boolean | null;
}

/** One תהליך — what happened on this client's file. */
export interface DossierProcess {
  id: string | null;
  opened_on: string | null;
  closed_on: string | null;
  type: string | null;
  status: string | null;
  is_closed: boolean;
  company: string | null;
  assignee: string | null;
  notes: string | null;
  last_activity_at: string | null;
}

export interface DossierRelation {
  name: string;
  relationship: string | null;
  crm_id: string | null;
}

export interface ClientDossier {
  kind: "client_dossier";
  client: DossierClient;
  covers: DossierCover[];
  amounts: DossierAmount[];
  presence: DossierPresence[];
  processes: DossierProcess[];
  related: DossierRelation[];
  calculated_at: string | null;
  /** False for CRMs with no per-policy resource, so we can say why. */
  policy_level_available: boolean;
}

export type TurnData = ClientDossier;
