import { useCallback, useEffect, useRef, useState } from "react";

/** Clipboard write with a short "copied" flag per key; the timer is cleaned up on unmount. */
export function useCopy<K extends string>(resetMs = 1500) {
  const [copied, setCopied] = useState<K | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (key: K, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        return; // clipboard unavailable (insecure context): nothing to do
      }
      setCopied(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), resetMs);
    },
    [resetMs],
  );

  return { copied, copy };
}
