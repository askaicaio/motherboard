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
//   1. the Feature Integration page, which renders EVERY version as the ONLY
//      way to reach them. **Since 2026-09-30 that is ONE dense list grouped by
//      experiment, archived ones included** (promoted from Version Directory
//      Alpha4). ⚠️ It used to be one card per family plus a separate archive
//      page, which is why so many comments below still talk about "its own
//      card"; where they do, read it as "its own group";
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
  AlignJustify,
  FolderTree,
  Gauge,
  Grid2x2Check,
  Grid3x3,
  Layers,
  LayoutGrid,
  ListChecks,
  PanelLeft,
  PanelTop,
  Microscope,
  Palette,
  Rows3,
  Route,
  ScrollText,
  Search,
  Signpost,
  Table2,
  Telescope,
  TestTube,
  TriangleAlert,
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
  /** ⭐ PARKED: finished, reachable, and NOT waiting on engineering. Added
   *  2026-09-13 for the AlphaA1/AlphaA2 pair: "They will remain in alpha
   *  indefinitely unless corpo says its something they want."
   *
   *  **THE DISTINCTION IS ABOUT WHO THE NEXT MOVE BELONGS TO, not about how
   *  finished a page is.** An ordinary bench is a design still being explored,
   *  and the next move is ours. A parked one is done and waiting on a BUSINESS
   *  decision, and the next move is theirs. Mixing the two in one list makes the
   *  directory read as a to-do list with two items that never move.
   *
   *  ⚠️ IT IS NOT "deprecated" AND NOT "on hold". Nothing here is abandoned and
   *  nothing is blocked; do not repurpose this flag for either. If a page is
   *  ever genuinely dead, it should be deleted, not flagged. */
  parked?: boolean;
  /** ⭐ A SET OF PAGES THAT ONLY MAKE SENSE NEXT TO EACH OTHER, rendered in
   *  their own card on the Feature Integration page instead of among the
   *  benches. Added 2026-09-24 when the user asked for AlphaA3 to sit with the
   *  AlphaA pair: "Move the AlphaA3 access button into this section."
   *
   *  🛑🛑 THIS EXISTS BECAUSE `parked` WAS DOING TWO JOBS AND THEY CAME APART.
   *  Until AlphaA3 the same flag meant both "waiting on a business decision"
   *  AND "render in the separate card", which was fine while those were the
   *  same two pages. **AlphaA3 belongs in that card and is NOT parked** - its
   *  next move is ours. Marking it `parked` to move the tile would have made
   *  the flag lie about whose move it is, which is the one thing it is for.
   *  ⚠️ SO THE TWO ARE INDEPENDENT NOW: a family member may or may not be
   *  parked, and a parked page need not be in a family. Read each for what it
   *  says and do not infer one from the other.
   *
   *  📌 THE SECOND FAMILY, `"dropdown-config"`, ARRIVED 2026-09-25 with six
   *  layout benches for the Dropdown Configuration page, and it is what the
   *  field was worth adding for: **six tiles for one page would have swamped
   *  the bench list**, where every other entry is a different design of the
   *  MAIN page. None of them is parked. */
  family?:
    | "light-dark"
    | "dropdown-config"
    | "feature-integration"
    | "version-directory";
  /** ⭐ ARCHIVED: this version did its job and is kept for the record. Added
   *  2026-09-28: "The new page is meant to house Archived alphas that already
   *  have served their purpose."
   *
   *  **IT IS ABOUT A QUESTION BEING SETTLED, not about age or quality.** An
   *  archived page is one whose comparison is OVER: a design was picked, or the
   *  thing it was testing shipped. The pages still work and are still reachable,
   *  they have just stopped being a live question.
   *
   *  🛑🛑 INTAKE IS USER-DRIVEN. **NEVER ARCHIVE A PAGE ON YOUR OWN JUDGEMENT.**
   *  The user says what is finished; the same rule the Impossible List runs on,
   *  and for the same reason - "it looks done to me" is exactly the call that is
   *  not mine to make. Ask, and ask again next time rather than carrying a
   *  previous answer forward.
   *  ⚠️ IT IS NOT `parked`. Parked means the next move belongs to the BUSINESS
   *  and the page is waiting on a decision. Archived means there is no decision
   *  left to wait for. **The AlphaA light/dark trio is parked and must not be
   *  archived while that is true.**
   *  📌 IT IS NOT DELETION EITHER. If a page is genuinely dead, delete it; this
   *  flag is for pages worth keeping and worth getting out of the way. */
  archived?: boolean;
  /** ⭐ SHIPPED: this design's LAYOUT is what a real page now renders. Added
   *  2026-09-30 so the directory can say which experiments actually landed,
   *  which until now existed only as prose in comments and in the Done List.
   *
   *  ⚠️⚠️ IT IS NOT THE OPPOSITE OF `archived`, AND NOT A SYNONYM FOR IT. All
   *  three of these have shipped and two of them are also archived: winning is
   *  what makes a bench finished, so the two flags go together more often than
   *  not. **Read them separately.**
   *  📌 IT IS A FACT ABOUT THE LAYOUT, NOT ABOUT THE FILE. The bench page is
   *  still a bench: it has no working controls, and the live page it fed keeps
   *  its own behaviour. See the note at the top of Feature Integration Alpha2.
   *  🛑 ONLY THE USER'S OWN PROMOTIONS GO HERE. Each of the three below is an
   *  explicit instruction, recorded in [[automations-done]]; do not infer a
   *  promotion from a resemblance. */
  shipped?: { href: string; label: string };
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
    archived: true,
  },
  {
    href: "/automations-beta2",
    label: "Main Page Beta2",
    icon: Blocks,
    blurb: "Assembly bench. Alpha3's master and detail, with working controls.",
    // Promoted 2026-09-10 (#497): "We are now going to update the official
    // page. It will now mirror the layout of the Beta2 page."
    shipped: { href: "/automations", label: "the Automations hub" },
    // ⚠️ The page is UNCHANGED; only its NAME moved (Beta1 -> Beta2). See the
    // renumbering note at the top of this file.
    archived: true,
  },
  {
    href: "/automations-beta3",
    label: "Main Page Beta3",
    icon: Boxes,
    blurb: "Assembly bench, seeded from Alpha2.",
    archived: true,
  },
  {
    href: "/automations-alpha1",
    label: "Main Page Alpha1",
    icon: FlaskConical,
    blurb: "The first redesign proposal.",
    archived: true,
  },
  {
    href: "/automations-alpha2",
    label: "Main Page Alpha2",
    icon: Beaker,
    blurb: "Dark status hero, a comparison table and an error feed.",
    archived: true,
  },
  {
    href: "/automations-alpha3",
    label: "Main Page Alpha3",
    icon: TestTube,
    blurb: "Master and detail.",
    archived: true,
  },
  {
    href: "/automations-alpha4",
    label: "Main Page Alpha4",
    icon: Microscope,
    blurb: "Search first.",
    archived: true,
  },
  {
    href: "/automations-alpha5",
    label: "Main Page Alpha5",
    icon: Atom,
    blurb: "A work queue.",
    archived: true,
  },
  {
    href: "/automations-alpha6",
    label: "Main Page Alpha6",
    icon: Dna,
    blurb: "Inventory quality.",
    archived: true,
  },
  {
    href: "/automations-alpha7",
    label: "Main Page Alpha7",
    icon: Telescope,
    blurb: "A changelog.",
    archived: true,
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
  // ⭐⭐ AS OF 2026-09-28 THESE THREE ARE THE ONLY UNARCHIVED VERSIONS LEFT. The
  // user archived both other cards in one go; this one was deliberately left
  // out, **because parked and archived are opposites here**: archived means
  // nothing is waiting, and these are waiting on the business.
  // 🛑 BOTH ARE `parked` AS OF 2026-09-13: "Lets leave the AlphaA1 and AlphaA2
  // now. They will remain in alpha indefinitely unless corpo says its something
  // they want. In the feature integration page, Put their own separate window
  // from the rest of the test pages."
  // ⚠️ **PARKED MEANS THE NEXT MOVE IS THE BUSINESS'S, NOT OURS.** The pair is
  // finished and works; see `parked` on the interface above.
  // 📌 THE SEPARATE WINDOW IS NOW DRIVEN BY `family`, NOT BY `parked`. It was the
  // same flag until 2026-09-24, when AlphaA3 joined the card without being
  // parked; see `family` on the interface for why those had to come apart.
  {
    href: "/automations-alpha-a1",
    label: "Main Page AlphaA1",
    icon: Palette,
    blurb: "Dark mode: the live hub on an eleven-colour palette.",
    parked: true,
    family: "light-dark",
  },
  {
    href: "/automations-alpha-a2",
    label: "Main Page AlphaA2",
    icon: Palette,
    blurb: "Light mode: the same layout, paired to AlphaA1 by a toggle.",
    parked: true,
    family: "light-dark",
  },

  // ⭐⭐ ALPHAA3 IS THE PAIR DONE THE ORDINARY WAY, added 2026-09-24. The user,
  // about A1 and A2: "just from gut feeling, that doesnt seem like the normal way
  // devs do night mode." It is not, so this is one route whose theme is a class
  // on the page root. **It is the same design as the pair, not a third design.**
  // 🛑 IT IS DELIBERATELY *NOT* `parked`, AND THE DISTINCTION IS THE FLAG'S OWN:
  // parked means the next move belongs to the BUSINESS. This page was asked for
  // on 2026-09-24 and the user may well iterate on it, so the next move is ours.
  // ⚠️ IT IS STILL IN THE `light-dark` FAMILY, so it renders in that card rather
  // than among the benches - the user asked for the tile to move there the same
  // day: "Move the AlphaA3 access button into this section." **Those two facts
  // are not in tension**; see `family` on the interface for why the one flag had
  // to become two.
  // 📌 THIS COMMENT USED TO ADD that the pair's card could keep the word "Pair"
  // because it held exactly two pages. **It holds three now and the heading
  // dropped the word.**
  // ⚠️ IT DOES NOT SUPERSEDE THE PAIR. Those two are the thing it is evidence
  // against, so the comparison only works while all three exist.
  {
    href: "/automations-alpha-a3",
    label: "Main Page AlphaA3",
    icon: Palette,
    blurb:
      "One route, both themes: the AlphaA pair as a real light/dark toggle.",
    family: "light-dark",
  },

  // ⭐⭐ SIX LAYOUTS FOR THE *DROPDOWN CONFIGURATION* PAGE, added 2026-09-25.
  // The user: "Can you suggest other better ways to layout the UI on this page?
  // How many Alpha pages can you create so i can see the samples?"
  //
  // 🏷️🏷️ THEY ARE "Dropdown Config AlphaN", NOT "Main Page Alpha8..13", AND THE
  // NAMING RULE BELOW IS WHY. `Main Page ...` means *a design FOR the main
  // page*; these are designs for a different page entirely, so they take that
  // page's name. **The same rule that made the toolbar gallery `Toolbar Options
  // 1` rather than another Beta.**
  //
  // 📌 WHAT THEY ARE ANSWERING: that page runs THREE data shapes through one
  // table. Four colour sets (1, 11, 15 and 5 options), two synced status lists
  // (**428** and 45) and a 77-row link list. One table cannot be right for all
  // three, and the six split that knot in different places.
  //
  // ⚠️ ALL SIX SHARE THE LIVE PAGE'S DATA AND BEHAVIOUR. Each forks the client
  // and replaces only its render layer, so a behaviour bug found on one is a bug
  // on the live page too.
  // 🛑 NONE IS `parked`: they were asked for today and the next move is ours.
  // They carry `family` purely so six tiles for one page do not swamp a bench
  // list where everything else redesigns the MAIN page.
  {
    href: "/automations-dropdown-config-alpha1",
    label: "Dropdown Config Alpha1",
    icon: ListChecks,
    blurb:
      "The seven tabs become a left rail, so navigation stops setting the page width.",
    // Promoted 2026-09-25: "This looks good, make the Live page use this
    // layout." Archived three days later, which is why both flags are set.
    shipped: {
      href: "/automations/dropdown-config",
      label: "Dropdown Configuration",
    },
    family: "dropdown-config",
    archived: true,
  },
  {
    href: "/automations-dropdown-config-alpha2",
    label: "Dropdown Config Alpha2",
    icon: ListChecks,
    blurb:
      "A narrow list beside a live detail pane, which retires the dialog and Edit mode.",
    family: "dropdown-config",
    archived: true,
  },
  {
    href: "/automations-dropdown-config-alpha3",
    label: "Dropdown Config Alpha3",
    icon: ListChecks,
    blurb:
      "Colour sets render as the badges they produce; the big lists keep the table.",
    family: "dropdown-config",
    archived: true,
  },
  {
    href: "/automations-dropdown-config-alpha4",
    label: "Dropdown Config Alpha4",
    icon: ListChecks,
    blurb:
      "All seven columns stacked with a jump bar, each capped at ten rows.",
    family: "dropdown-config",
    archived: true,
  },
  {
    href: "/automations-dropdown-config-alpha5",
    label: "Dropdown Config Alpha5",
    icon: ListChecks,
    blurb:
      "GHL Tags as a queue: grouped by status, multi-select, set a status in bulk.",
    family: "dropdown-config",
    archived: true,
  },
  {
    href: "/automations-dropdown-config-alpha6",
    label: "Dropdown Config Alpha6",
    icon: ListChecks,
    blurb:
      "One box across all seven columns, because finding one tag is the real job.",
    family: "dropdown-config",
    archived: true,
  },

  // ⭐⭐ EIGHT LAYOUTS FOR THE *FEATURE INTEGRATION* PAGE, added 2026-09-29.
  // The user, on that page: "Got any suggestions on UI layout for this page?
  // pls make as many Alphas as you can suggest".
  //
  // 🏷️ THEY ARE "Feature Integration AlphaN", by the same naming rule that made
  // the dropdown set "Dropdown Config AlphaN": **`Main Page ...` means a design
  // FOR the main page**, and these are designs for a different page.
  //
  // 📌 WHAT THEY ARE ANSWERING: the page holds FORTY BOOLEANS in two tables
  // that share the same five columns, and since 2026-09-28 its subtitle calls
  // it "a documentation of hidden features". **Two grids of ticks are not
  // documentation**, and the eight split that gap in different places: merge,
  // transpose, drop the grid, write it out, lead with the gaps, compress it,
  // put a website in a detail panel, or lead with the headline.
  //
  // 🗄️🗄️ SEVEN OF THE EIGHT WERE ARCHIVED ON 2026-09-30: "These are not
  // benched anymore, consider them archived." **Alpha2 was left out because
  // its layout is what the live page runs**, and the user chose the twelve
  // benches rather than both groups outright when asked.
  // ⚠️ CONTRAST WITH THE DROPDOWN CONFIG SIX, where the winner WAS archived
  // with the losers. **Same question, different answer, five days apart** -
  // which is exactly why the flag's note says to ask every time rather than
  // carry a previous answer forward.
  //
  // ✅✅ ALPHA2 WON, 2026-09-30, one day later: "the presentation here is good,
  // pls implement it to the actual page." The live page is now transposed, one
  // row per website, and its width floor moved 722 -> 1009 to fit.
  // 🛑 THE OTHER SEVEN STAY, AND SO DOES ALPHA2. Archiving is the user's call,
  // not a consequence of a winner emerging; the same thing happened with
  // Dropdown Config Alpha1, which shipped on 2026-09-25 and was archived three
  // days later when the user said so.
  //
  // ⚠️ ALL EIGHT READ THE LIVE PAGE'S SAVED STATE and none of them writes, so
  // the marks are the real ones. Only the layout differs.
  // ⚠️ EACH CARRIES ITS OWN ICON rather than one icon for the family, unlike
  // the dropdown six. **With eight tiles in one card a shared icon stops being
  // a grouping cue and becomes eight identical glyphs**, and each of these has
  // a shape that says what it does.
  // 🛑 ALPHA4 CONTAINS UNREVIEWED COPY. It is the only one that adds sentences
  // rather than rearranging marks; its own header says so and the page carries
  // a draft notice. **Do not lift those strings onto the live page.**
  // 🛑 NONE IS `parked`: they were asked for today and the next move is ours.
  {
    href: "/automations-feature-integration-alpha1",
    label: "Feature Integration Alpha1",
    icon: Grid2x2Check,
    blurb:
      "Both tables merged into one matrix, so a website reads as a single column.",
    family: "feature-integration",
    archived: true,
  },
  {
    href: "/automations-feature-integration-alpha2",
    label: "Feature Integration Alpha2",
    icon: Rows3,
    blurb:
      "Transposed: one row per website. This is the one the live page now uses.",
    // Promoted 2026-09-30: "the presentation here is good, pls implement it to
    // the actual page."
    shipped: {
      href: "/automations/feature-integration",
      label: "Feature Integration",
    },
    family: "feature-integration",
  },
  {
    href: "/automations-feature-integration-alpha3",
    label: "Feature Integration Alpha3",
    icon: LayoutGrid,
    blurb:
      "A card per website and no grid, so the page reflows instead of scrolling.",
    family: "feature-integration",
    archived: true,
  },
  {
    href: "/automations-feature-integration-alpha4",
    label: "Feature Integration Alpha4",
    icon: ScrollText,
    blurb: "Written documentation, with a reason under every gap. Draft copy.",
    family: "feature-integration",
    archived: true,
  },
  {
    href: "/automations-feature-integration-alpha5",
    label: "Feature Integration Alpha5",
    icon: TriangleAlert,
    blurb: "Gaps first, worst website at the top; what works is one line.",
    family: "feature-integration",
    archived: true,
  },
  {
    href: "/automations-feature-integration-alpha6",
    label: "Feature Integration Alpha6",
    icon: Grid3x3,
    blurb: "A dense dot board: all forty answers at a glance, no scrolling.",
    family: "feature-integration",
    archived: true,
  },
  {
    href: "/automations-feature-integration-alpha7",
    label: "Feature Integration Alpha7",
    icon: PanelLeft,
    blurb:
      "A website rail beside a detail panel, the pattern Dropdown Config shipped.",
    family: "feature-integration",
    archived: true,
  },
  {
    href: "/automations-feature-integration-alpha8",
    label: "Feature Integration Alpha8",
    icon: Gauge,
    blurb: "The headline first, the grid demoted underneath it.",
    family: "feature-integration",
    archived: true,
  },

  // ⭐⭐ SIX LAYOUTS FOR THE VERSION DIRECTORY ITSELF, added 2026-09-30. The
  // user circled the "Feature Integration Layouts" card: "Any suggestions on
  // how to show these layouts differently? pls make Alpha pages for them".
  //
  // 🏷️🏷️ "Version Directory AlphaN", NOT "Feature Integration AlphaN". The
  // naming rule says the prefix names WHAT IS BEING REDESIGNED, and this is the
  // directory, which happens to be hosted on the Feature Integration page. The
  // eight Feature Integration alphas redesign that page's capability TABLE, and
  // reusing their prefix would make two different experiments look like one.
  // **Same reasoning that made the toolbar gallery "Toolbar Options 1".**
  //
  // 📌 WHAT THEY ARE ANSWERING: the directory is **one card per family**, and
  // there are now four families plus a separate Archived page. Every family
  // added is another card, every tile looks identical to every other, and
  // **nothing on a tile says which design actually shipped** even though three
  // of them have. The six split that knot differently.
  //
  // 🗄️🗄️ FIVE OF THE SIX WERE ARCHIVED ON 2026-09-30, hours after they were
  // built: "These are not benched anymore, consider them archived." **Alpha4
  // was left out because its layout is what the live directory runs.**
  //
  // ✅✅ ALPHA4 WON THE SAME DAY: "This layout is good, pls implement it". The
  // Feature Integration page's directory is now one dense list, and the four
  // per-family filters that fed the old cards were deleted with them.
  // 🛑 THE OTHER FIVE STAY, AND SO DOES ALPHA4. Archiving is the user's call,
  // not a consequence of a winner emerging.
  //
  // ⭐ EACH ONE LISTS EVERY VERSION, so each is its own way back to the other
  // five. That is why they carry no "other layouts" strip, unlike the Feature
  // Integration eight: **a directory that could not reach its siblings would be
  // failing at the job it is proposing to do.**
  // 🛑 NONE IS `parked` and none is `archived`.
  {
    href: "/automations-version-directory-alpha1",
    label: "Version Directory Alpha1",
    icon: Table2,
    blurb:
      "One table for every version, archived included, instead of a card per family.",
    family: "version-directory",
    archived: true,
  },
  {
    href: "/automations-version-directory-alpha2",
    label: "Version Directory Alpha2",
    icon: Signpost,
    blurb:
      "Grouped by status: in use, waiting on you, open questions, settled.",
    family: "version-directory",
    archived: true,
  },
  {
    href: "/automations-version-directory-alpha3",
    label: "Version Directory Alpha3",
    icon: FolderTree,
    blurb: "A family rail beside the list, so a new family costs no new card.",
    family: "version-directory",
    archived: true,
  },
  {
    href: "/automations-version-directory-alpha4",
    label: "Version Directory Alpha4",
    icon: AlignJustify,
    blurb:
      "Dense rows instead of tiles. This is the one the live directory now uses.",
    // 🛑 THIS WAS MISSING UNTIL 2026-09-30 AND THE ROW LIED BECAUSE OF IT.
    // Promoted the same day ("This layout is good, pls implement it"), but the
    // `shipped` field had been added only hours earlier and this entry never
    // got one, so the directory rendered its own winner as "bench" with no
    // "runs" tail. ⚠️ **A NEW FIELD IS NOT DONE UNTIL EVERY CASE THAT SHOULD
    // CARRY IT DOES**; three entries got it on the day it was added and the
    // fourth arrived two rounds later.
    shipped: {
      href: "/automations/design-versions",
      label: "Design Versions",
    },
    family: "version-directory",
  },
  {
    href: "/automations-version-directory-alpha5",
    label: "Version Directory Alpha5",
    icon: Search,
    blurb: "One box across every version, with family and status chips.",
    family: "version-directory",
    archived: true,
  },
  {
    href: "/automations-version-directory-alpha6",
    label: "Version Directory Alpha6",
    icon: Route,
    blurb: "Provenance first: which design each live page is actually running.",
    family: "version-directory",
    archived: true,
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
    archived: true,
  },
];

/* 🛑🛑 THE CARD-PER-FAMILY FILTERS WERE DELETED ON 2026-09-30, when the
 * Feature Integration page's directory became ONE dense list (promoted from
 * Version Directory Alpha4). `AUTOMATION_BENCH_VERSIONS`,
 * `AUTOMATION_LIGHT_DARK_VERSIONS`, `AUTOMATION_DROPDOWN_CONFIG_VERSIONS` and
 * `AUTOMATION_VERSION_DIRECTORY_VERSIONS` each fed one card and had no other
 * consumer, so they went with the cards.
 * ⭐ THE RULE THEY CARRIED IS WORTH KEEPING EVEN THOUGH THEY ARE GONE: every
 * one of them ended `&& !v.archived`, **because with five lists a missed
 * filter renders the same version in two places at once.** A single list
 * cannot have that bug, which is one of the quieter arguments for it.
 * ⚠️ `family` IS STILL LIVE AND STILL MATTERS. It no longer picks a card; it
 * feeds `versionGroupLabel` below, which is what groups the list.
 * 🛑 `AUTOMATION_ARCHIVED_VERSIONS` WENT TOO, LATER THE SAME DAY, when the
 * user renamed that page to Design Versions and chose for it to show ALL
 * versions rather than the archived 17. **Nothing filters on `archived` any
 * more** - which was not quite true when it was written: the Feature
 * Integration list still did, and it was corrected on the same day when
 * archiving twelve pages would have emptied it. The flag itself is very much alive: it is one of the five states
 * `versionStatusKey` reports, so an archived version now gets a grey word on
 * its row instead of a different page.
 * ⚠️ WHICH MEANS ARCHIVING IS NO LONGER A MOVE. It used to take a version off
 * one list and put it on another, and that was the whole reason five filters
 * had to agree. It is now a label. **If archiving should ever hide a version
 * again, that is a new decision, not a restoration.**
 * 📌 THE ONE THAT SURVIVES HAS A REAL CONSUMER: the Feature Integration list is
 * read by all eight of those benches for their sibling strip. */

/** The eight Feature Integration layout benches.
 *
 *  ⚠️ ITS ONLY READER IS THE BENCHES THEMSELVES, since 2026-09-30. It used to
 *  feed a card on the Feature Integration page; that card is gone with the
 *  other four, and **what is left is the "other layouts" strip each of those
 *  eight pages carries so you can hop between them without going back.**
 *
 *  🛑🛑 IT STOPPED EXCLUDING `archived` ON 2026-09-30, AND THAT WAS NOT
 *  OPTIONAL. The user archived seven of the eight the same day. With the old
 *  `&& !v.archived` the list would have held ONE entry, every strip filters
 *  itself out, and **all eight strips would have rendered as nothing** - the
 *  benches would have silently stopped linking each other.
 *  ⭐ THE RULE BEHIND IT: **archiving is a LABEL now, not a move** (see the
 *  note above). A label must not decide reachability. The one filter still
 *  reading the flag was a leftover from when it did, and archiving twelve
 *  pages is exactly the event that would have exposed it as a dead link
 *  instead of an error. */
export const AUTOMATION_FEATURE_INTEGRATION_VERSIONS =
  AUTOMATION_VERSIONS.filter((v) => v.family === "feature-integration");

/** ⭐ THE ONE-WORD STATE OF A VERSION, for a directory that wants to say more
 *  than a name and a blurb. **The order is the point**: a design can be both
 *  shipped and archived (two of the three are), and "its layout is what the
 *  live page runs" is the more useful of those two facts, so it wins.
 *
 *  ⚠️ THIS IS A LABEL DERIVATION, NOT LAYOUT. Colour, shape and wording belong
 *  to whichever page renders it; this only says which bucket a version is in,
 *  so six benches cannot disagree about that. */
export type VersionStatusKey =
  "live" | "shipped" | "parked" | "archived" | "bench";

/** The states a person may pick from the directory's status menu.
 *
 *  🛑 `live` IS DELIBERATELY NOT ON THIS LIST. It does not mean "good" or
 *  "current", it means **this row IS the live page**, which is a fact about
 *  routing rather than a judgement anyone should be able to assert about a
 *  bench. The Official row shows it by default and gets it back from "Reset to
 *  default"; nothing else can claim it.
 *  ⚠️ `shipped` IS on the list even though it normally comes with a target
 *  ("runs Dropdown Configuration"). **That tail is not part of the status** -
 *  it lives on `shipped` in the registry - so a hand-set `shipped` row shows
 *  the word without a target, which is honest: nobody typed a target. */
export const EDITABLE_VERSION_STATUSES = [
  "shipped",
  "parked",
  "bench",
  "archived",
] as const satisfies readonly VersionStatusKey[];

export function versionStatusKey(v: AutomationVersion): VersionStatusKey {
  if (v.official) return "live";
  if (v.shipped) return "shipped";
  if (v.parked) return "parked";
  if (v.archived) return "archived";
  return "bench";
}

/** ⭐ WHICH EXPERIMENT A VERSION BELONGS TO, as a readable name.
 *
 *  ⚠️⚠️ IT IS NOT JUST `family`, AND IT DELIBERATELY DOES NOT BECOME ONE. The
 *  unfamilied entries are Main Page designs plus one toolbar gallery, and
 *  giving them a `family` value would quietly empty
 *  `AUTOMATION_BENCH_VERSIONS` of any FUTURE main-page bench, because that
 *  list is defined as "no family". **A display label was the cheap half of
 *  that change; the filter semantics were the expensive half.** */
export function versionGroupLabel(v: AutomationVersion): string {
  if (v.official) return "Live page";
  if (v.family === "light-dark") return "Light / Dark Mode";
  if (v.family === "dropdown-config") return "Dropdown Configuration";
  if (v.family === "feature-integration") return "Feature Integration";
  if (v.family === "version-directory") return "Version Directory";
  if (v.href.startsWith("/automations-toolbar-options"))
    return "Toolbar Options";
  return "Main Page";
}

/** True while `pathname` is any registered version, the live hub included.
 *  The sidebar's ONLY use of this registry: it keeps the Automations tab
 *  highlighted on a bench route, which a plain prefix match cannot do because
 *  "/automations-beta2" is not a child of "/automations". */
export function isAutomationVersionPath(pathname: string): boolean {
  return AUTOMATION_VERSIONS.some(
    (v) => pathname === v.href || pathname.startsWith(`${v.href}/`),
  );
}
