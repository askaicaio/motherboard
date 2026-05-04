import Link from "next/link";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { WelcomeFormClient } from "./welcome-form-client";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <InvalidTokenScreen
        message="No invite token in the link. Please check the URL or ask an admin to resend the invite."
      />
    );
  }

  // Look up the member by token
  const [member] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      department: adminUsers.department,
      inviteTokenExpiresAt: adminUsers.inviteTokenExpiresAt,
      passwordHash: adminUsers.passwordHash,
    })
    .from(adminUsers)
    .where(eq(adminUsers.inviteToken, token))
    .limit(1);

  if (!member) {
    return (
      <InvalidTokenScreen
        message="This invite link is invalid or has already been used. Ask an admin to send a new one."
      />
    );
  }

  if (member.inviteTokenExpiresAt && member.inviteTokenExpiresAt.getTime() < Date.now()) {
    return (
      <InvalidTokenScreen
        message="This invite link has expired. Ask an admin to send a new one."
      />
    );
  }

  // Token is valid — render the activation form
  return (
    <WelcomeFormClient
      memberId={member.id}
      memberName={member.name}
      memberEmail={member.email}
      memberRole={member.role === "admin" || member.role === "super_admin" ? "Admin" : "User"}
      memberDepartment={member.department || "unassigned"}
      hasPassword={!!member.passwordHash}
      token={token}
    />
  );
}

function InvalidTokenScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
          <span className="text-lg">⚠️</span>
        </div>
        <h1 className="text-xl font-medium tracking-tight text-zinc-900 mb-2">
          Invite link not valid
        </h1>
        <p className="text-sm text-zinc-600 mb-6 leading-relaxed">{message}</p>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            Go to sign-in
          </Button>
        </Link>
      </div>
    </div>
  );
}
