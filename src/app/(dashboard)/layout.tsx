import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/ui/confirm";
import { getOptionalAuth } from "@/lib/auth/guard";
import { getDepartmentTabVisibility } from "@/lib/layout/visibility";
import { hiddenTabsForDepartment } from "@/lib/layout/nav";

// Header removed — profile/account menu now lives in the sidebar bottom.
// More screen real estate, fewer visual seams.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve per-department hidden tabs server-side (no client flash). These
  // limits apply ONLY to regular members (viewer role) — admins and
  // super_admins always see every tab so they can never lock themselves out.
  const user = await getOptionalAuth();
  let hiddenTabs: string[] = [];
  if (user && user.role === "viewer") {
    const config = await getDepartmentTabVisibility();
    hiddenTabs = hiddenTabsForDepartment(config, user.department);
  }

  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar hiddenTabs={hiddenTabs} />
        <div className="flex flex-1 flex-col pl-60 min-w-0">
          {/* overflow-x-clip (not -hidden) clips horizontal overflow WITHOUT
              creating a scroll container, so the window stays the scroller and
              `position: sticky` works for page content (e.g. sticky outlines). */}
          <main className="flex-1 bg-zinc-50 p-6 min-w-0 overflow-x-clip">
            <Suspense fallback={<div className="animate-pulse h-64 bg-zinc-100 rounded" />}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
      <Toaster position="top-right" />
      <ConfirmHost />
    </SessionProvider>
  );
}
