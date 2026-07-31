"use client";

// Shared by the two automations choice comboboxes (single + multi select).
//
// The pickers normally open to the LEFT or RIGHT of their trigger (pinned, so
// the width cap can shrink them to fit — see the combobox files). But on a
// width-constrained screen the side gutter next to a centred dialog can get too
// narrow for a usable menu. When that happens we'd rather open the menu
// VERTICALLY (below the field, flipping above if there's no room), where it gets
// the full viewport width instead of the cramped gutter.
//
// Base UI can't do this on its own: its collision system only flips a side to
// its OPPOSITE (right <-> left), never to a perpendicular axis (right -> bottom).
// So we detect the narrow case ourselves by measuring the space beside the
// trigger when the menu opens (and on resize while open).

import { useCallback, useEffect, useRef, useState } from "react";

/** Below this much free space (px) on the configured side, open vertically.
 *  ~18rem = the comfortable min width a side-opening menu wants; under it the
 *  side menu would only shrink further, so we go vertical instead. */
const NARROW_SIDE_SPACE_PX = 288;

type Side = "left" | "right" | "top" | "bottom";

export function usePopoverSide(configuredSide: Side) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpenState] = useState(false);
  const [vertical, setVertical] = useState(false);

  // How much horizontal room is there beside the trigger on its chosen side?
  // Only left/right sides can run out of horizontal room; top/bottom never do.
  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sideSpace =
      configuredSide === "left"
        ? r.left
        : configuredSide === "right"
          ? window.innerWidth - r.right
          : Infinity;
    setVertical(sideSpace < NARROW_SIDE_SPACE_PX);
  }, [configuredSide]);

  // Decide the orientation BEFORE the popover renders open, so it opens on the
  // right side with no reposition flash. (measure() + setOpenState() batch into
  // a single render.)
  const setOpen = useCallback(
    (next: boolean) => {
      if (next) measure();
      setOpenState(next);
    },
    [measure],
  );

  // Keep it correct if the window is resized while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, measure]);

  const side: Side = vertical ? "bottom" : configuredSide;
  // Horizontal: PIN the side (no flip) so --available-width stays deterministic
  // and the width cap binds (otherwise wide content sprawls off the chosen side).
  // Vertical: allow bottom<->top flip + a horizontal shift to stay on-screen;
  // width can't run away here because flipping is on the vertical axis.
  const collisionAvoidance = vertical
    ? ({ side: "flip", align: "shift" } as const)
    : ({ side: "none" } as const);

  return { triggerRef, open, setOpen, side, collisionAvoidance };
}
