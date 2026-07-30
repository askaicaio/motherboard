"use client";

// Affiliate-facing chat widget, mounted bottom-right across the portal. Talks
// to /api/portal/messages. Polls unread while closed and the full thread while
// open (no realtime primitive exists). Sending is disabled while a staff member
// is impersonating (the API also enforces this).
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  fromPartner: boolean;
  senderName: string;
  body: string;
  createdAt: string;
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatWidget({ impersonating }: { impersonating: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/messages", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setUnread(0);
    } catch {
      // transient — the next poll retries
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/messages?peek=1", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unread ?? 0);
    } catch {
      // ignore
    }
  }, []);

  // Badge poll while closed.
  useEffect(() => {
    if (open) return;
    loadUnread();
    const t = setInterval(loadUnread, 20000);
    return () => clearInterval(t);
  }, [open, loadUnread]);

  // Thread poll while open.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
    const t = setInterval(loadMessages, 12000);
    return () => clearInterval(t);
  }, [open, loadMessages]);

  // Keep the view pinned to the latest message.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setInput("");
      }
    } catch {
      // leave the text in the box so they can retry
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat with the CAIO team"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#4f46e5]/80 text-white shadow-lg backdrop-blur transition hover:bg-[#4f46e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]/50"
      >
        <MessageCircle className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#1e1b4b] px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Chat with CAIO</p>
          <p className="text-[11px] text-indigo-200">
            We reply as soon as we can.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="rounded-lg p-1 text-indigo-200 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4">
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
            Questions about the program, a payout, or a lead? Send us a message
            — the CAIO team will get back to you here.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.fromPartner ? "items-end" : "items-start"}`}
            >
              {!m.fromPartner && (
                <span className="mb-0.5 px-1 text-[11px] font-medium text-slate-500">
                  {m.senderName}
                </span>
              )}
              <div
                className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  m.fromPartner
                    ? "bg-[#4f46e5] text-white"
                    : "bg-white text-slate-800 ring-1 ring-slate-200"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-0.5 px-1 text-[10px] text-slate-400">
                {shortTime(m.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      {impersonating ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
          Read-only while viewing as an affiliate.
        </div>
      ) : (
        <form
          onSubmit={send}
          className="flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-3"
        >
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
            placeholder="Type a message…"
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#1e1b4b] outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4f46e5] text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      )}
    </div>
  );
}
