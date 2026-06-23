import { Suspense } from "react";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import ThankYouContent from "./thank-you-content";

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7ff] px-4 py-16 font-sans antialiased">
      <div className="w-full max-w-lg text-center">
        {/* Brand mark */}
        <p className="mb-8 text-base font-bold tracking-tight text-[#1e1b4b]">
          Chief AI Officer
        </p>

        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50">
          <CheckCircle className="h-10 w-10 text-[#4f46e5]" strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-[#1e1b4b]">
          Thank you for your purchase!
        </h1>

        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-gray-600">
          You&apos;re now part of the CAIO community. We&apos;re excited to help
          you build your AI leadership capability. A confirmation email is on its
          way to your inbox.
        </p>

        {/* Dynamic session info */}
        <Suspense fallback={null}>
          <ThankYouContent />
        </Suspense>

        {/* Next steps card */}
        <div className="mt-8 rounded-2xl border border-indigo-100 bg-white p-6 text-left shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            What happens next
          </h2>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                1
              </span>
              <span>
                Check your email for a receipt and onboarding instructions from
                our team.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                2
              </span>
              <span>
                A CAIO team member will reach out within one business day to
                schedule your kickoff session.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                3
              </span>
              <span>
                Begin your AI leadership journey with direct access to your
                program resources and community.
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="https://chiefaiofficer.com"
            className="inline-flex items-center gap-2 rounded-lg bg-[#4f46e5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338ca]"
          >
            Go to chiefaiofficer.com
          </Link>
          <a
            href="mailto:hello@chiefaiofficer.com"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Contact support
          </a>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          If you have questions about your purchase, email us at{" "}
          <a
            href="mailto:hello@chiefaiofficer.com"
            className="text-[#4f46e5] hover:underline"
          >
            hello@chiefaiofficer.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
