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

/** Who filed a task: Milo, for a client he could not help or a number he did not
 *  recognise — or null, for a task a console user created. */
export type TaskKind = "clients" | "new_clients";

export type TaskStatus = "new" | "in_progress" | "done";

/** One row of milo.tasks — GET /agent/tasks */
export interface Task {
  id: string;
  title: string | null;
  description: string | null;
  status: TaskStatus;
  kind: TaskKind | null;
  /** Set by the WhatsApp client menu: which team the task is for. */
  team: "claims" | "operations" | null;
  phone: string | null;
  name: string | null;
  /** Milo's one line on what the person actually wants. Null when filed word for word. */
  summary: string | null;
  /** `media_url`: a file the person sent (a claim's receipt), opened via /agent/tasks/media. */
  messages: { text: string; at: string; media_url?: string }[];
  /** Files console users attached; `key` opens via /agent/tasks/media. */
  files: { key: string; name: string; by: string; at: string }[];
  /** The card's history, oldest first. */
  events: { type: "created" | "status" | "assignee" | "file" | "email" | "meeting"; text: string | null; by: string; at: string }[];
  assignee: string | null;
  created_by: string | null;
  created_at: string;
  last_message_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

/** GET /agent/tasks/people — who a task can be assigned to. */
export interface Person {
  email: string;
  display_name: string | null;
}

/** One message of the WhatsApp chat behind a task — GET /agent/tasks/{id}/conversation */
export interface TaskChatMessage {
  role: "customer" | "milo";
  text: string;
  at: string;
  /** A file the customer sent, opened via /agent/tasks/media. */
  media_url?: string;
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
  /** What Surense's products tab shows. Null when the portfolio could not be read. */
  policies: DossierPolicy[] | null;
  /** False when the policies could not be read, so we can say why. */
  policy_level_available: boolean;
}

/** One policy, as in Surense's products tab. */
export interface DossierPolicy {
  /** Surense's product group: "פנסיה", "גמל/השתלמות", "בריאות" ... */
  group: string;
  /** Null when the company id is not in agency.yaml. */
  company: string | null;
  product: string;
  policy_number: string | null;
  status: string;
  active: boolean;
  premium: number;
  premium_frequency: string | null;
  accumulation: number;
  covers: DossierPolicyCover[];
}

/** One row of a policy, shown when it is opened. */
export interface DossierPolicyCover {
  type: string | null;
  name: string | null;
  insured: string | null;
  insured_role: string | null;
  premium: number;
  amount: number;
  start: string | null;
  end: string | null;
}

export type TurnData = ClientDossier;

/** One row of milo.console_activity — GET /agent/activity (admins only). */
export interface ConsoleActivity {
  id: string;
  at: string;
  user_email: string;
  user_name: string | null;
  action: "chat" | "resolve_task";
  /** The question asked, or the resolved task's summary. */
  detail: string | null;
  /** The resolved task's name or number. Null for a chat. */
  customer: string | null;
}
