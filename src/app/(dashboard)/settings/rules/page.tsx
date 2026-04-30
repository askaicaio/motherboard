"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS, DIVISIONS, TOOL_KEYS, TOOL_DISPLAY_NAMES, type ToolKey } from "@/types";
import { Plus, Trash2 } from "lucide-react";

interface Rule {
  id: string;
  name: string;
  description?: string;
  matchDepartment?: string;
  matchDivision?: string;
  matchJobTitle?: string;
  toolKey: string;
  toolConfig: Record<string, unknown>;
  priority: number;
  isActive: boolean;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    setLoading(true);
    const res = await fetch("/api/rules");
    setRules(await res.json());
    setLoading(false);
  }

  async function toggleRule(id: string, isActive: boolean) {
    await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    fetchRules();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    toast.success("Rule deactivated");
    fetchRules();
  }

  async function createRule(formData: FormData) {
    const toolConfigStr = formData.get("toolConfig") as string;
    let toolConfig;
    try {
      toolConfig = JSON.parse(toolConfigStr);
    } catch {
      toast.error("Invalid JSON in tool config");
      return;
    }

    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description") || undefined,
        matchDepartment: formData.get("matchDepartment") || null,
        matchDivision: formData.get("matchDivision") || null,
        matchJobTitle: formData.get("matchJobTitle") || null,
        toolKey: formData.get("toolKey"),
        toolConfig,
        priority: Number(formData.get("priority") || 0),
      }),
    });

    if (res.ok) {
      toast.success("Rule created");
      setDialogOpen(false);
      fetchRules();
    } else {
      toast.error("Failed to create rule");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Provisioning Rules</h1>
          <p className="text-sm text-zinc-500">
            Rules map department/role/division to default tool configurations.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button><Plus className="mr-2 h-4 w-4" /> New Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Provisioning Rule</DialogTitle></DialogHeader>
            <form action={createRule} className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Name *</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Match Department</Label>
                  <select name="matchDepartment" className="w-full rounded border px-3 py-2 text-sm">
                    <option value="">Any</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Match Division</Label>
                  <select name="matchDivision" className="w-full rounded border px-3 py-2 text-sm">
                    <option value="">Any</option>
                    {DIVISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Match Job Title (LIKE pattern)</Label>
                <Input name="matchJobTitle" placeholder="e.g., %Engineer%" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tool *</Label>
                  <select name="toolKey" required className="w-full rounded border px-3 py-2 text-sm">
                    {TOOL_KEYS.map((t) => <option key={t} value={t}>{TOOL_DISPLAY_NAMES[t]}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input name="priority" type="number" defaultValue={0} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tool Config (JSON) *</Label>
                <Textarea name="toolConfig" required rows={4} placeholder='{"channels": ["general"], "role": "member"}' />
              </div>
              <Button type="submit" className="w-full">Create Rule</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded bg-zinc-100" />)}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-400">
            No provisioning rules configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.isActive ? "opacity-50" : ""}>
              <CardContent className="flex items-center justify-between pt-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{rule.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {TOOL_DISPLAY_NAMES[rule.toolKey as ToolKey] || rule.toolKey}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-zinc-400">
                      Priority: {rule.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {rule.matchDepartment || "Any dept"} &middot;{" "}
                    {rule.matchDivision || "Any div"} &middot;{" "}
                    {rule.matchJobTitle || "Any title"}
                  </p>
                  {rule.description && (
                    <p className="text-xs text-zinc-400">{rule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-zinc-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
