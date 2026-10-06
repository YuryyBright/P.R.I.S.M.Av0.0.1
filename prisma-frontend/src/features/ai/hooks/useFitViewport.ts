import { useCallback, useEffect, useState } from "react";

/**
 * Sizes an element to the space that is actually left in the window:
 *   height = innerHeight - element.top - bottomGap
 *
 * Replaces guessed constants like `calc(100dvh - 14rem)`: it stays correct whatever the app
 * layout puts above the page (top bar, paddings, breadcrumbs) and on mobile browsers whose
 * address bar changes the viewport height. The page itself then never scrolls; only inner
 * regions (message list, sidebar, card bodies) do.
 *
 * Returns a callback ref, so it also works when the element appears later
 * (e.g. after a loading skeleton).
 *
 * @param bottomGap space kept below the element (px) — usually the layout's bottom padding.
 */
export function useFitViewport<T extends HTMLElement>(bottomGap = 24) {
  const [el, setEl] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;

    const apply = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const h = Math.floor(window.innerHeight - top - bottomGap);
      el.style.height = `${Math.max(320, h)}px`;
    };

    apply();
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);

    // content above the element can change height (wrapping subtitle, banners…)
    const ro = new ResizeObserver(apply);
    ro.observe(document.body);

    return () => {
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      ro.disconnect();
    };
  }, [el, bottomGap]);

  return ref;
}
