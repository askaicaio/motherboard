// =============================================================
// Anthropic API client for top-quality deep research
// =============================================================
// Uses Claude Opus 4.7 (the flagship model) with:
//   - Adaptive thinking at xhigh effort (deepest reasoning)
//   - Web search 20260209 with dynamic filtering (latest)
//   - Code execution tool (required for dynamic filtering)
//   - Up to 30 web searches per report
//   - Prompt caching on the system prompt (save $ on repeat runs)
//   - Source + citation extraction
//   - Token usage tracking
//
// Mock mode (REPORTS_MODE=mock or no API key) returns a sample
// report after a 5-second delay.
// =============================================================

import {
  buildSystemPrompt,
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
  markdown: string;
  model: string;
  sources: ResearchSource[];
  usage: ResearchTokenUsage;
  thinkingSummary?: string;
  provider: "anthropic" | "mock";
}

export interface ResearchError {
  success: false;
  error: string;
  provider: "anthropic" | "mock";
}

export type ResearchOutcome = ResearchResult | ResearchError;

const MOCK_DELAY_MS = 5000;

function isMockMode(): boolean {
  return (
    process.env.REPORTS_MODE === "mock" ||
    !process.env.ANTHROPIC_API_KEY
  );
}

export async function generateResearch(
  options: BuildPromptOptions,
): Promise<ResearchOutcome> {
  if (isMockMode()) {
    return mockResearch(options);
  }
  return liveResearch(options);
}

// ---------------------------------------------------------------------------
// Mock research — returns a sample 10-slide report after a delay
// ---------------------------------------------------------------------------
async function mockResearch(
  options: BuildPromptOptions,
): Promise<ResearchOutcome> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));

  const titleText =
    options.titleFormat === "ebitda_expansion"
      ? "Leveraging Generative AI for Operational Excellence & EBITDA Expansion"
      : "Strategic Growth Through AI";

  return {
    success: true,
    provider: "mock",
    model: "mock-claude-opus-4-7",
    sources: [
      { url: "https://example.com/mock-source-1", title: "Mock Source: Industry Outlook" },
      { url: "https://example.com/mock-source-2", title: "Mock Source: Competitive Landscape" },
      { url: "https://example.com/mock-source-3", title: "Mock Source: Financial Filings" },
    ],
    usage: {
      inputTokens: 12000,
      outputTokens: 8000,
      cacheReadTokens: 0,
      cacheCreationTokens: 12000,
      webSearchRequests: 0,
      estimatedCostUsd: 0,
    },
    thinkingSummary:
      "Mock thinking: would normally analyze company size, industry benchmarks, SG&A structure, then map AI applications to specific cost lines.",
    markdown: `# ${titleText}

**${options.companyName}**
Leveraging Generative AI to drive Operational Excellence and EBITDA Expansion

PREPARED BY CHIEF AI OFFICER · CONFIDENTIAL

---

# Company at a Glance

**~$XXX M Revenue** · *Midpoint estimate · Privately held*
**XXX Employees** · Approximate headcount
**XX Years Operating** · Established market presence
**XX Locations** · Geographic footprint

${options.companyName} is a [industry description based on research]. The company is led by [leadership context] and recently [notable milestone].

---

# The Opportunity

## First-Mover Advantage
${options.companyName} is positioned to capture significant operational efficiency by deploying AI ahead of slower-moving peers in the industry.

## Efficiency Gap
Manual processes across SG&A functions present a 25-40% efficiency improvement opportunity through targeted AI deployment.

## Margin Expansion
Operational AI can expand EBITDA margins by 200-400 basis points within 24 months without revenue growth.

---

# Why Act Now

## Margin Pressure
- Industry margins compressing 100-200 bps annually
- Labor costs rising 4-6% per year

## Labor Escalation
- Talent shortages in skilled SG&A roles
- Turnover costs averaging 30-50% of annual salary

## Operational Complexity
- Multi-system data fragmentation
- Manual reconciliation overhead

## Scale Disadvantage
- Larger competitors deploying AI at scale
- Window for first-mover advantage closing rapidly

---

# AI Applications Across SG&A Functions

## Finance & Accounting
- Automated invoice processing & AP automation
- AI-powered financial close acceleration
- Cash flow forecasting
- **Impact: 25-35% labor reduction · $XXX K-XXX K savings**

## Sales & Marketing
- AI proposal generation
- Lead scoring & CRM intelligence
- Content automation
- **Impact: 30-40% productivity gain · $XXX K-XXX K savings**

## Customer Service
- 24/7 AI chatbot support
- Inquiry deflection (60-70%)
- Automated responses
- **Impact: 40-50% cost reduction · $XXX K-XXX K savings**

## HR & Talent
- Recruiting chatbot
- Onboarding automation
- Retention analytics
- **Impact: 20-30% efficiency gain · $XXX K-XXX K savings**

## Legal & Compliance
- Contract review automation
- Regulatory monitoring
- Document classification
- **Impact: 35-45% time savings · $XXX K-XXX K savings**

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
- AP/invoice processing automation
- Customer service chatbot
- Sales proposal AI
- AI Governance Framework
- **Investment: $XXX K - $XXX K · Value: $XXX K - $XXX K run-rate**

## Phase 2 · Months 4-12 · Scale & Integrate
- Enterprise AI platform deployment
- Advanced analytics across departments
- HR automation rollout
- Legal contract AI
- **Investment: $X.X M - $X.X M · Value: $X.X M - $X.X M run-rate**

## Phase 3 · Months 13-36 · Optimize & Lead
- AI Center of Excellence
- Predictive operational models
- Full automation of routine workflows
- Customer-facing AI products
- **Investment: $X.X M - $X.X M · Value: $X.X M - $X.X M run-rate**

---

# Risk Management

1. **Fragmented Adoption** · Prob: HIGH · Impact: HIGH
   Mitigation: Governance framework, Steering Committee, single enterprise platform.

2. **Data Quality Gaps** · Prob: MEDIUM · Impact: HIGH
   Mitigation: Phase 1 data readiness assessment; prioritize high-quality data use cases first.

3. **Change Resistance** · Prob: MEDIUM · Impact: MEDIUM
   Mitigation: "AI augments, not replaces" messaging; no-layoffs commitment; tiered training.

4. **Cybersecurity** · Prob: MEDIUM · Impact: HIGH
   Mitigation: SOC 2/ISO 27001 vendor requirements; private cloud for sensitive data.

5. **Vendor Lock-In** · Prob: MEDIUM · Impact: MEDIUM
   Mitigation: Open APIs, multi-vendor strategy, data portability in contracts.

6. **Industry-Specific Risk** · Prob: MEDIUM · Impact: HIGH
   Mitigation: [tailored to industry — placeholder].

---

# Enterprise Value Transformation

## Today
- **EBITDA: $X.X M** (Revenue × industry margin)
- **Multiple: X.Xx - X.Xx** (industry standard)
- **Enterprise Value: $XX M - $XX M**

## Year 3 (Post-AI)
- **EBITDA: $X.X M** (current + AI value)
- **Multiple: X.Xx - X.Xx** (premium for AI-enabled operations)
- **Enterprise Value: $XX M - $XX M**

## Enterprise Value Created: $XX M - $XX M

### Strategic Optionality
- Remain independent with materially improved margins
- Attract strategic/financial buyers at premium multiples
- Scale revenue without proportional SG&A growth

---

# Call to Action

## ❌ Status Quo
- Margins continue to erode
- Talent attrition accelerates
- Valuation stagnates while AI-enabled peers command premiums
- Competitive disadvantage compounds quarterly

## ✅ AI Transformation
- $X.X M - $X.X M annual EBITDA uplift
- 200-400 bps margin improvement
- $XX M - $XX M enterprise value created
- Industry leadership position

## Immediate Next Steps — Week 1
- **Day 1-3:** CEO convenes leadership; secure board endorsement
- **Week 1:** Engage AI consulting partner; assign Phase 1 lead; allocate Phase 1 budget
- **Week 1-2:** CEO-wide communication on AI vision; invite employee input
- **Week 2-4:** Select Phase 1 pilots; begin Executive Immersion training

> *${options.companyName} has the opportunity to set the AI standard for its industry — and a closing window in which to do it.*

**Contact:** Dani@ChiefAIOfficer.com · 858-463-1130

---

*[This is a MOCK report. Set ANTHROPIC_API_KEY and unset REPORTS_MODE=mock to enable live deep research with Claude Opus 4.7 + web search.]*`,
  };
}

// ---------------------------------------------------------------------------
// Live research — calls Claude Opus 4.7 with adaptive thinking + web search
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

interface AnthropicServerToolUse {
  type: "server_tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
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
  | AnthropicServerToolUse
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

// Pricing for Claude Opus 4.7 (per 1M tokens) — used for cost estimation only.
// Update if Anthropic pricing changes.
const PRICE_INPUT_PER_M = 15.0;
const PRICE_OUTPUT_PER_M = 75.0;
const PRICE_CACHE_READ_PER_M = 1.5;
const PRICE_CACHE_WRITE_PER_M = 18.75;
const PRICE_PER_WEB_SEARCH = 0.01; // $10 per 1,000 searches

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

async function liveResearch(
  options: BuildPromptOptions,
): Promise<ResearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";
  const maxSearches = Number(process.env.ANTHROPIC_MAX_SEARCHES || "30");

  const systemPrompt = buildSystemPrompt(options);
  const userMessage = buildUserMessage(options);

  // Cache the (very large) system prompt — reference reports rarely change.
  // Saves ~90% on input cost for repeat runs within 5 minutes.
  const systemBlocks = [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];

  // Use the latest web search tool with dynamic filtering.
  // web_search_20260209 auto-injects code_execution when needed —
  // do NOT define code_execution explicitly or it will 400.
  const tools: Array<Record<string, unknown>> = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: maxSearches,
    },
  ];

  // Adaptive thinking with maximum effort — Opus 4.7's deepest reasoning mode.
  const thinking = {
    type: "adaptive",
    display: "summarized" as const,
  };

  const requestBody = {
    model,
    max_tokens: 32_000,
    system: systemBlocks,
    messages: [{ role: "user", content: userMessage }],
    tools,
    thinking,
    output_config: { effort: "xhigh" }, // Opus 4.7 only — deepest reasoning
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required for prompt caching to work on Claude 4 models
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `Anthropic API ${response.status}`;
      try {
        const parsed = JSON.parse(responseText) as AnthropicResponse;
        if (parsed.error?.message) {
          errorMessage += `: ${parsed.error.message}`;
        }
      } catch {
        errorMessage += `: ${responseText.slice(0, 500)}`;
      }
      return {
        success: false,
        provider: "anthropic",
        error: errorMessage,
      };
    }

    const data = JSON.parse(responseText) as AnthropicResponse;

    // ----- Extract markdown text from content blocks -----
    const markdown = data.content
      .filter((block): block is AnthropicTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n")
      .trim();

    if (!markdown) {
      return {
        success: false,
        provider: "anthropic",
        error: "Claude returned no markdown content. Stop reason: " + data.stop_reason,
      };
    }

    // ----- Extract sources from web search tool results + citations -----
    const sourceMap = new Map<string, ResearchSource>();

    for (const block of data.content) {
      if (block.type === "web_search_tool_result") {
        const result = block as AnthropicWebSearchToolResult;
        if (Array.isArray(result.content)) {
          for (const r of result.content) {
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
      if (block.type === "text") {
        const tb = block as AnthropicTextBlock;
        for (const c of tb.citations || []) {
          if (c.url && !sourceMap.has(c.url)) {
            sourceMap.set(c.url, {
              url: c.url,
              title: c.title || c.url,
            });
          }
        }
      }
    }

    // ----- Extract thinking summary (if any) -----
    const thinkingBlocks = data.content
      .filter(
        (block): block is AnthropicThinkingBlock => block.type === "thinking",
      )
      .map((block) => block.thinking)
      .filter(Boolean);
    const thinkingSummary = thinkingBlocks.length
      ? thinkingBlocks.join("\n---\n")
      : undefined;

    // ----- Token usage + cost -----
    const usage: ResearchTokenUsage = {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
      cacheCreationTokens: data.usage?.cache_creation_input_tokens ?? 0,
      webSearchRequests:
        data.usage?.server_tool_use?.web_search_requests ?? 0,
      estimatedCostUsd: data.usage ? estimateCost(data.usage) : 0,
    };

    return {
      success: true,
      provider: "anthropic",
      model: data.model,
      sources: Array.from(sourceMap.values()),
      usage,
      thinkingSummary,
      markdown,
    };
  } catch (err) {
    return {
      success: false,
      provider: "anthropic",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
