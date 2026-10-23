import type {
  AllowedUser,
  AuthConfig,
  ConsoleActivity,
  Health,
  Identity,
  Person,
  Task,
  TaskChatMessage,
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
        // FormData sets its own (multipart, with the boundary).
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

export async function addUser(email: string, isAdmin: boolean, displayName: string): Promise<AllowedUser> {
  return request<AllowedUser>("/auth/users", {
    method: "POST",
    body: JSON.stringify({ email, is_admin: isAdmin, display_name: displayName || null }),
  });
}

export async function renameUser(email: string, displayName: string): Promise<AllowedUser> {
  return request<AllowedUser>(`/auth/users/${encodeURIComponent(email)}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName || null }),
  });
}

export async function removeUser(email: string): Promise<void> {
  await request(`/auth/users/${encodeURIComponent(email)}`, { method: "DELETE" });
}

/* --- משימות פתוחות -------------------------------------------------------- */

export async function listTasks(): Promise<Task[]> {
  return request<Task[]>("/agent/tasks");
}

export async function createTask(task: {
  title: string;
  description?: string;
  name?: string;
  phone?: string;
  assignee?: string;
  team?: "claims";
}): Promise<Task> {
  return request<Task>("/agent/tasks", { method: "POST", body: JSON.stringify(task) });
}

/** `assignee: ""` unassigns. */
export async function updateTask(
  id: string,
  changes: Partial<Pick<Task, "title" | "description" | "status">> & { assignee?: string },
): Promise<Task> {
  return request<Task>(`/agent/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function uploadTaskFile(id: string, file: File): Promise<Task> {
  const form = new FormData();
  form.append("file", file);
  return request<Task>(`/agent/tasks/${encodeURIComponent(id)}/files`, { method: "POST", body: form });
}

/** Note in the task's history a mail or a meeting opened in the user's Gmail / Google Calendar. */
export async function addTaskEvent(id: string, type: "email" | "meeting", text: string): Promise<Task> {
  return request<Task>(`/agent/tasks/${encodeURIComponent(id)}/events`, {
    method: "POST",
    body: JSON.stringify({ type, text }),
  });
}

export async function listPeople(): Promise<Person[]> {
  return request<Person[]>("/agent/tasks/people");
}

export async function taskConversation(id: string): Promise<TaskChatMessage[]> {
  return request<TaskChatMessage[]>(`/agent/tasks/${encodeURIComponent(id)}/conversation`);
}

/** A file sent with a task, or attached to it. Same-origin, so the session cookie goes with it. */
export function taskMediaUrl(mediaUrl: string): string {
  return url(`/agent/tasks/media?url=${encodeURIComponent(mediaUrl)}`);
}

/* --- מעקב משתמשים -------------------------------------------------------- */

/** `since` / `until` are ISO timestamps; both optional. Admins only. */
export async function listActivity(filter: { email?: string; since?: string; until?: string }): Promise<ConsoleActivity[]> {
  const query = new URLSearchParams(
    Object.entries(filter).filter((entry): entry is [string, string] => !!entry[1]),
  );
  return request<ConsoleActivity[]>(`/agent/activity?${query}`);
}
