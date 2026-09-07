// ---------------------------------------------------------------------------
// THE AUTOMATIONS VERSION REGISTRY: every parallel presentation of the hub.
//
// The user is deliberately collecting alternative designs for the Automations
// hub rather than picking one winner. Each lives at its OWN top-level route as
// a SELF-CONTAINED page, which is what stops bench work from ever breaking the
// live hub. **Do not factor shared pieces out of those page files.** This
// module is a registry of links and labels only; it holds no layout.
//
// ⚠️⚠️ THIS LIST IS THE ONLY PLACE A VERSION HAS TO BE REGISTERED. To add one:
// an entry here + one page file. Nothing else.
//
// ⚠️ IT MOVED HERE FROM `src/components/layout/sidebar.tsx` ON 2026-09-08,
// when the sidebar's version dropdown was removed ("The dropdown for the page
// selection when clicking the automation tab at the left sidebar is also not
// needed anymore"). Two things now read it and neither owns it:
//   1. the Feature Integration page, which renders the bench versions as the
//      ONLY way to reach them;
//   2. the sidebar, which uses it for one thing only: keeping the Automations
//      tab highlighted while you are on a bench route.
//
// 🛑 SO THE FEATURE INTEGRATION PAGE IS THE ONLY ROUTE TO THE BENCHES NOW.
// If that section is ever removed, the Alphas and Betas become unreachable
// except by typing the URL. They are NOT linked from anywhere else.
// ---------------------------------------------------------------------------

import {
  Atom,
  Beaker,
  Blocks,
  Boxes,
  Dna,
  FlaskConical,
  Microscope,
  Telescope,
  TestTube,
  Workflow,
} from "lucide-react";

// ⚠️⚠️ THE DISPLAY LABEL AND THE ROUTE DO NOT MATCH FOR TWO VERSIONS, AND
// THAT IS DELIBERATE. On 2026-09-08 the user renamed the first of each family:
// "Rename these, they should be referred to as Beta1 and Alpha1". So:
//     label "Beta1"  -> route /automations-beta
//     label "Alpha1" -> route /automations-alpha
// **The ROUTES were left alone on purpose.** They are stable identifiers: open
// tabs, bookmarks, every PR title and the whole Done List history refer to
// them, and moving the directories would break all of that to fix a cosmetic
// mismatch. **Do not "tidy" the routes to match the labels** without being
// asked; if that is ever wanted it is a rename of two directories plus a sweep
// of the docs, not a one-line change.
// ⚠️ OLDER CODE COMMENTS ACROSS THESE PAGES STILL SAY "Alpha" and "Alpha 1"
// in prose. They were left as written: they are a historical record, and
// rewriting them would be a large diff with no functional effect.

export interface AutomationVersion {
  href: string;
  /** What the UI calls this version. **Not derivable from `href`** for Beta1
   *  and Alpha1; see the note above. */
  label: string;
  icon: React.ElementType;
  /** One line on what this presentation actually tries. Taken from each page's
   *  OWN header comment rather than invented, so the two cannot drift into
   *  disagreeing about what a page is. */
  blurb: string;
  /** The live hub. Excluded from the Feature Integration page's list, because
   *  that page is reached FROM it and the sidebar tab already goes there. */
  official?: boolean;
}

export const AUTOMATION_VERSIONS: AutomationVersion[] = [
  {
    href: "/automations",
    label: "Official",
    icon: Workflow,
    blurb: "The live hub.",
    official: true,
  },
  {
    href: "/automations-beta",
    label: "Beta1",
    icon: Blocks,
    blurb: "Assembly bench. Alpha3's master and detail, with working controls.",
  },
  {
    href: "/automations-beta2",
    label: "Beta2",
    icon: Boxes,
    blurb: "Assembly bench, seeded from Alpha2.",
  },
  {
    href: "/automations-alpha",
    label: "Alpha1",
    icon: FlaskConical,
    blurb: "The first redesign proposal.",
  },
  {
    href: "/automations-alpha2",
    label: "Alpha2",
    icon: Beaker,
    blurb: "Dark status hero, a comparison table and an error feed.",
  },
  {
    href: "/automations-alpha3",
    label: "Alpha3",
    icon: TestTube,
    blurb: "Master and detail.",
  },
  {
    href: "/automations-alpha4",
    label: "Alpha4",
    icon: Microscope,
    blurb: "Search first.",
  },
  {
    href: "/automations-alpha5",
    label: "Alpha5",
    icon: Atom,
    blurb: "A work queue.",
  },
  {
    href: "/automations-alpha6",
    label: "Alpha6",
    icon: Dna,
    blurb: "Inventory quality.",
  },
  {
    href: "/automations-alpha7",
    label: "Alpha7",
    icon: Telescope,
    blurb: "A changelog.",
  },
];

/** The benches only: everything except the live hub. What the Feature
 *  Integration page lists. */
export const AUTOMATION_BENCH_VERSIONS = AUTOMATION_VERSIONS.filter(
  (v) => !v.official,
);

/** True while `pathname` is any registered version, the live hub included.
 *  The sidebar's ONLY use of this registry: it keeps the Automations tab
 *  highlighted on a bench route, which a plain prefix match cannot do because
 *  "/automations-beta" is not a child of "/automations". */
export function isAutomationVersionPath(pathname: string): boolean {
  return AUTOMATION_VERSIONS.some(
    (v) => pathname === v.href || pathname.startsWith(`${v.href}/`),
  );
}
