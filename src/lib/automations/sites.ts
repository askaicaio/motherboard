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
    description: "Scenarios automated in Make.",
    icon: "/automation-icons/make.svg",
    iconColor: "#B02DE9",
  },
  {
    slug: "n8n",
    label: "n8n",
    description: "Workflows automated in n8n.",
    icon: "/automation-icons/n8n.svg",
    iconColor: "#EA4B71",
  },
  {
    slug: "ghl",
    label: "GHL",
    description: "Workflows in GoHighLevel.",
    icon: "/automation-icons/ghl.png",
  },
  {
    slug: "ghl-b2b",
    label: "GHL b2b",
    description: "Workflows in the GoHighLevel B2B subaccount.",
    icon: "/automation-icons/ghl.png",
  },
  {
    slug: "zapier",
    label: "Zapier",
    description: "Zaps automated in Zapier.",
    // Full-colour logo (user-provided), so no iconColor tint.
    icon: "/automation-icons/zapier.png",
  },
];

/** Look up a single site by its URL slug. Returns undefined if unknown. */
export function getAutomationSite(slug: string): AutomationSite | undefined {
  return AUTOMATION_SITES.find((site) => site.slug === slug);
}
