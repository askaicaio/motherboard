// Partner Program — Email Templates audit page (staff, server component).
// Lists every system email descriptor from the registry as a card with a LIVE
// preview rendered in a sandboxed iframe, so staff can visually review the exact
// design that goes out when each trigger fires.

import { requireAuth } from "@/lib/auth/guard";
import { EMAIL_TEMPLATES } from "@/lib/email/registry";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  await requireAuth();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Email Templates
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          A live catalog of every transactional email the affiliate platform
          sends. Each card shows the template used when its trigger fires — the
          exact branded design, subject, and recipient — not individual messages
          that have already been sent. Previews are rendered from representative
          sample data.
        </p>
      </div>

      {/* Template cards */}
      <div className="space-y-5">
        {EMAIL_TEMPLATES.map((tpl) => {
          const { subject, html } = tpl.render();
          return (
            <Card key={tpl.key} id={tpl.key}>
              <CardContent className="p-0">
                {/* Meta header */}
                <div className="border-b border-zinc-100 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {tpl.name}
                    </h2>
                    <Badge
                      variant={
                        tpl.recipient === "Admin" ? "secondary" : "outline"
                      }
                    >
                      To: {tpl.recipient}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                    {tpl.trigger}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2 text-xs">
                    <span className="font-medium uppercase tracking-wide text-zinc-400">
                      Subject
                    </span>
                    <span className="font-medium text-zinc-700">{subject}</span>
                  </div>
                </div>

                {/* Live preview */}
                <div className="bg-zinc-50 p-3">
                  <iframe
                    title={`Preview: ${tpl.name}`}
                    srcDoc={html}
                    sandbox=""
                    className="h-[480px] w-full rounded-md border border-zinc-200 bg-white"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
