"use client";

// LIGHT / DARK MODE TOGGLE for the Automations hub. AlphaA1's copy.
// =============================================================
// 🛑🛑 IT IS DELIBERATELY INERT. **CLICKING IT CHANGES NOTHING BUT ITS OWN
// HIGHLIGHT.** Do not file that as a bug, and do not "finish" it by wiring a
// theme in without being asked.
//
// ⭐ THE CONTEXT, from the user on 2026-09-12, because it reframes what this
// whole page is for: "i was thinking that AlphaA1 is the 'Dark mode', and the
// current live version of the page is the 'Light mode'." **So AlphaA1 stops
// being only a palette experiment and becomes the dark half of a pair.** The
// ask was explicit about scope: "It will become the light-dark toggle later,
// but we can add that functionality later, just show the toggling aesthetic to
// me for now."
//
// 📌 WHAT WIRING IT UP WOULD ACTUALLY MEAN, recorded now while the reasoning is
// fresh, because it is more than a class swap:
//   - The two "modes" are currently TWO PAGES at two routes, not one page with
//     two palettes. A real toggle either navigates between them or the palette
//     has to move into the live hub behind a `data-theme` attribute.
//   - `PAGE_VARS` in `page.tsx` is the whole dark theme and it is applied on the
//     page root, so the second option is mostly "lift that object somewhere a
//     client component can flip". **The colours are already a single source.**
//   - Persistence (localStorage or a user setting) and the no-flash-on-load
//     problem are the parts that actually cost time, not the colours.
//
// ⚠️ IT SEEDS TO DARK because this page IS the dark one. On the live hub the
// same component would seed to light.
// =============================================================

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** One segment. Active = a lifted well with an amber glyph; inactive = the void
 *  with a grey one, lifting on hover. **Both states are dark**, which is the
 *  page's rule: chrome frames, never a background behind content. */
const SEGMENT =
  "flex w-8 items-center justify-center transition-colors [&_svg]:h-4 [&_svg]:w-4";

export function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("dark");

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
      <button
        type="button"
        onClick={() => setMode("light")}
        aria-pressed={mode === "light"}
        aria-label="Light mode"
        title="Light mode (not wired up yet)"
        className={cn(
          SEGMENT,
          "rounded-l-[9px]",
          mode === "light"
            ? "bg-[var(--pa-inset)] text-[var(--pa-label)]"
            : "bg-[var(--pa-void)] text-[var(--pa-muted)] hover:bg-[var(--pa-card)] hover:text-[var(--pa-label)]",
        )}
      >
        <Sun />
      </button>
      <button
        type="button"
        onClick={() => setMode("dark")}
        aria-pressed={mode === "dark"}
        aria-label="Dark mode"
        title="Dark mode (not wired up yet)"
        className={cn(
          SEGMENT,
          "rounded-r-[9px]",
          mode === "dark"
            ? "bg-[var(--pa-inset)] text-[var(--pa-label)]"
            : "bg-[var(--pa-void)] text-[var(--pa-muted)] hover:bg-[var(--pa-card)] hover:text-[var(--pa-label)]",
        )}
      >
        <Moon />
      </button>
    </div>
  );
}
