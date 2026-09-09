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
  Handshake,
  Sparkles,
  LogOut,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isAutomationVersionPath } from "@/lib/automations/versions";
import { canSeeCompanyReports } from "@/lib/auth/permissions";
import { MANAGEABLE_TABS } from "@/lib/layout/nav";
import type { Department, AdminRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Returns true if this item should be visible to the given user. */
  visible?: (role: string | undefined, dept: string | undefined) => boolean;
}

// Icon per href — kept here (client) while the href/label list lives in the
// shared registry so the sidebar and the visibility editor never drift.
const ICONS: Record<string, React.ElementType> = {
  "/": LayoutDashboard,
  "/onboarding": List,
  "/onboarding/new": UserPlus,
  "/reports": FileText,
  "/members": Users,
  "/leads": Sparkles,
  "/campaigns": Megaphone,
  "/automations": Workflow,
  "/docs": BookOpen,
  "/subscriptions": Receipt,
  "/partner-program": Handshake,
  "/integrations": Plug,
  "/audit-log": ScrollText,
  "/settings/rules": Shield,
  "/settings": Settings,
};

// The Automations tab is the one nav item that opens a MENU instead of
// navigating: the hub exists in several versions and the tab fans out to all
// of them. "Official" is the live page; each redesign preview lives at its own
// top-level route (NOT a child of /automations) so nothing about the live tab
// can be affected by them. Every route here keeps the single Automations tab
// highlighted, so the sidebar still shows where you are.
//
// ADD A FUTURE VERSION HERE AND NOWHERE ELSE: the menu, the highlight rule and
// the current-version check all read this list.
//
// ⚠️ ORDER IS THE USER'S, and "Beta" sits at index 1 DELIBERATELY: below Official,
// above the Alphas. It is not another proposal like the Alphas are. It started
// (2026-08-29) as an exact working mirror of the live hub and is the bench where
// elements picked out of the Alphas get assembled, so it belongs next to the page
// it is being compared against.
const AUTOMATIONS_HREF = "/automations";
// ⚠️⚠️ THE VERSION LIST USED TO LIVE HERE, along with a DROPDOWN MENU on the
// Automations tab that was the only way to reach the Alpha and Beta benches.
// Both went on 2026-09-08: "In S2, remove the old way to access the pages
// since the new feature can do it. The dropdown for the page selection when
// clicking the automation tab at the left sidebar is also not needed anymore."
//
// The list moved to `@/lib/automations/versions` and **the benches are now
// reached from the Feature Integration page instead**, which lists them as
// new-tab links. The Automations tab is an ordinary link again, like every
// other tab.
//
// ⚠️ THE ONE THING THIS FILE STILL NEEDS FROM THAT REGISTRY is
// `isAutomationVersionPath()`, folded into `isActive` below: it keeps the
// Automations tab highlighted while you sit on a bench route. A plain prefix
// match cannot do that, because "/automations-beta2" is NOT a child of
// "/automations". Without it, no tab looks active on a bench page.

// Role/department predicates for tabs that gate on more than the
// per-department visibility config.
const VISIBLE: Record<
  string,
  (role: string | undefined, dept: string | undefined) => boolean
> = {
  "/reports": (role, dept) =>
    canSeeCompanyReports(role as AdminRole, dept as Department),
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  ...MANAGEABLE_TABS.map((t) => ({
    href: t.href,
    label: t.label,
    icon: ICONS[t.href] ?? LayoutDashboard,
    visible: VISIBLE[t.href],
  })),
];

export function Sidebar({ hiddenTabs = [] }: { hiddenTabs?: string[] }) {
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

  const hidden = new Set(hiddenTabs);
  const visibleItems = navItems.filter((item) => {
    // Per-department visibility: a tab hidden for this user's department is
    // removed. The hiddenTabs list is resolved server-side in the layout and
    // only applies to non-admin members, so admins never get locked out.
    if (hidden.has(item.href)) return false;
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
          // Active = this exact route, or one of its CHILD routes. The match
          // stops at a path segment boundary: a plain startsWith would also
          // light "/automations" up while sitting on an unrelated route that
          // merely begins with those characters (e.g. "/automations-alpha",
          // which the Automations tab claims DELIBERATELY, just below, rather
          // than by accident). Every existing tab is unaffected, since a real
          // child route always begins with "<href>/".
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                // The Automations tab ALSO claims every bench route
                // ("/automations-beta2", "/automations-alpha4", ...). Those are
                // siblings of "/automations", not children, so the prefix
                // match above misses them. See the note on the registry.
                (item.href === AUTOMATIONS_HREF &&
                  isAutomationVersionPath(pathname));

          // ⚠️ THE AUTOMATIONS TAB HAD A SPECIAL CASE HERE, a DropdownMenu
          // listing every version instead of a plain link. It went on
          // 2026-09-08; the tab is an ordinary Link again and falls through to
          // the shared branch below. Its highlight-on-a-bench-route behaviour
          // survives, in `isActive` above. See the registry note at the top.

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
          <div className="flex items-center gap-1">
            <DropdownMenu>
            <DropdownMenuTrigger
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 cursor-pointer"
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
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="truncate font-mono text-xs text-zinc-500">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/members")}>
                <UserRound className="mr-2 h-4 w-4" />
                My profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-red-600 focus:text-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell />
          </div>
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
