import type { ProvisioningProvider } from "./types";
import { googleWorkspaceProvider } from "./google-workspace";
import { slackProvider } from "./slack";
import { clickupProvider } from "./clickup";
import { gohighlevelProvider } from "./gohighlevel";
import { circleProvider } from "./circle";
import { onepasswordProvider } from "./onepassword";
import { zoomProvider } from "./zoom";

const providers = new Map<string, ProvisioningProvider>();

function register(provider: ProvisioningProvider): void {
  providers.set(provider.toolKey, provider);
}

register(googleWorkspaceProvider);
register(slackProvider);
register(clickupProvider);
register(gohighlevelProvider);
register(circleProvider);
register(onepasswordProvider);
register(zoomProvider);

export function getProvider(toolKey: string): ProvisioningProvider {
  const provider = providers.get(toolKey);
  if (!provider) {
    throw new Error(`No provisioning provider registered for tool: ${toolKey}`);
  }
  return provider;
}

export function getAllProviders(): ProvisioningProvider[] {
  return Array.from(providers.values());
}

export function getProviderKeys(): string[] {
  return Array.from(providers.keys());
}
