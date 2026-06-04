"use client";

// Per-route error boundary so unexpected client crashes show the actual
// message + a Retry button, rather than bubbling up to the global
// "This page couldn't load" fallback (which loses all context).

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function SubscriptionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so it shows up in browser devtools / Vercel logs
    console.error("[subscriptions] route error:", error);
  }, [error]);

  return (
    <div className="p-6">
      <Card>
        <CardContent className="space-y-4 py-10 px-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Subscriptions hit an error</h2>
              <p className="text-sm text-zinc-600">
                Something went wrong while rendering this page. Sharing the
                message below with Cedric will speed up the fix.
              </p>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
            {error.message || String(error)}
            {error.digest && (
              <>
                {"\n\nDigest: "}
                {error.digest}
              </>
            )}
          </pre>
          <Button onClick={reset}>
            <RotateCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
