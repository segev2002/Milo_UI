import type {
  AllowedUser,
  AuthConfig,
  Health,
  Identity,
  OpenTask,
  TurnRequest,
  TurnResponse,
} from "../types";

const ENV_BASE = (import.meta.env.VITE_MILO_API_URL as string | undefined) ?? "";

/**
 * The console is the agency's own screen — Sigal's team, not the public. Every
 * call to /agent and /crm carries the session cookie the server set at sign-in;
 * nothing here reads or stores it, because it is httpOnly and script cannot.
 * That is the point: an XSS bug in this console cannot steal a session.
 *
 * `baseUrl` stays empty in development so the Vite proxy forwards a relative
 * path; a deployed build sets `VITE_MILO_API_URL` to the API origin instead,
 * and the deployment keeps the paths same-origin — which is also what makes
 * the browser send the cookie at all.
 */
export const session = {
  /** Empty is meaningful: it means same origin, i.e. the Vite dev proxy. */
  get baseUrl(): string {
    return ENV_BASE;
  },
};

/** What to do when the server says the session is gone. Set once, by App, so
 *  a 401 from any screen means the same thing: back to the sign-in page. */
let onUnauthorized: () => void = () => {};

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

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
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("לא הצלחתי להגיע למילו.");
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    // 401 is the session ending, not this particular call failing. Expected on
    // first load too, before anyone has signed in.
    if (response.status === 401) onUnauthorized();
    throw new ApiError(
      detail?.detail ?? `מילו החזיר ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export async function sendTurn(body: TurnRequest): Promise<TurnResponse> {
  return request<TurnResponse>("/agent/turn", { method: "POST", body: JSON.stringify(body) });
}

export async function health(): Promise<Health> {
  const response = await fetch(url("/health")).catch(() => null);
  if (!response?.ok) throw new ApiError("בדיקת הבריאות נכשלה.");
  return (await response.json()) as Health;
}

/* --- Signing in ----------------------------------------------------------- */

export async function authConfig(): Promise<AuthConfig> {
  return request<AuthConfig>("/auth/config");
}

/** Hand Google's ID token to Milo, who verifies it and sets the session cookie. */
export async function loginWithGoogle(credential: string): Promise<Identity> {
  return request<Identity>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export async function me(): Promise<Identity> {
  return request<Identity>("/auth/me");
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

/* --- ניהול משתמשים -------------------------------------------------------- */

export async function listUsers(): Promise<AllowedUser[]> {
  return request<AllowedUser[]>("/auth/users");
}

export async function addUser(email: string, isAdmin: boolean): Promise<AllowedUser> {
  return request<AllowedUser>("/auth/users", {
    method: "POST",
    body: JSON.stringify({ email, is_admin: isAdmin }),
  });
}

export async function removeUser(email: string): Promise<void> {
  await request(`/auth/users/${encodeURIComponent(email)}`, { method: "DELETE" });
}

/* --- משימות פתוחות -------------------------------------------------------- */

export async function listTasks(status: "open" | "done"): Promise<OpenTask[]> {
  return request<OpenTask[]>(`/agent/tasks?status=${status}`);
}

export async function resolveTask(id: string): Promise<void> {
  await request(`/agent/tasks/${encodeURIComponent(id)}/resolve`, { method: "POST" });
}
