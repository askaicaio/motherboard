"use client";

// Adds a "← Partner Program" back link on every sub-page (but not the
// overview itself, which is reached from the sidebar). Client component so
// it can read the current path; server page children pass straight through.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PartnerProgramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showBack = pathname !== "/partner-program";

  return (
    <>
      {showBack && (
        <div className="px-6 pt-6">
          <Link
            href="/partner-program"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Affiliates
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
