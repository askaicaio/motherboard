import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

// Header removed — profile/account menu now lives in the sidebar bottom.
// More screen real estate, fewer visual seams.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col pl-60 min-w-0">
          <main className="flex-1 bg-zinc-50 p-6 min-w-0 overflow-x-hidden">
            <Suspense fallback={<div className="animate-pulse h-64 bg-zinc-100 rounded" />}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
      <Toaster position="top-right" />
    </SessionProvider>
  );
}
