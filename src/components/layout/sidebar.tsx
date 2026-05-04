"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  UserPlus,
  List,
  Settings,
  ScrollText,
  Shield,
  Plug,
  FileText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canSeeCompanyReports } from "@/lib/auth/permissions";
import type { Department, AdminRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Returns true if this item should be visible to the given user. */
  visible?: (role: string | undefined, dept: string | undefined) => boolean;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: List },
  { href: "/onboarding/new", label: "New Request", icon: UserPlus },
  {
    href: "/reports",
    label: "Company Reports",
    icon: FileText,
    visible: (role, dept) =>
      canSeeCompanyReports(role as AdminRole, dept as Department),
  },
  { href: "/members", label: "Members", icon: Users },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/settings/rules", label: "Rules", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Pull role + department from the extended session user
  const sessionUser = session?.user as
    | { role?: string; department?: string }
    | undefined;
  const role = sessionUser?.role;
  const department = sessionUser?.department;

  // While the session is still loading, render gated items optimistically
  // (assume the user has access). Hide them only once we KNOW they don't.
  // This prevents the "flash where Company Reports appears late" — the
  // server-side page-level guard still enforces the actual permissions
  // if someone without access tries to navigate to the URL directly.
  const sessionLoading = status === "loading";

  const visibleItems = navItems.filter((item) => {
    if (!item.visible) return true;
    if (sessionLoading) return true; // optimistic during load
    return item.visible(role, department);
  });

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon-light.png"
            alt="Motherboard"
            width={28}
            height={28}
            className="dark:hidden"
            priority
          />
          <Image
            src="/icon-dark.png"
            alt="Motherboard"
            width={28}
            height={28}
            className="hidden dark:block"
            priority
          />
          <span className="text-sm font-semibold tracking-tight">
            Motherboard
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
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
