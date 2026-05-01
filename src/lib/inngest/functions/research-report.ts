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

const PRICE_INPUT_PER_M = 15.0;
const PRICE_OUTPUT_PER_M = 75.0;
const PRICE_CACHE_READ_PER_M = 1.5;
const PRICE_CACHE_WRITE_PER_M = 18.75;
const PRICE_PER_WEB_SEARCH = 0.01;

function estimateCost(usage: NonNullable<AnthropicResponse["usage"]>): number {
  const input = (usage.input_tokens ?? 0) * (PRICE_INPUT_PER_M / 1_000_000);
  const output = (usage.output_tokens ?? 0) * (PRICE_OUTPUT_PER_M / 1_000_000);
  const cacheRead =
    (usage.cache_read_input_tokens ?? 0) * (PRICE_CACHE_READ_PER_M / 1_000_000);
  const cacheWrite =
    (usage.cache_creation_input_tokens ?? 0) *
    (PRICE_CACHE_WRITE_PER_M / 1_000_000);
  const search =
    (usage.server_tool_use?.web_search_requests ?? 0) * PRICE_PER_WEB_SEARCH;
  return input + output + cacheRead + cacheWrite + search;
}

async function callAnthropicStage(params: {
  systemPrompt: string;
  userMessage: string;
  enableWebSearch: boolean;
  maxSearches?: number;
}): Promise<CallStageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

  const tools: Array<Record<string, unknown>> = [];
  if (params.enableWebSearch) {
    tools.push({
      type: "web_search_20260209",
      name: "web_search",
      max_uses: params.maxSearches ?? 30,
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
    output_config: { effort: "xhigh" },
  };
  if (tools.length > 0) requestBody.tools = tools;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
      estimatedCostUsd: data.usage ? estimateCost(data.usage) : 0,
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
      industry: report.industry || undefined,
      knownDetails: report.knownDetails || undefined,
      titleFormat: report.titleFormat as "strategic_growth" | "ebitda_expansion",
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
    // STAGE 1: Deep research (durable step — runs up to 2 hours)
    // ============================================================
    const stage1 = await step.run("stage-1-deep-research", async () => {
      return await callAnthropicStage({
        systemPrompt: buildResearchPrompt(promptOptions),
        userMessage: buildUserMessage(promptOptions),
        enableWebSearch: true,
        maxSearches: Number(process.env.ANTHROPIC_MAX_SEARCHES || "30"),
      });
    });

    const dossier = stage1.text;

    // ---- Persist dossier immediately ----
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

    // ============================================================
    // STAGE 2: Slide distillation (separate durable step — auto-retries
    // independently if it fails)
    // ============================================================
    const stage2 = await step.run("stage-2-slide-distillation", async () => {
      return await callAnthropicStage({
        systemPrompt: buildSlideDeckPrompt(promptOptions, dossier),
        userMessage: `Distill the dossier above into the 10-slide markdown for ${report.companyName}. Output ONLY the markdown, no preamble.`,
        enableWebSearch: false,
      });
    });

    // ---- Combine usage across both stages ----
    const totalUsage = {
      inputTokens: stage1.usage.inputTokens + stage2.usage.inputTokens,
      outputTokens: stage1.usage.outputTokens + stage2.usage.outputTokens,
      cacheReadTokens:
        stage1.usage.cacheReadTokens + stage2.usage.cacheReadTokens,
      cacheCreationTokens:
        stage1.usage.cacheCreationTokens + stage2.usage.cacheCreationTokens,
      webSearchRequests:
        stage1.usage.webSearchRequests + stage2.usage.webSearchRequests,
      estimatedCostUsd:
        stage1.usage.estimatedCostUsd + stage2.usage.estimatedCostUsd,
    };

    const combinedSources = new Map<string, { url: string; title: string; pageAge?: string }>();
    for (const s of [...stage1.sources, ...stage2.sources]) {
      if (!combinedSources.has(s.url)) combinedSources.set(s.url, s);
    }

    const combinedThinking = [stage1.thinking, stage2.thinking]
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
