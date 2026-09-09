import type { Health, TurnRequest, TurnResponse, WhoAmI } from "../types";
import { mockTurn, mockWhoAmI, mockHealth } from "./mock";

const TOKEN_KEY = "milo.token";
const BASE_KEY = "milo.baseUrl";
const MODE_KEY = "milo.mode";

const ENV_TOKEN = (import.meta.env.VITE_MILO_TOKEN as string | undefined) ?? "";
const ENV_BASE = (import.meta.env.VITE_MILO_API_URL as string | undefined) ?? "";

export type Mode = "live" | "demo";

/**
 * There is no sign-in screen: the console opens straight into the console and
 * the token is set under Connection. With no token anywhere, it starts on
 * sample data rather than throwing 401s at whoever opened it.
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
  setToken(token: string) {
    const trimmed = token.trim();
    if (trimmed) {
      localStorage.setItem(TOKEN_KEY, trimmed);
      localStorage.setItem(MODE_KEY, "live");
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
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
    throw new ApiError("Could not reach Milo. Is the API running?");
  }

  if (response.status === 401)
    throw new ApiError("Token rejected — set a valid one under Connection.", 401);
  if (response.status === 403) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(detail?.detail ?? "Not permitted.", 403);
  }
  if (!response.ok) throw new ApiError(`Milo replied ${response.status}.`, response.status);

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
  if (!response?.ok) throw new ApiError("Health check failed.");
  return (await response.json()) as Health;
}
