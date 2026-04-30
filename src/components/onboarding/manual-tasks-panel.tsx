"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MANUAL_TASK_STATUS_CONFIG, TOOL_DISPLAY_NAMES, type ManualTaskStatus, type ToolKey } from "@/types";
import { CheckCircle2, UserPlus, ClipboardList } from "lucide-react";

interface ManualTask {
  id: string;
  title: string;
  description: string | null;
  toolKey: string | null;
  status: ManualTaskStatus;
  assignedToEmail: string | null;
  createdAt: string;
  completedAt: string | null;
  notes: string | null;
}

interface ManualTasksPanelProps {
  tasks: ManualTask[];
  requestId: string;
  currentUserEmail: string;
  onAssign?: (taskId: string) => void;
  onComplete?: (taskId: string, notes?: string) => void;
}

export function ManualTasksPanel({
  tasks,
  requestId,
  currentUserEmail,
  onAssign,
  onComplete,
}: ManualTasksPanelProps) {
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No manual tasks for this request</p>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Tool</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const statusConfig = MANUAL_TASK_STATUS_CONFIG[task.status];
            const toolName = task.toolKey
              ? TOOL_DISPLAY_NAMES[task.toolKey as ToolKey] || task.toolKey
              : "\u2014";

            return (
              <TableRow key={task.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{toolName}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusConfig.color}>
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {task.assignedToEmail || "Unassigned"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {task.status === "pending" && !task.assignedToEmail && onAssign && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAssign(task.id)}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Assign to me
                      </Button>
                    )}
                    {(task.status === "pending" || task.status === "in_progress") && onComplete && (
                      <Dialog
                        open={completingTaskId === task.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setCompletingTaskId(null);
                            setCompletionNotes("");
                          }
                        }}
                      >
                        <DialogTrigger>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setCompletingTaskId(task.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Complete
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Complete Task</DialogTitle>
                            <DialogDescription>
                              Mark &ldquo;{task.title}&rdquo; as complete. Add any notes about what was done.
                            </DialogDescription>
                          </DialogHeader>
                          <Textarea
                            placeholder="Optional: describe what was done..."
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                            rows={3}
                          />
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setCompletingTaskId(null);
                                setCompletionNotes("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                onComplete(task.id, completionNotes || undefined);
                                setCompletingTaskId(null);
                                setCompletionNotes("");
                              }}
                            >
                              Mark Complete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
