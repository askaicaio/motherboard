import { useEffect, useRef, useState } from "react";

// Shared "fit-to-viewport" height for a scrollable table/list container.
//
// A fixed cap like `max-h-[70vh]` overflows the window whenever the container
// starts well below the top of the page (headers, tabs, toolbars, a search bar
// all sit above it): `offset + 70vh` can exceed the viewport, so the whole page
// scrolls. This hook instead measures the container's own document offset and
// returns a maxHeight that makes its bottom land `bottomGap` px above the window
// bottom, so the page itself no longer scrolls (only the container scrolls
// internally). Recomputed on window resize.
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
