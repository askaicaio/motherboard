"use client";

// Per-user notification inbox — the borderless bell that replaces the sidebar
// profile chevron. Shows a red unread badge, an Inbox/Archived toggle, and
// per-item mark-read/unread + archive. Clicking an item marks it read and
// navigates to its link.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  ArchiveRestore,
  Inbox,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkHref: string | null;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"inbox" | "archived">("inbox");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (which: "inbox" | "archived") => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications${which === "archived" ? "?view=archived" : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Light badge poll — refresh the unread count in the background.
  const pollBadge = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    pollBadge();
    const t = setInterval(pollBadge, 60_000);
    return () => clearInterval(t);
  }, [pollBadge]);

  // (Re)load the list whenever the panel opens or the tab changes.
  useEffect(() => {
    if (open) load(view);
  }, [open, view, load]);

  const patch = async (
    id: string,
    action: "read" | "unread" | "archive" | "unarchive",
  ) => {
    // Optimistic update.
    setRows((prev) => {
      if (action === "archive" || action === "unarchive") {
        return prev.filter((r) => r.id !== id);
      }
      return prev.map((r) =>
        r.id === id ? { ...r, isRead: action === "read" } : r,
      );
    });
    if (action === "read") setUnread((u) => Math.max(0, u - 1));
    if (action === "unread") setUnread((u) => u + 1);
    if (action === "archive") {
      const r = rows.find((x) => x.id === id);
      if (r && !r.isRead) setUnread((u) => Math.max(0, u - 1));
    }
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  };

  const markAllRead = async () => {
    setRows((prev) => prev.map((r) => ({ ...r, isRead: true })));
    setUnread(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
  };

  const openItem = async (r: NotificationRow) => {
    if (!r.isRead) await patch(r.id, "read");
    setOpen(false);
    if (r.linkHref) router.push(r.linkHref);
  };

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {badge}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[340px] gap-0 p-0"
      >
        {/* Header + tabs */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
          <div className="flex items-center gap-1 rounded-md bg-zinc-100 p-0.5">
            <button
              type="button"
              onClick={() => setView("inbox")}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition",
                view === "inbox"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setView("archived")}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition",
                view === "archived"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              Archived
            </button>
          </div>
          {view === "inbox" && unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[380px] overflow-y-auto">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-zinc-400">
              <Inbox className="h-6 w-6" />
              <p className="text-xs">
                {view === "inbox"
                  ? "You're all caught up."
                  : "Nothing archived."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    "group/notif relative flex gap-2.5 px-3 py-2.5 transition hover:bg-zinc-50",
                    !r.isRead && "bg-indigo-50/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      r.isRead ? "bg-transparent" : "bg-indigo-500",
                    )}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => openItem(r)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        "truncate text-xs",
                        r.isRead
                          ? "font-medium text-zinc-700"
                          : "font-semibold text-zinc-900",
                      )}
                    >
                      {r.title}
                    </p>
                    {r.body && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">
                        {r.body}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      {formatDistanceToNow(new Date(r.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </button>
                  {/* Row actions — revealed on hover */}
                  <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition group-hover/notif:opacity-100">
                    {view === "inbox" ? (
                      <>
                        <button
                          type="button"
                          title={r.isRead ? "Mark as unread" : "Mark as read"}
                          onClick={() =>
                            patch(r.id, r.isRead ? "unread" : "read")
                          }
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Archive"
                          onClick={() => patch(r.id, "archive")}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        title="Move back to inbox"
                        onClick={() => patch(r.id, "unarchive")}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
