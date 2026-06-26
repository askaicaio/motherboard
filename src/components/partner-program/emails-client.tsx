"use client";

// Email Templates — client UI for the partner-program emails page.
// Two-column layout: a sticky right-hand outline (table of contents) and a main
// column of template cards, each with a live sandboxed preview and an Edit
// dialog that PUTs subject/heading/body overrides (or resets them to default).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Pencil, Send } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renderBrandedEmail } from "@/lib/email/template";
import type { EmailVariable } from "@/lib/email/registry";

export interface TemplateRow {
  key: string;
  name: string;
  trigger: string;
  recipient: "Affiliate" | "Admin";
  subject: string;
  heading: string;
  bodyHtml: string;
  previewHtml: string;
  variables: EmailVariable[];
  overridden: { subject: boolean; heading: boolean; body: boolean };
}

/** Replace every {{name}} token with vars[name]; unknown tokens collapse to "". */
function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, name: string) =>
    vars[name] == null ? "" : vars[name],
  );
}

function sampleVarsFor(row: TemplateRow): Record<string, string> {
  const v: Record<string, string> = {};
  for (const item of row.variables) v[item.name] = item.sample;
  return v;
}

/** Rebuild a preview HTML client-side from a heading/body using the brand chrome. */
function buildPreview(
  heading: string,
  bodyHtml: string,
  vars: Record<string, string>,
): string {
  return renderBrandedEmail({
    heading: interpolate(heading, vars),
    contentHtml: interpolate(bodyHtml, vars),
  });
}

function isOverridden(o: TemplateRow["overridden"]): boolean {
  return o.subject || o.heading || o.body;
}

export function EmailTemplatesClient({
  fromLabel,
  templates,
}: {
  fromLabel: string;
  templates: TemplateRow[];
}) {
  // Local copy so we can optimistically update a card after save without a full
  // round-trip; router.refresh() then reconciles with the server.
  const [rows, setRows] = useState<TemplateRow[]>(templates);
  const [editing, setEditing] = useState<TemplateRow | null>(null);

  function applyUpdate(updated: TemplateRow) {
    setRows((prev) =>
      prev.map((r) => (r.key === updated.key ? updated : r)),
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Email Templates
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          These are the templates used when each trigger fires — edit the
          subject, content heading, and body below. The branded header and
          footer are fixed chrome and can&apos;t be changed here. Previews are
          rendered from representative sample data.
        </p>
      </div>

      {/* From-address banner */}
      <div className="mb-6 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <Send className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="text-zinc-500">Sending from:</span>
        <span className="font-medium text-zinc-800">{fromLabel}</span>
      </div>

      <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start">
        {/* Main column — template cards */}
        <div className="min-w-0 flex-1 space-y-5">
          {rows.map((row) => (
            <Card key={row.key} id={row.key} className="scroll-mt-6">
              <CardContent className="p-0">
                {/* Meta header */}
                <div className="border-b border-zinc-100 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {row.name}
                    </h2>
                    <Badge
                      variant={
                        row.recipient === "Admin" ? "secondary" : "outline"
                      }
                    >
                      To: {row.recipient}
                    </Badge>
                    {isOverridden(row.overridden) && (
                      <Badge variant="secondary">Edited</Badge>
                    )}
                    <div className="ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                    {row.trigger}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2 text-xs">
                    <span className="font-medium uppercase tracking-wide text-zinc-400">
                      Subject
                    </span>
                    <span className="font-medium text-zinc-700">
                      {row.subject}
                    </span>
                  </div>
                </div>

                {/* Live preview */}
                <div className="bg-zinc-50 p-3">
                  <iframe
                    title={`Preview: ${row.name}`}
                    srcDoc={row.previewHtml}
                    sandbox=""
                    className="h-[440px] w-full rounded-md border border-zinc-200 bg-white"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sticky outline / table of contents */}
        <nav className="lg:sticky lg:top-6 lg:w-60 lg:shrink-0">
          <div className="rounded-md border border-zinc-200 bg-white p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Templates
            </p>
            <ul className="space-y-0.5">
              {rows.map((row) => (
                <li key={row.key}>
                  <a
                    href={`#${row.key}`}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    {isOverridden(row.overridden) && (
                      <span
                        title="Edited"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                      />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      {editing && (
        <EditDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={applyUpdate}
        />
      )}
    </div>
  );
}

function EditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: TemplateRow;
  onClose: () => void;
  onSaved: (updated: TemplateRow) => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(row.subject);
  const [heading, setHeading] = useState(row.heading);
  const [bodyHtml, setBodyHtml] = useState(row.bodyHtml);
  const [busy, setBusy] = useState(false);

  async function submit(payload: {
    subject: string | null;
    heading: string | null;
    bodyHtml: string | null;
  }) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/partners/email-templates/${encodeURIComponent(row.key)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const { current } = (await res.json()) as {
        current: {
          subject: string;
          heading: string;
          bodyHtml: string;
          overridden: TemplateRow["overridden"];
        };
      };

      const vars = sampleVarsFor(row);
      onSaved({
        ...row,
        subject: current.subject,
        heading: current.heading,
        bodyHtml: current.bodyHtml,
        overridden: current.overridden,
        previewHtml: buildPreview(current.heading, current.bodyHtml, vars),
      });

      toast.success("Template saved");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save template",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row.name}</DialogTitle>
          <DialogDescription>
            Edit the subject, content heading, and body. The branded header and
            footer stay fixed. Use {"{{variable}}"} tokens — they&apos;re
            replaced when the email is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-heading">Content heading</Label>
            <Input
              id="tpl-heading"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Content body (HTML allowed)</Label>
            <Textarea
              id="tpl-body"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="min-h-[220px] font-mono text-xs"
            />
          </div>

          {/* Available variables */}
          {row.variables.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Available variables
              </p>
              <ul className="space-y-1.5">
                {row.variables.map((v) => (
                  <li key={v.name} className="text-xs leading-relaxed">
                    <code className="rounded bg-white px-1 py-0.5 font-mono text-indigo-600 ring-1 ring-zinc-200">
                      {`{{${v.name}}}`}
                    </code>
                    {v.description && (
                      <span className="ml-2 text-zinc-500">
                        {v.description}
                      </span>
                    )}
                    <span className="ml-2 text-zinc-400">
                      e.g. {v.sample}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              submit({ subject: null, heading: null, bodyHtml: null })
            }
          >
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => submit({ subject, heading, bodyHtml })}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
