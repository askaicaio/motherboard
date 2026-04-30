// =============================================================
// Notifications Layer — Internal Admin Notifications
// =============================================================
// Handles creating and querying in-app notifications for dashboard
// admins. Supports different notification types and read/unread state.
// =============================================================

import { db } from "@/lib/db";
import { notifications, adminUsers } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { audit } from "@/lib/audit/logger";
import type { NotificationType } from "@/types";

// ---- Types ----

export interface SendNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  recipientId?: string; // If omitted, sends to all super_admins
  relatedRequestId?: string;
  relatedTaskId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationListOptions {
  recipientId: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

// ---- Service Functions ----

/**
 * Send a notification to a specific admin or all super_admins.
 */
export async function sendNotification(
  input: SendNotificationInput
): Promise<void> {
  const recipientIds: string[] = [];

  if (input.recipientId) {
    recipientIds.push(input.recipientId);
  } else {
    // Send to all super_admins and admins
    const admins = await db.query.adminUsers.findMany({
      where: and(
        eq(adminUsers.isActive, true),
      ),
    });
    for (const admin of admins) {
      if (admin.role === "super_admin" || admin.role === "admin") {
        recipientIds.push(admin.id);
      }
    }
  }

  if (recipientIds.length === 0) return;

  const notificationValues = recipientIds.map((recipientId) => ({
    recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
    relatedRequestId: input.relatedRequestId || null,
    relatedTaskId: input.relatedTaskId || null,
    metadata: input.metadata || {},
  }));

  await db.insert(notifications).values(notificationValues);

  await audit({
    action: "notification_sent",
    requestId: input.relatedRequestId,
    details: {
      type: input.type,
      title: input.title,
      recipientCount: recipientIds.length,
    },
  });
}

/**
 * List notifications for a specific admin.
 */
export async function listNotifications(
  options: NotificationListOptions
) {
  const conditions = [eq(notifications.recipientId, options.recipientId)];

  if (options.unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }

  const results = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);

  return results;
}

/**
 * Count unread notifications for a specific admin.
 */
export async function countUnread(recipientId: string): Promise<number> {
  const results = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.isRead, false)
      )
    );

  return results.length;
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId));
}

/**
 * Mark all notifications as read for a specific admin.
 */
export async function markAllAsRead(recipientId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.isRead, false)
      )
    );
}
