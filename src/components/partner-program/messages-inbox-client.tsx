"use client";

// CAIO team inbox. Left: one conversation per affiliate. Right: the selected
// thread (polled) + a composer with a "reply as me / CAIO Team" toggle.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Users,
} from "lucide-react";

export interface Conversation {
  partnerId: string;
  name: string;
  email: string;
  refCode: string;
  lastBody: string;
  lastAt: string;
  lastFromPartner: boolean;
  unread: number;
}

interface ThreadMsg {
  id: string;
  fromPartner: boolean;
  senderName: string;
  sentAsTeam: boolean;
  body: string;
  createdAt: string;
}

function shortWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function MessagesInboxClient({
  conversations,
  selectedId,
}: {
  conversations: Conversation[];
  selectedId: string | null;
}) {
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyAs, setReplyAs] = useState<"admin" | "caio_team">("caio_team");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/partners/${selectedId}/messages`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setPartnerName(data.partner?.name ?? "");
    } catch {
      // next poll retries
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setPartnerName("");
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [selectedId, load]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending || !selectedId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/partners/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, displayAs: replyAs }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setInput("");
      }
    } catch {
      // keep the draft
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-zinc-500" />
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="overflow-hidden rounded-xl border">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              No conversations yet. Affiliates can start one from their portal,
              or open a partner from the Partners list to message them.
            </div>
          ) : (
            <ul className="divide-y">
              {conversations.map((c) => {
                const active = c.partnerId === selectedId;
                return (
                  <li key={c.partnerId}>
                    <Link
                      href={`/partner-program/messages?partner=${c.partnerId}`}
                      className={`block px-4 py-3 transition hover:bg-zinc-50 ${
                        active ? "bg-indigo-50/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900">
                          {c.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {c.unread > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
                              {c.unread}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-400">
                            {shortWhen(c.lastAt)}
                          </span>
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {c.lastFromPartner ? "" : "You: "}
                        {c.lastBody}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className="flex h-[70vh] flex-col overflow-hidden rounded-xl border">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-500">
              Select a conversation to read and reply.
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900">
                  {partnerName || "…"}
                </p>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 px-4 py-4"
              >
                {loading && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">
                    No messages yet — start the conversation below.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.fromPartner ? "items-start" : "items-end"}`}
                    >
                      <span className="mb-0.5 px-1 text-[11px] font-medium text-zinc-500">
                        {m.senderName}
                      </span>
                      <div
                        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                          m.fromPartner
                            ? "bg-white text-zinc-800 ring-1 ring-zinc-200"
                            : "bg-indigo-600 text-white"
                        }`}
                      >
                        {m.body}
                      </div>
                      <span className="mt-0.5 px-1 text-[10px] text-zinc-400">
                        {shortWhen(m.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Composer */}
              <form onSubmit={send} className="border-t bg-white px-3 py-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs">
                  <span className="text-zinc-500">Reply as:</span>
                  <button
                    type="button"
                    onClick={() => setReplyAs("caio_team")}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition ${
                      replyAs === "caio_team"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    CAIO Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyAs("admin")}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition ${
                      replyAs === "admin"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    Myself
                  </button>
                  <span className="ml-1 text-[11px] text-zinc-400">
                    {replyAs === "caio_team"
                      ? "Affiliate sees “CAIO Team”."
                      : "Affiliate sees your name."}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(e);
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    placeholder="Type a reply…"
                    className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    aria-label="Send"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
