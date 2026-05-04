import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { canSeeCompanyReports } from "@/lib/auth/permissions";

/**
 * Server-side gate: Company Reports tab is only accessible to
 * admins and members of the Sales department.
 *
 * The sidebar already hides the link from non-permitted users, but
 * this layout enforces the rule at the URL level so direct navigation
 * also fails closed.
 */
export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  if (!canSeeCompanyReports(user.role, user.department)) {
    redirect("/?denied=reports");
  }
  return <>{children}</>;
}
