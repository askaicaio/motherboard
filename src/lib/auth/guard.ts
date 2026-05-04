import { auth, type SessionUser } from "./options";
import { redirect } from "next/navigation";
import type { AdminRole } from "@/types";

/**
 * Dev-mode mock user when NEXTAUTH_SECRET is not set.
 * This allows local UI development without Google OAuth configured.
 */
const DEV_MOCK_USER: SessionUser = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "CAIO Admin (Dev)",
  email: "admin@chiefaiofficer.com",
  image: null,
  role: "super_admin",
  department: "operations",
};

function isDevBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" && !process.env.NEXTAUTH_SECRET
  );
}

/**
 * Server-side auth guard. Use in server components and API routes.
 * Returns the authenticated session user or redirects to login.
 *
 * In dev mode without NEXTAUTH_SECRET, returns a mock super_admin user.
 */
export async function requireAuth(): Promise<SessionUser> {
  if (isDevBypass()) return DEV_MOCK_USER;

  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }
  return session.user as SessionUser;
}

/**
 * Require a specific role level. Roles are ordered:
 * super_admin > admin > viewer
 */
export async function requireRole(minRole: AdminRole): Promise<SessionUser> {
  const user = await requireAuth();
  const roleLevel: Record<AdminRole, number> = {
    viewer: 0,
    admin: 1,
    super_admin: 2,
  };
  if (roleLevel[user.role] < roleLevel[minRole]) {
    throw new Error(`Insufficient permissions. Required: ${minRole}`);
  }
  return user;
}

/**
 * Get session without redirecting. Returns null if not authenticated.
 * In dev mode without NEXTAUTH_SECRET, returns mock user.
 */
export async function getOptionalAuth(): Promise<SessionUser | null> {
  if (isDevBypass()) return DEV_MOCK_USER;

  const session = await auth();
  if (!session?.user?.email) return null;
  return session.user as SessionUser;
}
