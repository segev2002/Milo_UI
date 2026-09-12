import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, authConfig, loginWithGoogle, session } from "../lib/api";
import { Button } from "./ui";

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
 */

const GSI_SRC = "https://accounts.google.com/gsi/client";

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

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");

  const signIn = useCallback(
    async (credential: string) => {
      setBusy(true);
      setError(null);
      try {
        await loginWithGoogle(credential);
        onSignedIn();
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
          // The server has no client id. Say so plainly and open the manual
          // path, rather than rendering a button that cannot work.
          setStatus("unavailable");
          setShowManual(true);
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
        if (!cancelled) {
          setStatus("unavailable");
          setShowManual(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signIn]);

  const useManualToken = () => {
    if (!manualToken.trim()) return;
    session.setToken(manualToken);
    onSignedIn();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 py-10">
      <div className="fade-in w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-champagne font-display text-2xl font-semibold text-ink-900">
            M
          </span>
          <h1 className="mt-5 font-display text-[28px] font-semibold leading-none text-champagne">
            מילו
          </h1>
          <p className="mt-2.5 text-sm text-champagne/60">סוכנות הביטוח של סיגל</p>
        </div>

        <div className="rounded-2xl border border-line bg-white px-7 py-8">
          <h2 className="font-display text-lg font-semibold text-ink-900">כניסה לקונסולה</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            הכניסה מיועדת לסיגל ולצוות הסוכנות בלבד. התחברו עם חשבון Google של הסוכנות.
          </p>

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

          {status === "unavailable" && !error && (
            <p className="mt-4 rounded-xl border border-champagne-deep bg-champagne-soft px-4 py-3 text-[13px] leading-relaxed text-[#7a5a1a]">
              כניסה עם Google לא זמינה כרגע. אפשר להיכנס עם טוקן, למטה.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
              {error}
            </p>
          )}

          <div className="mt-7 border-t border-line pt-5">
            {!showManual ? (
              <button
                onClick={() => setShowManual(true)}
                className="text-xs text-muted underline underline-offset-2 hover:text-ink-700"
              >
                כניסה עם טוקן במקום
              </button>
            ) : (
              <div>
                <label
                  htmlFor="manual-token"
                  className="block text-xs font-medium text-ink-900"
                >
                  כניסה עם טוקן
                </label>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  למפתחים, או כשאין גישה ל-Google. הטוקן נוצר עם{" "}
                  <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]" dir="ltr">
                    python -m scripts.issue_token
                  </code>
                  .
                </p>
                <input
                  id="manual-token"
                  dir="ltr"
                  value={manualToken}
                  onChange={(event) => setManualToken(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && useManualToken()}
                  placeholder="eyJhbGciOi…"
                  className="mt-2.5 w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-xs text-body outline-none focus:border-ink-300"
                />
                <Button
                  onClick={useManualToken}
                  disabled={!manualToken.trim()}
                  size="sm"
                  className="mt-3"
                >
                  כניסה
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-champagne/40">
          כל כניסה נרשמת. גישה ניתנת לפי כתובת מאושרת בלבד.
        </p>
      </div>
    </div>
  );
}
