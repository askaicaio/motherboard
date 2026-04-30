"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TOOL_KEYS, TOOL_DISPLAY_NAMES, type ToolKey } from "@/types";
import {
  Mail,
  MessageSquare,
  CheckSquare,
  Megaphone,
  Users,
  KeyRound,
  Video,
  FileText,
} from "lucide-react";

const TOOL_ICONS: Record<ToolKey, React.ComponentType<{ className?: string }>> = {
  google_workspace: Mail,
  slack: MessageSquare,
  clickup: CheckSquare,
  gohighlevel: Megaphone,
  circle: Users,
  onepassword: KeyRound,
  fathom: FileText,
  zoom: Video,
};

interface ToolSelectorProps {
  selected: ToolKey[];
  onChange: (tools: ToolKey[]) => void;
}

export function ToolSelector({ selected, onChange }: ToolSelectorProps) {
  const toggle = (tool: ToolKey) => {
    if (selected.includes(tool)) {
      onChange(selected.filter((t) => t !== tool));
    } else {
      onChange([...selected, tool]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {TOOL_KEYS.map((tool) => {
        const Icon = TOOL_ICONS[tool];
        const isChecked = selected.includes(tool);
        return (
          <label
            key={tool}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
              isChecked
                ? "border-zinc-900 bg-zinc-50"
                : "border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => toggle(tool)}
            />
            <Icon className="h-4 w-4 text-zinc-500" />
            <Label className="cursor-pointer text-sm font-medium">
              {TOOL_DISPLAY_NAMES[tool]}
            </Label>
          </label>
        );
      })}
    </div>
  );
}
