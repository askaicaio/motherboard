"use client";

// "Copy API Key" button for each Automations Main Page website card.
// Sits to the LEFT of the card's "Open ->" link. Styled to match the
// Campaigns tab "Copy signup URL" button (outline + copy icon).
//
// Option A behaviour (gated on whether the platform has an API key):
//   - No key  -> permanent RED "No API Integration" state (stays red until
//                a real key exists). Not clickable.
//   - Has key -> the working button: click copies the key + shows a
//                confirmation toast.
//
// Right now NO platform has a key wired up (see the Automations to-do +
// [[automations-one-token-per-platform]]), so every card shows the red
// "No API Integration" state. The working path stays in place, dormant,
// and lights up automatically once `apiKey` is provided.
//
// SECURITY NOTE: an API key is a live production secret. We deliberately do
// NOT source/pass a real key to this client component yet. Before wiring the
// real "copy the actual key" behaviour, decide how the key reaches the client
// safely (authed-admin only, masked/reference value, on-click server fetch,
// etc). See the SECURITY FLAG in the Automations to-do.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, CheckCheck, Ban } from "lucide-react";
import { toast } from "sonner";

export function CopyApiKeyButton({ apiKey }: { apiKey?: string | null }) {
  const [copied, setCopied] = useState(false);

  // No key configured -> permanent red "No API Integration" state.
  if (!apiKey) {
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

  // Working state: a real key exists for this platform, so copy it on click.
  async function copyApiKey() {
    await navigator.clipboard.writeText(apiKey!);
    setCopied(true);
    toast.success("API key copied to your clipboard.");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button variant="outline" size="sm" onClick={copyApiKey} className="flex-1">
      {copied ? (
        <>
          <CheckCheck className="mr-2 h-3.5 w-3.5 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy API Key
        </>
      )}
    </Button>
  );
}
