// LIGHT / DARK MODE TOGGLE for the Automations hub. AlphaA2's copy, LIGHT side.
// =============================================================
// ⭐⭐ IT NAVIGATES. **The two "modes" are two ROUTES, and this control is two
// links.** Clicking the moon goes to `/automations-alpha-a1` (the dark page);
// the sun is the page you are already on. Wired 2026-09-13: "Connect AlphaA1
// with AlphaA2 now. The lightdark toggle now controls which page gets
// displayed."
//
// 🔁 THIS FILE IS THE TWIN of `automations-alpha-a1/theme-toggle.tsx`, the DARK
// side, which carries the long note: why navigation rather than a `data-theme`
// flip, why the link is hover-prefetched, and what a real in-page theme would
// actually cost. **Read that one before changing either.** The two are meant to
// look like a single control across both pages, so a change to one belongs in
// both. Duplicated rather than shared because version pages are self-contained.
//
// ⚠️ THE ONE REAL DIFFERENCE BETWEEN THE TWINS, beyond swapping which segment is
// active: **this copy is styled in `zinc-*` literals and the dark one in
// `[var(--pa-*)]`.** That is not sloppiness, it is the whole reason the toggle
// navigates instead of flipping an attribute: this page inherited the live hub's
// hard-coded palette, which no CSS variable can reach.
//
// ⚠️ THIS IS THE FIFTH DELIBERATE DIFFERENCE FROM THE LIVE HUB, and the only one
// that is not bookkeeping. The page's header lists the other four. The live hub
// has no toggle and should not get one from this experiment.
// =============================================================

import { Moon, Sun } from "lucide-react";
import { HoverPrefetchLink } from "./hover-prefetch-link";

/** One segment, in this page's light palette: active is a white cell with dark
 *  glyph, inactive a greyed one that comes up to white on hover. Mirrors the
 *  dark twin's shape exactly; only the colours differ. */
const SEGMENT =
  "flex w-8 items-center justify-center transition-colors [&_svg]:h-4 [&_svg]:w-4";
const ACTIVE = "bg-white text-zinc-900";
const INACTIVE = "bg-zinc-50 text-zinc-400 hover:bg-white hover:text-zinc-700";

export function ThemeToggle({ site }: { site: string }) {
  return (
    // 📐 SAME GEOMETRY AS THE DARK TWIN so the control does not jump when you
    // switch: 32px tall, a 1px tray, and `rounded-[9px]` segments, which is the
    // concentric radius for a `rounded-lg` (10px) container with 1px of padding.
    <div
      role="group"
      aria-label="Colour mode"
      className="flex h-8 items-stretch gap-px rounded-lg bg-zinc-200 p-px"
    >
      {/* ⚠️ A `<span>`, NOT A LINK TO THIS PAGE: the current mode is a state
          marker, not a second button. See the dark twin's note. */}
      <span
        aria-current="page"
        aria-label="Light mode (current)"
        title="Light mode"
        className={`${SEGMENT} rounded-l-[9px] ${ACTIVE}`}
      >
        <Sun />
      </span>
      {/* ⚠️ HOVER-PREFETCHED, NOT PREFETCHED: a plain `prefetch` would render
          the sibling page in the background on every view of this one, and its
          read block is ten queries against a `max: 10` pool. */}
      <HoverPrefetchLink
        href={`/automations-alpha-a1?site=${site}`}
        label="Switch to dark mode"
        className={`${SEGMENT} rounded-r-[9px] ${INACTIVE}`}
      >
        <Moon />
      </HoverPrefetchLink>
    </div>
  );
}
