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

/** GET /agent/systems — what the agency connected. Never the keys themselves. */
export interface SystemStatus {
  id: "surense" | "polywizz" | "roeto" | "bafi";
  name: string;
  fields: string[];
  /** False: listed, cannot be connected yet ("בקרוב"). */
  available: boolean;
  chosen: boolean;
  connected: boolean;
  expires_at: string | null;
}

export interface SystemsState {
  /** False on dev for a real agency: its keys are shared with production. */
  can_write: boolean;
  systems: SystemStatus[];
  google: { connected: boolean; drive: boolean; calendar: boolean; gmail: boolean; gmail_read?: boolean; account?: string };
}

/** GET /auth/me, POST /auth/google — who the session cookie says this is. */
export interface Identity {
  email: string;
  display_name: string;
  is_admin: boolean;
  /** Milo's owner (all agencies): sees "עלויות ומפתחות". Not an agency role. */
  is_owner?: boolean;
  /** The agency this session works in; empty for Sigal's own deployment. */
  agency?: string;
}

/** GET /agent/owner/usage — one agency's use of one kind in the month. */
export interface UsageRow {
  agency_id: number | null;
  agency: string | null;
  month: string;
  kind: "chat" | "pdf" | "transcription" | "whatsapp" | "sms";
  calls: number;
  input_tokens: number;
  output_tokens: number;
  units: number;
  cost_usd: number;
}

export interface UsageMonth {
  month: string;
  agencies: { id: number; name: string; code: string }[];
  rows: UsageRow[];
}

/** GET /agent/owner/keys — an agency's API key that expires. */
export interface ApiKeyExpiry {
  agency_id: number;
  agency: string;
  key_name: string;
  expires_at: string;
  days_left: number;
  notified_at: string | null;
}

/** POST /auth/users/whatsapp-code — connect the agent's phone; the agency's links. */
export interface WhatsAppCode {
  code: string;
  agent_link: string;
  client_link: string;
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
  /** Chose a password (email sign-in); false = Google only, or not signed in yet. */
  has_password?: boolean;
}

/** Who filed a task: Milo, for a client he could not help or a number he did not
 *  recognise — or null, for a task a console user created. */
export type TaskKind = "clients" | "new_clients";

export type TaskStatus = "new" | "in_progress" | "done";

/** One row of milo.tasks — GET /agent/tasks */
export type TaskPriority = "normal" | "important" | "urgent";

export interface Task {
  id: string;
  title: string | null;
  description: string | null;
  /** One link the card opens — e.g. a new client's analysis sheet in Google Drive. */
  link_url?: string | null;
  link_label?: string | null;
  status: TaskStatus;
  kind: TaskKind | null;
  /** Set by the WhatsApp client menu: which team the task is for. */
  team: "claims" | "operations" | null;
  phone: string | null;
  name: string | null;
  /** Milo's one line on what the person actually wants. Null when filed word for word. */
  summary: string | null;
  /** `media_url`: a file the person sent (a claim's receipt), opened via /agent/tasks/media. */
  messages: { text: string; at: string; media_url?: string; media_name?: string }[];
  /** Files console users attached; `key` opens via /agent/tasks/media. */
  files: { key: string; name: string; by: string; at: string }[];
  /** The card's history, oldest first. */
  events: { type: "created" | "status" | "assignee" | "file" | "file_rename" | "file_delete" | "due" | "priority" | "email" | "meeting" | "polywizz"; text: string | null; by: string; at: string }[];
  /** The day the task is scheduled for ("YYYY-MM-DD"). A later day than today: a future task. */
  due_date?: string | null;
  /** רגיל / חשוב / דחוף. */
  priority?: TaskPriority;
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
  | "whatsapp_conversation"
  | "open_tasks"
  | "create_client"
  | "analyze_client"
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

/** "Show me the conversation with 0526747180" — milo.whatsapp_messages, oldest first. */
export interface WhatsAppConversation {
  kind: "whatsapp_conversation";
  phone: string;
  messages: TaskChatMessage[];
}

/** An action Milo waits for a user to approve, e.g. an expensive file analysis. */
export interface Confirm {
  kind: "confirm";
  label: string;
  prompt: string;
  intent: Intent;
  client_crm_id: string;
}

export type TurnData = ClientDossier | WhatsAppConversation | Confirm;

/** One row of milo.console_activity — GET /agent/activity (admins only). */
export interface ConsoleActivity {
  id: string;
  at: string;
  user_email: string;
  user_name: string | null;
  /** One of ACTIONS in UserActivity.tsx. */
  action: string;
  /** What was done: the question asked, the task's title and the change, what was typed in the sales log… */
  detail: string | null;
  /** Whose: the task's or call's client, the sale's insured. Null for a chat. */
  customer: string | null;
  /** The HTTP request behind it: method, path, query, body. Null on older lines. */
  request?: Record<string, unknown> | null;
}

/* --- ניהול הסוכנות --------------------------------------------------------- */

export type AgencyPeriod = "week" | "month" | "quarter" | "year" | "custom";

/** A period's totals. Sales: status "פוליסה", by sale date, amounts as written (monthly premium). */
export interface AgencyTotals {
  premium: number;
  /** Savings + pension + gemel moved in. */
  transfers: number;
  policies: number;
  tasks_done: number;
  /** Opened by Milo: from WhatsApp, or a call's follow-up. */
  tasks_by_milo: number;
  chats: number;
}

/** GET /agent/agency/summary (admins only). Dates are YYYY-MM-DD, both inclusive. */
export interface AgencySummary {
  period: { kind: AgencyPeriod; from: string; to: string };
  previous: { from: string; to: string };
  totals: AgencyTotals;
  previous_totals: AgencyTotals;
  /** The 12 months ending with the period's, each next to the same month a year earlier. */
  monthly: { month: string; premium: number; premium_last_year: number }[];
  /** The period's premium and policies per insurer, the largest first. */
  insurers: { insurer: string; premium: number; policies: number }[];
  /** Everyone who did something in the period, most active first. */
  people: {
    email: string;
    name: string;
    tasks_done: number;
    tasks_created: number;
    sale_rows: number;
    chats: number;
    actions: number;
    /** The tasks they closed in the period, latest first. */
    done: { id: string; title: string | null; client: string | null; resolved_at: string; by_milo: boolean }[];
  }[];
}

/* --- מכירות --------------------------------------------------------------- */

/** One tab of the sales log, usually a month — GET /agent/sales/sheets. */
export interface SalesSheet {
  id: string;
  title: string;
  /** "YYYY-MM-01", or null for a tab that is not a month. */
  month: string | null;
  position: number;
  /** The tab's columns, in order; null is the standard ones (Sales.tsx DEFAULT_COLUMNS). */
  columns?: SheetColumn[] | null;
  /** The boxes under the tab; null is the standard summary (Sales.tsx DEFAULT_SUMMARY). */
  summary?: SheetStat[] | null;
}

/** A column of a tab: a standard one by its field ("premium"), or one an admin added ("x_…"). */
export interface SheetColumn {
  id: string;
  label: string;
  /** Pixels at 16px text; drawn in rem, so it grows with the console's text. */
  width: number;
}

/** A box of a tab's summary. `count`: the filled cells of the column; `count_value`: those that say `value`. */
export interface SheetStat {
  label: string;
  op: "sum" | "avg" | "min" | "max" | "count" | "count_value";
  column: string;
  value?: string | null;
}

/** One sale. Amounts are numbers; the *_raw fields keep what was typed ("177K ₪", "עצמאי"). */
export interface SaleRow {
  id: string;
  sale_date: string | null;
  production_date: string | null;
  insured_name: string | null;
  id_number: string | null;
  product: string | null;
  insurer: string | null;
  premium: number | null;
  premium_raw: string | null;
  savings: number | null;
  savings_raw: string | null;
  status: string | null;
  agent_number: string | null;
  notes: string | null;
  /** ניוד קרן פנסיה */
  pension_amount: number | null;
  pension_raw: string | null;
  /** ניוד קופות גמל */
  gemel_amount: number | null;
  gemel_raw: string | null;
  salary: number | null;
  salary_raw: string | null;
  /** Cells Sigal painted: column → "#rrggbb". */
  colors: Record<string, string>;
  /** What was typed in the columns an admin added: column id → text. */
  extra?: Record<string, string>;
}

/** One row of the sheet's "יוניסון" block. */
export interface ServiceRow {
  id: string;
  handler: string | null;
  transfer_date: string | null;
  treatment: string | null;
  insured_name: string | null;
  status: string | null;
  left_job: string | null;
}

/** GET /agent/sales/sheets/{id} */
export interface SalesSheetRows extends SalesSheet {
  sales: SaleRow[];
  service: ServiceRow[];
}

export type CampaignCategory = "premium" | "savings" | "pension" | "gemel" | "salary";

/** A campaign with its live total — GET /agent/sales/campaigns. */
/** One category of a campaign, and how far it has got. */
export interface CampaignGoal {
  category: CampaignCategory;
  target: number;
  total: number;
  remaining: number;
  percent: number;
  achieved: boolean;
}

/** A campaign: one insurance company, a date range, a target per category. */
export interface Campaign {
  id: string;
  title: string | null;
  insurer: string;
  start_date: string;
  end_date: string;
  goals: CampaignGoal[];
  archived: boolean;
  /** Every goal reached. */
  achieved: boolean;
  days_left: number;
  started: boolean;
  ended: boolean;
}

export interface CampaignInput {
  title?: string;
  insurer: string;
  start_date: string;
  end_date: string;
  goals: { category: CampaignCategory; target: number }[];
}

/** What Milo told the admins — GET /agent/sales/notifications. */
export interface MiloNotification {
  id: string;
  kind: "campaign";
  title: string;
  body: string;
  campaign_id: string | null;
  created_at: string;
  read_at: string | null;
}

/* --- תמלול שיחות ---------------------------------------------------------- */

/** transcribing → summarizing → done, in that order; failed at any step. */
export type CallStatus = "transcribing" | "summarizing" | "done" | "failed";

/** A recorded call. The list omits `transcript` and `summary`; one call has them. */
export interface CallTranscription {
  id: string;
  client_name: string;
  phone: string | null;
  id_number: string | null;
  duration_seconds: number | null;
  status: CallStatus;
  audio_key: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  transcript?: string | null;
  summary?: string | null;
}
