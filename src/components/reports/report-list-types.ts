export interface ReportListItem {
  id: string;
  companyName: string;
  industry: string | null;
  titleFormat: string;
  researchStatus: "pending" | "running" | "complete" | "failed";
  gammaStatus: "pending" | "running" | "complete" | "failed";
  gammaUrl: string | null;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  researchSources?: Array<{ url: string; title: string }> | null;
  researchCostUsd?: string | null;
}

export type ViewMode = "list" | "board" | "gallery";

export const VIEW_MODES: { value: ViewMode; label: string; icon: string }[] = [
  { value: "list", label: "List", icon: "List" },
  { value: "board", label: "Board", icon: "Columns" },
  { value: "gallery", label: "Gallery", icon: "LayoutGrid" },
];
