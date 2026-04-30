import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col pl-60">
          <Header />
          <main className="flex-1 bg-zinc-50 p-6">
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
