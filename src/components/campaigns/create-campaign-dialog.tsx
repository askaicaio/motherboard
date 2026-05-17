"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CampaignListItem } from "./campaigns-page-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campaign: CampaignListItem) => void;
  baseUrl: string;
}

const CAMPAIGN_TYPES = [
  { value: "webinar", label: "Webinar" },
  { value: "event", label: "Event / Meetup" },
  { value: "launch", label: "Product Launch" },
  { value: "email_blast", label: "Email Blast" },
  { value: "lead_magnet", label: "Lead Magnet" },
  { value: "other", label: "Other" },
];

export function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("webinar");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [landingPageUrl, setLandingPageUrl] = useState("");

  function reset() {
    setName("");
    setType("webinar");
    setDescription("");
    setEventDate("");
    setEventTime("");
    setLandingPageUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      // Combine date + time as a local-zone ISO string. We send it as-is;
      // the server treats it as already-zoned.
      let eventDateISO: string | null = null;
      if (eventDate) {
        const dt = new Date(`${eventDate}T${eventTime || "12:00"}:00`);
        if (!isNaN(dt.getTime())) eventDateISO = dt.toISOString();
      }
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          description: description.trim() || null,
          eventDate: eventDateISO,
          landingPageUrl: landingPageUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create campaign");
        return;
      }
      // Backend returns the row directly — synthesize the list shape
      const created: CampaignListItem = {
        id: data.campaign.id,
        name: data.campaign.name,
        type: data.campaign.type,
        description: data.campaign.description,
        eventDate: data.campaign.eventDate,
        eventTimezone: data.campaign.eventTimezone || "America/New_York",
        status: data.campaign.status,
        webhookSecret: data.campaign.webhookSecret,
        landingPageUrl: data.campaign.landingPageUrl,
        ghlWorkflowId: data.campaign.ghlWorkflowId,
        leadCount: 0,
        attendedCount: 0,
        createdAt: data.campaign.createdAt,
      };
      reset();
      onOpenChange(false);
      onCreated(created);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Once created, you&apos;ll get a webhook URL to paste into your GHL
            workflow.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Name *</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="90-Day AI Playbook"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-type">Type</Label>
            <select
              id="campaign-type"
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="event-date">Event date</Label>
              <Input
                id="event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-time">Time (local)</Label>
              <Input
                id="event-time"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                placeholder="13:00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="landing-page">Landing page URL</Label>
            <Input
              id="landing-page"
              type="url"
              value={landingPageUrl}
              onChange={(e) => setLandingPageUrl(e.target.value)}
              placeholder="https://chiefaiofficer.com/playbook"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Live workshop — May 21, 1pm EST. McKinsey-style breakdown of the 90-day AI rollout playbook."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
