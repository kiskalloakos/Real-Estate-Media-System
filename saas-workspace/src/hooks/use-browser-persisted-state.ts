import { useEffect, useState } from 'react';

function readValue<Value>(key: string, fallback: Value): Value {
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : (JSON.parse(stored) as Value);
  } catch {
    return fallback;
  }
}

/**
 * Keeps lightweight UI preferences in this browser. Use it for navigation,
 * filters and view choices—not drafts or file inputs.
 */
export function useBrowserPersistedState<Value>(key: string, fallback: Value) {
  const [value, setValue] = useState<Value>(() => readValue(key, fallback));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private or restricted browser sessions.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
