import { useEffect, useRef, useState } from "react";

// Shared "fit-to-viewport" height for a scrollable table/list container.
//
// A fixed cap like `max-h-[70vh]` overflows the window whenever the container
// starts well below the top of the page (headers, tabs, toolbars, a search bar
// all sit above it): `offset + 70vh` can exceed the viewport, so the whole page
// scrolls. This hook sizes the container so its bottom lands a small visible
// `bottomGap` above the window bottom, so the page itself no longer scrolls
// (only the container scrolls internally). Recomputed on window resize.
//
// Why it MEASURES instead of assuming: the space below the container (the Card's
// own bottom padding + the dashboard <main>'s bottom padding + anything else in
// the layout) is real chrome that must be left room for, and hard-coding a guess
// for it is exactly what required hand-tuning before. So each pass momentarily
// forces the container to a candidate height that fills from its top to the
// window bottom, then reads how far the DOCUMENT overflows the window: that
// overflow IS the below-container chrome, measured empirically. The final height
// subtracts that measured chrome (plus the visible gap), so it self-corrects if
// the layout padding ever changes. `document.scrollHeight` is safe to read here
// even though this layout stretches <main> (sidebar `min-h-screen`): while the
// forced candidate is applied the table content dominates the document height,
// so the overflow reflects the real chrome, not the stretch.
//
// The forced-height probe is done imperatively and restored within the same
// synchronous effect run (before any paint), so it is never visible.
//
// Usage:
//   const { ref, style } = useFitViewportHeight();
//   <CardContent ref={ref} style={style} className="max-h-[70vh] overflow-auto" />
//
// The element's existing CSS max-height stays as the pre-measurement (first
// paint / SSR) fallback; the inline `style.maxHeight` overrides it once measured.
export function useFitViewportHeight<T extends HTMLElement = HTMLDivElement>({
  bottomGap = 24,
  minHeight = 240,
}: { bottomGap?: number; minHeight?: number } = {}) {
  const ref = useRef<T>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useEffect(() => {
    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const doc = document.documentElement;

      // Document offset of the container's top (robust to page scroll).
      const offsetTop = node.getBoundingClientRect().top + window.scrollY;
      // Candidate that fills from the container's top to the window bottom,
      // ignoring whatever chrome sits below it.
      const candidate = Math.max(minHeight, window.innerHeight - offsetTop);

      // Probe: force the container to exactly `candidate` (overriding both the
      // fallback max-height class and any prior inline max-height), read how far
      // the document now overflows the window, then restore. Reading scrollHeight
      // forces the reflow; all synchronous, so no paint happens in between.
      const prevMaxHeight = node.style.maxHeight;
      const prevHeight = node.style.height;
      node.style.maxHeight = "none";
      node.style.height = `${candidate}px`;
      const belowChrome = Math.max(0, doc.scrollHeight - window.innerHeight);
      node.style.maxHeight = prevMaxHeight;
      node.style.height = prevHeight;

      // Fit precisely: candidate minus the measured below-container chrome minus
      // the intentional visible gap.
      const next = Math.max(minHeight, candidate - belowChrome - bottomGap);
      setMaxHeight(next);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [bottomGap, minHeight]);

  const style = maxHeight ? { maxHeight } : undefined;
  return { ref, style } as const;
}
