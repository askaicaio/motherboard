import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

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
// `discountRef` (optional, added 2026-10-08 for the Housekeeping page) names a
// SIBLING THAT IS ALLOWED TO STACK ABOVE THE CONTAINER WITHOUT SHRINKING IT.
// When that element sits fully above, its height plus one row gap is subtracted
// from the measured offset, so the container is sized as if it were not there.
//
// ⚠️ THIS DELIBERATELY BREAKS THE "the page no longer scrolls" PROMISE ABOVE,
// for the one caller that asks for it. The page gains roughly the discounted
// element's height in scroll. That is the trade the Housekeeping page's user
// chose, knowingly: see the call site.
// 📌 IT IS OPT-IN AND THE DEFAULT IS UNCHANGED. The other nine callers pass no
// arguments at all and behave exactly as before.
// ⚠️ THE DISCOUNT IS NOT `container.top - element.top`, THOUGH THAT LOOKS
// RIGHT. The space between them is the row gap PLUS whatever chrome sits
// between the element and the measured container (on Housekeeping the `Card`
// adds 16px above its `CardContent`), and that chrome does not go away when the
// element does. **Height + row gap is what the element actually costs.**
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
  discountRef,
}: {
  bottomGap?: number;
  minHeight?: number;
  discountRef?: RefObject<HTMLElement | null>;
} = {}) {
  const ref = useRef<T>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Document offset (robust to page scroll), so the height is stable
      // regardless of how far the page is scrolled when we measure.
      let offsetTop = rect.top + window.scrollY;

      const discount = discountRef?.current;
      if (discount) {
        const dRect = discount.getBoundingClientRect();
        // "Above", not "beside": in the two-column layout this same element
        // sits to the RIGHT and must not be discounted. Comparing its BOTTOM
        // against the container's TOP is what tells the two cases apart, and it
        // needs no breakpoint constant to do it.
        if (dRect.bottom <= rect.top) {
          const gap =
            parseFloat(
              getComputedStyle(discount.parentElement ?? discount).rowGap,
            ) || 0;
          offsetTop -= dRect.height + gap;
        }
      }

      setMaxHeight(
        Math.max(minHeight, window.innerHeight - offsetTop - bottomGap),
      );
    };
    measure();
    window.addEventListener("resize", measure);

    // ⚠️ A RESIZE LISTENER IS NOT ENOUGH FOR THE DISCOUNTED ELEMENT. It can
    // change height without the window changing at all (its list goes from an
    // empty state to five rows when the first row is saved), and the container
    // would keep a stale cap until the next resize.
    const discount = discountRef?.current;
    const ro =
      discount && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (ro && discount) ro.observe(discount);

    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [bottomGap, minHeight, discountRef]);

  const style = maxHeight ? { maxHeight } : undefined;
  return { ref, style } as const;
}
