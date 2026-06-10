"use client";

// "Copy API Key" button for each Automations Main Page website card.
// Sits to the LEFT of the card's "Open ->" link. Styled to match the
// Campaigns tab "Copy signup URL" button (outline + copy icon).
//
// STEP 1 (testing scaffolding): on click it copies the literal dummy
// string "Test Admin Test" to the clipboard and shows a confirmation
// toast, so the copy + toast behaviour can be verified. This dummy value
// is temporary; in Step 2 it gets removed and the button gains a
// "has API key?" check that copies the real per-platform key when present
// and shows a permanent red "No API Integration" state when absent.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export function CopyApiKeyButton() {
  const [copied, setCopied] = useState(false);

  async function copyApiKey() {
    // Step 1 test value only. Replaced by the real key in Step 2.
    await navigator.clipboard.writeText("Test Admin Test");
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
