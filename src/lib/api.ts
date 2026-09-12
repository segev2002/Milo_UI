import type {
  AuthConfig,
  Health,
  LoginResponse,
  SignedInUser,
  TurnRequest,
  TurnResponse,
  WhoAmI,
} from "../types";
import { mockTurn, mockWhoAmI, mockHealth } from "./mock";

const TOKEN_KEY = "milo.token";
const BASE_KEY = "milo.baseUrl";
const MODE_KEY = "milo.mode";
const USER_KEY = "milo.user";

/** Fired when a token is rejected or cleared, so the shell can show sign-in. */
export const SIGNED_OUT_EVENT = "milo:signed-out";

const ENV_TOKEN = (import.meta.env.VITE_MILO_TOKEN as string | undefined) ?? "";
const ENV_BASE = (import.meta.env.VITE_MILO_API_URL as string | undefined) ?? "";

export type Mode = "live" | "demo";

/**
 * The console opens on the sign-in page and nothing else is reachable without a
 * token. Signing in with Google mints one (POST /auth/google); pasting one by
 * hand under Connection still works, which is what keeps a developer — or Sigal
 * on a day Google is unreachable — from being locked out of their own console.
 *
 * The token is the whole session. It is a normal Milo JWT: it asserts identity
 * only, and every request is re-authorized against the database, so a stale copy
 * in a browser grants nothing an active identity would not.
 */
export const session = {
  get token(): string {
    return localStorage.getItem(TOKEN_KEY) ?? ENV_TOKEN;
  },
  /** Empty is meaningful: it means same origin, i.e. the Vite dev proxy. */
  get baseUrl(): string {
    return localStorage.getItem(BASE_KEY) ?? ENV_BASE;
  },
  get mode(): Mode {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "live" || stored === "demo") return stored;
    return this.token ? "live" : "demo";
  },
  get demo(): boolean {
    return this.mode === "demo";
  },
  /** Who is signed in, for the greeting — never for a permission decision. */
  get user(): SignedInUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SignedInUser;
    } catch {
      return null;
    }
  },
  get signedIn(): boolean {
    return Boolean(this.token);
  },
  setToken(token: string) {
    const trimmed = token.trim();
    if (trimmed) {
      localStorage.setItem(TOKEN_KEY, trimmed);
      localStorage.setItem(MODE_KEY, "live");
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
  setUser(user: SignedInUser | null) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  },
  /** Clear the session. Everything local goes; the audit trail is server-side. */
  signOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(MODE_KEY);
    window.dispatchEvent(new CustomEvent(SIGNED_OUT_EVENT));
  },
  setBaseUrl(baseUrl: string) {
    localStorage.setItem(BASE_KEY, baseUrl.trim().replace(/\/$/, ""));
  },
  use(mode: Mode) {
    localStorage.setItem(MODE_KEY, mode);
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}

function url(path: string): string {
  return `${session.baseUrl}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("לא הצלחתי להגיע למילו. ה-API פועל?");
  }

  if (response.status === 401) {
    // The token expired or was revoked. Clearing it here rather than leaving a
    // dead token in the browser is what turns "everything returns 401" into
    // "you have been signed out", which is a thing a person can act on.
    session.signOut();
    throw new ApiError("פג תוקף ההתחברות. היכנסו שוב.", 401);
  }
  if (response.status === 403) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(detail?.detail ?? "אין הרשאה.", 403);
  }
  if (!response.ok) throw new ApiError(`מילו החזיר ${response.status}.`, response.status);

  return (await response.json()) as T;
}

export async function sendTurn(body: TurnRequest): Promise<TurnResponse> {
  if (session.demo) return mockTurn(body);
  return request<TurnResponse>("/agent/turn", { method: "POST", body: JSON.stringify(body) });
}

export async function whoami(): Promise<WhoAmI> {
  if (session.demo) return mockWhoAmI();
  return request<WhoAmI>("/agent/whoami");
}

export async function health(): Promise<Health> {
  if (session.demo) return mockHealth();
  const response = await fetch(url("/health")).catch(() => null);
  if (!response?.ok) throw new ApiError("בדיקת הבריאות נכשלה.");
  return (await response.json()) as Health;
}


// --- Sign-in ----------------------------------------------------------------

/** What the sign-in page needs. Never proxied through demo mode: signing in is real. */
export async function authConfig(): Promise<AuthConfig> {
  const response = await fetch(url("/auth/config")).catch(() => null);
  if (!response?.ok) throw new ApiError("לא הצלחתי להגיע לשרת של מילו.");
  return (await response.json()) as AuthConfig;
}

/**
 * Trade a Google ID token for a Milo token.
 *
 * The Google credential never becomes the session: it is proof of identity that
 * the server verifies and throws away. What comes back is an ordinary Milo JWT,
 * scoped by the allowlist rather than by Google.
 */
export async function loginWithGoogle(credential: string): Promise<LoginResponse> {
  const response = await fetch(url("/auth/google"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  }).catch(() => null);

  if (!response) throw new ApiError("לא הצלחתי להגיע לשרת של מילו.");

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(
      detail?.detail ?? "ההתחברות נכשלה.",
      response.status,
    );
  }

  const body = (await response.json()) as LoginResponse;
  session.setToken(body.token);
  session.setUser({
    display_name: body.display_name,
    email: body.email,
    role: body.role,
    picture: body.picture,
  });
  return body;
}
