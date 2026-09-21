import type {
  Health,
  TurnRequest,
  TurnResponse,
} from "../types";

const ENV_BASE = (import.meta.env.VITE_MILO_API_URL as string | undefined) ?? "";

/**
 * The console is the agency's own screen — Sigal's team, not the public. It is
 * a plain client of Milo the way WhatsApp is: the backend is a single origin
 * (the Vite proxy in development) and no token, key or account step sits
 * between her and the agent.
 *
 * `baseUrl` stays empty in development so the Vite proxy forwards a relative
 * path; a deployed build sets `VITE_MILO_API_URL` to the API origin instead,
 * and the deployment keeps the paths same-origin (no CORS needed).
 */
export const session = {
  /** Empty is meaningful: it means same origin, i.e. the Vite dev proxy. */
  get baseUrl(): string {
    return ENV_BASE;
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
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("לא הצלחתי להגיע למילו.");
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
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