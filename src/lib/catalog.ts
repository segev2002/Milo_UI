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
  /** Asks for the client's phone, sent with the prompt — not a client reference. */
  phoneInput?: boolean;
}

/** Mirrors agent-spec.md's ten scenarios plus the conversational extras. */
export const SCENARIOS: ScenarioMeta[] = [
  {
    intent: "missing_products",
    scenario: 1,
    name: "מוצרים חסרים",
    what: "לקוחות ללא פנסיה, קופת גמל או תוכנית חיסכון — מה חסר, לקוח לקוח.",
    cadence: "שבועי · לפי בקשה",
    needsClient: false,
    prompt: "מי חסרים מוצרים?",
    audience: "sigal",
  },
  {
    intent: "birthdays",
    scenario: 2,
    name: "ימי הולדת היום",
    what: "למי יש יום הולדת היום, עם פרטי קשר. אומר במפורש כשלאף אחד אין.",
    cadence: "08:00 יומי",
    needsClient: false,
    prompt: "יש ימי הולדת היום?",
    audience: "sigal",
  },
  {
    intent: "inactive_clients",
    scenario: 8,
    name: "לקוחות לא פעילים",
    what: "ללא שיחה, או ללא פעולה, ב-24 חודשים — שני הצירים נמדדים בנפרד.",
    cadence: "שבועי",
    needsClient: false,
    prompt: "אילו לקוחות לא פעילים?",
    audience: "sigal",
  },
  {
    intent: "client_overview",
    scenario: null,
    name: "סקירת לקוח",
    what: "מוצרים, פוליסות, פרטי קשר, ומה חסר בתיק.",
    cadence: "לפי בקשה",
    needsClient: true,
    prompt: "מה יש לה?",
    audience: "sigal",
  },
  {
    intent: "process_status",
    scenario: null,
    name: "סטטוס תהליך",
    what: "היכן עומדת בדיקת התיק, ועל מה היא ממתינה.",
    cadence: "לפי בקשה",
    needsClient: true,
    prompt: "האם הוא חתם?",
    audience: "sigal",
  },
  {
    intent: "whatsapp_conversation",
    scenario: null,
    name: "שיחת וואטסאפ",
    what: "השיחה של מילו עם מספר טלפון, מתוך יומן הוואטסאפ.",
    cadence: "לפי בקשה",
    needsClient: true,
    phoneInput: true,
    prompt: "הראה לי את השיחה עם",
    audience: "sigal",
  },
  {
    intent: "open_tasks",
    scenario: null,
    name: "משימות פתוחות",
    what: "כל המשימות שעוד לא בוצעו, לפי עמודה: חדשות, תביעות, בתהליך.",
    cadence: "לפי בקשה",
    needsClient: false,
    prompt: "מה המשימות הפתוחות?",
    audience: "sigal",
  },
  {
    intent: "create_client",
    scenario: null,
    name: "יצירת לקוח חדש",
    what: "שולח ללקוח SMS עם קישור למילוי פרטים וחתימה ב-PolyWizz. כשכל המידע מחברות הביטוח יגיע – תיפתח משימה.",
    cadence: "לפי בקשה",
    needsClient: true,
    phoneInput: true,
    prompt: "צור לקוח חדש",
    audience: "sigal",
  },
  {
    intent: "analyze_client",
    scenario: null,
    name: "ניתוח תיק",
    what: "ניתוח תיק בגוגל שיטס ללקוח קיים, מנתוני PolyWizz. מילו מבקש אישור לפני שמתחיל (הפעולה עולה כסף), וכשהניתוח מוכן נפתחת משימה עם קישור.",
    cadence: "לפי בקשה",
    needsClient: true,
    prompt: "ניתוח תיק",
    audience: "sigal",
  },
];

export const INTENT_LABELS: Record<string, string> = {
  ...Object.fromEntries(SCENARIOS.map((s) => [s.intent, s.name])),
  restart: "התחלת שיחה מחדש",
  help: "עזרה",
  unknown: "שיחה חופשית",
};

export function intentLabel(intent: string | null | undefined): string {
  if (!intent) return "לא נותב";
  return INTENT_LABELS[intent] ?? intent.replace(/_/g, " ");
}
