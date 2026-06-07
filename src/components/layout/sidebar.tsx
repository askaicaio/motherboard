"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
  Megaphone,
  BookOpen,
  Workflow,
  Receipt,
  LogOut,
  UserRound,
  ChevronUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/subscriptions", label: "Subscriptions", icon: Receipt },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/settings/rules", label: "Rules", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

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

      {/* Profile chip at the bottom of the sidebar — standard pattern
          (Slack/Linear/Notion). Opens upward into the account menu.
          Environment label sits below as a thin status line. */}
      <div className="border-t p-2">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 cursor-pointer"
              aria-label="Account menu"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-zinc-800">
                  {user.name}
                </div>
                <div className="truncate text-[11px] font-mono text-zinc-500">
                  {user.email}
                </div>
              </div>
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="truncate font-mono text-xs text-zinc-500">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/members")}>
                <UserRound className="mr-2 h-4 w-4" />
                My profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => signOut({ callbackUrl: "/login" })}
                className="text-red-600 focus:text-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="mt-1 flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-400">
          <span>
            {process.env.PROVISIONING_MODE === "live" ? "Production" : "Dev"}
          </span>
          <span className="font-mono text-zinc-300">Motherboard</span>
        </div>
      </div>
    </aside>
  );
}
