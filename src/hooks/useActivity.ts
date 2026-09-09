import { useMemo, useSyncExternalStore } from "react";
import { activityStore, computeMetrics } from "../lib/activity";

export function useActivity() {
  const entries = useSyncExternalStore(
    (listener) => activityStore.subscribe(listener),
    () => activityStore.snapshot(),
  );
  const metrics = useMemo(() => computeMetrics(entries), [entries]);
  return { entries, metrics };
}
