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
            title="חיבור"
            hint="לאן הקונסולה הזו מכוונת ומה הטוקן מרשה"
            right={
              <Button size="sm" variant="ghost" onClick={onRefresh}>
                בדוק שוב
              </Button>
            }
          />
          <dl className="divide-y divide-line text-sm">
            <Row label="מצב">
              {mode === "demo" ? (
                <Tag tone="warm">נתוני דוגמה</Tag>
              ) : (
                <Tag tone="ink">API חי</Tag>
              )}
            </Row>
            <Row label="כתובת API">
              {mode === "demo" ? "—" : session.baseUrl || "אותו origin (פרוקסי פיתוח)"}
            </Row>
            <Row label="בריאות">
              {health
                ? `${health.status} · ${health.environment} · ${health.timezone}`
                : (error ?? "לא ידוע")}
            </Row>
            <Row label="אינטגרציות">
              {health
                ? health.all_integrations_mocked
                  ? "הכול מדומה — התוצאות הן נתוני דוגמה"
                  : "חי"
                : "—"}
            </Row>
            <Row label="הרצה יבשה">
              {health ? (health.dry_run ? "פעיל — שום דבר לא נשלח" : "כבוי") : "—"}
            </Row>
            <Row label="מחובר בשם">{who ? `${who.display_name} (${who.subject})` : "—"}</Row>
            <Row label="תפקיד">{who ? `${who.role} · תקרה ${who.max_sensitivity}` : "—"}</Row>
          </dl>
        </Card>

        <Card>
          <CardHead
            title="טוקן"
            hint="מילו מאמת כל פונה — הדביקו את הטוקן שהוא הנפיק לסיגל"
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
                טוקן Bearer
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
                כתובת API
              </span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="ריק = אותו origin (פרוקסי הפיתוח)"
                className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-body placeholder:text-muted/60 focus:border-ink-500 focus:bg-white focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">שמור והשתמש ב-API</Button>
              {mode === "live" ? (
                <Button variant="ghost" onClick={() => onSwitchMode("demo")}>
                  עבור לנתוני דוגמה
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  disabled={!session.token}
                  onClick={() => onSwitchMode("live")}
                >
                  השתמש בטוקן השמור
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHead title="יומן בקשות" hint="נשמר בדפדפן הזה בלבד" />
          <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-muted">
            <p>
              הקונסולה מתעדת כל פנייה שהיא שולחת: מה נשאל, לאיזו כוונה מילו ניתב, כמה זמן זה לקח,
              והאם משהו היה חסר, ממתין או מוסתר. זה נמצא באחסון המקומי של הדפדפן הזה — ניקוי שלו
              לא נוגע בטבלאות של מילו עצמו.
            </p>
            <div className="flex flex-wrap gap-2">
              {mode === "demo" && (
                <Button
                  size="sm"
                  variant="warm"
                  onClick={() => sampleActivity().forEach((row) => activityStore.add(row))}
                >
                  טען שבועיים של שורות דוגמה
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm("לנקות את יומן הבקשות המקומי?")) activityStore.clear();
                }}
              >
                נקה יומן
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="מה הקונסולה הזו לא משנה" />
          <ul className="space-y-2 px-5 py-4 text-sm leading-relaxed text-muted">
            <li>
              היא צד־לקוח של <code className="text-ink-700">POST /agent/turn</code> — אותה נקודת קצה
              ואותו שער הרשאות כמו וואטסאפ. אין כאן שום לוגיקה עסקית.
            </li>
            <li>
              נפח היסטורי מוואטסאפ ומהעבודות המתוזמנות לא מוצג: אין עדיין נקודת קצה לקריאה שחושפת
              אותו, והמספרים של מילו אינם דבר שראוי לנחש.
            </li>
            <li>
              הדוחות מוצגים משדה ה־<code className="text-ink-700">report</code>{" "}
              המובנה, כך שדבר אינו מנוסח מחדש בדרך למסך.
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
      <dd className="text-end text-sm text-body">{children}</dd>
    </div>
  );
}
