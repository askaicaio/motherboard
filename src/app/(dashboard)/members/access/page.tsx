// Department tab visibility — staff access control matrix.
import { requireRole } from "@/lib/auth/guard";
import { getDepartmentTabVisibility } from "@/lib/layout/visibility";
import { MANAGEABLE_TABS } from "@/lib/layout/nav";
import { DEPARTMENTS_LIST } from "@/types";
import { DepartmentAccessClient } from "@/components/members/department-access-client";

export const dynamic = "force-dynamic";

export default async function DepartmentAccessPage() {
  // Editing access control is an admin action.
  await requireRole("admin");
  const config = await getDepartmentTabVisibility();

  return (
    <DepartmentAccessClient
      initialConfig={config}
      departments={DEPARTMENTS_LIST}
      tabs={MANAGEABLE_TABS}
    />
  );
}
