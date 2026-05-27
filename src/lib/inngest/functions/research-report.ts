// =============================================================
// Durable research function — runs the two-stage workflow
// =============================================================
// Each Anthropic call is a separate step.run(), which means:
//   - If Stage 1 succeeds and Stage 2 fails, only Stage 2 retries
//   - Each step can run for up to 2 hours (no Vercel limit)
//   - Auto-retries with exponential backoff
//   - Visible in Inngest dashboard with full step history
// =============================================================

import { inngest } from "../client";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { eq } from "drizzle-orm";
import {
  buildResearchPrompt,
  buildSlideDeckPrompt,
  buildUserMessage,
} from "@/lib/reports/system-prompt";
import { longFetch } from "@/lib/reports/long-fetch";

// We re-implement the Anthropic call here directly so each stage
// can be its own durable step. This is a copy of the logic in
// anthropic-client.ts callAnthropic() function, broken into steps.

interface AnthropicTextBlock {
  type: "text";
  text: string;
  citations?: Array<{ type: string; url?: string; title?: string; cited_text?: string }>;
}
interface AnthropicWebSearchToolResult {
  type: "web_search_tool_result";
  tool_use_id: string;
  content:
    | Array<{ type: "web_search_result"; url: string; title: string; page_age?: string }>
    | { type: "web_search_tool_result_error"; error_code: string };
}
interface AnthropicResponse {
  content: Array<Record<string, unknown>>;
  model: string;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
  error?: { type: string; message: string };
}

interface CallStageResult {
  text: string;
  model: string;
  sources: Array<{ url: string; title: string; pageAge?: string }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    webSearchRequests: number;
    estimatedCostUsd: number;
  };
  thinking?: string;
}

// Per-model Anthropic pricing (USD per 1M tokens). Source: anthropic.com/pricing
interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus 4.7 / 4.6 (flagship)
  "claude-opus-4-7": { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-opus-4-6": { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
  // Sonnet 4.6 / 4.5 (mid-tier — 5x cheaper than Opus)
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  // Haiku (entry-tier)
  "claude-haiku-4-5": { input: 0.8, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
};

const PRICE_PER_WEB_SEARCH = 0.01;

function pricingForModel(modelName: string): ModelPricing {
  if (MODEL_PRICING[modelName]) return MODEL_PRICING[modelName];
  // Prefix match — handles dated model variants (e.g. claude-sonnet-4-6-20240101)
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelName.startsWith(key)) return pricing;
  }
  // Unknown model — default to Opus pricing (over-estimate is safer than under-estimate)
  return MODEL_PRICING["claude-opus-4-7"];
}

function estimateCost(
  usage: NonNullable<AnthropicResponse["usage"]>,
  modelName: string,
): number {
  const p = pricingForModel(modelName);
  const input = (usage.input_tokens ?? 0) * (p.input / 1_000_000);
  const output = (usage.output_tokens ?? 0) * (p.output / 1_000_000);
  const cacheRead =
    (usage.cache_read_input_tokens ?? 0) * (p.cacheRead / 1_000_000);
  const cacheWrite =
    (usage.cache_creation_input_tokens ?? 0) * (p.cacheWrite / 1_000_000);
  const search =
    (usage.server_tool_use?.web_search_requests ?? 0) * PRICE_PER_WEB_SEARCH;
  return input + output + cacheRead + cacheWrite + search;
}

async function callAnthropicStage(params: {
  systemPrompt: string;
  userMessage: string;
  enableWebSearch: boolean;
  maxSearches?: number;
  /** Override model + effort for the call */
  modelOverride?: string;
  effortOverride?: string;
}): Promise<CallStageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model =
    params.modelOverride ||
    process.env.ANTHROPIC_MODEL ||
    "claude-opus-4-7";
  const effort =
    params.effortOverride || process.env.ANTHROPIC_EFFORT || "high";

  const tools: Array<Record<string, unknown>> = [];
  if (params.enableWebSearch) {
    // Use web_search_20250305 (the older basic version) NOT 20260209.
    // The newer version auto-injects code_execution which causes Claude
    // to write outputs to its sandbox filesystem instead of returning
    // them as message text — silently swallowing the dossier. See:
    // https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
    tools.push({
      type: "web_search_20250305",
      name: "web_search",
      max_uses: params.maxSearches ?? 15,
    });
  }

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: 32_000,
    system: [
      {
        type: "text",
        text: params.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: params.userMessage }],
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort },
  };
  if (tools.length > 0) requestBody.tools = tools;

  // Use longFetch (custom undici dispatcher) to allow the connection
  // to stay open longer than Node's default 5-minute headers timeout.
  // Anthropic with web search + adaptive thinking can take 8-12+ min.
  const response = await longFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let msg = `Anthropic API ${response.status}`;
    try {
      const parsed = JSON.parse(responseText) as AnthropicResponse;
      if (parsed.error?.message) msg += `: ${parsed.error.message}`;
    } catch {
      msg += `: ${responseText.slice(0, 500)}`;
    }
    throw new Error(msg);
  }

  const data = JSON.parse(responseText) as AnthropicResponse;

  // Text
  const text = data.content
    .filter((b): b is AnthropicTextBlock & Record<string, unknown> => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error(`Anthropic returned no text. Stop reason: ${data.stop_reason}`);
  }

  // Sources from web_search_tool_result + citations
  const sourceMap = new Map<string, { url: string; title: string; pageAge?: string }>();
  for (const block of data.content) {
    const t = (block as { type?: string }).type;
    if (t === "web_search_tool_result") {
      const wst = block as unknown as AnthropicWebSearchToolResult;
      if (Array.isArray(wst.content)) {
        for (const r of wst.content) {
          if (r.url && !sourceMap.has(r.url)) {
            sourceMap.set(r.url, {
              url: r.url,
              title: r.title || r.url,
              pageAge: r.page_age,
            });
          }
        }
      }
    }
    if (t === "text") {
      const tb = block as unknown as AnthropicTextBlock;
      for (const c of tb.citations || []) {
        if (c.url && !sourceMap.has(c.url)) {
          sourceMap.set(c.url, { url: c.url, title: c.title || c.url });
        }
      }
    }
  }

  // Thinking summary
  const thinkingBlocks = data.content
    .filter((b) => (b as { type?: string }).type === "thinking")
    .map((b) => (b as { thinking?: string }).thinking || "")
    .filter(Boolean);

  return {
    text,
    model: data.model,
    sources: Array.from(sourceMap.values()),
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
      cacheCreationTokens: data.usage?.cache_creation_input_tokens ?? 0,
      webSearchRequests: data.usage?.server_tool_use?.web_search_requests ?? 0,
      estimatedCostUsd: data.usage ? estimateCost(data.usage, data.model) : 0,
    },
    thinking: thinkingBlocks.join("\n---\n") || undefined,
  };
}

// =============================================================
// The durable research function
// =============================================================

export const researchReportFn = inngest.createFunction(
  {
    id: "research-report",
    name: "Research Company Report",
    retries: 1,
    triggers: [{ event: "report/research.requested" }],
    // If the function fails for any reason (timeout, API error, exhausted
    // retries), mark the DB as "failed" so the UI reflects reality and
    // operators can retry. Without this, reports get stuck in "running".
    onFailure: async ({ event, error }) => {
      const reportId = (event.data.event.data as { reportId?: string }).reportId;
      if (!reportId) return;

      const errorMessage =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : typeof error === "string"
            ? error
            : "Inngest function failed (see Inngest dashboard for details)";

      try {
        await db
          .update(companyReports)
          .set({
            researchStatus: "failed",
            researchPhase: null,
            researchError: errorMessage.slice(0, 2000),
            updatedAt: new Date(),
          })
          .where(eq(companyReports.id, reportId));
      } catch (e) {
        console.error("[onFailure] Failed to update report status:", e);
      }
    },
  },
  async ({ event, step }) => {
    const { reportId, actorId, actorEmail } = event.data;

    // ---- Load the report (durable; cached across retries) ----
    const report = await step.run("load-report", async () => {
      const [r] = await db
        .select()
        .from(companyReports)
        .where(eq(companyReports.id, reportId))
        .limit(1);
      if (!r) throw new Error(`Report ${reportId} not found`);
      return r;
    });

    const promptOptions = {
      companyName: report.companyName,
      companyUrl: report.companyUrl || undefined,
      industry: report.industry || undefined,
      knownDetails: report.knownDetails || undefined,
      titleFormat: report.titleFormat as "strategic_growth" | "ebitda_expansion",
      contactName: report.contactName,
      contactEmail: report.contactEmail,
      contactPhone: report.contactPhone,
    };

    // ---- Mark as researching ----
    await step.run("mark-researching", async () => {
      await db
        .update(companyReports)
        .set({
          researchStatus: "running",
          researchPhase: "researching",
          researchStartedAt: new Date(),
          researchError: null,
          updatedAt: new Date(),
        })
        .where(eq(companyReports.id, reportId));
    });

    // ============================================================
    // STAGE 1: Deep research
    // ============================================================
    // Mode-specific parameters:
    //   deep:   Opus 4.7 + xhigh + 15 searches (~$3-5, ~10 min) — real prospects
    //   quick:  Sonnet 4.6 + medium + 6 searches (~$0.30, ~2 min) — testing/demos
    //   manual: skip Stage 1 entirely — operator uploaded dossier directly
    const mode = report.researchMode || "deep";
    const stage1Params =
      mode === "quick"
        ? {
            modelOverride: "claude-sonnet-4-6",
            effortOverride: "medium",
            maxSearches: 6,
          }
        : {
            // deep — uses env defaults (Opus 4.7 + high)
            maxSearches: Number(process.env.ANTHROPIC_MAX_SEARCHES || "15"),
          };

    // Skip if a dossier was already saved to the DB from a previous run,
    // or if this is a manual-upload report.
    let dossier: string;
    let stage1Usage: CallStageResult["usage"] | null = null;
    let stage1Sources: CallStageResult["sources"] = [];
    let stage1Thinking: string | undefined;

    if (report.researchDossier && report.researchDossier.length > 1000) {
      console.log(
        `[research-report] Skipping Stage 1 — dossier already exists (${report.researchDossier.length} chars, mode=${mode})`,
      );
      dossier = report.researchDossier;
      stage1Sources = (report.researchSources as CallStageResult["sources"]) || [];
    } else if (mode === "manual") {
      throw new Error(
        "Manual mode requires a dossier to be uploaded before research can run. Upload the dossier first.",
      );
    } else {
      const stage1 = await step.run("stage-1-deep-research", async () => {
        return await callAnthropicStage({
          systemPrompt: buildResearchPrompt(promptOptions),
          userMessage: buildUserMessage(promptOptions),
          enableWebSearch: true,
          ...stage1Params,
        });
      });

      // Sanity-check the output: if Claude returned a meta-summary instead
      // of the actual dossier (e.g. because it tried to write files via
      // code_execution), reject early so the operator can retry with a
      // clearer prompt instead of pushing garbage into Stage 2.
      if (
        !stage1.text ||
        stage1.text.length < 1500 ||
        /the file .*\.md.* (is exported|has been (saved|created|exported))/i.test(
          stage1.text,
        ) ||
        /I('| ha)?ve (created|written|exported|saved) (a |the )?(dossier|file)/i.test(
          stage1.text.slice(0, 500),
        )
      ) {
        throw new Error(
          `Stage 1 returned a meta-summary instead of the dossier (${stage1.text.length} chars). ` +
            `Claude likely wrote the dossier to a sandbox file. Retry with the updated prompt.`,
        );
      }

      dossier = stage1.text;
      stage1Usage = stage1.usage;
      stage1Sources = stage1.sources;
      stage1Thinking = stage1.thinking;

      // Persist dossier immediately so it survives Stage 2 failures
      await step.run("save-dossier", async () => {
        await db
          .update(companyReports)
          .set({
            researchDossier: dossier,
            researchPhase: "distilling",
            updatedAt: new Date(),
          })
          .where(eq(companyReports.id, reportId));
      });
    }

    // ============================================================
    // STAGE 2: Slide distillation (separate durable step — auto-retries
    // independently if it fails)
    // ============================================================
    await step.run("mark-distilling", async () => {
      await db
        .update(companyReports)
        .set({ researchPhase: "distilling", updatedAt: new Date() })
        .where(eq(companyReports.id, reportId));
    });

    const stage2Params =
      mode === "quick"
        ? { modelOverride: "claude-sonnet-4-6", effortOverride: "medium" }
        : {};

    const stage2 = await step.run("stage-2-slide-distillation", async () => {
      return await callAnthropicStage({
        systemPrompt: buildSlideDeckPrompt(promptOptions, dossier),
        userMessage: `Distill the dossier above into the 10-slide markdown for ${report.companyName}. Output ONLY the markdown, no preamble.`,
        enableWebSearch: false,
        ...stage2Params,
      });
    });

    // ---- Combine usage across both stages (Stage 1 may be skipped) ----
    const totalUsage = {
      inputTokens: (stage1Usage?.inputTokens ?? 0) + stage2.usage.inputTokens,
      outputTokens: (stage1Usage?.outputTokens ?? 0) + stage2.usage.outputTokens,
      cacheReadTokens:
        (stage1Usage?.cacheReadTokens ?? 0) + stage2.usage.cacheReadTokens,
      cacheCreationTokens:
        (stage1Usage?.cacheCreationTokens ?? 0) +
        stage2.usage.cacheCreationTokens,
      webSearchRequests:
        (stage1Usage?.webSearchRequests ?? 0) + stage2.usage.webSearchRequests,
      estimatedCostUsd:
        (stage1Usage?.estimatedCostUsd ?? 0) + stage2.usage.estimatedCostUsd,
    };

    const combinedSources = new Map<string, { url: string; title: string; pageAge?: string }>();
    for (const s of [...stage1Sources, ...stage2.sources]) {
      if (!combinedSources.has(s.url)) combinedSources.set(s.url, s);
    }

    const combinedThinking = [stage1Thinking, stage2.thinking]
      .filter(Boolean)
      .join("\n---\n");

    // ---- Mark complete ----
    await step.run("mark-complete", async () => {
      await db
        .update(companyReports)
        .set({
          researchStatus: "complete",
          researchPhase: null,
          researchCompletedAt: new Date(),
          researchMarkdown: stage2.text,
          researchModel: stage2.model,
          researchProvider: "anthropic",
          researchSources: Array.from(combinedSources.values()),
          researchInputTokens: totalUsage.inputTokens,
          researchOutputTokens: totalUsage.outputTokens,
          researchCacheReadTokens: totalUsage.cacheReadTokens,
          researchCacheCreationTokens: totalUsage.cacheCreationTokens,
          researchWebSearchCount: totalUsage.webSearchRequests,
          researchCostUsd: totalUsage.estimatedCostUsd.toFixed(4),
          researchThinkingSummary: combinedThinking || null,
          updatedAt: new Date(),
        })
        .where(eq(companyReports.id, reportId));

      await audit({
        action: "report_research_completed",
        actorId,
        actorEmail,
        details: {
          reportId,
          provider: "anthropic",
          model: stage2.model,
          dossierLength: dossier.length,
          slideMarkdownLength: stage2.text.length,
          sourceCount: combinedSources.size,
          webSearches: totalUsage.webSearchRequests,
          costUsd: totalUsage.estimatedCostUsd,
        },
      });
    });

    return { reportId, success: true };
  },
);
