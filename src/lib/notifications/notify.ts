// =============================================================
// Affiliate-program notifications — the single fan-out path.
//
// notifyProgramEvent() checks whether the event type is enabled globally, then
// for every subscriber writes an in-app row (the sidebar bell) and, for those
// who opted into email, sends ONE email CC'ing the group. Best-effort: any
// failure is logged and swallowed so it can never break the action that fired
// it (an application, a message, a sale, a dispute).
// =============================================================

import { db } from "@/lib/db";
import {
  adminUsers,
  partnerNotificationSettings,
  partnerNotificationSubscribers,
  staffNotifications,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { sendEmail } from "@/lib/email/sender";

export type NotificationEventType =
  | "application"
  | "message"
  | "conversion"
  | "dispute";

export interface NotificationEventDef {
  key: NotificationEventType;
  label: string;
  description: string;
}

/** The event types that can generate a notification (drives the config checklist). */
export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  {
    key: "application",
    label: "New application submitted",
    description: "An affiliate applies via the public form.",
  },
  {
    key: "message",
    label: "New affiliate message",
    description: "An affiliate sends a chat message to the CAIO team.",
  },
  {
    key: "conversion",
    label: "New sale / conversion",
    description: "A referred purchase is recorded (a commission is earned).",
  },
  {
    key: "dispute",
    label: "New dispute filed",
    description: "An affiliate disputes a conversion decision.",
  },
];

const DEFAULT_EVENTS: NotificationEventType[] = [
  "application",
  "message",
  "conversion",
  "dispute",
];

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://motherboard.chiefaiofficer.com"
).replace(/\/$/, "");

/** Escape user-supplied text before embedding it in the notification email. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Enabled event keys (falls back to all-on if the settings row is missing). */
export async function getEnabledEvents(): Promise<string[]> {
  try {
    const [row] = await db
      .select({ events: partnerNotificationSettings.events })
      .from(partnerNotificationSettings)
      .where(eq(partnerNotificationSettings.id, "default"))
      .limit(1);
    return row?.events ?? DEFAULT_EVENTS;
  } catch {
    return DEFAULT_EVENTS;
  }
}

/** A plain internal email (not the affiliate-branded chrome) for staff. */
function renderInternalNotification(opts: {
  title: string;
  body?: string;
  link: string;
}): { html: string; plain: string } {
  const title = escapeHtml(opts.title);
  const body = opts.body ? escapeHtml(opts.body) : "";
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:0 0 8px;">Affiliate Program</p>
  <h1 style="font-size:18px;line-height:1.35;margin:0 0 8px;color:#111827;">${title}</h1>
  ${body ? `<p style="font-size:14px;line-height:1.6;color:#3f3f46;margin:0 0 16px;">${body}</p>` : ""}
  <a href="${opts.link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;">Open in Motherboard</a>
  <p style="font-size:11px;color:#a1a1aa;margin:24px 0 0;line-height:1.6;">You're receiving this because you subscribed to affiliate-program notifications in Motherboard. Manage this in Affiliate Program → notifications.</p>
</div>`;
  const plain = `Affiliate Program — ${opts.title}\n\n${opts.body ?? ""}\n\nOpen: ${opts.link}`;
  return { html, plain };
}

/**
 * Fan a program event out to every subscriber. Never throws.
 */
export async function notifyProgramEvent(params: {
  type: NotificationEventType;
  title: string;
  body?: string;
  /** Relative in-app path the notification (and email button) opens. */
  linkHref?: string;
}): Promise<void> {
  try {
    const enabled = await getEnabledEvents();
    if (!enabled.includes(params.type)) return;

    const subs = await db
      .select({
        userId: partnerNotificationSubscribers.userId,
        emailEnabled: partnerNotificationSubscribers.emailEnabled,
      })
      .from(partnerNotificationSubscribers);
    if (subs.length === 0) return;

    // (a) In-app row for every subscriber.
    await db.insert(staffNotifications).values(
      subs.map((s) => ({
        userId: s.userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        linkHref: params.linkHref ?? null,
      })),
    );

    // (b) One CC'd email to everyone who opted into email.
    const emailUserIds = subs.filter((s) => s.emailEnabled).map((s) => s.userId);
    if (emailUserIds.length > 0) {
      const recipients = await db
        .select({ email: adminUsers.email })
        .from(adminUsers)
        .where(inArray(adminUsers.id, emailUserIds));
      const emails = recipients.map((r) => r.email).filter(Boolean);
      if (emails.length > 0) {
        const link = params.linkHref
          ? `${APP_URL}${params.linkHref}`
          : APP_URL;
        const { html, plain } = renderInternalNotification({
          title: params.title,
          body: params.body,
          link,
        });
        await sendEmail({
          to: emails[0],
          cc: emails.slice(1),
          subject: `[Affiliate Program] ${params.title}`,
          html,
          plain,
        });
      }
    }
  } catch (err) {
    console.error("[notifications] notifyProgramEvent failed:", err);
  }
}
