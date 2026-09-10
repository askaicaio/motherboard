// =============================================================
// Automations "Toolbar Options 1", route /automations-toolbar-options-1
// =============================================================
// 🏷️ RENAMED FROM "GAMMA1" ON 2026-09-11, route and all. The user coined
// "Gamma1", then asked for suggestions; two things decided it:
//   1. **A Greek letter implies a MATURITY STAGE.** alpha -> beta -> release
//      candidate -> GA is the real ladder and it stops at two letters, so
//      "Gamma1" read as MORE finished than Beta3. This page is not further
//      along, it is a different KIND of page.
//   2. **⚠️ "GAMMA" ALREADY MEANS Gamma.app IN THIS CODEBASE**, which the
//      Reports feature integrates for deck generation (`gamma-client.ts`,
//      `GAMMA_API_KEY`, the `gamma_*` columns on `reports`). Sharing the word
//      was a genuine grep collision. **That was the stronger reason.**
// **The old route /automations-gamma1 is gone; nothing serves it.**
//
// ⭐ A DIFFERENT KIND OF PAGE FROM EVERY ALPHA AND BETA. Created 2026-09-10: "i need
// suggestions on other ways to display this toolbar. Still in the same spot,
// which is directly below the Automation Header. Create a Gamma1 Page. Put all
// your suggested toolbar aesthetics there. one after the other."
//
// ⚠️⚠️ THIS IS NOT A HUB REDESIGN, WHICH IS WHAT EVERY ALPHA AND BETA IS. It is
// a COMPONENT SHOWCASE: one element, the toolbar strip, rendered several ways,
// stacked so they can be compared against each other in the position they would
// actually occupy. **Read AN "OPTIONS" PAGE as "variations on one component" and
// ALPHA / BETA as "variations on the whole page".** If the user asks for
// suggestions on some other single element later, copy this shape and name it
// after that element: "Sidebar Options 1", "Card Options 1". **The element goes
// first; there is no running family number across different elements.**
//
// ⚠️ WHAT IT IS COMPARING: the three-link strip that sits directly below the
// page header on the live hub, going to Feature Integration, View All Lists and
// Dropdown Configuration. **Those three are the ONLY route to those pages from
// the hub**, which is why the strip's legibility matters more than its size.
//
// ⚠️ THE LINKS ARE REAL, NOT MOCKS, which is a departure from the Alphas
// (static <span>s on real data). Hover, focus and click all behave, because an
// aesthetic judgement about a toolbar is mostly a judgement about its hover and
// focus states. **Clicking one navigates away from this page**; that is the
// cost and it is worth it.
//
// ⚠️ EVERY VARIANT RENDERS THE SAME `TOOLS` ARRAY. That is deliberate: the only
// thing differing between them is presentation, so a comparison is honest. Do
// not hand-write the three links into a variant.
//
// ⚠️ SELF-CONTAINED, like every other version page. **Do not import pieces of
// this into the live hub or a bench, and do not factor its variants out into a
// shared component.** When one wins, it gets COPIED to its destination by hand,
// the same way every promotion in this project has worked.
//
// ⚠️ NO DATABASE READS. This page shows no estate data at all, so it costs
// nothing to open and cannot be affected by the connection-pool limit that the
// data-heavy pages have to respect.
// =============================================================

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  List,
  ListChecks,
  Plug,
  Workflow,
} from "lucide-react";

import { requireAuth } from "@/lib/auth/guard";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** The three destinations, shared by every variant so the comparison is fair.
 *
 *  ⚠️ `blurb` is used by the tile variant only. It is written here rather than
 *  in that variant so all the copy lives in one place. */
const TOOLS = [
  {
    href: "/automations/feature-integration",
    label: "Feature Integration",
    short: "Features",
    icon: Plug,
    blurb: "Which features are wired up, per platform.",
  },
  {
    href: "/automations/all",
    label: "View All Lists",
    short: "All Lists",
    icon: List,
    blurb: "Every automation from all five websites in one table.",
  },
  {
    href: "/automations/dropdown-config",
    label: "Dropdown Configuration",
    short: "Dropdowns",
    icon: ListChecks,
    blurb: "Edit the options behind the table's choice columns.",
  },
] as const;

export default async function AutomationsToolbarOptions1Page() {
  await requireAuth();

  return (
    <div className="space-y-5 p-6">
      {/* The real hub header, so each variant is judged in the position and at
          the width it would actually occupy. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-zinc-500" />
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Automations
            </h1>
            {/* ⚠️ THE BADGE IS THE *SHORT* NAME, same convention as every
                other version page: the directory tile reads "Toolbar Options
                1" and this pill drops the element qualifier, because the pill
                sits beside an <h1> already saying "Automations" and the strip
                it describes is visible directly below. */}
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Options 1
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Tracks workflows from different automation websites all in one
            place.
          </p>
        </div>
      </div>

      <p className="max-w-3xl rounded-lg bg-muted/40 px-4 py-3 text-sm text-zinc-600 ring-1 ring-foreground/10">
        Nine ways to render the same toolbar, in the spot it occupies on the
        hub: directly under the heading above. Same three destinations every
        time, so only the presentation differs. The links are live, so hover and
        click behave as they would in production.
      </p>

      <Variant
        n={1}
        name="Outlined buttons in a card"
        note="What ships today. Three outline buttons inside a bordered card that matches the pane below it."
      >
        <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5 ring-1 ring-foreground/10">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <t.icon />
              {t.label}
            </Link>
          ))}
        </div>
      </Variant>

      <Variant
        n={2}
        name="Segmented control"
        note="One object instead of three. Hairline dividers, no gaps, so it reads as a single control the way a tab bar does."
      >
        <div className="inline-flex overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
          {TOOLS.map((t, i) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 ${
                i > 0 ? "border-l" : ""
              }`}
            >
              <t.icon className="h-4 w-4 text-zinc-500" />
              {t.label}
            </Link>
          ))}
        </div>
      </Variant>

      <Variant
        n={3}
        name="Underlined tabs"
        note="No container at all. The lightest option, and the most familiar, though it implies these switch a view rather than navigate away."
      >
        <div className="flex items-center gap-6 border-b">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="-mb-px flex items-center gap-2 border-b-2 border-transparent px-1 pb-2.5 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900"
            >
              <t.icon className="h-4 w-4 text-zinc-400" />
              {t.label}
            </Link>
          ))}
        </div>
      </Variant>

      <Variant
        n={4}
        name="Ghost row, no chrome"
        note="Links sit straight on the page with a hover pill. Quietest of all; the trade is that nothing signals they are buttons until you point at them."
      >
        <div className="flex items-center gap-1">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <t.icon className="h-4 w-4 text-zinc-400" />
              {t.label}
            </Link>
          ))}
        </div>
      </Variant>

      <Variant
        n={5}
        name="Labelled, pushed right"
        note="A caption claims the row so the buttons stop competing with the page heading. Also leaves the left edge free if a filter or search ever lands here."
      >
        <div className="flex items-center justify-between gap-4 rounded-xl bg-card px-4 py-2.5 ring-1 ring-foreground/10">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Tools
          </span>
          <div className="flex items-center gap-2">
            {TOOLS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <t.icon />
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </Variant>

      <Variant
        n={6}
        name="Equal thirds, full width"
        note="Three equal segments spanning the pane's width, so the strip lines up with the layout instead of trailing off. Biggest click targets here."
      >
        <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {TOOLS.map((t, i) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 ${
                i > 0 ? "border-l" : ""
              }`}
            >
              <t.icon className="h-4 w-4 text-zinc-500" />
              {t.label}
            </Link>
          ))}
        </div>
      </Variant>

      <Variant
        n={7}
        name="Tiles with a line of explanation"
        note="The only variant that says what the destinations DO. Most discoverable, and by far the tallest; it pushes the pane below down by about 60px."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <t.icon className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-semibold text-zinc-800">
                  {t.label}
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {t.blurb}
              </p>
            </Link>
          ))}
        </div>
      </Variant>

      <Variant
        n={8}
        name="Compact: short labels"
        note="The same strip with the labels trimmed to one word each. Half the width, and it stops the longest label dominating the row."
      >
        <div className="inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              title={t.label}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <t.icon className="h-3.5 w-3.5 text-zinc-400" />
              {t.short}
            </Link>
          ))}
        </div>
      </Variant>

      <Variant
        n={9}
        name="Collapsed into one menu"
        note="Smallest possible footprint, and the only one that costs a click. Worth it only if this row is ever fighting the page for space."
      >
        {/* ⚠️ A NATIVE <details>, NOT A CLIENT COMPONENT. It opens and closes
            with no JavaScript, which keeps this page a pure server component
            and means the variant can be judged without importing the app's
            dropdown machinery. If this one wins, rebuild it with the real
            dropdown standard (`docs/dropdown-menu-standard.md`) rather than
            shipping the <details>. */}
        <details className="relative inline-block">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-card px-3.5 py-2 text-sm font-medium text-zinc-700 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
            <ListChecks className="h-4 w-4 text-zinc-500" />
            Tools
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </summary>
          <div className="absolute left-0 z-10 mt-1.5 w-64 overflow-hidden rounded-lg bg-card p-1 shadow-lg ring-1 ring-foreground/10">
            {TOOLS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <t.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                {t.label}
              </Link>
            ))}
          </div>
        </details>
      </Variant>
    </div>
  );
}

/** One numbered section: a caption, then the variant at full width.
 *
 *  ⚠️ The caption sits ABOVE the variant rather than beside it so every variant
 *  gets the full pane width, which is the width it would have on the hub. A
 *  side-by-side gallery would misrepresent the wide ones. */
function Variant({
  n,
  name,
  note,
  children,
}: {
  n: number;
  name: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tabular-nums text-zinc-400">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="text-sm font-semibold text-zinc-800">{name}</h2>
      </div>
      <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">{note}</p>
      <div className="pt-1">{children}</div>
    </section>
  );
}
