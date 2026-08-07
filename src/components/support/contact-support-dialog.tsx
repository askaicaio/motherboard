"use client";

// A "Send us a message" lightbox that replaces confusing raw mailto: links on
// the public affiliate / enroll pages. Renders a trigger styled to match the
// surrounding page (via triggerClassName), opens a small form, and POSTs to
// /api/contact which emails the support inbox (Dani) with the sender's address
// as reply-to. Mirrors the house dialog pattern in invite-member-dialog.tsx.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** The clickable trigger content (text and/or icon). */
  children: React.ReactNode;
  /** Classes for the trigger button so it matches the surrounding page. */
  triggerClassName?: string;
  /** Short page label sent along for context (e.g. "Enroll page"). */
  source?: string;
  /** Optional prefill for the email field. */
  defaultEmail?: string;
}

export function ContactSupportDialog({
  children,
  triggerClassName,
  source,
  defaultEmail,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please add your name, email, and a message.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          source,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success("Message sent — we'll reply to your email shortly.");
      setOpen(false);
      setName("");
      setMessage("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't send your message.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger type="button" className={triggerClassName}>
        {children}
      </DialogTrigger>
      <DialogContent className="!max-w-lg">
        <DialogHeader>
          <DialogTitle>Send us a message</DialogTitle>
          <DialogDescription>
            Have a question? Send it here and we&apos;ll reply to your email
            shortly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cs-name">
              Your name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-email">
              Your email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cs-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-message">
              Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="cs-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              rows={5}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send message
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
