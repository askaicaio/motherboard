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

// ⭐⭐ THE BETAS WERE RENUMBERED AND THEIR ROUTES MOVED WITH THEM, 2026-09-10.
// Two instructions, an hour apart. First the names: "Rename the current Beta2
// into Beta3. Then the current Beta 1 into Beta2. We have plans for another
// Beta1 page later." Then the routes: "Rename their links as well, they don't
// match their actual name at the moment."
//
//     route /automations-beta2  -> label "Main Page Beta2"  (was /automations-beta,  Beta1)
//     route /automations-beta3  -> label "Main Page Beta3"  (was /automations-beta2, Beta2)
//     route /automations-beta1  -> DOES NOT EXIST YET, reserved for the new one
//     route /automations-beta   -> GONE. Nothing serves it.
//
// **So for the BETAS the route number and the label number now agree**, which
// they did not for the hour between the two instructions.
// ⚠️⚠️ THE ALPHAS STILL DISAGREE, AND THAT IS THE REMAINING TRAP:
//     route /automations-alpha  -> label "Main Page Alpha1"
// Alpha1 was renamed on 2026-09-08 and its directory was NOT moved. **It was
// offered alongside this change and left alone**, so alpha2..alpha7 match their
// labels and alpha does not. **Never infer a version's name from its URL; read
// the `label` field.**
// ⚠️ WHAT MOVING A ROUTE COSTS, since the earlier note argued against it and the
// user overrode that: any open tab or bookmark on `/automations-beta` now 404s,
// and every past PR title and Done List entry naming that route describes a path
// that no longer exists. Those records were left as written; they are history.
// 📌 IF A VERSION IS EVER RENUMBERED AGAIN, MOVE THE DIRECTORY IN THE SAME PR.
// The hour where the labels said one thing and the URLs said another is exactly
// what the user objected to, and it is avoidable by doing both at once.
// ⚠️ ORDER MATTERS WHEN SHIFTING NAMES UPWARD: take the HIGHEST number first
// (beta2 -> beta3, then beta -> beta2), or the second move collides with a
// directory that still exists.
//
// ⚠️ THE ALPHA MISMATCH DATES FROM 2026-09-08, when the user renamed the first
// of each family: "Rename these, they should be referred to as Beta1 and
// Alpha1". The betas have since been reconciled; the alphas have not.
// **The ROUTES were left alone on purpose.** They are stable identifiers: open
// tabs, bookmarks, every PR title and the whole Done List history refer to
// them, and moving the directories would break all of that to fix a cosmetic
// mismatch. **Do not "tidy" the routes to match the labels** without being
// asked; if that is ever wanted it is a rename of two directories plus a sweep
// of the docs, not a one-line change.
// ⚠️ OLDER CODE COMMENTS ACROSS THESE PAGES STILL SAY "Alpha" and "Alpha 1"
// in prose. They were left as written: they are a historical record, and
// rewriting them would be a large diff with no functional effect.

// ⚠️⚠️ THE LABEL IS THE *QUALIFIED* NAME AND THE PAGE BADGE IS THE *SHORT*
// ONE. THEY ARE DELIBERATELY DIFFERENT as of 2026-09-08: "Append this to the
// start of their titles. 'Main Page'". So:
//     registry label   "Main Page Beta2"   <- what the directory tile shows
//     badge on the page "Beta2"            <- what the page's own pill shows
// **WHY BOTH EXIST.** Every one of these versions is a redesign of the
// Automations MAIN PAGE specifically, as opposed to the Per Website page, the
// Error History page or the Dropdown Config page. In the directory that
// qualifier is the useful part, because it says WHICH page's design you are
// about to open. On the page itself it is noise: the badge sits directly beside
// an `<h1>` reading "Automations", so a pill reading "MAIN PAGE BETA1" would
// repeat what the heading already says.
// **⚠️ AN EARLIER VERSION OF THIS NOTE TOLD YOU TO KEEP THE TWO STRINGS
// IDENTICAL. That was true for one day and is now wrong.** What must stay in
// step is the VERSION TOKEN they share: rename a version and you change the
// badge AND the tail of this label. The prefix belongs to the label only.
// **The 2026-09-10 renumbering did exactly that for both betas.**

export interface AutomationVersion {
  href: string;
  /** The QUALIFIED name, shown on the Feature Integration directory tile, e.g.
   *  "Main Page Beta2". **Not derivable from `href`, and not the same as the
   *  badge on the page itself** - see the note above. */
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
    href: "/automations-beta2",
    label: "Main Page Beta2",
    icon: Blocks,
    blurb: "Assembly bench. Alpha3's master and detail, with working controls.",
    // ⚠️ The page is UNCHANGED; only its NAME moved (Beta1 -> Beta2). See the
    // renumbering note at the top of this file.
  },
  {
    href: "/automations-beta3",
    label: "Main Page Beta3",
    icon: Boxes,
    blurb: "Assembly bench, seeded from Alpha2.",
  },
  {
    href: "/automations-alpha",
    label: "Main Page Alpha1",
    icon: FlaskConical,
    blurb: "The first redesign proposal.",
  },
  {
    href: "/automations-alpha2",
    label: "Main Page Alpha2",
    icon: Beaker,
    blurb: "Dark status hero, a comparison table and an error feed.",
  },
  {
    href: "/automations-alpha3",
    label: "Main Page Alpha3",
    icon: TestTube,
    blurb: "Master and detail.",
  },
  {
    href: "/automations-alpha4",
    label: "Main Page Alpha4",
    icon: Microscope,
    blurb: "Search first.",
  },
  {
    href: "/automations-alpha5",
    label: "Main Page Alpha5",
    icon: Atom,
    blurb: "A work queue.",
  },
  {
    href: "/automations-alpha6",
    label: "Main Page Alpha6",
    icon: Dna,
    blurb: "Inventory quality.",
  },
  {
    href: "/automations-alpha7",
    label: "Main Page Alpha7",
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
 *  "/automations-beta2" is not a child of "/automations". */
export function isAutomationVersionPath(pathname: string): boolean {
  return AUTOMATION_VERSIONS.some(
    (v) => pathname === v.href || pathname.startsWith(`${v.href}/`),
  );
}
