import { CheckCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// This page serves two flows:
//  - Customer purchase (Stripe checkout success_url adds ?session_id=…)
//  - Affiliate application (the apply form redirects here with no session_id)
// The copy adapts so a purchaser never sees "application" wording and an
// applicant never sees "thank you for your purchase".
const CONTACT_NAME = "Dani Apgar";
const CONTACT_EMAIL = "dani@chiefaiofficer.com";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const isPurchase = Boolean(session_id);

  const heading = isPurchase
    ? "You're all set — welcome to CAIO!"
    : "Thanks for applying!";

  const subheading = isPurchase
    ? "You're now part of the Chief AI Officer community. We're excited to help you build your AI leadership capability."
    : "We've received your affiliate application. We review every application personally, so a real person will be in touch — usually within 3 business days.";

  const steps = isPurchase
    ? [
        "Watch your inbox for onboarding instructions and next steps from our team.",
        "A CAIO team member will reach out within one business day to schedule your kickoff.",
        "You'll get direct access to your program resources and community.",
      ]
    : [
        "We personally review your application (usually within 3 business days).",
        "If it's a fit, you'll get an email with your referral link and portal login.",
        "Start earning 10% on every referral you send.",
      ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7ff] px-4 py-16 font-sans antialiased">
      <div className="w-full max-w-lg text-center">
        <Image
          src="/caio-scalingup.png"
          alt="Chief AI Officer — in partnership with Scaling Up"
          width={4000}
          height={1000}
          className="mx-auto mb-8 h-8 w-auto"
          priority
        />

        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50">
          <CheckCircle className="h-10 w-10 text-[#4f46e5]" strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-[#1e1b4b]">
          {heading}
        </h1>

        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-gray-600">
          {subheading}
        </p>

        {/* Next steps card */}
        <div className="mt-8 rounded-2xl border border-indigo-100 bg-white p-6 text-left shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            What happens next
          </h2>
          <ul className="space-y-3 text-sm text-gray-700">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Human contact — people like knowing who they're doing business with */}
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Your CAIO contact
          </p>
          <p className="mt-1 text-sm font-semibold text-[#1e1b4b]">
            {CONTACT_NAME}
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-sm text-[#4f46e5] hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="https://chiefaiofficer.com"
            className="inline-flex items-center gap-2 rounded-lg bg-[#4f46e5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338ca]"
          >
            Go to chiefaiofficer.com
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Contact {CONTACT_NAME.split(" ")[0]}
          </a>
        </div>

        {isPurchase && session_id && (
          <p className="mt-8 text-xs text-gray-400">
            Order reference:{" "}
            <span className="font-mono text-gray-500">{session_id}</span>
          </p>
        )}
      </div>
    </div>
  );
}
