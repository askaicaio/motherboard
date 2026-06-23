"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface Dept {
  value: string;
  label: string;
}
interface Tab {
  href: string;
  label: string;
}
type Config = Record<string, string[]>; // department -> hidden hrefs

export function DepartmentAccessClient({
  initialConfig,
  departments,
  tabs,
}: {
  initialConfig: Config;
  departments: Dept[];
  tabs: Tab[];
}) {
  // Work in the POSITIVE direction in the UI (checked = visible), but the
  // stored config is a deny-list (hidden hrefs). We convert on save.
  const [hidden, setHidden] = useState<Config>(() => {
    const c: Config = {};
    for (const d of departments) c[d.value] = initialConfig[d.value] ?? [];
    return c;
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isVisible = (dept: string, href: string) =>
    !(hidden[dept] ?? []).includes(href);

  const toggle = (dept: string, href: string) => {
    setHidden((prev) => {
      const cur = new Set(prev[dept] ?? []);
      if (cur.has(href)) cur.delete(href);
      else cur.add(href);
      return { ...prev, [dept]: Array.from(cur) };
    });
    setDirty(true);
  };

  const setAll = (dept: string, visible: boolean) => {
    setHidden((prev) => ({
      ...prev,
      [dept]: visible ? [] : tabs.map((t) => t.href),
    }));
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    try {
      const config: Config = {};
      for (const [dept, hrefs] of Object.entries(hidden)) {
        if (hrefs.length > 0) config[dept] = hrefs;
      }
      const res = await fetch("/api/members/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save");
        return;
      }
      toast.success("Department access saved");
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/members"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to members
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-zinc-500" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Department access
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Choose which tabs each department sees in the sidebar. A checked
              box means visible. These limits apply to members with the{" "}
              <strong>User</strong> role — Admins always see every tab.
            </p>
          </div>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="sticky left-0 bg-zinc-50 px-4 py-3 text-left">
                  Department
                </th>
                {tabs.map((t) => (
                  <th key={t.href} className="px-3 py-3 text-center font-medium">
                    {t.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center">All</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => {
                const allVisible = (hidden[d.value] ?? []).length === 0;
                return (
                  <tr key={d.value} className="border-t hover:bg-zinc-50/60">
                    <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-zinc-800">
                      {d.label}
                    </td>
                    {tabs.map((t) => {
                      const checked = isVisible(d.value, t.href);
                      return (
                        <td key={t.href} className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(d.value, t.href)}
                            aria-label={`${checked ? "Hide" : "Show"} ${t.label} for ${d.label}`}
                            className={
                              "inline-flex h-5 w-5 items-center justify-center rounded border transition " +
                              (checked
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-300 bg-white text-transparent hover:border-zinc-400")
                            }
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setAll(d.value, !allVisible)}
                        className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                      >
                        {allVisible ? "none" : "all"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-400">
        Dashboard is always visible. New tabs are visible by default until
        hidden here.
      </p>
    </div>
  );
}
