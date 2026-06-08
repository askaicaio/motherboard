"use client";

// Per Website Page — automations table + search. Read-only for now; the
// edit-mode toggle, "+ New Workflow" button, and Add/Edit Workflow dialogs
// land in the next PR. Two columns: Name and Link (the link is the
// automation's identity). The search bar above the table filters by NAME
// only — not the link or anything else.

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ExternalLink } from "lucide-react";

export interface AutomationRow {
  id: string;
  name: string;
  externalUrl: string;
}

export function AutomationsTableClient({
  initialRows,
}: {
  initialRows: AutomationRow[];
}) {
  const [rows] = useState(initialRows);
  const [query, setQuery] = useState("");

  // Search filters by NAME only (Column 1) — deliberately not the link.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-3">
      {/* Search bar — searches the automation NAME only. */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search automations by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table — the Name/Link column headers always render, even when empty,
          so the structure is visible. Empty / no-match messages sit inside
          the table body as a full-width row beneath the headers. */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-3 py-16 text-center text-sm text-zinc-500"
                  >
                    {rows.length === 0
                      ? "No automations yet."
                      : "No automations match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-zinc-50">
                    <td className="px-3 py-2 align-top font-medium text-zinc-900">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <a
                        href={r.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 break-all text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {r.externalUrl}
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
