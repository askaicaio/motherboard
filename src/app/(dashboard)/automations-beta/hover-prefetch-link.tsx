"use client";

// -----------------------------------------------------------------------------
// THE RAIL CARD'S OVERLAY LINK, WITH PREFETCH DEFERRED UNTIL YOU SHOW INTENT.
// Added 2026-09-09 to pay back the performance debt left by the outage that day.
//
// WHY IT EXISTS. Selecting a website is a real navigation (`?site=<slug>`, read
// on the SERVER), so the panel cannot change until the server responds. #472
// made that instant with `prefetch` on all five cards. #488 turned it off while
// I was misdiagnosing an outage, which reinstated the wait. #489 found the real
// cause (a `Promise.all` of 11 reads against a `max: 10` pool) and fixed it, so
// the speed can come back, but NOT by simply flipping the prop.
//
// ⚠️⚠️ WHY NOT JUST `prefetch` AGAIN: all five cards are in the viewport at once,
// so it prefetches all five on every page load. That is SIX full renders of this
// route per view, one real and five background, each running the page's whole
// read block. It is not what broke the page, but it is a real multiplier against
// a 10-connection pool, and it exists whether or not anyone ever clicks a card.
// **Hover costs ONE render, for the card you are actually heading for.**
//
// ⚠️⚠️ `prefetch={true}`, NOT the `prefetch={active ? null : false}` THE NEXT
// DOCS SHOW for this pattern. Their version restores the DEFAULT on hover, and
// the same docs say the default on a DYNAMIC route prefetches only "the partial
// route down to the nearest `loading.js` boundary". **This page is
// `force-dynamic` with NO loading.js, so `null` would prefetch nothing and the
// hover would buy nothing.** Only explicit `true` prefetches "the full route for
// both static and dynamic routes". Verified in
// `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`.
//
// ⚠️ `prefetch={false}` DISABLES HOVER PREFETCHING TOO, per those same docs
// ("Prefetching will never happen both on entering the viewport and on hover"),
// which is exactly why this component has to drive it with state instead of
// relying on Next's own hover behaviour.
//
// ⚠️ THE 80ms DWELL IS DELIBERATE, not a nervous tic. Without it, sweeping the
// mouse down the rail to reach something else fires all five prefetches anyway,
// which is the very fan-out this is meant to avoid. A real approach-to-click
// rests on a card for far longer than 80ms; a sweep does not. Hover-to-click is
// typically 200-500ms, so the head start survives the delay.
//
// ⚠️ ONCE ARMED, IT STAYS ARMED. `active` never goes back to false, so a card is
// prefetched at most once per page view. Resetting it on mouse-out would refetch
// on every pass.
//
// ⚠️ FOCUS AND TOUCH ARM IT TOO. Hover does not exist for keyboard or touch
// users, and the Next docs warn that extending Link makes accessibility your
// problem. `onFocus` covers tabbing; `onTouchStart` fires before the click and
// buys what little head start a tap allows.
//
// ⚠️ PREFETCHING ONLY RUNS IN PRODUCTION. This cannot be verified with
// `next dev`, so do not conclude it is broken from a local check.
//
// ⚠️ CHILDREN MUST STAY CHILDREN. `CardNavIndicator` calls `useLinkStatus`,
// which reports the pending state of its NEAREST ANCESTOR Link. It is passed
// through as `children` so it stays inside this Link; render it anywhere else
// and it reports `pending: false` forever and silently does nothing.
// -----------------------------------------------------------------------------

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long the pointer must rest on a card before its route is prefetched. */
const DWELL_MS = 80;

export function HoverPrefetchLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  /** Accessible name: the Link has no text of its own, only the overlay. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Arm immediately for intents that are already deliberate (focus, touch), and
  // after the dwell for a pointer that might just be passing through.
  const arm = useCallback(() => {
    clear();
    setActive(true);
  }, [clear]);

  const armAfterDwell = useCallback(() => {
    if (active || timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      setActive(true);
    }, DWELL_MS);
  }, [active]);

  // A card can unmount mid-dwell (the rail re-renders on every switch), and a
  // timer left running would call setState on a gone component.
  useEffect(() => clear, [clear]);

  return (
    <Link
      href={href}
      aria-label={label}
      // See the header: `true` and not `null`, or this prefetches nothing.
      prefetch={active ? true : false}
      className={className}
      onMouseEnter={armAfterDwell}
      onMouseLeave={clear}
      onFocus={arm}
      onTouchStart={arm}
    >
      {children}
    </Link>
  );
}
