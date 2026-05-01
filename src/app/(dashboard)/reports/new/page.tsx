"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";
import { REPORT_TITLE_FORMATS, type ReportTitleFormat } from "@/types";
import { toast } from "sonner";

export default function NewReportPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [knownDetails, setKnownDetails] = useState("");
  const [titleFormat, setTitleFormat] =
    useState<ReportTitleFormat>("strategic_growth");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          industry: industry.trim() || undefined,
          knownDetails: knownDetails.trim() || undefined,
          titleFormat,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { report } = await res.json();
      toast.success("Report created");
      router.push(`/reports/${report.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create report");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to reports
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">New Strategic Growth Report</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Enter the prospect details. Once created, you&apos;ll trigger the
          two-stage workflow: deep research → Gamma deck.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Prospect details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">
                Company name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Widel, Inc."
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry / sector</Label>
              <Input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Leave blank if unknown — research will figure it out"
              />
              <p className="text-xs text-zinc-500">
                Optional. If you don&apos;t know, the research stage will
                determine it.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="knownDetails">Known details</Label>
              <Textarea
                id="knownDetails"
                value={knownDetails}
                onChange={(e) => setKnownDetails(e.target.value)}
                placeholder="Any context you want the research to start with — e.g. 'Family-owned, parent company is X, they recently acquired Y...'"
                rows={4}
              />
              <p className="text-xs text-zinc-500">
                Optional. Free-form notes, hints, parent companies, recent news, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Report title format</Label>
              <div className="space-y-2">
                {REPORT_TITLE_FORMATS.map((fmt) => (
                  <label
                    key={fmt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      titleFormat === fmt.value
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="titleFormat"
                      value={fmt.value}
                      checked={titleFormat === fmt.value}
                      onChange={() => setTitleFormat(fmt.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900">
                        {fmt.label}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {fmt.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create report"}
              </Button>
              <Link href="/reports">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
