"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  Pin,
  Grid3x3,
  List as ListIcon,
  LayoutGrid,
  ChevronDown,
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { detectSource } from "@/lib/documents/source";
import { DocSourceIcon } from "./doc-source-icon";
import { AddDocDialog } from "./add-doc-dialog";

export interface DocItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "grouped" | "grid" | "list";
type SortMode = "recent" | "alpha" | "updated";

const UNCATEGORIZED = "Uncategorized";

export function DocsPageClient({
  initialDocs,
}: {
  initialDocs: DocItem[];
}) {
  const router = useRouter();
  const [docs, setDocs] = useState(initialDocs);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grouped");
  const [sort, setSort] = useState<SortMode>("recent");
  const [editing, setEditing] = useState<DocItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Build the list of unique categories and tags for the filter dropdowns
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const d of docs) {
      set.add(d.category?.trim() || UNCATEGORIZED);
    }
    return Array.from(set).sort((a, b) => {
      // Uncategorized always last
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [docs]);

  // Apply search filter + sort
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = docs.filter((d) => {
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false) ||
        (d.category?.toLowerCase().includes(q) ?? false) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    result = [...result].sort((a, b) => {
      // Pinned always first
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "alpha") return a.title.localeCompare(b.title);
      if (sort === "updated")
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [docs, query, sort]);

  // Group by category for grouped view
  const grouped = useMemo(() => {
    const map = new Map<string, DocItem[]>();
    for (const d of filtered) {
      const key = d.category?.trim() || UNCATEGORIZED;
      const arr = map.get(key) || [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const handleCreated = (doc: DocItem) => {
    setDocs((prev) => [doc, ...prev]);
    toast.success(`Added "${doc.title}"`);
  };

  const handleUpdated = (doc: DocItem) => {
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
    toast.success("Updated");
  };

  const handleDelete = async (doc: DocItem) => {
    if (!confirm(`Remove "${doc.title}" from the docs library?`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove");
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Removed");
    router.refresh();
  };

  const handleTogglePin = async (doc: DocItem) => {
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !doc.pinned }),
    });
    if (!res.ok) {
      toast.error("Failed to toggle pin");
      return;
    }
    const { document: updated } = await res.json();
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...updated } : d)));
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Docs</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Curated links to internal documentation — playbooks, guides, SOPs.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add doc
        </Button>
      </div>

      {/* Toolbar — search + view toggles + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search by title, tag, category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* View mode toggle */}
        <div className="inline-flex rounded-md border bg-white p-0.5 text-zinc-500">
          <button
            type="button"
            onClick={() => setView("grouped")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition",
              view === "grouped" && "bg-zinc-100 text-zinc-900",
            )}
            title="Group by category"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grouped
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition",
              view === "grid" && "bg-zinc-100 text-zinc-900",
            )}
            title="Flat grid"
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition",
              view === "list" && "bg-zinc-100 text-zinc-900",
            )}
            title="Compact list"
          >
            <ListIcon className="h-3.5 w-3.5" />
            List
          </button>
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
            {sort === "alpha"
              ? "A–Z"
              : sort === "updated"
              ? "Recently updated"
              : "Recently added"}
            <ChevronDown className="ml-1 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSort("recent")}>
              Recently added
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSort("updated")}>
              Recently updated
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSort("alpha")}>
              A–Z
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-zinc-100 p-3">
              <BookOpen className="h-6 w-6 text-zinc-500" />
            </div>
            <div>
              <h3 className="font-medium">
                {docs.length === 0 ? "No docs yet" : "Nothing matches"}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                {docs.length === 0
                  ? "Add your first link to start the team library."
                  : "Try a different search term."}
              </p>
            </div>
            {docs.length === 0 && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first doc
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {filtered.length > 0 && view === "grouped" && (
        <div className="space-y-8">
          {grouped.map(([category, items]) => (
            <section key={category} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {category}
                </h2>
                <span className="text-xs text-zinc-400">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => (
                  <DocCard
                    key={d.id}
                    doc={d}
                    onEdit={() => setEditing(d)}
                    onDelete={() => handleDelete(d)}
                    onTogglePin={() => handleTogglePin(d)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {filtered.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              onEdit={() => setEditing(d)}
              onDelete={() => handleDelete(d)}
              onTogglePin={() => handleTogglePin(d)}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 && view === "list" && (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((d) => (
                <DocListRow
                  key={d.id}
                  doc={d}
                  onEdit={() => setEditing(d)}
                  onDelete={() => handleDelete(d)}
                  onTogglePin={() => handleTogglePin(d)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AddDocDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
        knownCategories={categories.filter((c) => c !== UNCATEGORIZED)}
      />
      <AddDocDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        existing={editing ?? undefined}
        onUpdated={handleUpdated}
        knownCategories={categories.filter((c) => c !== UNCATEGORIZED)}
      />
    </div>
  );
}

function DocCard({
  doc,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  doc: DocItem;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const src = detectSource(doc.url);
  return (
    <Card className="group relative h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <DocSourceIcon source={src.source} className="h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-zinc-900 hover:underline line-clamp-2"
              >
                {doc.title}
              </a>
              {doc.pinned && (
                <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{src.label}</div>
          </div>
          <RowMenu doc={doc} onEdit={onEdit} onDelete={onDelete} onTogglePin={onTogglePin} />
        </div>

        {doc.description && (
          <p className="text-sm text-zinc-600 line-clamp-2">{doc.description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {doc.tags.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] font-normal">
              {t}
            </Badge>
          ))}
          {doc.tags.length > 4 && (
            <Badge variant="outline" className="text-[10px] font-normal">
              +{doc.tags.length - 4}
            </Badge>
          )}
        </div>

        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </a>
      </CardContent>
    </Card>
  );
}

function DocListRow({
  doc,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  doc: DocItem;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const src = detectSource(doc.url);
  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
      <DocSourceIcon source={src.source} className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sm text-zinc-900 hover:underline"
        >
          {doc.title}
        </a>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {doc.category && <span>{doc.category}</span>}
          {doc.category && doc.tags.length > 0 && <span>·</span>}
          {doc.tags.slice(0, 3).map((t) => (
            <span key={t}>#{t}</span>
          ))}
          {doc.tags.length > 3 && <span>+{doc.tags.length - 3} more</span>}
        </div>
      </div>
      <div className="hidden text-xs text-zinc-500 sm:block">
        {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
      </div>
      {doc.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
      <RowMenu doc={doc} onEdit={onEdit} onDelete={onDelete} onTogglePin={onTogglePin} />
    </li>
  );
}

function RowMenu({
  doc,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  doc: DocItem;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
        aria-label="Doc actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setTimeout(onEdit, 0);
          }}
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onTogglePin}>
          <Pin className="mr-2 h-4 w-4" />
          {doc.pinned ? "Unpin" : "Pin to top"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setTimeout(onDelete, 0);
          }}
          className="text-red-600 focus:text-red-700"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
