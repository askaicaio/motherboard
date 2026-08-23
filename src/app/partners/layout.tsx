// Passthrough layout for the public affiliate marketing pages (/partners,
// /partners/apply, /partners/terms, /partners/privacy). Sets the affiliate
// title + CAIO favicon for this section, overriding the root "M" monogram and
// the staff "CAIO Internal Dashboard" title.
import type { Metadata } from "next";

export const metadata: Metadata = {
  // A plain string, not a title.template: child pages here already carry full,
  // self-contained titles ("Terms & Conditions — CAIO Affiliate Program") and a
  // template would suffix them a second time. Children that set their own title
  // override this; those that don't inherit it. It is also what renders while a
  // page is still streaming — which is when the root staff title used to leak.
  title: "CAIO Affiliate Program",
  icons: {
    icon: "/icon-caio.png",
    shortcut: "/favicon.ico",
    apple: "/apple-icon-caio.png",
  },
};

export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
