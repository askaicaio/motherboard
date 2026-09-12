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
  Layers,
  PanelTop,
  Microscope,
  Palette,
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
//     route /automations-beta1  -> label "Main Page Beta1"  (BUILT 2026-09-10,
//                                   a fresh copy of the live hub's design)
//     route /automations-beta   -> GONE. Nothing serves it.
//
//     route /automations-alpha1 -> label "Main Page Alpha1" (was /automations-alpha)
//     route /automations-alpha  -> GONE. Nothing serves it.
//
// ⭐⭐ **EVERY VERSION'S ROUTE NOW MATCHES ITS LABEL, WITH NO EXCEPTIONS**, for
// the first time since the families were renamed on 2026-09-08. Alpha1's
// directory moved in the same session, right after the betas, once the user saw
// the betas reconciled: it was the last odd one out.
// 🛑 **KEEP IT THAT WAY. A version's route, label, badge and exported function
// name are FOUR strings that all carry its number, and the only cheap moment to
// change them is together.**
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
// ⚠️ BOTH MISMATCHES DATED FROM 2026-09-08, when the user renamed the first of
// each family ("Rename these, they should be referred to as Beta1 and Alpha1")
// and the directories were deliberately left behind. Both were reconciled on
// 2026-09-10, the betas first and Alpha1 immediately after.
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
    href: "/automations-beta1",
    label: "Main Page Beta1",
    icon: Layers,
    blurb: "Assembly bench, seeded from the live hub's current design.",
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
    href: "/automations-alpha1",
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
  // ⭐⭐ THE "A" FAMILY IS A LIGHT/DARK PAIR, not a series of recolours. Read
  // these two together; neither makes much sense alone.
  //   AlphaA1 = the DARK mode. The live hub's EXACT structure with every colour
  //             replaced from an eleven-colour palette the user curated off a
  //             game screenshot.
  //   AlphaA2 = the LIGHT mode. The live hub's design copied UNCHANGED, so the
  //             pairing can be tried out without experimenting on the page
  //             everyone actually uses.
  // 📌 THE FRAMING IS THE USER'S, 2026-09-12: "i was thinking that AlphaA1 is
  // the 'Dark mode', and the current live version of the page is the 'Light
  // mode'." AlphaA2 followed the next day: "We will be trying out compatability
  // of this page with AlphaA1 later."
  // ⚠️ BOTH KEEP THE "Main Page" PREFIX because both ARE main-page designs; what
  // varies between them is the palette, not the layout. **So a third "A" is only
  // warranted by a third member of THIS experiment**, not by any recolour.
  // 📌 The "A" itself is the user's naming, not a maturity marker.
  // ⭐ THEY ARE CONNECTED AS OF 2026-09-13. Each page carries a light/dark
  // toggle in its header cluster, and **it is two LINKS: the pair is two routes,
  // not one page with two palettes.** The selected website rides across the
  // switch on `?site=`. **So these two entries are one feature; open either and
  // you can reach the other.**
  {
    href: "/automations-alpha-a1",
    label: "Main Page AlphaA1",
    icon: Palette,
    blurb: "Dark mode: the live hub on an eleven-colour palette.",
  },
  {
    href: "/automations-alpha-a2",
    label: "Main Page AlphaA2",
    icon: Palette,
    blurb: "Light mode: the live hub unchanged, for pairing with AlphaA1.",
  },
  // ⚠️⚠️ AN "OPTIONS" ENTRY IS A DIFFERENT KIND OF THING FROM EVERYTHING ABOVE
  // IT, and the label says so. Every Alpha and Beta is a redesign of the whole
  // Main Page. **AN OPTIONS PAGE IS A SHOWCASE OF ONE COMPONENT, rendered
  // several ways on a single page so the user can pick between them.** This one
  // does that for the hub's toolbar strip.
  // 📌 SO IT IS NOT "Main Page ...": that prefix means "a design FOR the main
  // page", and this is a design for one strip on it. Using it would promise a
  // whole page and deliver a gallery. **The element goes first and the word
  // "Options" carries the category**, so a future set for a different element
  // is "Sidebar Options 1", NOT another Beta and NOT a running family count.
  //
  // 🏷️🏷️ THIS WAS CALLED "GAMMA1" UNTIL 2026-09-11 AND WAS RENAMED FOR A REASON
  // WORTH KEEPING. The user coined "Gamma1" and later asked for suggestions;
  // two problems settled it:
  //   1. **Greek letters imply a MATURITY STAGE.** The real ladder is alpha ->
  //      beta -> release candidate -> GA, and it stops at two letters. So
  //      "Gamma1" reads as MORE finished than Beta3, when in fact it is
  //      orthogonal to maturity: it is a different KIND of page, not a later
  //      one.
  //   2. **⚠️⚠️ "GAMMA" ALREADY MEANS SOMETHING ELSE IN THIS CODEBASE.** The
  //      Reports feature integrates Gamma.app for deck generation:
  //      `lib/reports/gamma-client.ts`, `lib/inngest/functions/generate-gamma.ts`,
  //      `GAMMA_API_KEY`, and the `gamma_status` / `gamma_url` /
  //      `gamma_credits_*` columns on `reports`. **Anyone grepping "gamma" is
  //      looking for that.** A toolbar gallery sharing the word was a real
  //      collision, and it is the stronger of the two reasons.
  // **Do not reintroduce a Greek letter for a version family here.**
  {
    href: "/automations-toolbar-options-1",
    label: "Toolbar Options 1",
    icon: PanelTop,
    blurb: "Nine ways to render the hub's toolbar strip, stacked to compare.",
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
