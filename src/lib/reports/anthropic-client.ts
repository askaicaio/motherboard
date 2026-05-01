// =============================================================
// Anthropic API client for deep research + report generation
// =============================================================
// Calls Claude with the web_search tool enabled, runs the
// McKinsey-caliber prompt, and returns the structured 10-slide
// markdown ready to paste into Gamma.
//
// Mock mode (REPORTS_MODE=mock or no API key) returns a sample
// report after a 5-second delay so the UI can be tested without
// burning API credits or waiting 5 minutes for real research.
// =============================================================

import { buildSystemPrompt, buildUserMessage, type BuildPromptOptions } from "./system-prompt";

export interface ResearchResult {
  success: true;
  markdown: string;
  model: string;
  sources: string[];
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
    model: "mock-claude-sonnet-4-5",
    sources: [
      "https://example.com/mock-source-1",
      "https://example.com/mock-source-2",
    ],
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

*[This is a MOCK report generated without real research. Set ANTHROPIC_API_KEY in environment variables and unset REPORTS_MODE=mock to enable live deep research.]*`,
  };
}

// ---------------------------------------------------------------------------
// Live research — calls the real Anthropic API
// ---------------------------------------------------------------------------
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  model: string;
  stop_reason?: string;
}

async function liveResearch(
  options: BuildPromptOptions,
): Promise<ResearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  const systemPrompt = buildSystemPrompt(options);
  const userMessage = buildUserMessage(options);

  const messages: AnthropicMessage[] = [
    { role: "user", content: userMessage },
  ];

  // Use Anthropic's web_search tool for the deep research portion.
  // Spec: https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool
  const tools = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 8,
    },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: systemPrompt,
        messages,
        tools,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        provider: "anthropic",
        error: `Anthropic API ${response.status}: ${errorText.slice(0, 500)}`,
      };
    }

    const data = (await response.json()) as AnthropicResponse;

    // Extract markdown text from the final message blocks
    const markdown = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("\n\n");

    // Extract any source URLs from web_search tool calls (simplified)
    const sources: string[] = [];

    return {
      success: true,
      provider: "anthropic",
      model: data.model,
      sources,
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
