import type { ActivityEntry } from "../types";

const KEY = "milo.activity";
const LIMIT = 500;

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: ActivityEntry[] | null = null;

function read(): ActivityEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(entries: ActivityEntry[]): void {
  cache = entries.slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* a full quota must not break the console */
  }
  listeners.forEach((listener) => listener());
}

export const activityStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: read,
  add(entry: ActivityEntry) {
    write([entry, ...read()]);
  },
  clear() {
    write([]);
  },
};

export interface Metrics {
  total: number;
  today: number;
  week: number;
  failures: number;
  needsSigal: number;
  medianMs: number;
  successRate: number;
  byIntent: { intent: string; count: number }[];
  byDay: { day: string; label: string; count: number }[];
  byStatus: Record<string, number>;
}

const DAY = 86_400_000;

export function computeMetrics(entries: ActivityEntry[], days = 14): Metrics {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const byIntent = new Map<string, number>();
  const byStatus: Record<string, number> = {};
  const perDay = new Map<string, number>();

  for (let i = days - 1; i >= 0; i -= 1) {
    perDay.set(dayKey(new Date(now - i * DAY)), 0);
  }

  let today = 0;
  let week = 0;
  let failures = 0;
  let needsSigal = 0;
  const durations: number[] = [];

  for (const entry of entries) {
    const at = new Date(entry.at).getTime();
    if (at >= startOfToday.getTime()) today += 1;
    if (at >= now - 7 * DAY) week += 1;
    if (!entry.ok) failures += 1;
    if (entry.awaitingCount > 0 || entry.missingCount > 0 || entry.reportStatus === "blocked") {
      needsSigal += 1;
    }
    if (entry.durationMs) durations.push(entry.durationMs);

    const intent = entry.intent ?? "unknown";
    byIntent.set(intent, (byIntent.get(intent) ?? 0) + 1);

    const status = entry.reportStatus ?? entry.status ?? "—";
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    const key = dayKey(new Date(at));
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  durations.sort((a, b) => a - b);
  const medianMs = durations.length
    ? durations[Math.floor(durations.length / 2)]
    : 0;

  return {
    total: entries.length,
    today,
    week,
    failures,
    needsSigal,
    medianMs,
    successRate: entries.length ? (entries.length - failures) / entries.length : 1,
    byIntent: [...byIntent.entries()]
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count),
    byDay: [...perDay.entries()].map(([day, count]) => ({
      day,
      label: new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      count,
    })),
    byStatus,
  };
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
