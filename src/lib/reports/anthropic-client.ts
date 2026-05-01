// =============================================================
// Anthropic API client — two-stage research workflow
// =============================================================
// Stage 1: Deep Research → produces a comprehensive 5-25K char
//          intelligence dossier matching the style of the proven
//          reference dossiers. Uses:
//            - Claude Opus 4.7 (flagship model)
//            - Adaptive thinking with effort: xhigh
//            - web_search_20260209 with dynamic filtering
//            - Up to 30 web searches
//
// Stage 2: Slide Distillation → takes the dossier and produces the
//          10-slide markdown ready for Gamma. Uses:
//            - Claude Opus 4.7 with adaptive thinking
//            - NO web search (just synthesis)
//            - Embeds the 3 reference deck PDFs as calibration
//
// Mock mode (REPORTS_MODE=mock or no API key) returns sample data.
// =============================================================

import { longFetch } from "./long-fetch";
import {
  buildResearchPrompt,
  buildSlideDeckPrompt,
  buildUserMessage,
  type BuildPromptOptions,
} from "./system-prompt";

export interface ResearchSource {
  url: string;
  title: string;
  pageAge?: string;
}

export interface ResearchTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  webSearchRequests: number;
  estimatedCostUsd: number;
}

export interface ResearchResult {
  success: true;
  /** Long-form research dossier (5-25K chars) — comprehensive intelligence */
  dossier: string;
  /** 10-slide markdown ready for Gamma */
  slideMarkdown: string;
  model: string;
  sources: ResearchSource[];
  /** Combined usage across both Claude calls */
  usage: ResearchTokenUsage;
  thinkingSummary?: string;
  provider: "anthropic" | "mock";
}

export interface ResearchError {
  success: false;
  error: string;
  provider: "anthropic" | "mock";
  /** If stage 1 succeeded but stage 2 failed, we keep the dossier */
  partialDossier?: string;
}

export type ResearchOutcome = ResearchResult | ResearchError;

const MOCK_DELAY_MS = 5000;

function isMockMode(): boolean {
  return (
    process.env.REPORTS_MODE === "mock" || !process.env.ANTHROPIC_API_KEY
  );
}

export interface GenerateResearchOptions extends BuildPromptOptions {
  /** Called when transitioning between stages so the UI can update */
  onPhaseChange?: (phase: "researching" | "distilling") => Promise<void> | void;
  /** Called when stage 1 completes so partial dossier can be persisted early */
  onDossierReady?: (dossier: string) => Promise<void> | void;
}

export async function generateResearch(
  options: GenerateResearchOptions,
): Promise<ResearchOutcome> {
  if (isMockMode()) {
    return mockResearch(options);
  }
  return liveResearch(options);
}

// ---------------------------------------------------------------------------
// Mock research
// ---------------------------------------------------------------------------
async function mockResearch(
  options: GenerateResearchOptions,
): Promise<ResearchOutcome> {
  await options.onPhaseChange?.("researching");
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));

  const titleText =
    options.titleFormat === "ebitda_expansion"
      ? "Leveraging Generative AI for Operational Excellence & EBITDA Expansion"
      : "Strategic Growth Through AI";

  const dossier = `# ${options.companyName}: AI strategic growth profile

**${options.companyName} is a [MOCK] company in the [industry] sector with an estimated $XX-$XX M in annual revenue and ~XXX employees. AI could unlock $X.X-$X.X M in annual SG&A savings — a XX-XX% reduction — with a XX-month payback. The company has no visible AI strategy as of early 2026, creating both competitive risk and a greenfield ROI opportunity.**

---

## Company overview

[Mock company background — would normally describe founding, HQ, current operations, business segments based on web research.]

## Confirmed financials and sizing

⚠️ All financial figures are estimates from third-party databases.

| Metric | Estimate | Source |
|---|---|---|
| Annual revenue | ~$XXX M | D&B / ZoomInfo |
| Employee count | ~XXX | LinkedIn / D&B |
| EBITDA margin (est.) | XX% | Industry benchmark |

## Leadership and ownership

[Mock leadership context — founders, current execs, any recent transitions.]

## Industry pressures that frame the AI opportunity

[Mock industry analysis — margin pressure, labor scarcity, regulatory shifts.]

## Current AI/technology baseline

No public AI initiatives identified. Tech stack appears to be standard enterprise tools.

## Conclusion

The combination of [specific company traits] makes ${options.companyName} a strong candidate for AI-driven SG&A transformation, with the highest-impact opportunities concentrated in [function] and [function].

*[This is a MOCK research dossier. Set ANTHROPIC_API_KEY and unset REPORTS_MODE=mock for real research.]*`;

  const slideMarkdown = `# ${titleText}

**${options.companyName}**
Leveraging Generative AI for Operational Excellence at ${options.companyName}

PREPARED BY CHIEF AI OFFICER · CONFIDENTIAL

---

# Company at a Glance

[Mock 4-5 stat blocks would go here — revenue, employees, locations, years operating, differentiator.]

---

# The Opportunity

## First-Mover Advantage
${options.companyName} has the chance to set the AI standard in its category before competitors close the gap.

## Efficiency Gap
Manual SG&A processes present a 25-40% efficiency improvement opportunity.

## Margin Expansion
AI can expand EBITDA margins by 200-400 bps within 24 months.

---

# Why Act Now

## Margin Pressure
- Industry margins compressing
- Labor costs rising

## Operational Complexity
- Multi-system data fragmentation
- Manual reconciliation overhead

---

# AI Applications Across SG&A Functions

## Finance & Accounting
- Automated invoice processing
- Financial close acceleration
- **Impact: 25-35% labor reduction · $XXX K-XXX K**

## Sales & Marketing
- Proposal automation
- Lead scoring
- **Impact: 30-40% productivity · $XXX K-XXX K**

## Customer Service
- AI chatbot
- **Impact: 40-50% cost reduction · $XXX K-XXX K**

## HR & Talent
- Recruiting automation
- **Impact: 20-30% efficiency · $XXX K-XXX K**

## Legal & Compliance
- Contract review AI
- **Impact: 35-45% time savings · $XXX K-XXX K**

---

# Consolidated Financial Impact

| Function | Annual Value Range | Timeline |
|---|---|---|
| Finance & Accounting | $XXX K - $XXX K | 6-12 months |
| Sales & Marketing | $XXX K - $XXX K | 6-9 months |
| Customer Service | $XXX K - $XXX K | 3-6 months |
| HR & Talent | $XXX K - $XXX K | 6-12 months |
| Legal & Compliance | $XXX K - $XXX K | 9-12 months |
| **TOTAL IMPACT** | **$X.X M - $X.X M** | — |

**Investment Required:** $X.X M - $X.X M over 36 months
**Payback Period:** 6-9 months
**3-Year ROI:** XXX% - X,XXX%

---

# Three-Phase Transformation Roadmap

## Phase 1 · Days 1-90 · Fast Wins
- Executive AI immersion workshop
- AP/invoice automation
- Customer service chatbot
- Sales proposal AI
- AI Governance Framework
- **Investment: $XXX K-$XXX K · Value: $XXX K-$XXX K run-rate**

## Phase 2 · Months 4-12 · Scale & Integrate
- Enterprise AI platform
- Department-wide rollouts
- **Investment: $X.X M-$X.X M · Value: $X.X M-$X.X M run-rate**

## Phase 3 · Months 13-36 · Optimize & Lead
- AI Center of Excellence
- Predictive models
- **Investment: $X.X M-$X.X M · Value: $X.X M-$X.X M run-rate**

---

# Risk Management

1. **Fragmented Adoption** · Prob: HIGH · Mitigation: Governance + Steering Committee
2. **Data Quality Gaps** · Prob: MEDIUM · Mitigation: Phase 1 readiness assessment
3. **Change Resistance** · Prob: MEDIUM · Mitigation: "Augments not replaces" messaging
4. **Cybersecurity** · Prob: MEDIUM · Mitigation: SOC 2/ISO 27001 vendor requirements
5. **Vendor Lock-In** · Prob: MEDIUM · Mitigation: Open APIs, multi-vendor strategy
6. **Industry-Specific Risk** · Prob: MEDIUM · Mitigation: [tailored placeholder]

---

# The Valuation Transformation

## Today
- **EBITDA: $X.X M** (Revenue × industry margin)
- **Multiple: X.X-X.Xx**
- **Enterprise Value: $XX-$XX M**

## Year 3 (Post-AI)
- **EBITDA: $X.X M** (current + AI value)
- **Multiple: X.X-X.Xx** (premium)
- **Enterprise Value: $XX-$XX M**

## 💰 Enterprise Value Created: $XX-$XX M

### Strategic Optionality
- Remain independent with improved margins
- Attract buyers at premium multiples
- Scale revenue without proportional SG&A growth

---

# The Choice Is Clear

## ❌ Option A: Status Quo
- Margins erode
- Talent attrition accelerates
- Valuation stagnates
- Competitive disadvantage compounds

## ✅ Option B: AI Transformation
- $X.X M-$X.X M annual EBITDA uplift
- 200-400 bps margin improvement
- $XX-$XX M enterprise value created
- Industry leadership

## Immediate Next Steps — Week 1
- **Day 1-3:** CEO convenes leadership; secure board endorsement
- **Week 1:** Engage AI partner; assign Phase 1 lead; allocate budget
- **Week 1-2:** Communicate AI vision company-wide
- **Week 2-4:** Select pilots; begin Executive Immersion training

**Contact:** Dani@ChiefAIOfficer.com · 858-463-1130

---

*[MOCK output. Set ANTHROPIC_API_KEY for live deep research.]*`;

  return {
    success: true,
    provider: "mock",
    model: "mock-claude-opus-4-7",
    dossier,
    slideMarkdown,
    sources: [
      { url: "https://example.com/mock-1", title: "Mock Source: Industry Outlook" },
      { url: "https://example.com/mock-2", title: "Mock Source: Competitive Landscape" },
      { url: "https://example.com/mock-3", title: "Mock Source: Financial Filings" },
    ],
    usage: {
      inputTokens: 18000,
      outputTokens: 12000,
      cacheReadTokens: 0,
      cacheCreationTokens: 18000,
      webSearchRequests: 0,
      estimatedCostUsd: 0,
    },
    thinkingSummary:
      "Mock thinking: would research company financials, leadership, AI baseline, then synthesize ROI thesis.",
  };
}

// ---------------------------------------------------------------------------
// Live research — two-stage Anthropic API calls
// ---------------------------------------------------------------------------

interface AnthropicTextBlock {
  type: "text";
  text: string;
  citations?: Array<{
    type: string;
    url?: string;
    title?: string;
    cited_text?: string;
  }>;
}

interface AnthropicThinkingBlock {
  type: "thinking";
  thinking: string;
  signature?: string;
}

interface AnthropicWebSearchToolResult {
  type: "web_search_tool_result";
  tool_use_id: string;
  content:
    | Array<{
        type: "web_search_result";
        url: string;
        title: string;
        page_age?: string;
        encrypted_content?: string;
      }>
    | { type: "web_search_tool_result_error"; error_code: string };
}

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicThinkingBlock
  | AnthropicWebSearchToolResult
  | { type: string; [key: string]: unknown };

interface AnthropicResponse {
  id?: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    server_tool_use?: {
      web_search_requests?: number;
    };
  };
  error?: { type: string; message: string };
}

// Pricing for Claude Opus 4.7 (per 1M tokens)
const PRICE_INPUT_PER_M = 15.0;
const PRICE_OUTPUT_PER_M = 75.0;
const PRICE_CACHE_READ_PER_M = 1.5;
const PRICE_CACHE_WRITE_PER_M = 18.75;
const PRICE_PER_WEB_SEARCH = 0.01;

function estimateCost(usage: NonNullable<AnthropicResponse["usage"]>): number {
  const input = (usage.input_tokens ?? 0) * (PRICE_INPUT_PER_M / 1_000_000);
  const output = (usage.output_tokens ?? 0) * (PRICE_OUTPUT_PER_M / 1_000_000);
  const cacheRead =
    (usage.cache_read_input_tokens ?? 0) *
    (PRICE_CACHE_READ_PER_M / 1_000_000);
  const cacheWrite =
    (usage.cache_creation_input_tokens ?? 0) *
    (PRICE_CACHE_WRITE_PER_M / 1_000_000);
  const search =
    (usage.server_tool_use?.web_search_requests ?? 0) * PRICE_PER_WEB_SEARCH;
  return input + output + cacheRead + cacheWrite + search;
}

function emptyUsage(): ResearchTokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    webSearchRequests: 0,
    estimatedCostUsd: 0,
  };
}

function addUsage(
  acc: ResearchTokenUsage,
  resp: AnthropicResponse,
): ResearchTokenUsage {
  const u = resp.usage ?? {};
  return {
    inputTokens: acc.inputTokens + (u.input_tokens ?? 0),
    outputTokens: acc.outputTokens + (u.output_tokens ?? 0),
    cacheReadTokens: acc.cacheReadTokens + (u.cache_read_input_tokens ?? 0),
    cacheCreationTokens:
      acc.cacheCreationTokens + (u.cache_creation_input_tokens ?? 0),
    webSearchRequests:
      acc.webSearchRequests + (u.server_tool_use?.web_search_requests ?? 0),
    estimatedCostUsd: acc.estimatedCostUsd + estimateCost(u),
  };
}

interface CallResult {
  success: boolean;
  text: string;
  thinking: string[];
  sources: Map<string, ResearchSource>;
  response?: AnthropicResponse;
  error?: string;
}

/**
 * Make a single Anthropic API call. Used by both stages.
 */
async function callAnthropic(params: {
  apiKey: string;
  model: string;
  effort: string;
  systemPrompt: string;
  userMessage: string;
  enableWebSearch: boolean;
  maxSearches?: number;
}): Promise<CallResult> {
  // Cache the (very large) system prompt
  const systemBlocks = [
    {
      type: "text",
      text: params.systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];

  const tools: Array<Record<string, unknown>> = [];
  if (params.enableWebSearch) {
    tools.push({
      type: "web_search_20260209",
      name: "web_search",
      max_uses: params.maxSearches ?? 30,
    });
  }

  const requestBody: Record<string, unknown> = {
    model: params.model,
    max_tokens: 32_000,
    system: systemBlocks,
    messages: [{ role: "user", content: params.userMessage }],
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: params.effort },
  };
  if (tools.length > 0) requestBody.tools = tools;

  let response: Response;
  try {
    response = await longFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    return {
      success: false,
      text: "",
      thinking: [],
      sources: new Map(),
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const responseText = await response.text();

  if (!response.ok) {
    let errorMessage = `Anthropic API ${response.status}`;
    try {
      const parsed = JSON.parse(responseText) as AnthropicResponse;
      if (parsed.error?.message) errorMessage += `: ${parsed.error.message}`;
    } catch {
      errorMessage += `: ${responseText.slice(0, 500)}`;
    }
    return {
      success: false,
      text: "",
      thinking: [],
      sources: new Map(),
      error: errorMessage,
    };
  }

  let data: AnthropicResponse;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    return {
      success: false,
      text: "",
      thinking: [],
      sources: new Map(),
      error: `Failed to parse Anthropic response: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Extract text
  const text = data.content
    .filter((b): b is AnthropicTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();

  // Extract thinking
  const thinking = data.content
    .filter((b): b is AnthropicThinkingBlock => b.type === "thinking")
    .map((b) => b.thinking)
    .filter(Boolean);

  // Extract sources from web_search_tool_result + citations
  const sources = new Map<string, ResearchSource>();
  for (const block of data.content) {
    if (block.type === "web_search_tool_result") {
      const r = block as AnthropicWebSearchToolResult;
      if (Array.isArray(r.content)) {
        for (const result of r.content) {
          if (result.url && !sources.has(result.url)) {
            sources.set(result.url, {
              url: result.url,
              title: result.title || result.url,
              pageAge: result.page_age,
            });
          }
        }
      }
    }
    if (block.type === "text") {
      const tb = block as AnthropicTextBlock;
      for (const c of tb.citations || []) {
        if (c.url && !sources.has(c.url)) {
          sources.set(c.url, {
            url: c.url,
            title: c.title || c.url,
          });
        }
      }
    }
  }

  return {
    success: true,
    text,
    thinking,
    sources,
    response: data,
  };
}

async function liveResearch(
  options: GenerateResearchOptions,
): Promise<ResearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";
  const effort = process.env.ANTHROPIC_EFFORT || "high";
  const maxSearches = Number(process.env.ANTHROPIC_MAX_SEARCHES || "15");

  let totalUsage: ResearchTokenUsage = emptyUsage();
  const allSources = new Map<string, ResearchSource>();
  const allThinking: string[] = [];

  // ===========================================================
  // STAGE 1 — Deep research dossier (with web search)
  // ===========================================================
  await options.onPhaseChange?.("researching");

  const stage1 = await callAnthropic({
    apiKey,
    model,
    effort,
    systemPrompt: buildResearchPrompt(options),
    userMessage: buildUserMessage(options),
    enableWebSearch: true,
    maxSearches,
  });

  if (!stage1.success || !stage1.text) {
    return {
      success: false,
      provider: "anthropic",
      error: `Stage 1 (research) failed: ${stage1.error || "no content returned"}`,
    };
  }

  const dossier = stage1.text;

  if (stage1.response) totalUsage = addUsage(totalUsage, stage1.response);
  for (const [k, v] of stage1.sources) allSources.set(k, v);
  allThinking.push(...stage1.thinking);

  // Persist the dossier immediately so it's accessible even if
  // stage 2 fails or the function times out
  await options.onDossierReady?.(dossier);

  // ===========================================================
  // STAGE 2 — Slide distillation (no web search)
  // ===========================================================
  await options.onPhaseChange?.("distilling");

  const stage2 = await callAnthropic({
    apiKey,
    model,
    effort,
    systemPrompt: buildSlideDeckPrompt(options, dossier),
    userMessage: `Distill the dossier above into the 10-slide markdown for ${options.companyName}. Output ONLY the markdown, no preamble.`,
    enableWebSearch: false,
  });

  if (!stage2.success || !stage2.text) {
    // Stage 1 succeeded — return partial result so the dossier isn't lost
    return {
      success: false,
      provider: "anthropic",
      error: `Stage 2 (slide distillation) failed: ${stage2.error || "no content returned"}`,
      partialDossier: dossier,
    };
  }

  if (stage2.response) totalUsage = addUsage(totalUsage, stage2.response);
  allThinking.push(...stage2.thinking);

  return {
    success: true,
    provider: "anthropic",
    model: stage2.response?.model || model,
    dossier,
    slideMarkdown: stage2.text,
    sources: Array.from(allSources.values()),
    usage: totalUsage,
    thinkingSummary: allThinking.length ? allThinking.join("\n---\n") : undefined,
  };
}
