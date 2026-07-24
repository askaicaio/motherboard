import { useEffect, useRef, useState } from "react";

// Shared "fit-to-viewport" height for a scrollable table/list container.
//
// A fixed cap like `max-h-[70vh]` overflows the window whenever the container
// starts well below the top of the page (headers, tabs, toolbars, a search bar
// all sit above it): `offset + 70vh` can exceed the viewport, so the whole page
// scrolls. This hook instead measures the container's own document offset and
// caps its height so its bottom lands `bottomGap` px above the window bottom, so
// the page itself no longer scrolls (only the container scrolls internally).
// Recomputed on window resize.
//
// `bottomGap` (default 72px) is a fixed reserve that must cover the chrome BELOW
// the container plus a little breathing room. In the dashboard that chrome is
// the Card's own bottom padding (`py-4` = 16px) + the `<main>` wrapper's bottom
// padding (`p-6` = 24px) + a bit more; 72px is the value tuned to clear it on
// all four Automations tables without the outer window scrollbar returning.
//
// NOTE: a self-correcting "measure the real chrome" variant was tried (PR #222)
// but reverted: the dashboard pins `<main>` to a fixed flex height (`flex-1`
// inside a `min-h-screen` column), so probing by forcing the table tall makes
// the content overflow main's pinned box and the measured overflow no longer
// equals the true chrome. The fixed reserve is the reliable choice for this
// layout. `bottomGap` is the single knob if it ever needs adjusting.
//
// Usage:
//   const { ref, style } = useFitViewportHeight();
//   <CardContent ref={ref} style={style} className="max-h-[70vh] overflow-auto" />
//
// The element's existing CSS max-height stays as the pre-measurement (first
// paint / SSR) fallback; the inline `style.maxHeight` overrides it once measured.
export function useFitViewportHeight<T extends HTMLElement = HTMLDivElement>({
  bottomGap = 72,
  minHeight = 240,
}: { bottomGap?: number; minHeight?: number } = {}) {
  const ref = useRef<T>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      // Document offset (robust to page scroll), so the height is stable
      // regardless of how far the page is scrolled when we measure.
      const offsetTop = el.getBoundingClientRect().top + window.scrollY;
      setMaxHeight(
        Math.max(minHeight, window.innerHeight - offsetTop - bottomGap),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [bottomGap, minHeight]);

  const style = maxHeight ? { maxHeight } : undefined;
  return { ref, style } as const;
}
