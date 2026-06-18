// Server-side check for whether a platform has an API credential configured
// (its env var is present). Used by the Main Page card indicator and the
// per-website page's auto-refresh toggle. Reads env only — import server-side
// only; only a boolean is ever exposed to the client, never the secret.

export function platformHasApiKey(slug: string): boolean {
  switch (slug) {
    case "make":
      return !!process.env.MAKE_API_TOKEN;
    case "n8n":
      // Needs BOTH the key and the instance URL to talk to n8n.
      return !!process.env.N8N_API_KEY && !!process.env.N8N_BASE_URL;
    case "ghl":
      // Main subaccount, dedicated Automations creds (separate from Campaigns).
      return !!process.env.GHL_MAIN_API_TOKEN && !!process.env.GHL_MAIN_LOCATION_ID;
    case "ghl-b2b":
      // B2B subaccount has its own token + location.
      return !!process.env.GHL_B2B_API_TOKEN && !!process.env.GHL_B2B_LOCATION_ID;
    // zapier: wired if/when its sync lands (likely no list API).
    default:
      return false;
  }
}
