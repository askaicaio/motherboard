import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "CAIO Internal Dashboard",
  description: "Employee onboarding and provisioning management",
  // Default (Motherboard) favicon = the "M" monogram, theme-aware. This applies
  // to the dashboard + staff login. The affiliate section (portal/partners/
  // enroll) overrides this to the CAIO mark via its own layout metadata. The
  // shared /favicon.ico (public/) is the CAIO mark — that's what 1Password and
  // legacy browsers fetch, and it can only exist once for the whole app.
  icons: {
    icon: [
      { url: "/icon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-light">{children}</body>
    </html>
  );
}
