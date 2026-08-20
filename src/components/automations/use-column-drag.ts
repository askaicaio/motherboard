"use client";

// =============================================================
// useColumnDrag — drag a table column header sideways to reorder
// =============================================================
// Shared by the Per Website table and View All Lists so the gesture cannot drift
// between them. The caller owns the column order and its persistence; this hook
// only turns pointer movement into "column X should be dropped at gap N".
//
// ⚠️ NO DRAG LIBRARY, ON PURPOSE. dnd-kit's sortable applies a CSS `transform`
// to the dragged item, and `transform` BREAKS `position: sticky` — both tables
// depend on sticky for their header row AND their frozen left-0 Name column, so
// transforming a header breaks the two things that make them usable. (Its mature
// line also declares peer support only up to React 18, and the app is on 19.)
// Re-read this before reaching for a drag library here.
//
// So the dragged header does NOT follow the cursor. The caller dims it and draws
// an insertion line, which is why this hook returns `dragId` + `dropIndex`
// rather than any coordinates.
//
// HOW THE GESTURE IS DETECTED
//   - pointerdown records the x and takes POINTER CAPTURE, so move/up keep
//     arriving once the pointer leaves the cell (which it does immediately).
//   - a drag starts only after DRAG_THRESHOLD_PX of sideways travel, so a plain
//     click still means "click". What that DOES is the caller's business: the Per
//     Website table opens its header menu, View All Lists toggles the sort.
//   - pointerdown is CANCELLED. Per the Pointer Events spec that also suppresses
//     the compatibility mouse events (mousedown/mouseup/click), which is what
//     stops a Base UI menu trigger opening mid-drag. Two costs, both the caller's
//     to handle in `onPlainClick`: the click must be re-created by hand, and so
//     must the focus the cancelled default would have set.
//
// ⚠️ WHY THE LIVE VALUES LIVE IN REFS, NOT STATE
// `pointerup` must act on the drop gap measured by the LAST `pointermove`. In
// React, pointermove updates are low-priority and may not have committed by the
// time pointerup (which is discrete, and flushes) runs — so reading the dragged
// id / drop index out of state inside pointerup can read a STALE render. The refs
// are written synchronously inside the handlers, and the state exists only to
// drive rendering. Do not "simplify" this to state-only.
// =============================================================

import { useEffect, useRef, useState } from "react";
import type React from "react";

/** How far the pointer must travel sideways before a press counts as a DRAG
 *  rather than a click. Small enough to feel immediate, large enough that a
 *  normal click still registers as one. */
export const DRAG_THRESHOLD_PX = 5;

/** Attribute stamped on every draggable header cell, used to measure the live
 *  header rects so the drop gap is correct at any scroll position. */
export const DRAG_COL_ATTR = "data-drag-col";

/** Edge auto-scroll: without it you cannot drag a column across a ~2800px-wide
 *  table, because the target is off-screen. */
const EDGE_PX = 56; // distance from the container edge that triggers scrolling
const EDGE_MAX_PX = 18; // scroll per frame at the very edge

export interface ColumnDragHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLTableCellElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLTableCellElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLTableCellElement>) => void;
  onPointerCancel: () => void;
}

export function useColumnDrag<Id extends string>({
  scrollRef,
  onCommit,
}: {
  /** The horizontally scrolling container the table lives in (for auto-scroll). */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Called on a completed drag. `dropIndex` is an INSERTION GAP in the visible
   *  column list: 0 = before the first, list.length = after the last. */
  onCommit: (id: Id, dropIndex: number) => void;
}) {
  // Render state.
  const [dragId, setDragId] = useState<Id | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Live gesture values, written synchronously in the handlers (see the header
  // note). `pressX` is null whenever no press is in flight.
  const pressXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragIdRef = useRef<Id | null>(null);
  const dropRef = useRef<number | null>(null);
  const xRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // The commit callback is recreated every render; keep the latest so the
  // handlers never call a stale closure.
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });

  /** Which insertion gap is the pointer nearest? Measures the live header rects,
   *  so it stays correct at any scroll position and after any hide/reorder. */
  const computeDropIndex = (clientX: number): number | null => {
    const el = tableRef.current;
    if (!el) return null;
    const ths = Array.from(
      el.querySelectorAll<HTMLElement>(`th[${DRAG_COL_ATTR}]`),
    );
    if (ths.length === 0) return null;
    for (let i = 0; i < ths.length; i++) {
      const r = ths[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return ths.length;
  };

  /** Set the drop gap in both the ref (authoritative) and state (for rendering). */
  const setDrop = (next: number | null) => {
    dropRef.current = next;
    setDropIndex(next);
  };

  const stopAutoScroll = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startAutoScroll = () => {
    const tick = () => {
      const box = scrollRef.current;
      if (box) {
        const r = box.getBoundingClientRect();
        const x = xRef.current;
        let dx = 0;
        if (x < r.left + EDGE_PX) {
          dx = -EDGE_MAX_PX * Math.min(1, (r.left + EDGE_PX - x) / EDGE_PX);
        } else if (x > r.right - EDGE_PX) {
          dx = EDGE_MAX_PX * Math.min(1, (x - (r.right - EDGE_PX)) / EDGE_PX);
        }
        if (dx !== 0) {
          box.scrollLeft += dx;
          // The columns moved under a stationary pointer, so re-measure.
          setDrop(computeDropIndex(x));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    stopAutoScroll();
    rafRef.current = requestAnimationFrame(tick);
  };

  const endDrag = (commit: boolean) => {
    stopAutoScroll();
    const id = dragIdRef.current;
    const drop = dropRef.current;
    dragIdRef.current = null;
    dropRef.current = null;
    setDragId(null);
    setDropIndex(null);
    if (commit && id !== null && drop !== null) commitRef.current(id, drop);
  };

  const resetPress = () => {
    pressXRef.current = null;
    draggingRef.current = false;
  };

  /** Pointer handlers for ONE draggable header cell. `onPlainClick` runs when the
   *  press turned out to be a click rather than a drag; the caller decides what
   *  that means. It receives the CELL ELEMENT so the caller can restore focus
   *  itself — the cancelled pointerdown suppressed the default focus, and passing
   *  the element avoids the caller needing a ref for it. */
  const headerHandlers = (
    id: Id,
    onPlainClick: (cell: HTMLTableCellElement) => void,
  ): ColumnDragHandlers => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return; // left button only
      e.preventDefault();
      pressXRef.current = e.clientX;
      draggingRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      const start = pressXRef.current;
      if (start === null) return;
      if (!draggingRef.current) {
        if (Math.abs(e.clientX - start) < DRAG_THRESHOLD_PX) return;
        draggingRef.current = true;
        dragIdRef.current = id;
        xRef.current = e.clientX;
        setDragId(id);
        setDrop(computeDropIndex(e.clientX));
        startAutoScroll();
        return;
      }
      xRef.current = e.clientX;
      setDrop(computeDropIndex(e.clientX));
    },
    onPointerUp: (e) => {
      if (pressXRef.current === null) return;
      const dragged = draggingRef.current;
      resetPress();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (dragged) endDrag(true);
      else onPlainClick(e.currentTarget);
    },
    onPointerCancel: () => {
      if (pressXRef.current === null) return;
      const dragged = draggingRef.current;
      resetPress();
      if (dragged) endDrag(false);
    },
  });

  // Escape aborts an in-flight drag. Must be a WINDOW listener: the cancelled
  // pointerdown means no header ever takes focus, so a keydown on the cell would
  // never fire.
  const endRef = useRef(endDrag);
  useEffect(() => {
    endRef.current = endDrag;
  });
  useEffect(() => {
    if (dragId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetPress();
        endRef.current(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragId]);

  // Never leave a rAF loop running if the table unmounts mid-drag.
  useEffect(() => stopAutoScroll, []);

  /** Which edge of the cell at `index` should show the insertion line, given the
   *  total number of visible columns. Null when no line belongs on this cell. */
  const dropEdgeFor = (
    index: number,
    total: number,
  ): "left" | "right" | null => {
    if (dragId === null || dropIndex === null) return null;
    if (dropIndex === index) return "left";
    if (dropIndex === total && index === total - 1) return "right";
    return null;
  };

  return { tableRef, dragId, headerHandlers, dropEdgeFor };
}
