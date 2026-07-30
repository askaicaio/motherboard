import Image from "next/image";
import Link from "next/link";

/**
 * Shared footer for the affiliate legal pages (privacy, terms). Previously
 * duplicated byte-for-byte in each page — extracted here so the size/labels
 * stay in one place.
 */
export function LegalFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-8 py-16 sm:flex-row">
        <a
          href="https://chiefaiofficer.com"
          className="flex items-center"
          aria-label="Chief AI Officer — in partnership with Scaling Up"
        >
          <Image
            src="/caio-scalingup.png"
            alt="Chief AI Officer — in partnership with Scaling Up"
            width={4000}
            height={1000}
            className="h-12 w-auto"
          />
        </a>
        <div className="flex items-center gap-10 text-lg text-slate-500">
          <Link href="/partners" className="transition hover:text-[#4f46e5]">
            Home
          </Link>
          <Link
            href="/partners/privacy"
            className="transition hover:text-[#4f46e5]"
          >
            Privacy
          </Link>
          <Link
            href="/partners/terms"
            className="transition hover:text-[#4f46e5]"
          >
            Terms
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-50 py-8 text-center text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Chief AI Officer. All rights reserved.
      </div>
    </footer>
  );
}
