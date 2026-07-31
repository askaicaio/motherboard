# Dropdown / choice-picker standard

The standard for building **searchable dropdown pickers** (single- and multi-select)
in this app. Follow it for any new dropdown, and prefer **reusing** the existing
components over rebuilding.

Reference implementation (copy / reuse these, don't reinvent):

| File | Role |
| --- | --- |
| `src/components/automations/single-choice-combobox.tsx` | single-select picker |
| `src/components/automations/multi-choice-combobox.tsx` | multi-select picker (checkboxes, stays open) |
| `src/components/automations/use-popover-side.ts` | orientation hook (side vs. vertical) |
| `src/components/ui/popover.tsx` | shared Base UI Popover wrapper (forwards `collisionAvoidance`) |
| `src/components/ui/command.tsx` | shared cmdk list primitives |
| `src/components/automations/color-badge.tsx` | coloured option pill |

---

## Anatomy

A **Base UI `Popover`** (Trigger → Portal → Positioner → Popup) wrapping a **cmdk
`Command`** (search input + scrollable list):

```
<Popover open onOpenChange>
  <PopoverTrigger ref={triggerRef} …>   ← styled button showing the current selection
  <PopoverContent side align="start" sideOffset={8} collisionAvoidance>
    <Command>
      <CommandInput/>                    ← pinned search box
      <CommandList className="max-h-[…]">← scrollable options
        <CommandItem …>                  ← one per option
```

- Trigger shows the selection as a **coloured pill/chips** (via `ColorBadge`) or a
  red **"None"** when empty; mirrors how the value renders in the table cell.
- The list **type-filters** case-insensitively (the `Command filter` prop).
- Single-select closes on pick + has a leading **"None"** clear row; multi-select
  toggles with a checkbox and **stays open**.
- **Multi-select pins its selected options** frozen at the top of the open list, see
  the dedicated section [Multi-select: pinned (frozen) selected options](#multi-select-pinned-frozen-selected-options).

---

## The four sizing/placement behaviours (exact recipes)

### 1. Trigger styling — border, focus, open-state ring
```
flex w-full items-center justify-between gap-2 rounded-md border border-zinc-300
bg-white px-2 py-1.5 text-left text-sm shadow-sm outline-none transition-colors
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/50
```
The `data-[popup-open]:` ring is essential: a click moves focus **into** the popover,
so `focus-visible` alone never shows the ring on click. The open-state ring is the
"active" cue. Empty value adds `font-medium text-red-600`.

### 2. Height — grow to the window, scroll past it
On the **`CommandList`** (per-instance, NOT in the shared `command.tsx`):
```
max-h-[calc(var(--available-height)_-_3rem)]
```
`--available-height` is set by Base UI on the Positioner = space between the trigger
and the window edge. The `3rem` reserves room for the pinned search box so the whole
popup stays inside the viewport. (Left as `max-h-72` everywhere else in the app.)

### 3. Width — grow to content, capped at the window edge
On the **`PopoverContent`**:
```
min-w-[min(18rem,calc(var(--available-width,100vw)_-_0.5rem))]
w-max
max-w-[calc(var(--available-width,100vw)_-_0.5rem)]
p-0
```
- `w-max` grows to the widest option.
- `max-w` caps it at the space to the window edge (`--available-width`, less `0.5rem`
  so it doesn't touch the edge). Long options truncate here.
- The **floor is `min(18rem, cap)`** — normally 18rem, but it shrinks with the cap on
  a narrow screen (see gotcha #2).
- `100vw` fallback keeps the `calc()` valid on the first paint before Base UI sets
  `--available-width`.

Option **text spans must be `min-w-0 truncate`** so they ellipsis at the cap
(a flex child won't shrink below its content otherwise). Coloured options use
`ColorBadge` instead.

### 4. Orientation — side normally, vertical when too narrow
Driven by **`usePopoverSide(preferredSide)`**, which returns
`{ triggerRef, open, setOpen, side, collisionAvoidance }`:
- Pass `side="right"` (default) for right-column fields, `side="left"` for left-column
  fields, so the menu opens **away** from the dialog.
- The hook measures the free space beside the trigger on open (+ on resize). If it's
  under **`NARROW_SIDE_SPACE_PX` (~288px)** it opens **vertically** (`side="bottom"`,
  flipping to `top`), otherwise it keeps the configured side.
- It also returns the matching `collisionAvoidance` (see gotcha #1).
- Attach the returned `triggerRef` to the `PopoverTrigger` (React 19 ref-as-prop
  through Base UI's `forwardRef` trigger).

`align="start"` and `sideOffset={8}` on the `PopoverContent` are shared by both
orientations.

---

## Multi-select: pinned (frozen) selected options

**Multi-select only** (`multi-choice-combobox.tsx`), the single-select picker doesn't
do this. The options are split into **selected** and **unselected**:

- **Selected** options are **pinned/frozen** in a `sticky top-0` zone at the top of
  the scroll area, right below the frozen search box, so the current selection stays
  visible while the unselected list scrolls under it (mirrors how the search box stays
  frozen above).
- **Unselected** options are the normal, searchable list below.
- Toggling a selection moves the row between the two zones: unselect a pinned row and
  it drops back into the searchable list; select a list row and it rises into the
  pinned zone.

Recipe, inside the `CommandList` (which is the scroll container):

```tsx
const selected   = options.filter((o) =>  selectedSet.has(o.id));
const unselected = options.filter((o) => !selectedSet.has(o.id));

<CommandList className="max-h-[calc(var(--available-height)_-_3rem)]">
  {/* PINNED selected zone: sticky, plain buttons (NOT cmdk items), own scroll */}
  {selected.length > 0 && (
    <div className="sticky top-0 z-10 max-h-40 overflow-y-auto border-b bg-popover p-1">
      {selected.map((o) => (
        <button key={o.id} type="button" onClick={() => toggle(o.id)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted">
          {optionInner(o, /*checked*/ true)}
        </button>
      ))}
    </div>
  )}
  {/* UNSELECTED list: normal searchable cmdk items */}
  {unselected.length > 0 ? (
    <>
      <CommandEmpty>{noResultsLabel}</CommandEmpty>
      <CommandGroup>
        {unselected.map((o) => (
          <CommandItem key={o.id} value={o.value} onSelect={() => toggle(o.id)}>
            {optionInner(o, /*checked*/ false)}
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  ) : selected.length > 0 ? (
    <div className="px-2 py-4 text-center text-xs text-muted-foreground">All options selected.</div>
  ) : null}
</CommandList>
```

Load-bearing choices:

1. **Pinned rows are plain `<button>`s, NOT `CommandItem`s.** cmdk's `filter` only
   applies to `CommandItem`s, so plain buttons are **never search-filtered**, every
   selection stays visible while you type to add more. (If you ever want the search to
   also narrow the pinned zone, that's the knob: make them `CommandItem`s instead.)
2. **`sticky top-0` inside the scroll container** keeps the zone frozen at the top.
   This works because cmdk's internal `[cmdk-list-sizer]` wrapper is a plain div (no
   transform/overflow/contain), so sticky resolves against the scrolling `[cmdk-list]`.
3. **The pinned zone caps its own height (`max-h-40`) + scrolls**, so a big selection
   can't consume the whole popup (sticky can't pin a zone taller than the container).
4. **`optionInner(o, checked)`** renders the shared row body (checkbox + coloured pill
   / `min-w-0 truncate` text) so pinned rows and list rows look identical.

---

## Non-obvious rules (the gotchas — and the bug each prevents)

1. **Pin the side while horizontal** (`collisionAvoidance={{ side: "none" }}`).
   Base UI runs its flip/shift middleware **before** it computes `--available-width`.
   With flip on, a content-sized (`w-max`) popover is measured at its full natural
   width, so the positioner bails off the chosen side and sprawls across the screen —
   and the width cap never binds. Pinning anchors the near edge to the trigger, making
   `--available-width` deterministic so the cap actually shrinks the box.
   *(A content-sized popover with an `--available-width` cap MUST pin its side.)*

2. **The width floor must be `min(floor, cap)`, never a fixed `min-w`.**
   CSS resolves `min-width` **over** `max-width`, so a fixed `min-w-72` beats the cap
   and pushes the box off the screen edge on a narrow screen instead of shrinking.

3. **The vertical fallback is custom** (`use-popover-side.ts`). Base UI's collision
   only flips a side to its **opposite** (right ↔ left), never to a perpendicular axis
   (right → bottom). So "give up sideways, go vertical" has to be detected manually by
   measuring the trigger.

4. **Vertical mode uses `collisionAvoidance={{ side: "flip", align: "shift" }}`** —
   flip bottom ↔ top for vertical room, shift horizontally to stay on-screen. Flipping
   on the vertical axis can't make the width run away, so this is safe (unlike a
   horizontal flip, gotcha #1).

5. **The `CommandList` height override is per-instance**, not in the shared
   `command.tsx` — every other combobox in the app keeps the default `max-h-72`.

6. **Decide orientation in the open handler**, before the popover renders open, so
   there's no reposition flash (the hook does this: `measure()` + `setOpen(true)`
   batch into one render).

---

## Checklist: adding a new dropdown field/column

1. **Reuse** `SingleChoiceCombobox` or `MultiChoiceCombobox` — do not hand-roll a new
   Popover+Command.
2. Pass `options` as `ChoiceOption[]`, the current `value`/`values`, and `onChange`.
3. Set `side="left"` for a left-column dialog field, else leave the `"right"` default.
4. If options carry colours, they render as pills automatically (`ColorBadge`); plain
   options stay text with `min-w-0 truncate`.
5. You get height-grow, width-grow-to-edge, and the vertical-when-narrow fallback for
   free — don't re-implement them.

## Base UI `Select` dropdowns (e.g. the Status selector)

Small enum dropdowns (Add/Edit **Status**) use a Base UI **`Select`**, not the
combobox. They reuse the **orientation** half of the standard so they behave the
same: they route `open`/`side`/`collisionAvoidance` through `usePopoverSide` (with
the smaller `NARROW_SIDE_SPACE_SELECT_PX` threshold, since the menu is a fixed
~176px, not content-sized), and attach the returned `triggerRef` to the
`SelectTrigger`. To do this the `Select` must be **open-controlled**
(`open`/`onOpenChange` wired to the hook) and `alignItemWithTrigger={false}` (so
`side` takes effect on a Select). They keep the Select's own **height**
(`max-h-(--available-height)`, already in `ui/select.tsx`) and **width**
(`w-(--anchor-width)`) — the combobox width recipe does NOT apply (a Select can't
sprawl). See `choice-dialog.tsx` (Status, opens right) and `workflow-dialog.tsx`
(Status, opens left).

## Tunable knobs

| Knob | Where | Effect |
| --- | --- | --- |
| `NARROW_SIDE_SPACE_PX` (~288) | `use-popover-side.ts` | vertical-switch threshold for the wide comboboxes |
| `NARROW_SIDE_SPACE_SELECT_PX` (~200) | `use-popover-side.ts` | vertical-switch threshold for the small fixed-width Status Selects |
| `0.5rem` edge gap | width `calc()` in both comboboxes | gap between the menu and the window edge |
| `3rem` search-box reserve | `CommandList` height `calc()` | headroom kept for the pinned search box |

---

*History: built across PRs #271 (height), #272 (width-to-edge), #273 (pin side),
#274 (narrow-screen floor), #275 (vertical fallback). See the Automations Done List
"Round 48" for the blow-by-blow.*
