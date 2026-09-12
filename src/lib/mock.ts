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
    display_name: "סיגל (דוגמה)",
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
  if (/(יום הולדת|ימי הולדת|birthday)/.test(text)) return "birthdays";
  if (/(חסר|חסרים|פער|missing)/.test(text)) return "missing_products";
  if (/(הנחה|הנחות|יקר|discount)/.test(text)) return "discount_check";
  if (/(מסמכים|החזר|תביעה|ניתוח|document|reimburs)/.test(text)) return "reimbursement_documents";
  if (/(אישור מס|אישורי מס|tax)/.test(text)) return "tax_certificates";
  if (/(לא פעיל|רדומים|נעלם|inactive)/.test(text)) return "inactive_clients";
  if (/(משימות|היום|סדר יום|task)/.test(text)) return "daily_digest";
  if (/(חתם|חתמה|בדיקת תיק|sign)/.test(text)) return "process_status";
  if (/(פגישה|לקבוע|תור|book|meeting)/.test(text)) return "appointment_booking";
  if (/(מה יש ל|סקירה|overview)/.test(text)) return "client_overview";
  return "unknown";
}

function response(input: Report, extra: Partial<TurnResponse> = {}): TurnResponse {
  const report = label(input);
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
        title: "המשימות שלך — יום שלישי",
        status: "attention",
        summary: "4 משימות פתוחות. שתיים ממתינות למישהו אחר, לא לך.",
        sections: [
          {
            title: "לפי סדר עדיפות",
            lines: [],
            table: {
              headers: ["משימה", "לקוח", "מדוע כאן"],
              rows: [
                ["חתימה חסרה", "ישראל בן-עמי", "חוסם את השליפה מהר הביטוח — 6 ימים"],
                ["ביטוח חיים 3 שנים", "דנה כהן", "אבן הדרך הושגה אתמול"],
                ["בדיקת הנחות חוזרת", "משה לוי", "שני מבטחים החזירו 'לא ידוע' בשבוע שעבר"],
                ["חסרה קופת גמל", "רינה אזולאי", "הפער סומן בסריקה השבועית"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: [],
        awaiting: ["החתימה של ישראל בן-עמי", "דלפק ההנחות של מגדל"],
        footnotes: ["משקלי העדיפות הם עדיין SCH-1 — זמניים."],
      },
      { intent: "daily_digest" },
    ),
  birthdays: () =>
    response(
      {
        title: "ימי הולדת היום",
        status: "ok",
        summary: "ללקוח אחד יש יום הולדת היום.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["לקוח", "גיל", "טלפון"],
              rows: [["רינה אזולאי", "54", "052-000-0000"]],
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
        title: "לקוחות שחסרים להם מוצרי ליבה",
        status: "attention",
        summary: "ל-3 מתוך 12 לקוחות פעילים יש פער בפנסיה, קופת גמל או חיסכון.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["לקוח", "חסר", "שיחה אחרונה"],
              rows: [
                ["רינה אזולאי", "קופת גמל", "לפני 4 חודשים"],
                ["יוסי מזרחי", "תוכנית חיסכון", "לפני 11 חודשים"],
                ["טל ברק", "פנסיה, תוכנית חיסכון", "לפני חודשיים"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: ["לטל ברק אין תאריך לידה בתיק"],
        awaiting: [],
        footnotes: [],
      },
      { intent: "missing_products" },
    ),
  discount_check: () =>
    response(
      {
        title: "בדיקת הנחות — משה לוי",
        status: "attention",
        summary: "4 פוליסות פעילות נבדקו. הנחה אחת זמינה, לשני מבטחים לא ניתן היה להגיע.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["פוליסה", "מבטח", "תוצאה"],
              rows: [
                ["ביטוח חיים", "הראל", "8% זמין בתשלום שנתי"],
                ["בריאות", "כלל", "אין הנחה"],
                ["פנסיה", "מגדל", "לא הצלחתי לברר — הפורטל לא הגיב"],
                ["אובדן כושר עבודה", "מנורה מבטחים", "לא הצלחתי לברר — אין הרשאות"],
              ],
              caption: "'אין הנחה' ו'לא הצלחתי לברר' הן תשובות שונות.",
            },
          },
        ],
        missing_information: [],
        awaiting: ["הפורטל של מגדל", "הרשאות מנורה"],
        footnotes: [],
      },
      { intent: "discount_check" },
    ),
  reimbursement_documents: () =>
    response(
      {
        title: "מסמכים להחזר על ניתוח",
        status: "ok",
        summary: "חמישה מסמכים. כל מה שלא ברשימה הזו אינו נדרש.",
        sections: [
          {
            title: "נדרש",
            lines: [
              "דוח ניתוח מבית החולים המטפל",
              "קבלות מקוריות על כל סכום שנתבע",
              "הפניה מהרופא המטפל",
              "סיכום שחרור",
              "אישור ניהול חשבון בנק על שם הלקוח",
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
        title: "לקוחות לא פעילים",
        status: "attention",
        summary: "נמדד בשני צירים בנפרד: ללא שיחה, וללא פעולה.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["לקוח", "ללא שיחה מאז", "ללא פעולה מאז"],
              rows: [
                ["יוסי מזרחי", "26 חודשים", "13 חודשים"],
                ["נורית שלו", "9 חודשים", "31 חודשים"],
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
        title: "אישורי מס — משה לוי",
        status: "attention",
        summary: "3 מתוך 4 הופקו. אחד נכשל, עם הסיבה.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["מוצר", "גוף מנהל", "תוצאה"],
              rows: [
                ["קרן פנסיה", "מגדל", "הופק"],
                ["קופת גמל", "אלטשולר שחם", "הופק"],
                ["קרן השתלמות", "אלטשולר שחם", "הופק"],
                ["ביטוח מנהלים", "הפניקס", "לא הופק — 2025 עוד לא פורסם"],
              ],
              caption: null,
            },
          },
        ],
        missing_information: [],
        awaiting: ["הפניקס — אישורי 2025"],
        footnotes: ["אישורים לשנה הקודמת זמינים בדרך כלל מפברואר."],
      },
      { intent: "tax_certificates" },
    ),
  process_status: () =>
    response(
      {
        title: "בדיקת תיק ביטוחי — ישראל בן-עמי",
        status: "blocked",
        summary: "נעצר בשלב ב'. שני צילומי התעודה התקבלו; הטופס מלא ולא חתום.",
        sections: [
          {
            title: "היכן זה עומד",
            lines: [
              "שלב א' — צילומי תעודת זהות נאספו (שני הצדדים) ✓",
              "שלב ב' — טופס פוליויז'ן מלא, ממתין לחתימה",
              "שלב ג' — שליפה מהר הביטוח + המסלקה (לא התחיל)",
            ],
            table: null,
          },
        ],
        missing_information: [],
        awaiting: ["החתימה של ישראל בן-עמי — לא ניתן לדלג עליה או לחתום בשמו"],
        footnotes: [],
      },
      { intent: "process_status" },
    ),
  client_overview: () =>
    response(
      {
        title: "דנה כהן",
        status: "ok",
        summary: "052-000-0000 · dana@example.co.il · לקוחה מ-2019",
        sections: [
          {
            title: "מחזיקה",
            lines: [],
            table: {
              headers: ["מוצר", "מבטח", "מאז"],
              rows: [
                ["קרן פנסיה", "מגדל", "2019"],
                ["ביטוח חיים", "הראל", "2022"],
                ["ביטוח בריאות", "כלל", "2021"],
              ],
              caption: null,
            },
          },
          { title: "לא בתיק", lines: ["קופת גמל", "קרן השתלמות"], table: null },
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
        title: "פוליסות ביטוח חיים בנקודת 3 השנים",
        status: "ok",
        summary: "פוליסה אחת הגיעה לאבן הדרך שלה אתמול.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["לקוח", "מבטח", "תאריך הנפקה"],
              rows: [["דנה כהן", "הראל", "לפני 3 שנים, אתמול"]],
              caption: null,
            },
          },
        ],
        missing_information: ["לפוליסת החיים של טל ברק אין תאריך הנפקה — דווח, לא הושמט"],
        awaiting: [],
        footnotes: [],
      },
      { intent: "life_insurance_milestone" },
    ),
  client_activity_log: () =>
    response(
      {
        title: "יומן פעולות — C-1003",
        status: "ok",
        summary: "כל מה שמילו כתב בכרטיס הזה.",
        sections: [
          {
            title: null,
            lines: [],
            table: {
              headers: ["מתי", "פעולה", "תוצאה"],
              rows: [
                ["היום 09:12", "אישורי מס הופקו (3 מתוך 4)", "הצלחה"],
                ["אתמול 14:40", "בדיקת הנחות אצל 4 מבטחים", "חלקי"],
                ["לפני 3 ימים", "מסמכים התקבלו בוואטסאפ", "הצלחה"],
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
        title: "בדיקת פוליסה — שעות שפנויות באמת",
        status: "ok",
        summary: "45 דקות. נבדק מול היומן ממש עכשיו.",
        sections: [
          {
            title: "הוצעו",
            lines: ["יום רביעי 11:00", "יום חמישי 15:30"],
            table: null,
          },
        ],
        missing_information: [],
        awaiting: ["איזו מהשתיים הלקוח מעדיף"],
        footnotes: ["שעה שלא הוצעה לא ניתן לקבוע."],
      },
      { intent: "appointment_booking" },
    ),
};

function conversational(message: string): TurnResponse {
  const text = message.toLowerCase();
  if (/(שישי|פתוח|פתוחים|שעות|friday|open|hours)/.test(text)) {
    return {
      reply:
        "תשובת דוגמה: פתוח ביום שישי 09:00–12:30, סגור בשבת, ראשון–חמישי 09:00–17:00. " +
        "השעות האלה מגיעות מנתוני הדוגמה של הקונסולה, לא מ-business/agency.yaml.",
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
      "נתוני דוגמה — הקונסולה הזו אינה מחוברת למילו, ולכן אין תשובה לתת. " +
      "הוסיפו טוקן במסך \"חיבור\" ושאלו שוב.",
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

/** Stamp every mock report, so a screenshot of one carries its own disclaimer. */
function label(report: Report): Report {
  return { ...report, footnotes: [...report.footnotes, "נתוני דוגמה — לא ממילו ולא מה-CRM."] };
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
        prompt: "(דוגמה)",
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
