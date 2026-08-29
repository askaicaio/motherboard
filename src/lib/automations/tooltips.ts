// Shared tooltip timing for the Automations tab.
//
// WHY A CONSTANT: the delay was hard-coded as `delay={300}` on nine separate
// TooltipProviders (one per surface), so changing it meant finding all nine and
// hoping none were missed. It now lives here.
//
// ⚠️ THIS ONLY GOVERNS THE APP'S <Tooltip> COMPONENTS. A native `title`
// attribute is timed by the browser and the OS (roughly a second in Chrome) and
// CANNOT be changed from code. That difference is why the amber Relationships
// count felt broken: it was a native title competing with its own button's
// title, on the slow timing, while everything around it was a <Tooltip> on this
// one. If a tooltip needs to obey this delay, it has to be a <Tooltip>.
//
// The shared TooltipProvider in components/ui/tooltip.tsx defaults to 0, which
// is why every provider passes this explicitly rather than relying on it.

/** Milliseconds the cursor must rest on a trigger before its tooltip opens.
 *  User-set: 300 originally, raised to 600 on 2026-08-28 so tooltips stay out
 *  of the way while scanning a table and only appear on a deliberate hover. */
export const TOOLTIP_DELAY_MS = 600;
