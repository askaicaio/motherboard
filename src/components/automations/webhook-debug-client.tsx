"use client";

// =============================================================
// TEMPORARY: Zapier webhook inspector viewer
// =============================================================
// Shows the public ingest URL (to paste into the Zapier monitor Zap's webhook
// action) and lists every captured payload, raw + parsed, so we can see whether
// Zapier's "New Zap Error" trigger sends the erroring Zap's ID / link or only
// its title. Delete this component when the investigation is done.
// =============================================================

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { WebhookCapture } from "@/lib/automations/webhook-debug";

interface Props {
  initialCaptures: WebhookCapture[];
  ingestPath: string;
}

/** Keys worth highlighting — the whole point is finding an id / link / title. */
const INTERESTING = /(^|[._])(id|ids|zap|zap_?id|link|links|url|href|title|name|label)([._]|$)/i;

/** Flatten a nested value into dot-path -> primitive entries. */
function flatten(value: unknown, prefix = ""): [string, string][] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object") return [[prefix || "(value)", String(value)]];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i)));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

function highlightsFor(capture: WebhookCapture): [string, string][] {
  const source = capture.parsed ?? capture.form ?? null;
  if (!source) return [];
  return flatten(source).filter(([k]) => INTERESTING.test(k));
}

export function WebhookDebugClient({ initialCaptures, ingestPath }: Props) {
  const [captures, setCaptures] = useState<WebhookCapture[]>(initialCaptures);
  const [fullUrl, setFullUrl] = useState(ingestPath);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setFullUrl(`${window.location.origin}${ingestPath}`);
  }, [ingestPath]);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch("/api/automations/zapier-webhook-debug");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCaptures(data.captures ?? []);
      toast.success("Refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm("Clear all captured payloads? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/automations/zapier-webhook-debug", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear");
      setCaptures([]);
      toast.success("Cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("URL copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Zapier Webhook Inspector</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Temporary tool. Paste the URL below into your Zapier monitor Zap&apos;s
          webhook action, force a Zap error, then refresh to see exactly what
          Zapier sent.
        </p>
      </div>

      {/* Ingest URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingest URL (POST here)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-zinc-100 px-3 py-2 text-xs text-zinc-800">
              {fullUrl}
            </code>
            <Button variant="outline" size="sm" onClick={copyUrl}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Use the production URL (Zapier must reach it publicly). New Zap Error
            is a polling trigger, so a capture can take a few minutes to arrive.
          </p>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={clearAll}
          disabled={busy || captures.length === 0}
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
        <span className="text-sm text-zinc-500">
          {captures.length} capture{captures.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Captures */}
      {captures.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500">
            No payloads captured yet. Trigger a Zap error, wait a moment, then
            hit Refresh.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {captures.map((c) => {
            const highlights = highlightsFor(c);
            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {new Date(c.receivedAt).toLocaleString()}{" "}
                    <span className="text-zinc-400">
                      · {c.method} · {c.contentType ?? "no content-type"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* The answer-at-a-glance: id / link / title fields found */}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Identity fields found ({highlights.length})
                    </p>
                    {highlights.length === 0 ? (
                      <p className="text-xs text-zinc-400">
                        None — no id / link / title / name keys in the payload.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {highlights.map(([k, v]) => (
                          <li key={k} className="text-xs">
                            <span className="font-mono text-zinc-500">{k}</span>
                            <span className="text-zinc-400"> = </span>
                            <span className="font-mono text-zinc-900 [overflow-wrap:anywhere]">
                              {v}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Parsed JSON */}
                  {c.parsed !== null && (
                    <details open>
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Parsed JSON
                      </summary>
                      <pre className="mt-1 max-h-96 overflow-auto rounded bg-zinc-50 p-3 text-xs">
                        {JSON.stringify(c.parsed, null, 2)}
                      </pre>
                    </details>
                  )}

                  {/* Form body */}
                  {c.form !== null && (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Form fields
                      </summary>
                      <pre className="mt-1 max-h-96 overflow-auto rounded bg-zinc-50 p-3 text-xs">
                        {JSON.stringify(c.form, null, 2)}
                      </pre>
                    </details>
                  )}

                  {/* Raw body */}
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Raw body
                    </summary>
                    <pre className="mt-1 max-h-96 overflow-auto rounded bg-zinc-50 p-3 text-xs [overflow-wrap:anywhere] whitespace-pre-wrap">
                      {c.rawBody || "(empty)"}
                    </pre>
                  </details>

                  {/* Headers */}
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Headers
                    </summary>
                    <pre className="mt-1 max-h-96 overflow-auto rounded bg-zinc-50 p-3 text-xs">
                      {JSON.stringify(c.headers, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
