import type { ProvisioningConfig } from "@/lib/providers/types";
import type { DivisionType } from "@/types";

export interface ProvisioningRule {
  id: string;
  name: string;
  description: string | null;
  matchDepartment: string | null;
  matchDivision: DivisionType | null;
  matchJobTitle: string | null;
  toolKey: string;
  toolConfig: ProvisioningConfig;
  priority: number;
  isActive: boolean;
}

export interface RuleMatch {
  department: string;
  division: DivisionType;
  jobTitle: string;
}
