import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getItem, withDefaults, type StorageKey, type StorageSchema } from '../lib/storage';

/** Live view of one storage key; re-renders whenever the background worker updates it. */
export function useStorage<K extends StorageKey>(key: K): StorageSchema[K] | undefined {
  const [value, setValue] = useState<StorageSchema[K]>();
  useEffect(() => {
    let alive = true;
    // The initial read can resolve after a change event already delivered a newer value;
    // once any change event has arrived, the stale initial read must not overwrite it.
    let changed = false;
    void getItem(key).then((v) => {
      if (alive && !changed) setValue(v);
    });
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && key in changes) {
        changed = true;
        setValue(withDefaults(key, changes[key]!.newValue));
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, [key]);
  return value;
}

/** Current time, refreshed every `intervalMs` (for countdowns). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
