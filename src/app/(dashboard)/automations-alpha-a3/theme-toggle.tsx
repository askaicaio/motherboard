"use client";

// LIGHT / DARK MODE TOGGLE for AlphaA3. **A real toggle, not two links.**
// =============================================================
// ⭐⭐ COMPARE THIS WITH ITS TWO ANCESTORS. On AlphaA1 and AlphaA2 the "toggle"
// is a pair of `<Link>`s pointing at each other's route: clicking it is a
// NAVIGATION, which re-runs that page's ten database queries, and the pages
// carry `?site=` across so the selection survives the trip. Here the same
// control flips one class on one element. **Nothing is fetched, nothing is
// re-rendered by React, and there is no `site` prop, because there is no trip
// for the selection to survive.**
// 📌 THAT MISSING PROP IS THE CLEAREST SINGLE MEASURE of what the one-route
// shape buys. It also retires the `HoverPrefetchLink` warm-up that the pair
// needs purely to hide the cost of switching.
//
// ⚠️⚠️ THERE IS NO `useState` DRIVING THE COLOURS, AND THAT IS DELIBERATE. Which
// segment looks active is decided in CSS from the root's `data-a3-theme` (see
// the `.a3-seg-*` rules in `theme.tsx`), so the right one is highlighted in the
// FIRST PAINTED FRAME, before React has hydrated and even on a first visit
// where only the OS knows. **Drive it from state and the control flashes the
// wrong segment on every load.**
// 📌 The hook below exists ONLY so `aria-pressed` is truthful. It settles on
// hydration, which no screen reader notices and no eye can see.
//
// ⚠️ THE CLICK MUTATES THE DOM DIRECTLY rather than going through React. The
// root is rendered by a SERVER component, so React will never re-render it and
// cannot own the attribute. **This is the rare case where reaching for
// `setAttribute` is correct rather than lazy**: the alternative is promoting
// the whole page tree to a client component to hold one string.
// 📌 AND IT IS WHY THIS IS AN ATTRIBUTE RATHER THAN SHADCN'S `dark` CLASS. A
// class React renders is a class React owns, and it will put its own value
// back on hydration. See `A3_THEME_ATTR` for the bug that proved it.
//
// 🔁 UNLIKE the pair, this file has NO twin. There is one page, so there is one
// toggle. That is the entire argument of AlphaA3 in miniature.
// =============================================================

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import {
  A3_COOKIE_MAX_AGE,
  A3_ROOT_ID,
  A3_THEME_ATTR,
  A3_THEME_COOKIE,
} from "./theme";

/** One segment.
 *
 *  📐 GEOMETRY MATCHES ALPHAA1 AND ALPHAA2 EXACTLY: 32px tall, a 1px tray, and
 *  `rounded-[9px]` segments, which is the concentric radius for a `rounded-lg`
 *  (10px) container with 1px of padding. Get that wrong and the tray thins to
 *  nothing at the outer corners.
 *  ⚠️ NO COLOUR CLASSES HERE. Colour comes from the `.a3-seg-*` rules, because
 *  it depends on the theme rather than on the element. */
const SEGMENT =
  "flex w-8 items-center justify-center transition-colors [&_svg]:h-4 [&_svg]:w-4";

type Mode = "light" | "dark";

/* ⭐⭐ THE EFFECTIVE THEME IS AN EXTERNAL STORE, SO IT IS READ AS ONE. React
 * does not own it: it is an attribute the SERVER set from a cookie, that `pick`
 * overwrites, and that falls back to an OS media query when absent. That is
 * exactly the situation `useSyncExternalStore` exists for.
 * 🛑 THE FIRST ATTEMPT WAS `useState` PLUS A `useEffect` THAT READ THE DOM ON
 * MOUNT, and the lint rule `react-hooks/set-state-in-effect` rejected it,
 * rightly: that is a cascading render to learn something the DOM already knew.
 * **Do not put it back.**
 * ⚠️ BOTH SOURCES MUST BE SUBSCRIBED TO. The attribute can change (the click)
 * and so can the media query (the visitor flips their OS to dark while this is
 * open, having never chosen here). Miss the second and the control goes stale
 * against a page that has already repainted, because the CSS reacts and React
 * does not. */
function subscribe(onChange: () => void) {
  const root = document.getElementById(A3_ROOT_ID);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  const observer = root ? new MutationObserver(onChange) : null;
  observer?.observe(root!, {
    attributes: true,
    attributeFilter: [A3_THEME_ATTR],
  });
  return () => {
    mq.removeEventListener("change", onChange);
    observer?.disconnect();
  };
}

/** ⚠️ THE FALLBACK ORDER HERE MIRRORS THE CSS EXACTLY: an explicit attribute
 *  wins, otherwise the OS decides. If you change one, change the other, or the
 *  control and the page will disagree about which theme is showing. */
function getSnapshot(): Mode {
  const chosen = document
    .getElementById(A3_ROOT_ID)
    ?.getAttribute(A3_THEME_ATTR);
  if (chosen === "dark" || chosen === "light") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** @param initialTheme what the SERVER rendered, or `null` when the visitor has
 *  made no choice and the OS is deciding.
 *
 *  ⚠️⚠️ `null` IS NOT LAZINESS, IT IS THE ONLY HONEST SERVER ANSWER. The server
 *  cannot read `prefers-color-scheme`, so on a first visit it does not know
 *  which segment is active and renders NO `aria-pressed` at all. Guess `light`
 *  here instead and every dark-OS first visit ships markup that says the wrong
 *  button is pressed, which is both a hydration mismatch and a lie to a screen
 *  reader. It resolves on hydration, a moment no user can perceive. */
export function ThemeToggle({ initialTheme }: { initialTheme: Mode | null }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => initialTheme);

  function pick(next: Mode) {
    const root = document.getElementById(A3_ROOT_ID);
    if (!root) return;
    root.setAttribute(A3_THEME_ATTR, next);
    // ⚠️ THE WRITE IS WHAT TAKES THE PAGE OFF "FOLLOW THE OS", so it belongs
    // here in the click handler and nowhere else. Writing it on load would mean
    // a visitor who never touched the control could never go back to following
    // their system setting.
    // ⚠️⚠️ A COOKIE, NOT `localStorage`, AND `path=/` IS LOAD-BEARING: without it
    // the cookie is scoped to this exact path and the SERVER would not see it on
    // the RSC request for a client-side navigation back into the page, which is
    // the whole bug the cookie exists to fix. See `A3_THEME_COOKIE`.
    // 📌 `SameSite=Lax` because this is a same-site preference and nothing reads
    // it cross-origin. Not `Secure`, so it also works over plain http on a dev
    // server; it holds the word "dark" and protects nothing.
    document.cookie = `${A3_THEME_COOKIE}=${next}; path=/; max-age=${A3_COOKIE_MAX_AGE}; SameSite=Lax`;
    // ⚠️ NOTHING TO SET HERE. The `MutationObserver` above sees the attribute
    // change and re-renders the control, so the DOM stays the single source of
    // truth and there is no second copy of the theme to keep in step.
  }

  return (
    <div
      role="group"
      aria-label="Colour mode"
      // ⚠️ THE TRAY IS A TOKEN, not `--border`: in dark it is the palette's
      // chrome and in light it is the app's border colour, and those are not
      // the same role. See `--a-toggle-tray` in `theme.tsx`.
      className="flex h-8 items-stretch gap-px rounded-lg bg-[var(--a-toggle-tray)] p-px"
    >
      <button
        type="button"
        onClick={() => pick("light")}
        aria-pressed={mode === null ? undefined : mode === "light"}
        aria-label="Light mode"
        title="Light mode"
        className={`a3-seg-light ${SEGMENT} rounded-l-[9px]`}
      >
        <Sun />
      </button>
      <button
        type="button"
        onClick={() => pick("dark")}
        aria-pressed={mode === null ? undefined : mode === "dark"}
        aria-label="Dark mode"
        title="Dark mode"
        className={`a3-seg-dark ${SEGMENT} rounded-r-[9px]`}
      >
        <Moon />
      </button>
    </div>
  );
}
