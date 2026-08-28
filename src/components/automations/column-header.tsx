"use client";

// =============================================================
// ColumnHeader — one table column header cell, for BOTH tables
// =============================================================
// Shared by the Per Website table (`automations-table-client.tsx`) and View All
// Lists (`all-automations-table-client.tsx`). It was Per Website's local
// component until 2026-08-21, when the header menu was added to View All Lists
// too; it moved here rather than being copied, for the same reason
// `use-column-drag.ts` exists — this cell is where the click/drag/portal traps
// live, and a copy would have to re-learn every one of them.
//
// ⚠️ THE TRAP THIS CELL SITS ON. In edit mode the header is BOTH a menu trigger
// and a drag handle, and the drag hook CANCELS pointerdown (which, per the
// Pointer Events spec, also suppresses the compatibility mouse events, `click`
// included). So the menu cannot be left uncontrolled: Base UI would never see a
// click. It is opened by hand from `onPlainClick`, and the focus the cancelled
// default would have set is restored by hand as well. Read the note on
// `menuOpen` below before changing any of this.
//
// The `SortKey` type differs between the two tables (View All Lists has an extra
// "website" column), so the component is generic over it. Nothing else about it
// is table-specific: the caller supplies the cell's className, its label
// (`children`), and what each menu item does.
// =============================================================

import { useState, type ReactNode } from "react";
import { ArrowDownUp, ArrowLeft, ArrowRight, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DRAG_COL_ATTR, type ColumnDragHandlers } from "./use-column-drag";

/** ⏸️ OFF SWITCH for the FROZEN NAME column's edit-mode menu, on BOTH tables.
 *
 *  Name is pinned, so its menu can only ever offer "Cycle Sort": there is
 *  nothing to move it past, and hiding the identifying column makes no sense.
 *  A one-item menu is strictly worse than the plain click it replaced, so the
 *  user turned it off (2026-08-21) and clicking the Name header in edit mode
 *  cycles the sort again, exactly as it does off edit mode.
 *
 *  ⚠️ TURNED OFF, NOT REMOVED, deliberately (user's word: "turn off"). Nothing
 *  else was deleted: both Name headers still render a ColumnHeader and still
 *  pass their sort props. Flip this to `true` to bring the menu back on both
 *  pages at once, and add `onMoveLeft`/`onMoveRight`/`onHide` at the two call
 *  sites if Name ever stops being pinned. Nothing else to change.
 *
 *  Mechanism: the call sites pass `editMode={editMode && NAME_HEADER_MENU}`, so
 *  the cell simply takes ColumnHeader's off-edit-mode branch (plain <th>, click
 *  cycles the sort) while the rest of the table stays in edit mode. */
export const NAME_HEADER_MENU = false;

// Interactive affordance shared by clickable headers (sortable ones off edit
// mode, and EVERY header while edit mode is on).
export const HEADER_INTERACTIVE =
  "cursor-pointer select-none transition-colors hover:bg-zinc-200 hover:text-zinc-700";

/** A column header cell.
 *
 *  OFF edit mode: behaves exactly as before. Sortable headers (a non-null
 *  `sortKey`) click to CYCLE the sort and carry the hover affordance (already in
 *  their `className`); the rest are inert plain headers.
 *
 *  ON edit mode: EVERY header instead hosts a full-width dropdown-trigger BUTTON
 *  inside the (still fixed-width) cell, so clicking it opens an options menu in
 *  place of the plain sort-cycle click. Every menu item is OPTIONAL and is left
 *  OUT entirely when it does not apply (rather than shown grayed): no `sortKey`
 *  means no "Cycle Sort", no `onMoveLeft` means no "Move Column Left", and so
 *  on. A header with none of them would open an EMPTY menu, so give every
 *  edit-mode header at least one action. */
export function ColumnHeader<K extends string>({
  className,
  editMode,
  sortKey,
  activeSortKey,
  sortDir,
  onCycleSort,
  onMoveLeft,
  onMoveRight,
  onHide,
  makeDragHandlers,

  isDragging,
  dropEdge,
  dragKey,
  tooltip,
  children,
}: {
  className: string;
  editMode: boolean;
  sortKey: K | null;
  activeSortKey: K;
  sortDir: "asc" | "desc";
  onCycleSort: (key: K) => void;
  /** Provided (enabled) when the column can move that way; omit to disable the
   *  item (pinned column, or already at the edge). */
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  /** Hide this column; omit on non-hideable columns (e.g. Name). */
  onHide?: () => void;

  /** Provided only on DRAGGABLE headers (the reorderable middle columns, edit
   *  mode). Omit on the pinned Name column, which then keeps the plain
   *  click-opens-the-menu behaviour with no gesture handling at all. */
  /** Provided only on DRAGGABLE headers. Called with what a PLAIN CLICK should
   *  do (open this header s menu), and returns the pointer handlers to spread
   *  onto the cell. Omit on the pinned Name column, which then gets no gesture
   *  handling at all. */
  makeDragHandlers?: (
    onPlainClick: (cell: HTMLTableCellElement) => void,
  ) => ColumnDragHandlers;
  /** This column is the one being dragged: dim it. */
  isDragging?: boolean;
  /** Draw the insertion line on this cell's left or right edge, or neither. */
  dropEdge?: "left" | "right" | null;
  /** Column id, stamped as `data-mid-col` so the drag can measure the header
   *  rects. Present on the reorderable middle columns only. */
  dragKey?: string;
  /**
   * Hover text explaining what the column MEANS, for headers whose label is not
   * self-explanatory (today: "Last Edited" versus "Row Update", which look
   * alike and are fed by completely different things).
   *
   * ⚠️ A NATIVE `title`, deliberately, NOT the app's <Tooltip>. This cell is
   * already both a sort target and a drag handle, and the drag hook cancels
   * pointerdown (see the trap note at the top of this file). Putting another
   * interactive element inside it, which is what a TooltipTrigger is, risks the
   * one interaction this component exists to get right. A title attribute adds
   * no element and no listener.
   */
  tooltip?: string;
  children: ReactNode;
}) {
  const ariaSort = sortKey
    ? activeSortKey === sortKey
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none"
    : undefined;

  // Mirror the cell's own text-align onto the trigger button so the label sits
  // exactly where the static header puts it (Name is left, the rest center).
  const alignClass = className.includes("text-left") ? "text-left" : "text-center";

  // ── Click vs drag ──────────────────────────────────────────────────────────
  // The header is BOTH a menu trigger and a drag handle, so the same press has to
  // resolve into one or the other. The gesture itself lives in useColumnDrag; all
  // that belongs here is what a PLAIN CLICK means.
  //
  // The menu is therefore CONTROLLED: the hook cancels pointerdown (which, per
  // the Pointer Events spec, also suppresses mousedown/mouseup/click), so Base UI
  // never sees a click and cannot open the menu behind a drag. The two costs of
  // that are paid right here — the open is re-created by hand, and so is the focus
  // the cancelled default would have set. Keyboard is unaffected: Enter/Space
  // fires a real click, which the controlled menu still honours.
  const [menuOpen, setMenuOpen] = useState(false);
  const dragHandlers = makeDragHandlers?.((cell) => {
    cell.querySelector("button")?.focus();
    setMenuOpen(true);
  });

  if (!editMode) {
    // The passed className already carries the interactive classes for sortable
    // headers (and omits them for the rest), so behavior is byte-for-byte as before.
    return (
      <th
        onClick={sortKey ? () => onCycleSort(sortKey) : undefined}
        aria-sort={ariaSort}
        title={tooltip}
        className={className}
      >
        {children}
      </th>
    );
  }

  // Edit mode: keep the <th> a plain, fixed-width cell (p-0) and put a full-width
  // BUTTON inside it as the dropdown trigger. Rendering the <th> ITSELF as the
  // trigger (Base UI `render`) broke both behaviors: a non-button trigger opened
  // only on press-and-hold (released = closed), and the <th> stopped honoring its
  // fixed width once it became the menu's anchor. A real <button> (the standard
  // trigger, matching every other dropdown) fixes both. The button carries the
  // padding + interactive affordance; the cell keeps its width/sticky/shadow.
  return (
    <th
      aria-sort={ariaSort}
      {...(dragKey ? { [DRAG_COL_ATTR]: dragKey } : {})}
      className={cn(
        className,
        "p-0",
        isDragging && "opacity-40",
        // Insertion line as an INSET box-shadow on the cell edge, so it scrolls
        // with the table and needs no absolute positioning. The header cells
        // already use inset shadows for their bottom border, so both are listed
        // together here (a second box-shadow would override the first).
        dropEdge === "left" &&
          "shadow-[inset_2px_0_0_0_#2563eb,inset_0_-1px_0_0_#e4e4e7]",
        dropEdge === "right" &&
          "shadow-[inset_-2px_0_0_0_#2563eb,inset_0_-1px_0_0_#e4e4e7]",
      )}
      {...dragHandlers}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          // In edit mode the label lives on the button, not the cell, so the
          // hover text has to move with it.
          title={tooltip}
          // `uppercase` re-applies the header text-transform that the <button>
          // reset strips (Tailwind preflight sets `text-transform: none` on
          // buttons), so the trigger label stays uppercase like the static <th>.
          className={cn(
            "block w-full px-3 py-2 uppercase",
            alignClass,
            HEADER_INTERACTIVE,
            // Draggable headers claim the touch gesture, otherwise a touch drag
            // just scrolls the table horizontally and never reorders.
            makeDragHandlers && "touch-none",
          )}
        >
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-auto min-w-48">
          {/* Cycle Sort, shown ONLY on sortable columns (hidden on the
              display-only ones instead of appearing disabled/grayed). */}
          {sortKey && (
            <DropdownMenuItem onClick={() => onCycleSort(sortKey)}>
              <ArrowDownUp />
              Cycle Sort
            </DropdownMenuItem>
          )}
          {/* Move the column left/right, shown ONLY when it can actually go that
              way. So both are hidden on the pinned Name column (nothing to move),
              and the edge item is hidden on the first / last movable column. */}
          {onMoveLeft && (
            <DropdownMenuItem onClick={onMoveLeft}>
              <ArrowLeft />
              Move Column Left
            </DropdownMenuItem>
          )}
          {onMoveRight && (
            <DropdownMenuItem onClick={onMoveRight}>
              <ArrowRight />
              Move Column Right
            </DropdownMenuItem>
          )}
          {/* Hide this column (persists per page; re-show via the Columns
              control). Last item in this menu since Reset moved out. */}
          {onHide && (
            <DropdownMenuItem onClick={onHide}>
              <EyeOff />
              Hide Column
            </DropdownMenuItem>
          )}
          {/* NOTE "Reset Column Order" USED to live here. It moved into the
              "Columns" dropdown 2026-08-20 (user request) so both tables keep it
              in the same place — View All Lists has no header menu to hold it.
              This menu is now per-COLUMN actions only; the table-wide one is in
              the toolbar. */}

        </DropdownMenuContent>
      </DropdownMenu>
    </th>
  );
}
