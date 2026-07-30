"use client";

// =============================================================
// confirmDialog() — a reliable replacement for window.confirm()
// =============================================================
// window.confirm/alert/prompt are silently BLOCKED in embedded / iframed
// browser panes (they return false with no dialog), which made every
// confirm-gated action (archive, delete, reset…) appear dead. This renders a
// real in-app dialog instead and resolves a Promise<boolean>.
//
// Usage (from any client event handler):
//   if (!(await confirmDialog({ title: "Archive?", destructive: true }))) return;
//
// Requires <ConfirmHost/> mounted once high in the tree (see the dashboard
// layout). If no host is mounted, it resolves false (fails safe — the guarded
// action does NOT run).
// =============================================================

import * as React from "react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  title?: string;
  /** Body text — newlines are preserved. */
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). */
  destructive?: boolean;
}

type Request = { opts: ConfirmOptions; resolve: (v: boolean) => void };

let deliver: ((req: Request) => void) | null = null;

export function confirmDialog(opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deliver) {
      // No host mounted — never silently run a guarded (often destructive)
      // action. Resolve false so the caller aborts.
      resolve(false);
      return;
    }
    deliver({ opts, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    deliver = (r) => setReq(r);
    return () => {
      deliver = null;
    };
  }, []);

  const close = (value: boolean) => {
    req?.resolve(value);
    setReq(null);
  };

  const opts = req?.opts;

  return (
    <Dialog
      open={!!req}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{opts?.title ?? "Are you sure?"}</DialogTitle>
          {opts?.body != null && (
            <DialogDescription className="whitespace-pre-line">
              {opts.body}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {opts?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="button"
            variant={opts?.destructive ? "destructive" : "default"}
            onClick={() => close(true)}
          >
            {opts?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
