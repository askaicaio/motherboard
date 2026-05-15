"use client";

import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserRound, Users, Settings as SettingsIcon, ChevronDown } from "lucide-react";

export function Header() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user;
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

  // Show a quiet placeholder while the session is still resolving so the
  // chip is never in a half-rendered state that could look broken.
  if (status === "loading") {
    return (
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-6">
        <div />
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-7 w-7 rounded-full bg-zinc-100" />
          <div className="h-3 w-24 rounded bg-zinc-100" />
        </div>
      </header>
    );
  }

  // If somehow we render without a session (shouldn't happen — proxy
  // redirects to /login), render a sign-in link instead of a broken chip.
  if (!user) {
    return (
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-6">
        <div />
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          Sign in
        </button>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 cursor-pointer"
          aria-label="Account menu"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-zinc-700">{user.name}</span>
          <ChevronDown className="h-3 w-3 text-zinc-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-zinc-500 truncate font-mono">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/members")}>
            <UserRound className="mr-2 h-4 w-4" />
            My profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/members")}>
            <Users className="mr-2 h-4 w-4" />
            Team members
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/settings")}>
            <SettingsIcon className="mr-2 h-4 w-4" />
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
    </header>
  );
}
