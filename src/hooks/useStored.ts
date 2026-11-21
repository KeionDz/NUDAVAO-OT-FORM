import { useEffect, useState } from 'react';

/**
 * State that survives a reload, on this device only.
 *
 * Used for the person's details and their rules — things typed once and the
 * same every cutoff. Attendance is deliberately NOT stored: swipe times are
 * personal, and a stale month reappearing next time is worse than a blank page.
 *
 * Storage can be missing or throw (private windows, blocked site data), so
 * every access is guarded and the app works without it. A stored object is
 * merged over the defaults, so a field added later still gets its default.
 */
export function useStored<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...(JSON.parse(raw) as Partial<T>) } : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not saved; the app still works for this visit.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
