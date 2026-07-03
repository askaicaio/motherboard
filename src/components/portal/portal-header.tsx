"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/activity", label: "Activity" },
  { href: "/portal/payouts", label: "Payouts" },
  { href: "/portal/disputes", label: "Disputes" },
  { href: "/portal/resources", label: "Resources" },
  { href: "/portal/toolkit", label: "Toolkit" },
];

export function PortalHeader({
  partner,
}: {
  partner: { name: string; email: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href={partner ? "/portal" : "/partners"} className="flex items-center gap-2.5">
          <Image
            src="/caio-scalingup.png"
            alt="Chief AI Officer — in partnership with Scaling Up"
            width={4000}
            height={1000}
            className="h-6 w-auto"
          />
          <span className="hidden border-l border-slate-200 pl-2.5 text-sm font-semibold tracking-tight text-slate-500 sm:inline">
            Affiliate Portal
          </span>
        </Link>

        {partner && (
          <div className="flex items-center gap-1">
            <nav className="mr-2 hidden items-center gap-1 sm:flex">
              {NAV.map((item) => {
                const active =
                  item.href === "/portal"
                    ? pathname === "/portal"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition",
                      active
                        ? "bg-indigo-50 text-[#4f46e5]"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
