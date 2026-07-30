"use client";

// Affiliate-program notification config — the bell button in the program header
// (between the email and gear icons). Opens a popover with:
//   • a checklist of which events generate notifications (global),
//   • a Subscribers roster (avatar + name), each with an email opt-in Switch
//     and a remove control, plus a + to add teammates via member search.
// In-app notifications are always on for a subscriber; email is opt-in.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Bell, Plus, X, Search, Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EventDef {
  key: string;
  label: string;
  description: string;
}
interface Subscriber {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  emailEnabled: boolean;
}
interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

const BASE = "/api/partner-program/notifications";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function NotificationSettingsPopover() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allEvents, setAllEvents] = useState<EventDef[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  const [adding, setAdding] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(BASE, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAllEvents(data.allEvents ?? []);
      setEnabled(new Set<string>(data.events ?? []));
      setSubscribers(data.subscribers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
    else {
      setAdding(false);
      setQuery("");
    }
  }, [open, load]);

  // ── Event checklist ──────────────────────────────────────────────────────
  async function toggleEvent(key: string) {
    const next = new Set(enabled);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setEnabled(next);
    const res = await fetch(BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [...next] }),
    });
    if (!res.ok) {
      toast.error("Couldn't save that change.");
      load();
    }
  }

  // ── Subscribers ──────────────────────────────────────────────────────────
  async function toggleEmail(userId: string, value: boolean) {
    setSubscribers((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, emailEnabled: value } : s)),
    );
    const res = await fetch(`${BASE}/subscribers/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailEnabled: value }),
    });
    if (!res.ok) {
      toast.error("Couldn't update email preference.");
      load();
    }
  }

  async function removeSubscriber(userId: string) {
    setSubscribers((prev) => prev.filter((s) => s.userId !== userId));
    const res = await fetch(`${BASE}/subscribers/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Couldn't remove subscriber.");
      load();
    }
  }

  async function openAdd() {
    setAdding(true);
    if (!members) {
      try {
        const res = await fetch("/api/members", { cache: "no-store" });
        const data = await res.json();
        setMembers(
          (data.members ?? []).map(
            (m: { id: string; name: string; email: string; avatarUrl: string | null }) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              avatarUrl: m.avatarUrl ?? null,
            }),
          ),
        );
      } catch {
        toast.error("Couldn't load members.");
      }
    }
    setTimeout(() => searchRef.current?.focus(), 30);
  }

  async function addSubscriber(m: Member) {
    // Optimistic — drop it in immediately.
    setSubscribers((prev) => [
      ...prev,
      {
        userId: m.id,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatarUrl,
        emailEnabled: false,
      },
    ]);
    setQuery("");
    const res = await fetch(`${BASE}/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: m.id }),
    });
    if (!res.ok) {
      toast.error("Couldn't add that member.");
      load();
    }
  }

  const subscribedIds = useMemo(
    () => new Set(subscribers.map((s) => s.userId)),
    [subscribers],
  );

  const candidates = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !subscribedIds.has(m.id))
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [members, subscribedIds, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Notification settings"
        title="Notification settings"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 data-[popup-open]:bg-zinc-50"
      >
        <Bell className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] gap-0 p-0"
      >
        {loading && allEvents.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            {/* Event checklist */}
            <div className="border-b border-zinc-100 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Notify about
              </p>
              <div className="mt-2 space-y-2">
                {allEvents.map((e) => (
                  <label
                    key={e.key}
                    className="flex cursor-pointer items-start gap-2.5"
                  >
                    <Checkbox
                      checked={enabled.has(e.key)}
                      onCheckedChange={() => toggleEvent(e.key)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-zinc-800">
                        {e.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-zinc-500">
                        {e.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subscribers */}
            <div className="px-3.5 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Subscribers
                  {subscribers.length > 0 && (
                    <span className="ml-1 text-zinc-300">
                      ({subscribers.length})
                    </span>
                  )}
                </p>
                {!adding && (
                  <button
                    type="button"
                    onClick={openAdd}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                )}
              </div>

              {/* Add-member search */}
              {adding && (
                <div className="mt-2 rounded-md border border-zinc-200">
                  <div className="flex items-center gap-2 border-b border-zinc-100 px-2.5 py-1.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search team members…"
                      className="w-full bg-transparent text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setQuery("");
                      }}
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      aria-label="Close member search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-[176px] overflow-y-auto py-1">
                    {members === null ? (
                      <div className="flex items-center justify-center py-4 text-zinc-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      </div>
                    ) : candidates.length === 0 ? (
                      <p className="px-3 py-3 text-center text-[11px] text-zinc-400">
                        {query ? "No matches." : "Everyone's already subscribed."}
                      </p>
                    ) : (
                      candidates.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => addSubscriber(m)}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-zinc-50"
                        >
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={m.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[9px]">
                              {initials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-zinc-800">
                              {m.name}
                            </span>
                            <span className="block truncate text-[10px] text-zinc-500">
                              {m.email}
                            </span>
                          </span>
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Roster */}
              {subscribers.length === 0 && !adding ? (
                <p className="mt-2 rounded-md bg-zinc-50 px-3 py-4 text-center text-[11px] text-zinc-400">
                  No one's subscribed yet. Add teammates to start sending
                  notifications.
                </p>
              ) : (
                <ul className="mt-2 max-h-[220px] space-y-0.5 overflow-y-auto">
                  {subscribers.map((s) => (
                    <li
                      key={s.userId}
                      className="group/sub flex items-center gap-2 rounded-md px-1 py-1 hover:bg-zinc-50"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={s.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(s.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-800">
                          {s.name}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500">
                          {s.email}
                        </p>
                      </div>
                      <label
                        className="flex shrink-0 items-center gap-1.5"
                        title={
                          s.emailEnabled
                            ? "Email notifications on"
                            : "In-app only (email off)"
                        }
                      >
                        <span className="text-[10px] text-zinc-400">Email</span>
                        <Switch
                          size="sm"
                          checked={s.emailEnabled}
                          onCheckedChange={(v: boolean) =>
                            toggleEmail(s.userId, v)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeSubscriber(s.userId)}
                        title="Remove subscriber"
                        aria-label={`Remove ${s.name}`}
                        className="shrink-0 rounded p-1 text-zinc-300 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-600 group-hover/sub:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[10px] leading-snug text-zinc-400">
                In-app notifications are always on for subscribers. Email is
                opt-in and, when on, CCs everyone on one message.
              </p>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
