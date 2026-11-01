import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, authConfig, loginWithGoogle, loginWithPassword, requestPasswordCode, setPassword } from "../lib/api";
import type { Identity } from "../types";
import { Button, FIELD } from "./ui";

/**
 * The console's front door.
 *
 * Google proves who someone is; it cannot know whether that person has anything
 * to do with this agency — so a successful Google sign-in is only half of it,
 * and the server still has to recognise the address. That is why a refusal here
 * says "this account isn't authorized" rather than "wrong password": the person
 * is who they say they are, they are simply not on the list, and the thing they
 * need to do next is ask Sigal rather than try again.
 *
 * The client id comes from GET /auth/config rather than from the bundle, so the
 * console can be rebuilt without it and a changed id is a server setting.
 *
 * Without Google: the same address and a password (EmailSignIn below). The
 * password is chosen with a code emailed to that address — the first time, and
 * whenever it is forgotten.
 *
 * Nothing is kept here after a successful sign-in. The server answers with an
 * httpOnly cookie, which this page never sees and could not read if it tried.
 */

const GSI_SRC = "https://accounts.google.com/gsi/client?hl=he";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}

/** Load Google's script once per page, and resolve when it is usable. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gsi")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(script);
  });
}

export function Login({ onSignedIn }: { onSignedIn: (identity: Identity) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "unreachable">(
    "loading",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(
    async (credential: string) => {
      setBusy(true);
      setError(null);
      try {
        onSignedIn(await loginWithGoogle(credential));
      } catch (exc) {
        setError(exc instanceof ApiError ? exc.message : "ההתחברות נכשלה.");
        setBusy(false);
      }
    },
    [onSignedIn],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const config = await authConfig();
        if (cancelled) return;

        if (!config.google_sign_in_enabled || !config.google_client_id) {
          // The server has no client id. Say so plainly, rather than rendering
          // a button that cannot work.
          setStatus("unavailable");
          return;
        }

        await loadGoogleScript();
        if (cancelled || !buttonRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: config.google_client_id,
          callback: (response) => void signIn(response.credential),
          cancel_on_tap_outside: false,
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          locale: "he",
          width: 280,
        });
        setStatus("ready");
      } catch {
        // Told apart on purpose: "the server has no client id" and "there is
        // no server answering" are different problems with different fixes.
        if (!cancelled) setStatus("unreachable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signIn]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="fade-in w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/milo.png" alt="" className="h-16 w-16 rounded-2xl bg-champagne object-cover shadow-sm" />
          <h1 className="mt-5 font-display text-[28px] font-semibold leading-none text-ink-900">מילו</h1>
          <p className="mt-3 text-[15px] text-muted">העוזר האישי של סיגל</p>
        </div>

        <div className="rounded-2xl border border-line bg-white px-7 py-8">
          <h2 className="font-display text-lg font-semibold text-ink-900">כניסה לקונסולה</h2>
          <div className="mt-6 flex min-h-[44px] items-center justify-center">
            {busy ? (
              <p className="text-sm text-muted">מתחבר…</p>
            ) : (
              <div ref={buttonRef} />
            )}
            {status === "loading" && !busy && (
              <p className="text-sm text-muted">טוען…</p>
            )}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            או עם אימייל וסיסמה
            <span className="h-px flex-1 bg-line" />
          </div>
          <EmailSignIn onSignedIn={onSignedIn} />

          {status === "unavailable" && !error && (
            <p className="mt-4 rounded-xl border border-champagne-deep bg-champagne-soft px-4 py-3 text-[13px] leading-relaxed text-[#7a5a1a]">
              כניסה עם Google לא מוגדרת בשרת. אפשר להיכנס עם אימייל וסיסמה.
            </p>
          )}

          {status === "unreachable" && !error && (
            <p className="mt-4 rounded-xl border border-champagne-deep bg-champagne-soft px-4 py-3 text-[13px] leading-relaxed text-[#7a5a1a]">
              לא הצלחתי להגיע לשרת של מילו. ודאו שהוא רץ, ונסו שוב.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const RESEND_AFTER = 60;
const ERROR_BOX =
  "rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked";

/**
 * Email + password. "כניסה ראשונה / שכחתי סיסמה" emails a 6-digit code; with it
 * the user chooses a password and is signed in. The server sends a code only to
 * an address on the list; any other gets its refusal here, and no email.
 */
function EmailSignIn({ onSignedIn }: { onSignedIn: (identity: Identity) => void }) {
  const [step, setStep] = useState<"login" | "code">("login");
  const [email, setEmail] = useState("");
  const [password, setPasswordValue] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!wait) return;
    const timer = window.setTimeout(() => setWait(wait - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "משהו השתבש. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const sendCode = () =>
    run(async () => {
      setSending(true);
      await requestPasswordCode(email.trim());
      setStep("code");
      setCode("");
      setPasswordValue("");
      setConfirm("");
      setWait(RESEND_AFTER);
    }).finally(() => setSending(false));

  const signIn = () => run(async () => onSignedIn(await loginWithPassword(email.trim(), password)));

  const choose = () => {
    if (password.length < 8) return setError("הסיסמה צריכה לכלול לפחות 8 תווים.");
    if (password !== confirm) return setError("הסיסמאות לא זהות.");
    return run(async () => onSignedIn(await setPassword(email.trim(), code.trim(), password)));
  };

  if (step === "code") {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void choose();
        }}
      >
        <p className="text-[13px] leading-relaxed text-body">
          שלחנו קוד בן 6 ספרות ל-<span dir="ltr" className="font-semibold text-ink-900">{email.trim()}</span>.
          הקוד בתוקף ל-10 דקות.
        </p>
        <input
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          placeholder="קוד מהמייל"
          aria-label="קוד מהמייל"
          className={`${FIELD} text-center tracking-[0.4em] placeholder:tracking-normal`}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPasswordValue(event.target.value)}
          placeholder="סיסמה חדשה (לפחות 8 תווים)"
          aria-label="סיסמה חדשה"
          className={FIELD}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="הסיסמה שוב"
          aria-label="אימות סיסמה"
          className={FIELD}
        />
        {error && <p className={ERROR_BOX}>{error}</p>}
        <Button type="submit" disabled={busy || code.length !== 6 || !password} className="w-full justify-center">
          {busy ? "שומר…" : "שמירה וכניסה"}
        </Button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep("login");
              setError(null);
            }}
            className="text-muted hover:text-ink-900"
          >
            חזרה
          </button>
          <button
            type="button"
            disabled={busy || wait > 0}
            onClick={() => void sendCode()}
            className="font-medium text-ink-900 hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
          >
            {wait > 0 ? `שליחה מחדש בעוד ${wait}` : "שליחת קוד חדש"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void signIn();
      }}
    >
      <input
        dir="ltr"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="name@example.co.il"
        aria-label="אימייל"
        className={FIELD}
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPasswordValue(event.target.value)}
        placeholder="סיסמה"
        aria-label="סיסמה"
        className={FIELD}
      />
      {error && <p className={ERROR_BOX}>{error}</p>}
      <Button type="submit" disabled={busy || !validEmail || !password} className="w-full justify-center">
        {sending ? "שולח קוד…" : busy ? "מתחבר…" : "כניסה"}
      </Button>
      <button
        type="button"
        disabled={busy}
        onClick={() => (validEmail ? void sendCode() : setError("הכניסו קודם את כתובת האימייל."))}
        className="block w-full text-center text-xs font-medium text-ink-900 hover:underline"
      >
        כניסה ראשונה או שכחתי סיסמה
      </button>
    </form>
  );
}
