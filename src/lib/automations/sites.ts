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
}

export const AUTOMATION_SITES: AutomationSite[] = [
  { slug: "make", label: "Make", description: "Scenarios automated in Make." },
  { slug: "n8n", label: "n8n", description: "Workflows automated in n8n." },
  { slug: "ghl", label: "GHL", description: "Workflows in GoHighLevel." },
  {
    slug: "ghl-b2b",
    label: "GHL b2b",
    description: "Workflows in the GoHighLevel B2B subaccount.",
  },
  { slug: "zapier", label: "Zapier", description: "Zaps automated in Zapier." },
];

/** Look up a single site by its URL slug. Returns undefined if unknown. */
export function getAutomationSite(slug: string): AutomationSite | undefined {
  return AUTOMATION_SITES.find((site) => site.slug === slug);
}
