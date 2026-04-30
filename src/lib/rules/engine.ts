import { db } from "@/lib/db";
import { provisioningRules } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import type { ProvisioningConfig } from "@/lib/providers/types";
import type { ProvisioningRule, RuleMatch } from "./types";

/**
 * Evaluate all active rules against employee attributes.
 * Returns a Map of toolKey -> merged ProvisioningConfig.
 *
 * Rules are applied in priority order (lowest first).
 * Higher-priority rules override scalars and extend arrays.
 */
export async function evaluateRules(
  match: RuleMatch
): Promise<Map<string, ProvisioningConfig>> {
  const rules = await db
    .select()
    .from(provisioningRules)
    .where(eq(provisioningRules.isActive, true))
    .orderBy(asc(provisioningRules.priority));

  const toolConfigs = new Map<string, ProvisioningConfig>();

  for (const rule of rules) {
    if (!matchesRule(rule as ProvisioningRule, match)) continue;

    const existing = toolConfigs.get(rule.toolKey) || {};
    toolConfigs.set(
      rule.toolKey,
      mergeConfigs(existing, rule.toolConfig as ProvisioningConfig)
    );
  }

  return toolConfigs;
}

function matchesRule(rule: ProvisioningRule, match: RuleMatch): boolean {
  if (rule.matchDepartment && rule.matchDepartment !== match.department) {
    return false;
  }
  if (rule.matchDivision && rule.matchDivision !== match.division) {
    return false;
  }
  if (rule.matchJobTitle) {
    // Convert SQL LIKE pattern to regex: % -> .*, _ -> .
    const escaped = rule.matchJobTitle
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    const regex = new RegExp(`^${escaped}$`, "i");
    if (!regex.test(match.jobTitle)) {
      return false;
    }
  }
  return true;
}

function mergeConfigs(
  base: ProvisioningConfig,
  override: ProvisioningConfig
): ProvisioningConfig {
  const merged: ProvisioningConfig = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value) && Array.isArray(merged[key])) {
      merged[key] = [...new Set([...(merged[key] as string[]), ...value])];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
