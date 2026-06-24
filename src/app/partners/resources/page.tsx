// Public affiliate resources page — the Playbook, Toolkit, and marketing
// assets affiliates can download. No auth; link-shared with partners.
import Link from "next/link";
import { db } from "@/lib/db";
import { partnerResources } from "@/lib/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { FileText, Link2, Download, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = [
  "playbook",
  "toolkit",
  "brand_asset",
  "email_template",
  "social_post",
  "banner",
  "other",
];
const CATEGORY_LABELS: Record<string, string> = {
  playbook: "Affiliate Playbook",
  toolkit: "Marketing Toolkit",
  brand_asset: "Brand Assets",
  email_template: "Email Templates",
  social_post: "Social Posts",
  banner: "Banners",
  other: "Other Resources",
};

export default async function PublicResourcesPage() {
  const rows = await db
    .select()
    .from(partnerResources)
    .where(
      and(isNull(partnerResources.archivedAt), eq(partnerResources.isPublic, true)),
    )
    .orderBy(asc(partnerResources.sortOrder), desc(partnerResources.createdAt));

  const byCategory = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }
  const groups = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c] ?? c,
    items: byCategory.get(c)!,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header band */}
      <div className="bg-[#1e1b4b] text-white">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <Link
            href="/partners"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-200 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Affiliates
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Affiliate Resources
          </h1>
          <p className="mt-3 max-w-2xl text-indigo-200">
            Everything you need to promote CAIO and earn — the Affiliate Playbook,
            the Marketing Toolkit, and ready-to-use assets.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {groups.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Resources are being prepared — check back shortly.
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((g) => (
              <section key={g.category}>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {g.label}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {g.items.map((r) => {
                    const url = r.fileUrl || r.externalUrl || "#";
                    const isFile = !!r.fileUrl;
                    return (
                      <a
                        key={r.id}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm"
                      >
                        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                          {isFile ? (
                            <FileText className="h-5 w-5" />
                          ) : (
                            <Link2 className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-medium text-slate-900">
                            <span className="truncate">{r.title}</span>
                          </div>
                          {r.description && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                              {r.description}
                            </p>
                          )}
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                            <Download className="h-3 w-3" />
                            {isFile ? "Download" : "Open"}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
