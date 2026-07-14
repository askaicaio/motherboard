// The fixed set of automation source websites the Automations tab tracks.
// Single source of truth shared by the Automations Main Page (the cards) and
// each Per Website Page (the [platform] route). Add/rename a site here and
// both the card grid and the routes update together.

export interface AutomationSite {
  /** URL segment, e.g. /automations/<slug>. Lowercase, no spaces. */
  slug: string;
  /** Display name shown on the card + page header (named after the website). */
  label: string;
  /** Short one-liner shown under the label on the Main Page card. */
  description: string;
  /**
   * Path (under /public) to the website's logo icon, shown on the Main Page
   * card next to the label. Make/n8n/Zapier use official monochrome SVG
   * glyphs; GHL (and GHL b2b, same brand) use the GoHighLevel favicon as a
   * stopgap until a clean official SVG icon is sourced.
   */
  icon: string;
  /**
   * Official brand colour (hex) used to tint the monochrome SVG glyph via a
   * CSS mask. Leave undefined for full-colour icons (e.g. the GHL favicon),
   * which render in their own colours.
   */
  iconColor?: string;
}

export const AUTOMATION_SITES: AutomationSite[] = [
  {
    slug: "make",
    label: "Make",
    description: "Scenarios found in Make",
    icon: "/automation-icons/make.svg",
    iconColor: "#B02DE9",
  },
  {
    slug: "n8n",
    label: "n8n",
    description: "Workflows found in n8n",
    icon: "/automation-icons/n8n.svg",
    iconColor: "#EA4B71",
  },
  {
    slug: "ghl",
    label: "GHL",
    description: "Workflows found in GoHighLevel",
    icon: "/automation-icons/ghl.png",
  },
  {
    slug: "ghl-b2b",
    label: "GHL b2b",
    description: "Workflows found in the GoHighLevel B2B subaccount",
    icon: "/automation-icons/ghl.png",
  },
  {
    slug: "zapier",
    label: "Zapier",
    description: "Zaps found in Zapier",
    // Full-colour logo (user-provided), so no iconColor tint.
    icon: "/automation-icons/zapier.png",
  },
];

/** Look up a single site by its URL slug. Returns undefined if unknown. */
export function getAutomationSite(slug: string): AutomationSite | undefined {
  return AUTOMATION_SITES.find((site) => site.slug === slug);
}

/**
 * Platforms whose "Refresh List" button performs a REAL sync (a sync engine
 * + API route exist). Any platform not in this set keeps the temporary
 * placeholder error on refresh. Add a slug here as its sync lands.
 */
export const SYNCABLE_PLATFORMS = new Set<string>([
  "make",
  "n8n",
  "ghl",
  "ghl-b2b",
]);

/** True when this platform has a working refresh/sync wired up. */
export function isSyncablePlatform(slug: string): boolean {
  return SYNCABLE_PLATFORMS.has(slug);
}

/**
 * Platforms whose ERROR capture is built. Make + n8n are wired; add a slug here
 * as each platform's error capture lands. The Error History "Check for new
 * errors" button is a real trigger for these, and a placeholder (red error) for
 * the rest. (GHL/GHL b2b can't ever join — no run history via API.)
 */
export const ERROR_CAPTURE_PLATFORMS = new Set<string>(["make", "n8n"]);

/** True when this platform's error capture is wired up. */
export function isErrorCapturePlatform(slug: string): boolean {
  return ERROR_CAPTURE_PLATFORMS.has(slug);
}
