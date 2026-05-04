import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { AdminRole, Department } from "@/types";

// ---- Domain restriction ----
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "chiefaiofficer.com";

function isAllowedDomain(email: string): boolean {
  return email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Restrict the Google consent screen to the organization domain
          hd: ALLOWED_EMAIL_DOMAIN,
          // Always show the account picker so users can choose between
          // multiple Google accounts (work vs personal)
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // HARD GATE: Only @chiefaiofficer.com Google accounts allowed
      if (!isAllowedDomain(user.email)) {
        console.warn(
          `[AUTH] Rejected sign-in from non-org email: ${user.email}`
        );
        return false;
      }

      // Verify the Google token's hd (hosted domain) claim matches
      if (account?.provider === "google") {
        const idToken = account.id_token;
        if (idToken) {
          try {
            const payload = JSON.parse(
              Buffer.from(idToken.split(".")[1], "base64").toString()
            );
            if (payload.hd !== ALLOWED_EMAIL_DOMAIN) {
              console.warn(
                `[AUTH] Rejected sign-in: Google hd claim "${payload.hd}" !== "${ALLOWED_EMAIL_DOMAIN}"`
              );
              return false;
            }
          } catch {
            // If token parsing fails, still allow if email domain matches
          }
        }
      }

      // Only allow users who exist in admin_users table and are active
      const adminUser = await db.query.adminUsers.findFirst({
        where: eq(adminUsers.email, user.email),
      });

      if (!adminUser?.isActive) {
        console.warn(
          `[AUTH] Rejected sign-in: user ${user.email} not found or inactive in admin_users`
        );
        return false;
      }

      // Update last login timestamp
      await db
        .update(adminUsers)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(adminUsers.email, user.email));

      return true;
    },

    async session({ session }) {
      if (session.user?.email) {
        const adminUser = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.email, session.user.email),
        });
        if (adminUser) {
          const extUser = session.user as unknown as SessionUser;
          extUser.id = adminUser.id;
          extUser.role = adminUser.role as AdminRole;
          extUser.department = (adminUser.department as Department) || "unassigned";
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

// Extended session user type
export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: AdminRole;
  department?: Department;
}

export { ALLOWED_EMAIL_DOMAIN };
