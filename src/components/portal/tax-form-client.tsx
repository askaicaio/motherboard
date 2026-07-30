"use client";

// Partner-facing form to set tax form type + upload the signed tax document.
// Bank details are handled by Stripe Connect (see ConnectPayoutCard), so this
// no longer collects ACH/Zelle. Posts to /api/portal/tax-form.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Download,
  Trash2,
  Upload,
} from "lucide-react";

const TAX_OPTIONS: { value: "w9" | "w8ben" | "w8bene"; label: string; hint: string }[] = [
  { value: "w9", label: "W-9", hint: "US persons & US-based entities" },
  { value: "w8ben", label: "W-8BEN", hint: "Non-US individuals" },
  { value: "w8bene", label: "W-8BEN-E", hint: "Non-US entities" },
];

export function TaxFormClient({
  taxFormStatus,
  taxFormUrl,
  taxFormName,
}: {
  taxFormStatus: string;
  taxFormUrl: string | null;
  taxFormName: string | null;
}) {
  const router = useRouter();

  // --- Tax-form DOCUMENT (the actual PDF), separate from the type above ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(!!taxFormUrl);
  const [fileName, setFileName] = useState(taxFormName);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setFileError(null);
    if (file.type !== "application/pdf") {
      setFileError("Your tax form must be a PDF.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/portal/tax-form/file", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFileError(data?.error || "Upload failed. Please try again.");
        return;
      }
      setHasFile(true);
      setFileName(data.fileName ?? file.name);
      setConfirmRemove(false);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveFile() {
    setFileError(null);
    setRemoving(true);
    try {
      const res = await fetch("/api/portal/tax-form/file", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFileError(data?.error || "Could not remove the file. Please try again.");
        return;
      }
      setHasFile(false);
      setFileName(null);
      setConfirmRemove(false);
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  const [tax, setTax] = useState<"w9" | "w8ben" | "w8bene">(
    taxFormStatus === "w9" || taxFormStatus === "w8ben" || taxFormStatus === "w8bene"
      ? taxFormStatus
      : "w9",
  );
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/portal/tax-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxFormStatus: tax }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResult({
          ok: false,
          message: data?.error || "Could not save your details. Please try again.",
        });
        return;
      }
      setResult({ ok: true, message: "Saved. Your tax form type is up to date." });
      router.refresh();
    } catch {
      setResult({
        ok: false,
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Tax-form DOCUMENT — download / remove / upload + warning-if-none */}
      <div>
        <label className="block text-sm font-medium text-[#1e1b4b]">
          Tax form document
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          Your signed W-9 or W-8BEN PDF. Stored securely — only the CAIO team
          can view it.
        </p>

        {fileError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}

        {hasFile ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate text-sm font-medium text-[#1e1b4b]">
                {fileName || "tax-form.pdf"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/portal/tax-form/file"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
              {confirmRemove ? (
                <>
                  <button
                    type="button"
                    onClick={onRemoveFile}
                    disabled={removing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    {removing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Confirm remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    disabled={removing}
                    className="rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                No tax form document on file. We can&apos;t release a payout
                until your signed W-9 / W-8BEN PDF is uploaded.
              </span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1e1b4b] transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading…" : "Upload tax form (PDF)"}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onUploadFile}
        />
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#1e1b4b]">Tax form type</label>
        <p className="mt-0.5 text-xs text-slate-500">
          Required before any payout can be released.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TAX_OPTIONS.map((opt) => {
            const active = tax === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setTax(opt.value)}
                aria-pressed={active}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-[#4f46e5] bg-indigo-50 ring-1 ring-[#4f46e5]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-semibold text-[#1e1b4b]">
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="status"
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save tax form type"}
        </button>
      </div>
      </form>
    </div>
  );
}
