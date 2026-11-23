import { useEffect, useState, type ReactNode } from "react";
import { FcGoogle } from "react-icons/fc";
import { LuCheck, LuCircle, LuCircleCheck, LuCopy, LuExternalLink } from "react-icons/lu";
import { SiGmail, SiGooglecalendar, SiGoogledrive, SiWhatsapp } from "react-icons/si";
import {
  ApiError,
  chooseSystems,
  connectSystem,
  getSystems,
  googleConnectUrl,
  googleTest,
  whatsappCode,
} from "../lib/api";
import type { SystemStatus, SystemsState, WhatsAppCode } from "../types";
import { Modal } from "./Tasks";
import { Button, DateField, Empty, TiltCard } from "./ui";

/** What each key field is called on screen. */
const LABELS: Record<string, string> = {
  client_id: "Client ID",
  client_secret: "Client secret",
  username: "שם משתמש",
  password: "סיסמה",
};
/** Fields that are secrets: typed into a password box. */
const HIDDEN = new Set(["client_secret", "password"]);

/** Each card's face colour, from the vendor's own brand. `keys` is the page where the agency makes
    its keys (shown in the keys window); `keysNote` says how to get them when there is no such page. */
const BRAND: Record<string, { color: string; keys?: string; keysNote?: string }> = {
  surense: {
    color: "linear-gradient(135deg, #1f6bff, #0b3fb3)",
    keys: "https://app.surense.com/settings/agency/api",
  },
  polywizz: {
    color: "linear-gradient(135deg, #2b3a73, #121a3d)",
    keysNote: "את שם המשתמש והסיסמה ל-API פותחים ב-PolyWizz עבור הסוכנות: בקשו אותם מ-PolyWizz.",
  },
  roeto: { color: "linear-gradient(135deg, #2a2860, #1f7bff)" },
  bafi: { color: "linear-gradient(135deg, #20b2c8, #0d6f7f)" },
  google: { color: "linear-gradient(135deg, #4285f4, #1a4fb8)" },
  whatsapp: { color: "linear-gradient(135deg, #25d366, #128c7e)" },
};

const ERROR_BOX =
  "rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[0.875rem] leading-relaxed text-blocked";
const INPUT =
  "mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base text-body outline-none focus:border-ink-500 focus:bg-white";

const img = (id: string) =>
  id === "polywizz" ? (
    // PolyWizz publishes only a 32px icon: shown at twice its size, sharp, rather than blurred.
    <img src="/systems/polywizz.png" alt="" className="h-16 w-16 object-contain [image-rendering:pixelated]" />
  ) : (
    <img src={`/systems/${id}.png`} alt="" className="h-full w-full object-contain" />
  );

/**
 * חיבורים — the agency's admin connects the systems it works with, its Google
 * account and the agent's WhatsApp. Every connection is the same card. Keys go
 * from here to the server, which tries them and saves them in the agency's own
 * secret; they never come back to the browser. Admin-only; the server enforces it too.
 */
export function Systems() {
  const [state, setState] = useState<SystemsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  //: Which card's window is open: a system id, "google" or "whatsapp".
  const [open, setOpen] = useState<string | null>(null);
  const googleBack = new URLSearchParams(window.location.search).get("google") === "connected";

  const load = () =>
    getSystems()
      .then(setState)
      .catch((exc) => setError(exc instanceof ApiError ? exc.message : "הטעינה נכשלה."));
  useEffect(() => void load(), []);

  /** Ticks a system as one the agency uses (or not) — saved, not secret. */
  async function setChosen(id: string, chosen: boolean) {
    if (!state) return;
    const list = state.systems.filter((s) => (s.id === id ? chosen : s.chosen)).map((s) => s.id);
    setState({ ...state, systems: state.systems.map((s) => (s.id === id ? { ...s, chosen } : s)) });
    try {
      await chooseSystems(list);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "השמירה נכשלה.");
      void load();
    }
  }

  if (!state) return error ? <p className={ERROR_BOX}>{error}</p> : <Empty title="טוען…" />;

  const system = state.systems.find((s) => s.id === open);
  const g = state.google;
  const googleServices = [g.drive && "Drive", g.calendar && "יומן", g.gmail && "Gmail"].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      {error && <p className={ERROR_BOX}>{error}</p>}
      {!state.can_write && (
        <p className={ERROR_BOX}>בסביבת הבדיקה אי אפשר לשנות את המפתחות של הסוכנות הזו: הם משותפים עם המערכת האמיתית.</p>
      )}
      {googleBack && <p className="text-sm text-milo">Google חובר ✓</p>}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {state.systems.map((s) => (
          <TiltCard
            key={s.id}
            title={s.name}
            subtitle={statusOf(s)}
            logo={img(s.id)}
            color={BRAND[s.id]?.color ?? "#334155"}
            actionText={
              !s.available
                ? s.chosen
                  ? "לא עובדים איתה"
                  : `אנחנו עובדים עם ${s.name}`
                : s.connected
                  ? "עדכון מפתחות"
                  : "חיבור"
            }
            disabled={s.available && !state.can_write}
            onAction={() => (s.available ? setOpen(s.id) : void setChosen(s.id, !s.chosen))}
          />
        ))}
        <TiltCard
          title="Google"
          subtitle={
            g.connected ? `מחובר ✓ · ${g.account || googleServices}` : "Drive, יומן ו-Gmail · לא מחובר"
          }
          logo={<FcGoogle className="h-full w-full" />}
          color={BRAND.google.color}
          actionText={g.connected ? "ניהול החיבור" : "התחברות עם Google"}
          disabled={!state.can_write}
          onAction={() => setOpen("google")}
        />
        <TiltCard
          title="וואטסאפ של הסוכן/ת"
          subtitle="מילו מזהה את הטלפון של הסוכן/ת"
          logo={<SiWhatsapp className="h-full w-full text-[#25d366]" />}
          color={BRAND.whatsapp.color}
          actionText="קוד לחיבור"
          onAction={() => setOpen("whatsapp")}
        />
      </div>

      {system && (
        <KeysWindow
          system={system}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            if (!system.chosen) void setChosen(system.id, true);
            void load();
          }}
        />
      )}
      {open === "google" && <GoogleWindow google={g} onClose={() => setOpen(null)} />}
      {open === "whatsapp" && <WhatsAppWindow onClose={() => setOpen(null)} />}
    </div>
  );
}

function statusOf(s: SystemStatus): ReactNode {
  if (!s.available) return s.chosen ? "בקרוב · סימנתם שאתם עובדים איתה" : "בקרוב";
  if (!s.connected) return "לא מחובר";
  if (!s.expires_at) return "מחובר ✓";
  const days = Math.round((new Date(s.expires_at).getTime() - Date.now()) / 86_400_000);
  return `מחובר ✓ · המפתח פג בעוד ${days} ימים`;
}

/** Every connection's window (and the playbook's): one size, one type scale, a logo beside the name. */
export function Window({
  title,
  logo,
  onClose,
  children,
}: {
  title: string;
  logo?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal onClose={onClose} size="lg">
      <div className="space-y-5 p-7 text-base">
        <div className="flex items-center gap-3">
          {logo && <span className="flex h-11 w-11 shrink-0 items-center justify-center">{logo}</span>}
          <h2 className="font-display text-2xl font-semibold text-ink-900">{title}</h2>
        </div>
        {children}
      </div>
    </Modal>
  );
}

/** A green "connected" chip, or a grey one for what is not. */
function Connected({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
        on ? "bg-[#e3f6ea] text-[#167a3e]" : "bg-paper text-muted"
      }`}
    >
      {on ? <LuCircleCheck className="h-4 w-4" /> : <LuCircle className="h-4 w-4" />}
      {children}
    </span>
  );
}

/** Copy to the clipboard, with a short "הועתק". */
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      onClick={() =>
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          })
          .catch(() => undefined)
      }
    >
      {done ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
      {done ? "הועתק" : "העתקה"}
    </Button>
  );
}

/** The system's keys: tried by the server, saved only if they work. */
function KeysWindow({ system, onClose, onSaved }: { system: SystemStatus; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [createdOn, setCreatedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await connectSystem(system.id, values, createdOn || undefined);
      onSaved();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "השמירה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Window title={`חיבור ${system.name}`} logo={img(system.id)} onClose={onClose}>
      {system.connected && <Connected on>מחובר עכשיו · מפתחות חדשים יחליפו את הקיימים</Connected>}
      {BRAND[system.id]?.keys ? (
        <a
          href={BRAND[system.id].keys}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3.5 transition-colors hover:border-ink-500 hover:bg-white"
        >
          <span className="h-9 w-9 shrink-0">{img(system.id)}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink-900">איפה מוצאים את המפתחות</span>
            <span className="block text-sm text-muted">ההגדרות של {system.name} ← API · נפתח בלשונית חדשה</span>
          </span>
          <LuExternalLink className="h-5 w-5 shrink-0 text-muted" />
        </a>
      ) : (
        BRAND[system.id]?.keysNote && <p className="text-body">{BRAND[system.id].keysNote}</p>
      )}
      {system.fields.map((field) => (
        <div key={field}>
          <label htmlFor={`${system.id}-${field}`} className="block text-sm font-semibold text-ink-900">
            {LABELS[field] ?? field}
          </label>
          <input
            id={`${system.id}-${field}`}
            type={HIDDEN.has(field) ? "password" : "text"}
            autoComplete="off"
            dir="ltr"
            value={values[field] ?? ""}
            onChange={(event) => setValues({ ...values, [field]: event.target.value })}
            className={INPUT}
          />
        </div>
      ))}
      {system.id === "surense" && (
        <div>
          <p className="mb-1.5 block text-sm font-semibold text-ink-900">מתי המפתח נוצר ב-Surense (בתוקף 180 יום)</p>
          <DateField value={createdOn} onChange={setCreatedOn} />
        </div>
      )}
      <p className="text-sm text-muted">המפתחות נשמרים מוצפנים בחשבון של מילו, ולא מוצגים שוב.</p>
      {error && <p className={ERROR_BOX}>{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          ביטול
        </Button>
        <Button
          disabled={busy || system.fields.some((f) => !(values[f] ?? "").trim())}
          onClick={() => void save()}
        >
          {busy ? "בודק…" : "בדיקה ושמירה"}
        </Button>
      </div>
    </Window>
  );
}

/** Drive, Calendar and Gmail, each with its own logo and whether Google granted it. */
const GOOGLE_SERVICES: { key: "drive" | "calendar" | "gmail"; name: string; what: string; logo: ReactNode }[] = [
  { key: "drive", name: "Google Drive", what: "ניתוחי התיק שמילו יוצר", logo: <SiGoogledrive className="h-7 w-7 text-[#1a73e8]" /> },
  { key: "calendar", name: "יומן Google", what: "הפגישות של היום, זמנים פנויים וקביעת פגישות", logo: <SiGooglecalendar className="h-7 w-7 text-[#4285f4]" /> },
  { key: "gmail", name: "Gmail", what: "שליחת מיילים בשם הסוכנות, ומיילים שלא נקראו בתדריך הבוקר", logo: <SiGmail className="h-7 w-7 text-[#ea4335]" /> },
];

function GoogleWindow({ google, onClose }: { google: SystemsState["google"]; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      window.location.href = await googleConnectUrl();
    } catch (exc) {
      setMessage(exc instanceof ApiError ? exc.message : "החיבור נכשל.");
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await googleTest();
      setMessage(
        `יומן: ${r.calendar ? `✓ ${r.busy_today ?? 0} אירועים היום` : "✗ לא עבד"} · Gmail: ${
          r.gmail ? `✓ נשלח מייל בדיקה אל ${r.sent_to ?? ""}` : "✗ לא עבד"
        }`,
      );
    } catch (exc) {
      setMessage(exc instanceof ApiError ? exc.message : "הבדיקה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Window title="Google" logo={<FcGoogle className="h-10 w-10" />} onClose={onClose}>
      {google.connected ? (
        <div className="rounded-xl border border-line bg-paper px-4 py-3.5">
          <p className="text-sm font-semibold text-muted">המייל המחובר</p>
          <p className="mt-0.5 text-lg font-semibold text-ink-900" dir="ltr">
            {google.account || "—"}
          </p>
        </div>
      ) : (
        <p className="text-body">חשבון ה-Google של הסוכנות, באישור אחד. מהמייל מילו קורא רק שולח, נושא ושורת פתיחה של מיילים שלא נקראו, לתדריך הבוקר.</p>
      )}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {GOOGLE_SERVICES.map((service) => {
          // Gmail connected before the brief read mail: sending works, reading needs a reconnect.
          const stale = service.key === "gmail" && google.connected && google.gmail && !google.gmail_read;
          const on = google.connected && google[service.key] && !stale;
          return (
            <li key={service.key} className="flex items-center gap-3 px-4 py-3">
              <span className="shrink-0">{service.logo}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900">{service.name}</span>
                <span className="block text-sm text-muted">{service.what}</span>
              </span>
              <Connected on={on}>{on ? "מחובר" : stale ? "צריך חיבור מחדש" : "לא מחובר"}</Connected>
            </li>
          );
        })}
      </ul>
      {message && <p className="rounded-xl bg-paper px-4 py-3 text-sm text-body">{message}</p>}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {google.connected && (
          <Button variant="ghost" disabled={busy} onClick={() => void test()}>
            בדיקה
          </Button>
        )}
        <Button disabled={busy} onClick={() => void connect()}>
          {google.connected ? "חיבור מחדש" : "התחברות עם Google"}
        </Button>
      </div>
    </Window>
  );
}

/** The agent's own phone on Milo's one number: a one-time code sent from that phone.
 * With `email` (from the users page), the phone becomes that user's. */
export function WhatsAppWindow({ onClose, email, name }: { onClose: () => void; email?: string; name?: string }) {
  const [code, setCode] = useState<WhatsAppCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    whatsappCode(email)
      .then(setCode)
      .catch((exc) => setError(exc instanceof ApiError ? exc.message : "הפעולה נכשלה."));
  }, []);

  return (
    <Window title={name ? `וואטסאפ של ${name}` : "וואטסאפ של הסוכן/ת"} logo={<SiWhatsapp className="h-9 w-9 text-[#25d366]" />} onClose={onClose}>
      {error && <p className={ERROR_BOX}>{error}</p>}
      {!code && !error && <p className="text-muted">יוצר קוד…</p>}
      {code && (
        <>
          <div className="rounded-xl border border-line bg-paper px-4 py-4">
            <p className="text-sm font-semibold text-muted">
              1 · שלחו את הקוד הזה למילו מהטלפון של {name || "הסוכן/ת"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span dir="ltr" className="font-mono text-3xl font-bold tracking-wider text-ink-900">
                {code.code}
              </span>
              <CopyButton text={code.code} />
            </div>
            <p className="mt-2 text-sm text-muted">בתוקף 10 דקות, לשימוש אחד.</p>
          </div>
          <a
            href={code.agent_link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#1ebe5a]"
          >
            <SiWhatsapp className="h-5 w-5" />
            פתיחה בוואטסאפ עם הקוד
          </a>
          <div className="rounded-xl border border-line px-4 py-4">
            <p className="text-sm font-semibold text-muted">2 · הקישור שהלקוחות שלכם שולחים למילו</p>
            <div className="mt-2 flex items-center gap-3">
              <span dir="ltr" className="min-w-0 flex-1 truncate text-sm text-body">
                {decodeURI(code.client_link)}
              </span>
              <CopyButton text={code.client_link} />
            </div>
          </div>
        </>
      )}
    </Window>
  );
}
