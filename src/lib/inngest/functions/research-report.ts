// =============================================================
// Durable research function — runs the two-stage workflow
// =============================================================
// Each Anthropic call is a separate step.run(), which means:
//   - If Stage 1 succeeds and Stage 2 fails, only Stage 2 retries
//   - Auto-retries with exponential backoff
//   - Visible in Inngest dashboard with full step history
//
// IMPORTANT: a step is NOT unbounded. Inngest invokes each step.run() as its
// own HTTP call to /api/inngest, so every step is capped by that route's
// maxDuration like any other request. Stage 1 in deep mode runs 8-12 minutes,
// which is why it goes through the Message Batches API (submit → poll → fetch)
// instead of one long call — see "Batched Stage 1" below. Quick mode is short
// enough to run synchronously.
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

interface StageParams {
  systemPrompt: string;
  userMessage: string;
  enableWebSearch: boolean;
  maxSearches?: number;
  /** Override model + effort for the call */
  modelOverride?: string;
  effortOverride?: string;
}

function anthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return apiKey;
}

const ANTHROPIC_HEADERS = {
  "Content-Type": "application/json",
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "prompt-caching-2024-07-31",
} as const;

/**
 * Build the Messages-API request body for a stage. Shared by the synchronous
 * path (callAnthropicStage) and the batched path (submitStageBatch) so the two
 * can never drift — a batched request must be byte-identical in intent to the
 * synchronous one, or deep and quick mode would quietly produce different work.
 */
function buildStageRequestBody(params: StageParams): Record<string, unknown> {
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
  return requestBody;
}

async function callAnthropicStage(
  params: StageParams,
): Promise<CallStageResult> {
  const apiKey = anthropicApiKey();
  const requestBody = buildStageRequestBody(params);

  // Use longFetch (custom undici dispatcher) to allow the connection
  // to stay open longer than Node's default 5-minute headers timeout.
  // Anthropic with web search + adaptive thinking can take 8-12+ min.
  const response = await longFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { ...ANTHROPIC_HEADERS, "x-api-key": apiKey },
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

  return parseStageResponse(JSON.parse(responseText) as AnthropicResponse);
}

/** Turn a raw Messages-API response into our CallStageResult. */
function parseStageResponse(data: AnthropicResponse): CallStageResult {

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
// Batched Stage 1 (Message Batches API)
// =============================================================
// Deep research is a single Anthropic call that routinely runs 8-12 minutes.
// Run synchronously it needs a function that can stay alive that long, which
// pins the whole app to a plan with an 800s ceiling. The Batches API turns the
// same work into three SHORT HTTP calls — submit, poll, fetch — so no single
// invocation lasts more than a few seconds and the ceiling stops mattering.
//
// Two further wins: batches are billed at 50% of standard rates, and the
// result survives for 29 days, so a crashed run can be recovered by batch id
// instead of paying for the research twice.
//
// Server tools work unchanged in batches — Anthropic runs the same server-side
// agentic loop — so web_search behaves exactly as it does synchronously. The
// one documented difference is that web_search is throttled per organization
// across concurrent batches, which can make a batch take longer (we allow up
// to BATCH_MAX_POLLS minutes) but does not change the result.
// Docs: https://platform.claude.com/docs/en/build-with-claude/batch-processing
// =============================================================

const BATCH_API_URL = "https://api.anthropic.com/v1/messages/batches";
/** Our single request inside the batch — we submit exactly one. */
const BATCH_CUSTOM_ID = "stage-1";
/** Gap between polls. Each poll is its own Inngest step, so this is wall-clock
 *  waiting, not function time. */
const BATCH_POLL_INTERVAL = "60s";
/** How many polls before we give up. Anthropic says most batches finish within
 *  an hour (hard expiry is 24h); 90 minutes covers the typical case with room
 *  to spare, and giving up here does not destroy the batch. */
const BATCH_MAX_POLLS = 90;

interface BatchStatus {
  ended: boolean;
  succeeded: number;
  errored: number;
  canceled: number;
  expired: number;
}

/** One line of the batch results JSONL. */
interface BatchResultLine {
  custom_id?: string;
  result?: {
    type?: string;
    message?: AnthropicResponse;
    error?: { type?: string; message?: string };
  };
}

/** Submit Stage 1 as a one-request batch. Returns the batch id. Fast. */
async function submitStageBatch(params: StageParams): Promise<string> {
  const apiKey = anthropicApiKey();
  const response = await fetch(BATCH_API_URL, {
    method: "POST",
    headers: { ...ANTHROPIC_HEADERS, "x-api-key": apiKey },
    body: JSON.stringify({
      requests: [
        { custom_id: BATCH_CUSTOM_ID, params: buildStageRequestBody(params) },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Anthropic Batches create ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const batch = JSON.parse(text) as { id?: string };
  if (!batch.id) {
    throw new Error(`Anthropic Batches create returned no id: ${text.slice(0, 300)}`);
  }
  return batch.id;
}

/** Check whether the batch has finished processing. Fast. */
async function pollStageBatch(batchId: string): Promise<BatchStatus> {
  const apiKey = anthropicApiKey();
  const response = await fetch(`${BATCH_API_URL}/${batchId}`, {
    headers: { ...ANTHROPIC_HEADERS, "x-api-key": apiKey },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Anthropic Batches retrieve ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const batch = JSON.parse(text) as {
    processing_status?: string;
    request_counts?: Record<string, number>;
  };
  const counts = batch.request_counts || {};
  return {
    ended: batch.processing_status === "ended",
    succeeded: counts.succeeded ?? 0,
    errored: counts.errored ?? 0,
    canceled: counts.canceled ?? 0,
    expired: counts.expired ?? 0,
  };
}

/**
 * Download the finished batch's results (JSONL, one line per request) and
 * parse our single result into the same CallStageResult the synchronous path
 * returns — so everything downstream is identical either way.
 */
async function fetchStageBatchResult(
  batchId: string,
): Promise<CallStageResult> {
  const apiKey = anthropicApiKey();
  const response = await fetch(`${BATCH_API_URL}/${batchId}/results`, {
    headers: { ...ANTHROPIC_HEADERS, "x-api-key": apiKey },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Anthropic Batches results ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) {
    throw new Error(`Batch ${batchId} returned no results`);
  }

  // We submit exactly one request, but match on custom_id rather than taking
  // lines[0] so this stays correct if the batch ever carries more than one.
  let entry: BatchResultLine | null = null;
  for (const line of lines) {
    const parsed = JSON.parse(line) as BatchResultLine;
    if (parsed.custom_id === BATCH_CUSTOM_ID) {
      entry = parsed;
      break;
    }
  }
  if (!entry) {
    throw new Error(
      `Batch ${batchId} has no result for custom_id "${BATCH_CUSTOM_ID}"`,
    );
  }

  const result = entry.result;
  if (result?.type !== "succeeded" || !result.message) {
    const detail =
      result?.error?.message || result?.type || "unknown batch result type";
    throw new Error(`Batch ${batchId} request did not succeed: ${detail}`);
  }

  return parseStageResponse(result.message);
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
      const stage1Call: StageParams = {
        systemPrompt: buildResearchPrompt(promptOptions),
        userMessage: buildUserMessage(promptOptions),
        enableWebSearch: true,
        ...stage1Params,
      };

      let stage1: CallStageResult;

      if (mode === "quick") {
        // Quick mode is Sonnet + 6 searches (~2-3 min) — comfortably inside any
        // function ceiling, and batching would only add latency for no gain.
        stage1 = await step.run("stage-1-deep-research", async () => {
          return await callAnthropicStage(stage1Call);
        });
      } else {
        // Deep mode runs 8-12 minutes, which no single serverless invocation
        // should have to stay alive for. Submit it as a batch, then poll in
        // short steps — each one is a few seconds, so the function duration
        // ceiling stops being the thing that decides whether this works.
        const batchId = await step.run("stage-1-submit-batch", async () => {
          return await submitStageBatch(stage1Call);
        });

        console.log(
          `[research-report] Stage 1 submitted as batch ${batchId} (report ${reportId})`,
        );

        let ended = false;
        for (let attempt = 0; attempt < BATCH_MAX_POLLS; attempt++) {
          await step.sleep(`stage-1-wait-${attempt}`, BATCH_POLL_INTERVAL);
          const status = await step.run(
            `stage-1-poll-${attempt}`,
            async () => await pollStageBatch(batchId),
          );
          if (status.ended) {
            ended = true;
            break;
          }
        }

        if (!ended) {
          // The batch itself is still valid for 29 days, so surface the id —
          // the research is paid for and recoverable rather than lost.
          throw new Error(
            `Deep research batch ${batchId} did not finish within ` +
              `${BATCH_MAX_POLLS} minutes. Results stay available for 29 days — ` +
              `recover them with this batch id rather than re-running the research.`,
          );
        }

        stage1 = await step.run(
          "stage-1-fetch-batch",
          async () => await fetchStageBatchResult(batchId),
        );
      }

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
