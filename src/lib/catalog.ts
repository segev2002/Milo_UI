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
    intent: "discount_check",
    scenario: 3,
    name: "בדיקת הנחות",
    what: "כל פוליסה פעילה נבדקת אצל המבטח שלה. 'אין הנחה' ו'לא הצלחתי לברר' נשארות תשובות שונות.",
    cadence: "לפי בקשה",
    needsClient: true,
    prompt: "בדוק הנחות בפוליסות שלו",
    audience: "sigal",
  },
  {
    intent: "reverify_insurance_file",
    scenario: 4,
    name: "בדיקת תיק ביטוחי",
    what: "הר הביטוח + המסלקה, בשלבים. עוצר לחלוטין עד לחתימה אמיתית.",
    cadence: "המשך כל שעה",
    needsClient: true,
    prompt: "בדיקת תיק ביטוחי שלה",
    audience: "sigal",
  },
  {
    intent: "reimbursement_documents",
    scenario: 5,
    name: "מסמכים להחזר",
    what: "בדיוק המסמכים שסוג הטיפול דורש, ועוד אישור הבנק. שום דבר לא רלוונטי.",
    cadence: "לפי בקשה",
    needsClient: false,
    prompt: "אילו מסמכים נדרשים להחזר על ניתוח?",
    audience: "sigal",
  },
  {
    intent: "life_insurance_milestone",
    scenario: 6,
    name: "ביטוח חיים, 3 שנים",
    what: "פוליסות שמגיעות לשלוש שנים — פעם אחת לכל אבן דרך, לא פעם ביום.",
    cadence: "יומי",
    needsClient: false,
    prompt: "אילו פוליסות ביטוח חיים מגיעות לבדיקה?",
    audience: "sigal",
  },
  {
    intent: "tax_certificates",
    scenario: 7,
    name: "אישורי מס",
    what: "אישור לכל מוצר וגוף מנהל, ואת אלה שלא הצליח להפיק עם הסיבה.",
    cadence: "לפי בקשה",
    needsClient: true,
    prompt: "הפק את אישורי המס שלו",
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
    intent: "daily_digest",
    scenario: 9,
    name: "סיכום משימות יומי",
    what: "משימות פתוחות לפי עדיפות, לכל אחת שורת הסבר למקומה בתור.",
    cadence: "07:00 יומי",
    needsClient: false,
    prompt: "המשימות שלי להיום",
    audience: "sigal",
  },
  {
    intent: "client_activity_log",
    scenario: 10,
    name: "יומן פעולות לקוח",
    what: "מה מילו כתב בכרטיס ה-CRM של הלקוח — צד הקריאה של יומן הפעולות.",
    cadence: "לפי בקשה",
    needsClient: true,
    prompt: "הצג לי את יומן הפעולות",
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
    intent: "appointment_booking",
    scenario: null,
    name: "פגישות",
    what: "בודק את היומן האמיתי ומציע רק שעות שפנויות באמת. מעולם לא אומר שיש שעה פנויה בלי לבדוק.",
    cadence: "לפי בקשה",
    needsClient: true,
    prompt: "קבע לה פגישה לבדיקת פוליסה",
    audience: "client",
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

/** Phrasings Milo's keyword router actually matches (graph/router.py), so a
    suggestion never lands on "I'm not sure what you're asking". */
export const SUGGESTED_PROMPTS = [
  "המשימות שלי להיום",
  "יש ימי הולדת היום?",
  "מי חסרים מוצרים?",
  "מה יש לדנה כהן?",
  "אילו לקוחות לא פעילים?",
  "אילו מסמכים להחזר על ניתוח?",
  "האם ישראל חתם?",
  "מתי אנחנו פתוחים ביום שישי?",
];
