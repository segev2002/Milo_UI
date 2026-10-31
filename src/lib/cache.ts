import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

/**
 * What each screen last showed, kept while the console is open — so leaving a
 * page and coming back shows it as it was (the month tab, the filters, what
 * was half-typed) at once, while the page refreshes from the server behind it.
 *
 * Memory only, on purpose: it holds client names and ID numbers, so it is never
 * written to the browser's storage, and it is emptied on sign-out.
 */
const store = new Map<string, unknown>();

/** `useState`, remembered under `key` after the component is gone. */
export function useCached<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (store.has(key)) return store.get(key) as T;
    const first = typeof initial === "function" ? (initial as () => T)() : initial;
    store.set(key, first);
    return first;
  });

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        store.set(key, resolved);
        return resolved;
      }),
    [key],
  );

  return [value, set];
}

/** Forget everything — at sign-out, or when the session ends. */
export function clearCache(): void {
  store.clear();
}
