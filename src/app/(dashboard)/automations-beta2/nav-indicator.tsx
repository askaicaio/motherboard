"use client";

// -----------------------------------------------------------------------------
// PER-CARD NAVIGATION FEEDBACK for the Automations Beta rail, 2026-09-06.
//
// WHY THIS EXISTS. Selecting a website is a real navigation (`?site=<slug>` read
// on the SERVER), so the panel cannot change until the server responds. The user
// reported the gap: "there is around a 1 second delay before this section of the
// page changes", and then, after the queries were parallelised in #470, "i can't
// tell if there is any particular difference".
//
// ⚠️⚠️ THIS MAKES NOTHING FASTER AND IS NOT MEANT TO. It removes the DEAD GAP:
// until this landed, clicking a card produced no visible change at all until the
// whole response arrived. A 300ms wait where something happened at 0ms reads as
// fast; a 300ms wait where nothing moves reads as broken. **If someone later
// measures this and finds the server time unchanged, that is the design, not a
// regression.**
//
// ⚠️ `useLinkStatus` ONLY WORKS INSIDE A `<Link>`. It reports the pending state
// of the NEAREST ANCESTOR Link, so this component must stay a child of the
// card's overlay Link. Rendered anywhere else it reports `pending: false`
// forever and silently does nothing. Added in Next 15.3; this repo is on 16.2.2.
//
// ⚠️ WHY IT RENDERS `data-pending` RATHER THAN JUST STYLING ITSELF: the DETAIL
// PANEL dims while a switch is in flight, and the panel is a cousin of this
// node, not a descendant. The pane uses `group-has-[[data-pending]]/pane:` to
// reach it. **Removing this attribute silently stops the panel dimming**, with
// no type error, so keep them in step.
//
// ⚠️ THE ALTERNATIVE THAT WAS REJECTED: a Suspense skeleton. It needs the shell
// to render before the data, but the rail's queries and the panel's queries now
// resolve together (one `Promise.all`), so the shell would arrive with the
// content anyway. Making it work would mean putting the RAIL behind a skeleton
// too, which flickers the rail on every click: worse than a short freeze.
// -----------------------------------------------------------------------------

import { useLinkStatus } from "next/link";

export function CardNavIndicator({ accent }: { accent: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      {/* The whole-card tint. `inset-0` is the LINK's box, and the Link is
          already `absolute inset-0` over the card, so this needs no layout of
          its own and cannot disturb the card's three rows.
          ⚠️ It sits UNDER the card's real controls, which carry `relative
          z-10`. That is deliberate: the buttons must stay legible and clickable
          while a different card is loading. */}
      <span
        data-pending
        aria-hidden
        className="absolute inset-0 rounded-lg bg-zinc-900/[0.04]"
      />
      {/* A 2px bar along the card's bottom edge, in the site's own accent.
          ⚠️ AN EDGE BAR RATHER THAN A SPINNER because the card has NO free
          space: all three rows run the full content width, so anything placed
          inside would overlap the statistic or the buttons. `inset-x-2.5`
          matches the card's own `px-2.5` so it lines up with the content. */}
      <span
        aria-hidden
        className="absolute inset-x-2.5 bottom-0 h-[2px] animate-pulse rounded-full"
        style={{ backgroundColor: accent }}
      />
    </>
  );
}
