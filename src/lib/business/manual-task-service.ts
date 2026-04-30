// =============================================================
// Business Layer — Manual Task Service
// =============================================================
// Manages manual tasks generated when provisioning can't fully
// automate a step. Supports assignment, completion, and linking
// back to provisioning steps.
// =============================================================

import { db } from "@/lib/db";
import { manualTasks } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { audit } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/notification-service";
import type { ManualTaskStatus } from "@/types";

// ---- Types ----

export interface CreateManualTaskInput {
  requestId: string;
  stepId?: string;
  title: string;
  description?: string;
  toolKey?: string;
  assignedTo?: string;
  assignedToEmail?: string;
}

export interface ManualTaskListOptions {
  requestId?: string;
  status?: ManualTaskStatus;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

// ---- Service Functions ----

/**
 * Create a manual task.
 */
export async function createManualTask(
  input: CreateManualTaskInput,
  actorId?: string,
  actorEmail?: string
) {
  const [task] = await db
    .insert(manualTasks)
    .values({
      requestId: input.requestId,
      stepId: input.stepId || null,
      title: input.title,
      description: input.description || null,
      toolKey: input.toolKey || null,
      status: "pending",
      assignedTo: input.assignedTo || null,
      assignedToEmail: input.assignedToEmail || null,
    })
    .returning();

  await audit({
    action: "manual_task_created",
    requestId: input.requestId,
    actorId,
    actorEmail,
    details: {
      taskId: task.id,
      title: input.title,
      toolKey: input.toolKey,
    },
  });

  // Notify the assigned person
  if (input.assignedTo) {
    await sendNotification({
      type: "manual_task_assigned",
      title: `New manual task: ${input.title}`,
      message: input.description || `A manual task has been assigned to you.`,
      recipientId: input.assignedTo,
      relatedRequestId: input.requestId,
      relatedTaskId: task.id,
    });
  }

  return task;
}

/**
 * List manual tasks with optional filters.
 */
export async function listManualTasks(options: ManualTaskListOptions) {
  const conditions = [];

  if (options.requestId) {
    conditions.push(eq(manualTasks.requestId, options.requestId));
  }
  if (options.status) {
    conditions.push(eq(manualTasks.status, options.status));
  }
  if (options.assignedTo) {
    conditions.push(eq(manualTasks.assignedTo, options.assignedTo));
  }

  const query = db
    .select()
    .from(manualTasks)
    .orderBy(desc(manualTasks.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

/**
 * Assign a manual task to an admin.
 */
export async function assignTask(
  taskId: string,
  assignedTo: string,
  assignedToEmail: string,
  actorId: string,
  actorEmail: string
) {
  await db
    .update(manualTasks)
    .set({
      assignedTo,
      assignedToEmail,
      status: "in_progress",
      updatedAt: new Date(),
    })
    .where(eq(manualTasks.id, taskId));

  const task = await db.query.manualTasks.findFirst({
    where: eq(manualTasks.id, taskId),
  });

  await audit({
    action: "manual_task_assigned",
    requestId: task?.requestId,
    actorId,
    actorEmail,
    details: { taskId, assignedTo, assignedToEmail },
  });

  await sendNotification({
    type: "manual_task_assigned",
    title: `Task assigned: ${task?.title}`,
    message: `You've been assigned a manual task: ${task?.title}`,
    recipientId: assignedTo,
    relatedRequestId: task?.requestId,
    relatedTaskId: taskId,
  });

  return task;
}

/**
 * Complete a manual task.
 */
export async function completeTask(
  taskId: string,
  actorId: string,
  actorEmail: string,
  notes?: string
) {
  await db
    .update(manualTasks)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedBy: actorId,
      notes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(manualTasks.id, taskId));

  const task = await db.query.manualTasks.findFirst({
    where: eq(manualTasks.id, taskId),
  });

  await audit({
    action: "manual_task_completed",
    requestId: task?.requestId,
    actorId,
    actorEmail,
    details: { taskId, notes },
  });

  return task;
}

/**
 * Cancel a manual task.
 */
export async function cancelTask(
  taskId: string,
  actorId: string,
  actorEmail: string,
  reason?: string
) {
  await db
    .update(manualTasks)
    .set({
      status: "cancelled",
      notes: reason || null,
      updatedAt: new Date(),
    })
    .where(eq(manualTasks.id, taskId));
}
