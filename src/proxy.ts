import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (formerly Middleware)
 *
 * Protects dashboard routes by checking for auth session.
 * In development without NEXTAUTH_SECRET, redirects are disabled
 * to allow local UI development.
 */
// Static asset extensions that should never be auth-gated
const STATIC_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif",
  ".ico", ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".css", ".js", ".map", ".txt", ".json", ".xml",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets
  const hasStaticExtension = STATIC_EXTENSIONS.some((ext) =>
    pathname.toLowerCase().endsWith(ext)
  );

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/welcome") || // public — token-gated invite acceptance
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/callbacks") ||
    pathname.startsWith("/api/welcome") || // public — token-gated activation
    pathname.startsWith("/api/inngest") || // Inngest webhook — verifies its own signatures
    pathname.startsWith("/api/cron") || // Vercel cron — enforces its own CRON_SECRET
    // ---- Partner Program PUBLIC surfaces (affiliate-facing) ----
    pathname === "/partners" ||
    pathname.startsWith("/partners/") || // landing, apply, resources, thank-you
    pathname === "/r" || // affiliate click tracker (NOT /reports — exact match)
    pathname.startsWith("/api/stripe/webhook") || // Stripe → us; verifies its own signature
    pathname.startsWith("/api/partners/checkout") || // public checkout-session creation
    pathname.startsWith("/api/partners/apply") || // public application intake
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    hasStaticExtension
  ) {
    return NextResponse.next();
  }

  // Check for session token (NextAuth.js sets this cookie)
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  // In dev mode without NEXTAUTH_SECRET, allow all access for UI development
  const isDev = process.env.NODE_ENV === "development";
  const hasAuthSecret = !!process.env.NEXTAUTH_SECRET;

  if (!sessionToken && (!isDev || hasAuthSecret)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect all routes EXCEPT:
     * - login page
     * - NextAuth API routes
     * - n8n callback API
     * - Vercel cron routes (they enforce their own CRON_SECRET)
     * - Next.js internals (static, image, prefetch)
     * - any file with an extension (favicon.ico, .png, .css, etc.)
     *
     * The negative lookahead at the end (`\\..*`) ensures any path with
     * a `.` followed by characters (i.e. a file with extension) is
     * skipped — this handles all public/ static assets in one shot.
     */
    "/((?!login|welcome|partners|r$|api/auth|api/callbacks|api/welcome|api/inngest|api/cron|api/stripe/webhook|api/partners/checkout|api/partners/apply|_next/static|_next/image|.*\\..*).*)",
  ],
};
