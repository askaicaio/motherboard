// Passthrough layout for the public affiliate marketing pages (/partners,
// /partners/apply, /partners/terms, /partners/privacy). Its only job is to set
// the CAIO favicon for this section, overriding the root "M" monogram.
import type { Metadata } from "next";

export const metadata: Metadata = {
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
