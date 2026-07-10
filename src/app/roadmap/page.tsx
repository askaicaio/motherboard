import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import RoadmapClient from "./roadmap-client";

/**
 * Public event landing page — served at roadmap.chiefaiofficer.com.
 * Self-contained: its own fonts + full-screen layout. Renders under the app
 * root layout but carries NO dashboard chrome.
 *
 * Fonts are scoped to this page via CSS variables set on the page root
 * (see the wrapper <div> in RoadmapClient / the root section below) so they
 * never leak into the rest of the app.
 */

// Display / accent — Instrument Serif, italic. Single (non-variable) weight.
// Used only for the single hero display headline as a premium editorial accent.
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roadmap-serif",
});

// Body + headings — Inter (clean, executive, matches the CAIO funnel).
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roadmap-sans",
});

// ── EDITABLE COPY CONSTANTS ───────────────────────────────────────────────
const HERO_HEADLINE = "You've seen the first two stages. Here are all four.";
const HERO_SUBHEAD =
  "Get your Four Stages of AI Adoption roadmap — and have our team map it to your business on a short, private call.";
const HERO_CTA = "Book your roadmap call";
const HERO_TRUST = "For the leaders who just saw Chris Daigle speak.";

export const metadata: Metadata = {
  title: "The Four Stages of AI Adoption — Chief AI Officer",
  description:
    "Get your Four Stages of AI Adoption roadmap and have our team map it to your business on a short call.",
  robots: { index: true, follow: true },
};

export default function RoadmapPage() {
  const bookingBaseUrl =
    process.env.NEXT_PUBLIC_BOOKING_CALENDAR_URL ||
    // Dani Apgar's calendar (embeddable /widget/booking permalink).
    "https://api.leadconnectorhq.com/widget/booking/UPZT7IA9XbWWcjm5oFCz";

  return (
    <RoadmapClient
      fontClassName={`${instrumentSerif.variable} ${inter.variable}`}
      bookingBaseUrl={bookingBaseUrl}
      heroHeadline={HERO_HEADLINE}
      heroSubhead={HERO_SUBHEAD}
      heroCta={HERO_CTA}
      heroTrust={HERO_TRUST}
    />
  );
}
