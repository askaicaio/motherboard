"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { setSettings(d); setLoading(false); });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast.success("Settings saved");
      else toast.error("Failed to save settings");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateSetting(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <div className="animate-pulse h-64 bg-zinc-100 rounded" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500">Configure global application settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">n8n Configuration</CardTitle>
          <CardDescription>Connection settings for the n8n orchestration layer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>n8n Base URL</Label>
            <Input
              value={String(settings.n8n_base_url || "")}
              onChange={(e) => updateSetting("n8n_base_url", e.target.value)}
              placeholder="https://n8n.example.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label>Mode:</Label>
            <Badge variant="outline">
              {process.env.NEXT_PUBLIC_PROVISIONING_MODE || "mock"}
            </Badge>
            <span className="text-xs text-zinc-400">(set via PROVISIONING_MODE env var)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Email Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>From Address</Label>
            <Input
              value={String(settings.email_from_address || "")}
              onChange={(e) => updateSetting("email_from_address", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input
              value={String(settings.email_from_name || "")}
              onChange={(e) => updateSetting("email_from_name", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Provisioning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Max Retries</Label>
            <Input
              type="number"
              value={String(settings.default_max_retries || 3)}
              onChange={(e) => updateSetting("default_max_retries", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Provisioning Timeout (minutes)</Label>
            <Input
              type="number"
              value={String(settings.provisioning_timeout_minutes || 30)}
              onChange={(e) => updateSetting("provisioning_timeout_minutes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
