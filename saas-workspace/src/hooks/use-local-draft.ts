import { useEffect } from 'react';

export function readLocalDraft<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string) {
  if (typeof window !== 'undefined') window.localStorage.removeItem(key);
}

export function useLocalDraft<T>(key: string, value: T, enabled: boolean, hasContent: (value: T) => boolean) {
  useEffect(() => {
    if (!enabled || !hasContent(value) || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* local drafts are best-effort */ }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [enabled, hasContent, key, value]);
}
