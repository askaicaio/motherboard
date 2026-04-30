import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (formerly Middleware)
 *
 * Protects dashboard routes by checking for auth session.
 * In development without NEXTAUTH_SECRET, redirects are disabled
 * to allow local UI development.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/callbacks") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
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
    // Protect all routes except auth, callbacks, and static assets
    "/((?!login|api/auth|api/callbacks|_next/static|_next/image|favicon.ico).*)",
  ],
};
