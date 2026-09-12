// LIGHT / DARK MODE TOGGLE for the Automations hub. AlphaA1's copy, DARK side.
// =============================================================
// ⭐⭐ IT NAVIGATES. **The two "modes" are two ROUTES, and this control is two
// links.** Clicking the sun goes to `/automations-alpha-a2` (the light page);
// the moon is the page you are already on. Wired 2026-09-13: "Connect AlphaA1
// with AlphaA2 now. The lightdark toggle now controls which page gets
// displayed."
//
// 🛑 IT WAS INERT FOR A DAY, on purpose ("just show the toggling aesthetic to me
// for now", 2026-09-12), which is why the aesthetic was settled before any of
// this existed. **The look did not change when it was wired up**; only the two
// `<span>`s became a link and an `aria-current` marker.
//
// ⚠️⚠️ WHY NAVIGATION RATHER THAN A `data-theme` FLIP, which was the other
// option written down when this was inert: **AlphaA2 is a copy of the LIVE hub,
// and its colours are `zinc-*` LITERALS, not tokens.** A CSS variable cannot
// reach `text-zinc-900`, so flipping one attribute could never restyle it. The
// only reason AlphaA1 can be themed by variables at all is that its recolour
// rewrote every one of those classes to `[var(--pa-*)]`. **Two routes is not a
// shortcut here; it is the honest shape of what exists.**
//
// 📌 SO WHAT WOULD A REAL IN-PAGE THEME TAKE? The same rewrite AlphaA1 already
// had: one page whose every colour is a token, plus `PAGE_VARS` behind a
// `data-theme` attribute, plus persistence and the no-flash-on-load problem.
// **That is a different project from this toggle**; do not start it because this
// one looks like a stepping stone.
//
// 🔁 THIS FILE HAS A TWIN at `automations-alpha-a2/theme-toggle.tsx`, the LIGHT
// side. It is the same markup with the palette swapped and the two segments'
// roles reversed. **They are meant to look like one control across both pages,
// so a change to either belongs in both.** Duplicated rather than shared because
// version pages are self-contained, the same reason `hover-prefetch-link.tsx`
// and `nav-indicator.tsx` exist twice in this folder.
//
// ⚠️ `site` IS NOT DECORATION. Without it, switching mode would throw you back
// to the default website, which makes the toggle useless for comparing the two
// designs on the site you were actually looking at. The page already knows the
// selection server-side, so it is passed in rather than read from the URL on the
// client: no `useSearchParams`, no Suspense boundary, no hydration gap.
// =============================================================

import { Moon, Sun } from "lucide-react";
import { HoverPrefetchLink } from "./hover-prefetch-link";

/** One segment. Active = a lifted well with an amber glyph; inactive = the void
 *  with a grey one, lifting on hover. **Both states are dark**, which is the
 *  page's rule: chrome frames, never a background behind content. */
const SEGMENT =
  "flex w-8 items-center justify-center transition-colors [&_svg]:h-4 [&_svg]:w-4";
const ACTIVE = "bg-[var(--pa-inset)] text-[var(--pa-label)]";
const INACTIVE =
  "bg-[var(--pa-void)] text-[var(--pa-muted)] hover:bg-[var(--pa-card)] hover:text-[var(--pa-label)]";

export function ThemeToggle({ site }: { site: string }) {
  return (
    // ⚠️ THE FRAME IS 1px HERE, NOT THE PAGE'S USUAL 3px, and that is on
    // purpose: 3px belongs to the big windows (the toolbar, the pane, the
    // panels), while the small controls beside this one carry `ring-1`. A 3px
    // band on a 32px control reads as a chunk rather than a frame.
    // 📐 `rounded-[9px]` ON THE SEGMENTS IS THE CONCENTRIC RADIUS: the container
    // is `rounded-lg` (0.625rem = 10px) with 1px of padding, so 10 - 1 = 9.
    // Get this wrong and the frame thins to nothing at the outer corners; see
    // the toolbar's note in `page.tsx` for the arithmetic and the bug it fixed.
    <div
      role="group"
      aria-label="Colour mode"
      className="flex h-8 items-stretch gap-px rounded-lg bg-[var(--pa-line)] p-px"
    >
      {/* ⚠️ HOVER-PREFETCHED, NOT PREFETCHED. A plain `prefetch` here would
          render the whole sibling page in the background on EVERY view of this
          one, and that page's read block is ten queries against a `max: 10`
          pool. See `hover-prefetch-link.tsx` and [[db-pool-max-10-fanout]]. The
          80ms dwell means the switch is warm by the time you click it without
          costing anything to people who never do. */}
      <HoverPrefetchLink
        href={`/automations-alpha-a2?site=${site}`}
        label="Switch to light mode"
        className={`${SEGMENT} rounded-l-[9px] ${INACTIVE}`}
      >
        <Sun />
      </HoverPrefetchLink>
      {/* ⚠️ A `<span>`, NOT A LINK TO THIS PAGE. The only action this control
          offers is switching, so the current mode is a state marker rather than
          a second button; `aria-current` says which one you are on and keyboard
          focus skips straight to the one that does something. */}
      <span
        aria-current="page"
        aria-label="Dark mode (current)"
        title="Dark mode"
        className={`${SEGMENT} rounded-r-[9px] ${ACTIVE}`}
      >
        <Moon />
      </span>
    </div>
  );
}
