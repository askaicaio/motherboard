"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  List,
  Settings,
  ScrollText,
  Shield,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: List },
  { href: "/onboarding/new", label: "New Request", icon: UserPlus },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/settings/rules", label: "Rules", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white text-sm font-bold">
            C
          </div>
          <span className="text-sm font-semibold tracking-tight">
            CAIO Internal
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="rounded-md bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Environment</p>
          <p className="text-xs font-medium text-zinc-700">
            {process.env.PROVISIONING_MODE === "live" ? "Production" : "Development (Mock)"}
          </p>
        </div>
      </div>
    </aside>
  );
}
