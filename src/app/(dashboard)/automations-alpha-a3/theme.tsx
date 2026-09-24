// =============================================================
// AlphaA3's THEME LAYER: two palettes, one route, one component tree.
// =============================================================
// ⭐⭐ THIS FILE IS THE WHOLE POINT OF ALPHAA3. The AlphaA1/AlphaA2 pair renders
// the same design twice, at two URLs, and swaps between them by NAVIGATING.
// The user, 2026-09-24: "just from gut feeling, that doesnt seem like the normal
// way devs do night mode." It is not. **This page is the normal way**: one
// route, one tree, every colour a token, and a class on the page root that
// swaps the token VALUES.
//
// ⚠️⚠️ WHY THE PAIR COULD NOT SIMPLY BE MERGED, because this is the thing that
// looks easy and is not. AlphaA1's markup is **already 100% tokenised** (zero
// literal colour classes; verified by stripping comments and grepping). So the
// obvious move is "add a light palette to AlphaA1 and done". **That does not
// work, and the reason is that A1's tokens are named after COLOURS rather than
// after ROLES.** Measured across the pair:
//   `--pa-label` (one amber) is SEVEN different colours on the light page:
//      zinc-400, zinc-500, zinc-600, zinc-700, zinc-800, zinc-900, amber-800.
//   `--pa-red` is four: red-600, red-700, zinc-500 and zinc-600.
//   `--pa-line` is five: white, zinc-200, zinc-300, the border token, and a
//      10%-of-foreground ring.
// **A dark theme that collapses distinctions cannot be un-collapsed by renaming
// its variables.** So the token set below is re-cut by ROLE, and it is the UNION
// of the distinctions the two designs make. Each theme then collapses the ones
// it does not care about: in dark, six of the text roles all resolve to amber,
// which is how the page keeps its "three colours by meaning" rule while the
// light theme keeps its six greys.
// 📌 THAT IS THE GENERAL LESSON, worth more than this page: **name a theme
// token for the JOB it does, never for the colour it happens to be.** The
// moment a second theme exists, a token called `--red` that has to be grey is a
// contradiction you cannot refactor your way out of one class at a time.
//
// 🔧 HOW THE SWAP WORKS, in three parts:
//   1. `ThemeStyles` below defines both palettes in THREE cases: light as the
//      base, dark under `[data-a3-theme="dark"]`, and dark again under a
//      `prefers-color-scheme` media query guarded by `:not([data-a3-theme])`
//      for a visitor who has not chosen yet.
//   2. `page.tsx` reads the cookie ON THE SERVER and renders the attribute, so
//      the first HTML is already correct - on a full load AND on a client-side
//      navigation, because a cookie rides along with the RSC request too.
//   3. `theme-toggle.tsx` sets that attribute on click and writes the cookie.
// ⭐ **NOTHING RUNS BEFORE PAINT, because nothing needs to.** The flash people
// fight with an inline script is designed out rather than patched over.
//
// 🛑🛑 IT DELIBERATELY DOES **NOT** USE SHADCN'S `dark` CLASS, and the first
// version did. `globals.css` declares `@custom-variant dark (&:is(.dark *))`
// with a full `.dark { ... }` block, and putting that class on this page's root
// looked ideal: every shadcn component inside would flip while the sidebar
// stayed light. **It was removed for a measured reason.** A class React renders
// is a class React OWNS, so the pre-paint script that has to correct it on a
// first visit loses to hydration - see `A3_THEME_ATTR`. Switching to an
// attribute the server sets from a cookie, plus a media query for the
// never-chosen case, removes the script, the race and the whole problem.
// 📌 WHAT THAT COSTS, stated plainly: shadcn's own `dark:` variants no longer
// fire inside this page, so popovers and tooltips stay light on the dark theme.
// **AlphaA1 behaves exactly the same way** (it overrides the five core tokens
// and nothing else), so this page still matches it precisely, which is the
// claim it makes. Fixing that wart is a separate job for both pages at once.
//
// ⚠️ PAGE SCOPE IS STILL THE POINT, and it is unchanged: every selector is
// under `#a3-root`, so the sidebar and every other route stay light. The user
// chose page scope over app scope deliberately - app scope is the real
// production shape, but it persists after you navigate away and every other
// page would need checking in dark first.
//
// 🎨 THE LIGHT PALETTE REFERENCES TOKENS, IT DOES NOT HARD-CODE HEXES. Tailwind
// v4 emits its whole scale as `--color-*` custom properties on `:root`
// (confirmed by reading them off the running app rather than assuming), so
// `var(--color-zinc-500)` IS the colour `text-zinc-500` paints. **Hard-coding
// #71717a here would silently drift the day the scale is retuned**, and it
// would also be wrong today, because v4's scale is oklch and the familiar v3
// hexes are not the same colours.
// =============================================================

/** The page root's id. **Both the CSS below and the toggle's click handler find
 *  the root through this**, so it is not cosmetic. An id rather than a class
 *  because there is exactly one of these per page and the (1,0,0) specificity
 *  is what keeps the palette above `globals.css`. */
export const A3_ROOT_ID = "a3-root";

/** The attribute the chosen theme is written to.
 *
 *  ⚠️⚠️ AN ATTRIBUTE, NOT A CLASS, AND IT WAS A CLASS FIRST. **The rewrite was
 *  forced by a measured bug, so do not undo it.** The first version put
 *  shadcn's own `dark` class on this element and had an inline script flip it
 *  before paint. That cannot work, because **the class is part of what React
 *  renders, so React owns it**: the script removed it during parse and
 *  hydration put it straight back, leaving a light-OS first visit stuck on the
 *  dark palette. Measured, not guessed - the class was still `dark` with
 *  `prefers-color-scheme: light`.
 *  📌 AN ABSENT ATTRIBUTE IS A REAL STATE: it means "no choice made, follow the
 *  OS", and the media query in the CSS handles it with no JavaScript at all.
 *  That is why nothing here needs a no-flash script. */
export const A3_THEME_ATTR = "data-a3-theme";

/** COOKIE name holding `"dark"` / `"light"`, or nothing at all.
 *
 *  ⭐ ABSENT IS A REAL STATE AND NOT A BUG: it means "follow the OS", which is
 *  what a first visit does. Writing a value is what takes the page off the OS
 *  setting, which is why the toggle never writes on load.
 *
 *  ⚠️⚠️ A COOKIE RATHER THAN `localStorage`, AND IT WAS localStorage FIRST.
 *  **The rewrite was forced by a real bug, so do not undo it.** localStorage is
 *  invisible to the server, so the only way to apply it before paint was an
 *  inline script - and React logs *"Encountered a script tag while rendering
 *  React component. Scripts inside React components are never executed when
 *  rendering on the client"* and **does not run it** when you arrive by
 *  CLIENT-SIDE NAVIGATION, which is what the sidebar does. So clicking into
 *  this page from anywhere in the app ignored your saved theme entirely.
 *  ⭐ A COOKIE IS SENT WITH THE RSC REQUEST TOO, so the SERVER picks the theme
 *  on every path in, and the attribute is right in the first HTML either way.
 *  There is nothing left to correct on the client and therefore no script. */
export const A3_THEME_COOKIE = "a3-theme";

export const A3_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** How long the choice is remembered. A preference, not a session. */

/* -------------------------------------------------------------------------
 * The palettes.
 * -----------------------------------------------------------------------*/

/** ⚠️ DARK IS ALPHAA1'S ELEVEN COLOURS, VERBATIM. These are the values in that
 *  page's `PALETTE`, read by the user off a pixel-art mech-factory game UI and
 *  curated by them from seventeen down to nine (plus two blues added later).
 *  **Do not retune them here.** If the palette changes, it changes on AlphaA1
 *  first and this follows, because that page is the one the user has been
 *  judging the colours on. */
const DARK = {
  void: "#0A0E13",
  card: "#16202A",
  inset: "#2A3038",
  line: "#4A5560",
  muted: "#8A96A2",
  label: "#E8A33C",
  bright: "#DCE2E8",
  red: "#C0392F",
  green: "#4FAF4A",
  blue: "#5CA0DC",
  blueBright: "#9AC4EA",
} as const;

/** The CSS. Written as a string rather than added to `globals.css` because
 *  **version pages are self-contained** - the same rule that gives this folder
 *  its own `nav-indicator.tsx` and `hover-prefetch-link.tsx`. A bench must not
 *  be able to break the live hub, and a global stylesheet is a shared surface.
 *
 *  ⚠️ EVERY SELECTOR IS SCOPED TO `#a3-root`. Nothing here can escape the page
 *  even though it is injected into the document, which is what makes shipping
 *  a `<style>` from a page component safe rather than sloppy. */
const CSS = `
/* ---- LIGHT: the live hub's own scheme, spelled as roles ---------------- */
/* ---- LIGHT is the base, and it is also the fallback ------------------- */
#${A3_ROOT_ID} {
  color-scheme: light;

  /* surfaces */
  --a-page: var(--color-zinc-50);
  --a-well: var(--card);
  --a-tile: var(--color-white);
  --a-lift: var(--color-zinc-50);
  --a-lift-strong: var(--color-zinc-50);
  --a-sel: var(--color-zinc-100);
  --a-chrome: var(--card);
  --a-header: color-mix(in oklab, var(--muted) 40%, var(--card));
  --a-track: var(--color-zinc-100);
  --a-track-off: var(--color-zinc-300);

  /* frame */
  --a-ring: color-mix(in oklab, var(--foreground) 10%, transparent);
  --a-ring-w: 1px;
  --a-ring-outer-w: 1px;
  --a-divider: var(--border);
  --a-header-line: var(--border);

  /* text */
  /* ⚠️ THE PAGE'S INHERITED TEXT COLOUR, a role in its own right and not the
     same as any of the six below. In light, nothing on the live hub sets a page
     text colour, so it inherits the body's --foreground; naming a zinc step here
     instead would tint every otherwise-unstyled string on the page. */
  --a-text-base: var(--foreground);
  --a-text-strong: var(--color-zinc-900);
  --a-text-head: var(--color-zinc-800);
  --a-text-body: var(--color-zinc-700);
  --a-text-dim: var(--color-zinc-600);
  --a-text-muted: var(--color-zinc-500);
  --a-text-faint: var(--color-zinc-400);
  --a-icon: var(--color-zinc-500);
  --a-icon-faint: var(--color-zinc-300);

  /* values */
  --a-value: var(--color-zinc-900);
  --a-value-faint: var(--color-zinc-400);
  --a-value-hero: var(--color-zinc-900);

  /* meaning */
  --a-problem: var(--color-red-600);
  --a-problem-note: var(--color-zinc-500);
  --a-ok-text: var(--color-emerald-700);
  --a-warn-text: var(--color-amber-800);
  --a-bad-text: var(--color-red-700);
  --a-off-text: var(--color-zinc-600);
  --a-ok-dot: var(--color-emerald-500);
  --a-warn-dot: var(--color-amber-500);
  --a-bad-dot: var(--color-red-500);
  --a-off-dot: var(--color-zinc-400);
  --a-refresh-on: var(--color-emerald-600);
  --a-err-bar: var(--color-red-400);
  --a-err-bar-zero: var(--color-zinc-200);
  --a-bar-low: var(--color-red-400);
  --a-bar-mid: var(--color-amber-400);
  --a-bar-high: var(--color-emerald-600);

  /* the Housekeeping count pill */
  --a-pill-bg: var(--color-amber-100);
  --a-pill-text: var(--color-amber-800);
  --a-pill-line: var(--color-amber-300);

  /* the version badge beside the title */
  --a-badge-bg: var(--color-zinc-900);
  --a-badge-text: var(--color-white);
  --a-badge-ring: transparent;

  /* the two small "View list" / "Error History" chips */
  --a-chip-bg: var(--card);
  --a-chip-text: var(--color-zinc-600);
  --a-chip-hover-bg: var(--color-zinc-50);
  --a-chip-hover-text: var(--color-zinc-900);

  /* the API Health Check button (a shadcn Button, default variant) */
  --a-hbtn-bg: var(--primary);
  --a-hbtn-text: var(--primary-foreground);
  --a-hbtn-ring: transparent;
  --a-hbtn-hover: color-mix(in oklab, var(--primary) 90%, transparent);

  /* the per-website API key button's three states */
  /* ⚠️ THE "checking" STATE IS THE OUTLINE VARIANT'S OWN DEFAULT IN LIGHT, so
     these three name what that variant already paints ('border-border',
     'bg-background', inherited text) rather than picking a look. Choose
     anything else and A3 stops matching AlphaA2 for the second and a half that
     button spends spinning. */
  --a-key-line: var(--border);
  --a-key-bg: var(--background);
  --a-key-text: var(--foreground);
  --a-key-ok-line: var(--color-green-300);
  --a-key-ok-bg: var(--color-green-50);
  --a-key-ok-text: var(--color-green-700);
  --a-key-ok-hover: var(--color-green-100);
  --a-key-bad-line: var(--color-red-300);
  --a-key-bad-bg: var(--color-red-50);
  --a-key-bad-text: var(--color-red-600);
  --a-key-bad-hover: var(--color-red-100);

  /* the light/dark control itself */
  --a-toggle-tray: var(--border);
  --a-toggle-on-bg: var(--color-white);
  --a-toggle-on-text: var(--color-zinc-900);
  --a-toggle-off-bg: var(--color-zinc-50);
  --a-toggle-off-text: var(--color-zinc-400);
  --a-toggle-off-hover-bg: var(--color-white);
  --a-toggle-off-hover-text: var(--color-zinc-700);
}

/* ---- DARK, case 1: NO CHOICE MADE YET, so follow the operating system --
   ⭐⭐ THIS MEDIA QUERY IS WHY THERE IS NO SCRIPT AND NO FLASH ON A FIRST
   VISIT. The browser resolves 'prefers-color-scheme' before the first paint,
   with no JavaScript and nothing for React to disagree with.
   🛑 THE ':not([data-a3-theme])' GUARD IS THE WHOLE MECHANISM: the instant the
   visitor picks a theme, that attribute exists and this rule stops applying,
   so an explicit choice outranks the OS. **Remove the guard and the toggle
   silently stops working for anyone whose OS is dark.** */
@media (prefers-color-scheme: dark) {
  #${A3_ROOT_ID}:not([data-a3-theme]) {
    color-scheme: dark;

    /* ⚠️ THE FIVE SHADCN OVERRIDES ARE THE LEVER, inherited from AlphaA1's
       reasoning: because globals.css resolves its token utilities at USE time,
       re-pointing these recolours every bg-card, bg-muted/40, border, divide-y
       and ring-foreground/10 on the page with no class edits at all.
       🛑 --card IS THE VOID, NOT DARK.card. Every bg-card on this page is a place
       text sits, and this design puts text on the darkest colour. Point it at
       DARK.card and every well lifts to #16202A, which is the inverted hierarchy
       the user rejected on 2026-09-11.
       ⚠️ --foreground MUST BE THE BRIGHT COLOUR, not the label: ring-foreground/10
       reads it, and amber there turns every hairline faintly orange. */
    --background: ${DARK.void};
    --foreground: ${DARK.bright};
    --card: ${DARK.void};
    --muted: ${DARK.inset};
    --border: ${DARK.line};

    /* surfaces */
    --a-page: ${DARK.void};
    --a-well: ${DARK.void};
    --a-tile: ${DARK.void};
    --a-lift: ${DARK.card};
    --a-lift-strong: ${DARK.inset};
    --a-sel: ${DARK.inset};
    --a-chrome: ${DARK.line};
    --a-header: ${DARK.void};
    --a-track: ${DARK.inset};
    --a-track-off: ${DARK.line};

    /* frame */
    --a-ring: ${DARK.line};
    --a-ring-w: 3px;
    /* ⚠️ 0px, NOT "none". The toolbar and the pane draw their frame with a 3px
       chrome BAND (padding + gaps showing through), so an outer ring on top of it
       would read as a double border. The light theme has no band, so it needs the
       ring. Same markup, one number. */
    --a-ring-outer-w: 0px;
    /* ⚠️ TRANSPARENT, NOT REMOVED. The dividers keep their 1px box in both themes
       so the geometry cannot drift between them; only the colour changes. In dark
       the 3px gutter is already the divider, so a visible line here would read as
       a 4px gutter on one side only. */
    --a-divider: transparent;
    --a-header-line: ${DARK.line};

    /* text: six roles, three colours. The collapse is the design. */
    --a-text-base: ${DARK.label};
    --a-text-strong: ${DARK.label};
    --a-text-head: ${DARK.label};
    --a-text-body: ${DARK.label};
    --a-text-dim: ${DARK.label};
    --a-text-muted: ${DARK.label};
    --a-text-faint: ${DARK.label};
    --a-icon: ${DARK.muted};
    --a-icon-faint: ${DARK.line};

    /* values */
    --a-value: ${DARK.blue};
    --a-value-faint: ${DARK.blue};
    --a-value-hero: ${DARK.blueBright};

    /* meaning */
    --a-problem: ${DARK.red};
    --a-problem-note: ${DARK.red};
    --a-ok-text: ${DARK.blue};
    --a-warn-text: ${DARK.label};
    --a-bad-text: ${DARK.red};
    --a-off-text: ${DARK.red};
    --a-ok-dot: ${DARK.green};
    --a-warn-dot: ${DARK.label};
    --a-bad-dot: ${DARK.red};
    --a-off-dot: ${DARK.muted};
    --a-refresh-on: ${DARK.green};
    --a-err-bar: ${DARK.red};
    --a-err-bar-zero: ${DARK.line};
    --a-bar-low: ${DARK.red};
    --a-bar-mid: ${DARK.label};
    --a-bar-high: ${DARK.green};

    --a-pill-bg: ${DARK.inset};
    --a-pill-text: ${DARK.red};
    --a-pill-line: transparent;

    --a-badge-bg: transparent;
    --a-badge-text: ${DARK.label};
    --a-badge-ring: ${DARK.label};

    --a-chip-bg: ${DARK.card};
    --a-chip-text: ${DARK.label};
    --a-chip-hover-bg: ${DARK.inset};
    --a-chip-hover-text: ${DARK.label};

    --a-hbtn-bg: ${DARK.card};
    --a-hbtn-text: ${DARK.label};
    --a-hbtn-ring: ${DARK.line};
    --a-hbtn-hover: ${DARK.inset};

    /* 📌 THE KEY BUTTON STAYS GREEN/RED IN BOTH THEMES, which is the page's one
       documented exception to "three colours by meaning". It is the only ON/OFF
       pair rendered at the same shape five times in a column, so it is SCANNED
       rather than read, and blue/red do not separate at a glance the way
       green/red do. The user reverted an earlier move to blue the same day it
       shipped: "the previous color of the these buttons were better, use those." */
    --a-key-line: ${DARK.line};
    --a-key-bg: ${DARK.void};
    --a-key-text: ${DARK.label};
    --a-key-ok-line: ${DARK.green};
    --a-key-ok-bg: ${DARK.void};
    --a-key-ok-text: ${DARK.green};
    --a-key-ok-hover: ${DARK.card};
    --a-key-bad-line: ${DARK.red};
    --a-key-bad-bg: ${DARK.void};
    --a-key-bad-text: ${DARK.red};
    --a-key-bad-hover: ${DARK.card};

    --a-toggle-tray: ${DARK.line};
    --a-toggle-on-bg: ${DARK.inset};
    --a-toggle-on-text: ${DARK.label};
    --a-toggle-off-bg: ${DARK.void};
    --a-toggle-off-text: ${DARK.muted};
    --a-toggle-off-hover-bg: ${DARK.card};
    --a-toggle-off-hover-text: ${DARK.label};
  }
}

/* ---- DARK, case 2: the visitor chose it -------------------------------
   (1,1,0) beats the base rule's (1,0,0), so this wins wherever it applies.
   There is no matching '[data-a3-theme="light"]' block because the base rule
   IS light; the attribute only has to stop the media query above. */
#${A3_ROOT_ID}[data-a3-theme="dark"] {
  color-scheme: dark;

  /* ⚠️ THE FIVE SHADCN OVERRIDES ARE THE LEVER, inherited from AlphaA1's
     reasoning: because globals.css resolves its token utilities at USE time,
     re-pointing these recolours every bg-card, bg-muted/40, border, divide-y
     and ring-foreground/10 on the page with no class edits at all.
     🛑 --card IS THE VOID, NOT DARK.card. Every bg-card on this page is a place
     text sits, and this design puts text on the darkest colour. Point it at
     DARK.card and every well lifts to #16202A, which is the inverted hierarchy
     the user rejected on 2026-09-11.
     ⚠️ --foreground MUST BE THE BRIGHT COLOUR, not the label: ring-foreground/10
     reads it, and amber there turns every hairline faintly orange. */
  --background: ${DARK.void};
  --foreground: ${DARK.bright};
  --card: ${DARK.void};
  --muted: ${DARK.inset};
  --border: ${DARK.line};

  /* surfaces */
  --a-page: ${DARK.void};
  --a-well: ${DARK.void};
  --a-tile: ${DARK.void};
  --a-lift: ${DARK.card};
  --a-lift-strong: ${DARK.inset};
  --a-sel: ${DARK.inset};
  --a-chrome: ${DARK.line};
  --a-header: ${DARK.void};
  --a-track: ${DARK.inset};
  --a-track-off: ${DARK.line};

  /* frame */
  --a-ring: ${DARK.line};
  --a-ring-w: 3px;
  /* ⚠️ 0px, NOT "none". The toolbar and the pane draw their frame with a 3px
     chrome BAND (padding + gaps showing through), so an outer ring on top of it
     would read as a double border. The light theme has no band, so it needs the
     ring. Same markup, one number. */
  --a-ring-outer-w: 0px;
  /* ⚠️ TRANSPARENT, NOT REMOVED. The dividers keep their 1px box in both themes
     so the geometry cannot drift between them; only the colour changes. In dark
     the 3px gutter is already the divider, so a visible line here would read as
     a 4px gutter on one side only. */
  --a-divider: transparent;
  --a-header-line: ${DARK.line};

  /* text: six roles, three colours. The collapse is the design. */
  --a-text-base: ${DARK.label};
  --a-text-strong: ${DARK.label};
  --a-text-head: ${DARK.label};
  --a-text-body: ${DARK.label};
  --a-text-dim: ${DARK.label};
  --a-text-muted: ${DARK.label};
  --a-text-faint: ${DARK.label};
  --a-icon: ${DARK.muted};
  --a-icon-faint: ${DARK.line};

  /* values */
  --a-value: ${DARK.blue};
  --a-value-faint: ${DARK.blue};
  --a-value-hero: ${DARK.blueBright};

  /* meaning */
  --a-problem: ${DARK.red};
  --a-problem-note: ${DARK.red};
  --a-ok-text: ${DARK.blue};
  --a-warn-text: ${DARK.label};
  --a-bad-text: ${DARK.red};
  --a-off-text: ${DARK.red};
  --a-ok-dot: ${DARK.green};
  --a-warn-dot: ${DARK.label};
  --a-bad-dot: ${DARK.red};
  --a-off-dot: ${DARK.muted};
  --a-refresh-on: ${DARK.green};
  --a-err-bar: ${DARK.red};
  --a-err-bar-zero: ${DARK.line};
  --a-bar-low: ${DARK.red};
  --a-bar-mid: ${DARK.label};
  --a-bar-high: ${DARK.green};

  --a-pill-bg: ${DARK.inset};
  --a-pill-text: ${DARK.red};
  --a-pill-line: transparent;

  --a-badge-bg: transparent;
  --a-badge-text: ${DARK.label};
  --a-badge-ring: ${DARK.label};

  --a-chip-bg: ${DARK.card};
  --a-chip-text: ${DARK.label};
  --a-chip-hover-bg: ${DARK.inset};
  --a-chip-hover-text: ${DARK.label};

  --a-hbtn-bg: ${DARK.card};
  --a-hbtn-text: ${DARK.label};
  --a-hbtn-ring: ${DARK.line};
  --a-hbtn-hover: ${DARK.inset};

  /* 📌 THE KEY BUTTON STAYS GREEN/RED IN BOTH THEMES, which is the page's one
     documented exception to "three colours by meaning". It is the only ON/OFF
     pair rendered at the same shape five times in a column, so it is SCANNED
     rather than read, and blue/red do not separate at a glance the way
     green/red do. The user reverted an earlier move to blue the same day it
     shipped: "the previous color of the these buttons were better, use those." */
  --a-key-line: ${DARK.line};
  --a-key-bg: ${DARK.void};
  --a-key-text: ${DARK.label};
  --a-key-ok-line: ${DARK.green};
  --a-key-ok-bg: ${DARK.void};
  --a-key-ok-text: ${DARK.green};
  --a-key-ok-hover: ${DARK.card};
  --a-key-bad-line: ${DARK.red};
  --a-key-bad-bg: ${DARK.void};
  --a-key-bad-text: ${DARK.red};
  --a-key-bad-hover: ${DARK.card};

  --a-toggle-tray: ${DARK.line};
  --a-toggle-on-bg: ${DARK.inset};
  --a-toggle-on-text: ${DARK.label};
  --a-toggle-off-bg: ${DARK.void};
  --a-toggle-off-text: ${DARK.muted};
  --a-toggle-off-hover-bg: ${DARK.card};
  --a-toggle-off-hover-text: ${DARK.label};
}

/* ---- The toggle's own two segments ------------------------------------
   ⭐⭐ THESE RULES ARE WHY THE CONTROL NEEDS NO REACT STATE TO LOOK RIGHT.
   Which segment reads as "active" is decided by the same three cases as the
   palette, in CSS, so the correct one is highlighted in the very first
   painted frame - before React has hydrated and before it knows the theme.
   **Drive this from useState instead and you reintroduce the flash.**
   ⚠️ EACH PAIR HAS THREE SELECTORS, NOT ONE, and they must stay in step with
   the three cases above: explicit dark, explicit light, and OS-dark with no
   choice made. Miss the media-query line and the control lies about the
   theme on a first visit. */
#${A3_ROOT_ID}:not([data-a3-theme]) .a3-seg-light,
#${A3_ROOT_ID}[data-a3-theme="light"] .a3-seg-light,
#${A3_ROOT_ID}[data-a3-theme="dark"] .a3-seg-dark {
  background: var(--a-toggle-on-bg);
  color: var(--a-toggle-on-text);
}
#${A3_ROOT_ID}:not([data-a3-theme]) .a3-seg-dark,
#${A3_ROOT_ID}[data-a3-theme="light"] .a3-seg-dark,
#${A3_ROOT_ID}[data-a3-theme="dark"] .a3-seg-light {
  background: var(--a-toggle-off-bg);
  color: var(--a-toggle-off-text);
}
#${A3_ROOT_ID}:not([data-a3-theme]) .a3-seg-dark:hover,
#${A3_ROOT_ID}[data-a3-theme="light"] .a3-seg-dark:hover,
#${A3_ROOT_ID}[data-a3-theme="dark"] .a3-seg-light:hover {
  background: var(--a-toggle-off-hover-bg);
  color: var(--a-toggle-off-hover-text);
}
@media (prefers-color-scheme: dark) {
  #${A3_ROOT_ID}:not([data-a3-theme]) .a3-seg-dark {
    background: var(--a-toggle-on-bg);
    color: var(--a-toggle-on-text);
  }
  #${A3_ROOT_ID}:not([data-a3-theme]) .a3-seg-light {
    background: var(--a-toggle-off-bg);
    color: var(--a-toggle-off-text);
  }
  #${A3_ROOT_ID}:not([data-a3-theme]) .a3-seg-light:hover {
    background: var(--a-toggle-off-hover-bg);
    color: var(--a-toggle-off-hover-text);
  }
}
`;

/** Both palettes, as a `<style>` the page renders inside itself.
 *
 *  ⚠️ NOT A CLIENT COMPONENT and it must not become one: this has to be in the
 *  server HTML so the first paint is already themed. */
export function ThemeStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
