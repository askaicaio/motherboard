"use client";

// Per-card API-integration STATUS indicator on the Automations Main Page.
// (Formerly a "Copy API Key" button; the clipboard-copy behaviour was removed
// 2026-06-11 - it no longer copies anything.) Sits to the left of the card's
// "Open ->" link.
//   - hasApiKey true  -> green box + green "API Key Integrated" with a check.
//   - hasApiKey false -> red box + red "No API Integration".
// Neither state is clickable. Only a boolean reaches the client, never the
// secret API key itself (keys stay server-side in env vars, per the brief).

import { Button } from "@/components/ui/button";
import { Check, Ban } from "lucide-react";

export function CopyApiKeyButton({ hasApiKey }: { hasApiKey?: boolean }) {
  if (hasApiKey) {
    return (
      <Button
        variant="outline"
        size="sm"
        aria-disabled="true"
        onClick={(e) => e.preventDefault()}
        className="flex-1 cursor-default border-green-300 bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700"
      >
        <Check className="mr-2 h-3.5 w-3.5" />
        API Key Integrated
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled="true"
      onClick={(e) => e.preventDefault()}
      className="flex-1 cursor-default border-red-300 bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600"
    >
      <Ban className="mr-2 h-3.5 w-3.5" />
      No API Integration
    </Button>
  );
}
