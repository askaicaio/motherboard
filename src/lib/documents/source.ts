// =============================================================
// URL → source detection
// =============================================================
// Detects which platform a doc lives on so the UI can render the
// appropriate icon + source label. Used by the Docs tab cards.
// Pure functions, no React — safe to import from server or client.
// =============================================================

export type DocSource =
  | "google_docs"
  | "google_sheets"
  | "google_slides"
  | "google_drive"
  | "notion"
  | "slack"
  | "loom"
  | "figma"
  | "github"
  | "pdf"
  | "web";

export interface SourceInfo {
  source: DocSource;
  /** Short human label shown as a chip on the card */
  label: string;
}

/**
 * Classify a URL into a known source. Falls back to "web" for anything
 * unrecognized. Tolerates malformed URLs (returns "web").
 */
export function detectSource(url: string): SourceInfo {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return { source: "web", label: "Link" };
  }

  if (host === "docs.google.com") {
    if (path.startsWith("/document")) return { source: "google_docs", label: "Google Docs" };
    if (path.startsWith("/spreadsheets")) return { source: "google_sheets", label: "Google Sheets" };
    if (path.startsWith("/presentation")) return { source: "google_slides", label: "Google Slides" };
    if (path.startsWith("/forms")) return { source: "google_docs", label: "Google Forms" };
    return { source: "google_docs", label: "Google Docs" };
  }
  if (host === "drive.google.com") return { source: "google_drive", label: "Google Drive" };
  if (host.endsWith("notion.so") || host.endsWith("notion.site"))
    return { source: "notion", label: "Notion" };
  if (host.endsWith("slack.com")) return { source: "slack", label: "Slack" };
  if (host.endsWith("loom.com")) return { source: "loom", label: "Loom" };
  if (host.endsWith("figma.com")) return { source: "figma", label: "Figma" };
  if (host === "github.com" || host.endsWith(".github.com"))
    return { source: "github", label: "GitHub" };
  if (path.endsWith(".pdf")) return { source: "pdf", label: "PDF" };
  return { source: "web", label: "Link" };
}
