// Passthrough layout for the public /enroll checkout page. Sets the affiliate
// title + CAIO favicon for this section, overriding the root "M" monogram and
// the staff "CAIO Internal Dashboard" title.
import type { Metadata } from "next";

export const metadata: Metadata = {
  // Matches the page's own title so the tab reads correctly while the page is
  // still streaming, instead of briefly showing the staff dashboard title.
  title: "Enroll — Chief AI Officer",
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
