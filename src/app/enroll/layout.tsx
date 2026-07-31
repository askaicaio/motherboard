// Passthrough layout for the public /enroll checkout page. Sets the CAIO
// favicon for this section, overriding the root "M" monogram.
import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/icon-caio.png",
    shortcut: "/favicon.ico",
    apple: "/apple-icon-caio.png",
  },
};

export default function EnrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
