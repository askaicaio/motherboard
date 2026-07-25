import type { Metadata } from "next";

// The apply page is a client component (form state), so its metadata lives
// here in the route's server layout.
export const metadata: Metadata = {
  title: "Apply to the CAIO Affiliate Program",
  description:
    "Apply to become a Chief AI Officer affiliate. Earn a flat 10% commission introducing executives and boards to CAIO's AI leadership programs.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://affiliates.chiefaiofficer.com/partners/apply" },
  openGraph: {
    title: "Apply to the CAIO Affiliate Program",
    description:
      "Earn a flat 10% commission introducing leaders to Chief AI Officer programs. Apply in minutes.",
    url: "https://affiliates.chiefaiofficer.com/partners/apply",
    siteName: "Chief AI Officer",
    type: "website",
  },
};

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
