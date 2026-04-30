"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Mail,
  MessageSquare,
  CheckSquare,
  Rocket,
  Users,
  KeyRound,
  Video,
  FileText,
  ExternalLink,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Eye,
  EyeOff,
} from "lucide-react";
import { INTEGRATIONS } from "@/lib/integrations/registry";
import type { IntegrationDefinition } from "@/lib/integrations/registry";

const ICON_MAP: Record<string, React.ElementType> = {
  Mail,
  MessageSquare,
  CheckSquare,
  Rocket,
  Users,
  KeyRound,
  Video,
  FileText,
};

const CATEGORY_LABELS: Record<string, string> = {
  workspace: "Workspace",
  communication: "Communication",
  project: "Project Management",
  crm: "CRM",
  security: "Security",
  meetings: "Meetings",
  community: "Community",
};

// Simulated connection states (in production these would come from DB/env check)
type ConnectionStatus = "connected" | "not_connected" | "partial" | "no_api";

function getSimulatedStatus(integration: IntegrationDefinition): ConnectionStatus {
  if (integration.requiredEnvVars.length === 0) return "no_api";
  // In production, check if env vars are set via an API route
  return "not_connected";
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
        </Badge>
      );
    case "partial":
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertTriangle className="mr-1 h-3 w-3" /> Partial
        </Badge>
      );
    case "no_api":
      return (
        <Badge className="bg-zinc-50 text-zinc-500 border-zinc-200">
          Manual Only
        </Badge>
      );
    default:
      return (
        <Badge className="bg-zinc-50 text-zinc-500 border-zinc-200">
          Not Connected
        </Badge>
      );
  }
}

function IntegrationCard({ integration }: { integration: IntegrationDefinition }) {
  const [showDetails, setShowDetails] = useState(false);
  const Icon = ICON_MAP[integration.icon] || Settings2;
  const status = getSimulatedStatus(integration);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
              <Icon className="h-5 w-5 text-zinc-600" />
            </div>
            <div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {CATEGORY_LABELS[integration.category]}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-zinc-500">{integration.description}</p>

        <div className="flex items-center gap-2">
          {integration.supportsN8n && (
            <Badge variant="outline" className="text-xs">
              <Zap className="mr-1 h-3 w-3" /> n8n
            </Badge>
          )}
          {integration.supportsDirectApi && (
            <Badge variant="outline" className="text-xs">
              <Shield className="mr-1 h-3 w-3" /> API
            </Badge>
          )}
          {!integration.supportsN8n && !integration.supportsDirectApi && (
            <Badge variant="outline" className="text-xs text-zinc-400">
              Instructions Only
            </Badge>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {status !== "no_api" ? (
            <Dialog>
              <DialogTrigger>
                <Button size="sm" variant={status === "connected" ? "outline" : "default"}>
                  {status === "connected" ? "Configure" : "Connect"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Connect {integration.name}</DialogTitle>
                  <DialogDescription>
                    Workspace-level connection — applies to all admins and all provisioning workflows.
                  </DialogDescription>
                </DialogHeader>
                <ConnectionForm integration={integration} />
              </DialogContent>
            </Dialog>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide" : "Details"}
          </Button>

          {integration.docsUrl && (
            <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost">
                <ExternalLink className="mr-1 h-3 w-3" /> Docs
              </Button>
            </a>
          )}
        </div>

        {showDetails && (
          <div className="mt-4 space-y-4 border-t pt-4 text-sm">
            <div>
              <h4 className="font-medium text-zinc-900 mb-1.5">What can be automated</h4>
              <ul className="space-y-1 text-zinc-600">
                {integration.automatable.length > 0 ? (
                  integration.automatable.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-zinc-400 italic">No API automation available</li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-zinc-900 mb-1.5">Plan/admin constraints</h4>
              <ul className="space-y-1 text-zinc-600">
                {integration.planConstraints.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-zinc-900 mb-1.5">Automation approach</h4>
              <p className="text-zinc-600">{integration.automationApproach}</p>
            </div>

            <div>
              <h4 className="font-medium text-zinc-900 mb-1.5">Manual fallback</h4>
              <p className="text-zinc-600">{integration.manualFallback}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionForm({ integration }: { integration: IntegrationDefinition }) {
  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Simulate API test
    await new Promise((r) => setTimeout(r, 1500));
    setTestResult("success");
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1">
        <p>
          <strong>Org-wide credentials.</strong> These are stored as server
          environment variables — not per-user. Any admin who connects this
          integration sets it for the entire workspace.
        </p>
        <p>
          For production, set these in your hosting provider (Vercel, Railway,
          etc.) rather than through this form.
        </p>
      </div>

      {integration.requiredEnvVars.map((envVar) => (
        <div key={envVar} className="space-y-1.5">
          <Label className="text-xs font-mono text-zinc-500">{envVar}</Label>
          <div className="relative">
            <Input
              type={showSecrets ? "text" : "password"}
              placeholder={`Enter ${envVar}`}
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              onClick={() => setShowSecrets(!showSecrets)}
            >
              {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={handleTest} disabled={testing} variant="outline" size="sm">
          {testing ? "Testing..." : "Test Connection"}
        </Button>
        <Button size="sm">Save Configuration</Button>

        {testResult === "success" && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connection successful
          </span>
        )}
        {testResult === "error" && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Connection failed
          </span>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const categories = [...new Set(INTEGRATIONS.map((i) => i.category))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Integrations</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Workspace-level connections shared by all dashboard admins. Connect once — every admin can use them for provisioning.
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm text-blue-800 flex items-start gap-2">
        <Shield className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>These are org-wide connections, not personal accounts.</strong>{" "}
          Credentials (API keys, service account tokens) are set once at the server level
          and apply to the entire dashboard. Any admin who signs in can trigger provisioning
          workflows using these shared connections.
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {CATEGORY_LABELS[cat] || cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {INTEGRATIONS.map((integration) => (
              <IntegrationCard key={integration.key} integration={integration} />
            ))}
          </div>
        </TabsContent>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {INTEGRATIONS.filter((i) => i.category === cat).map((integration) => (
                <IntegrationCard key={integration.key} integration={integration} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* How It Works section */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">How integrations work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-600 space-y-3">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <h4 className="font-medium text-zinc-900">1. Configure credentials (once)</h4>
              <p>
                API keys and service tokens are set as server environment
                variables — one connection per tool for the whole workspace.
                Any admin can trigger workflows using the shared credentials.
              </p>
            </div>
            <div className="space-y-1.5">
              <h4 className="font-medium text-zinc-900">2. n8n orchestrates</h4>
              <p>
                When an onboarding request is approved, the dashboard sends
                webhook calls to n8n workflows. Each tool has its own n8n
                workflow that handles the actual API calls and reports back.
              </p>
            </div>
            <div className="space-y-1.5">
              <h4 className="font-medium text-zinc-900">3. Callbacks update status</h4>
              <p>
                n8n workflows call back to the dashboard's API with success or
                failure status for each provisioning step. Failed steps can be
                retried, and manual tasks are generated when needed.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-amber-50 p-3 text-amber-800 text-xs">
            <strong>Note:</strong> For Google sign-in to this dashboard, you need
            a Google Cloud OAuth client configured for @chiefaiofficer.com. Set
            <code className="mx-1 rounded bg-amber-100 px-1">GOOGLE_CLIENT_ID</code> and
            <code className="mx-1 rounded bg-amber-100 px-1">GOOGLE_CLIENT_SECRET</code> in
            your environment. Only @chiefaiofficer.com Google accounts can access this dashboard.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
