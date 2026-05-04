// =============================================================
// Two-stage prompts for Strategic Growth Reports
// =============================================================
// Stage 1: Deep research dossier (web_search + reasoning)
//          → produces a comprehensive 5-25K char company intelligence
//            document matching the style of the reference dossiers.
//
// Stage 2: Slide distillation
//          → takes the dossier and produces the 10-slide markdown
//            ready to paste into Gamma, matching the reference deck
//            structure exactly.
// =============================================================

import { REFERENCES } from "./reference-content";
import type { ReportTitleFormat } from "@/types";
import { DEFAULT_REPORT_CONTACT } from "@/types";

export interface BuildPromptOptions {
  companyName: string;
  industry?: string;
  knownDetails?: string;
  titleFormat: ReportTitleFormat;
  /** CAIO representative shown on Slide 10 (CTA). Falls back to Dani Apgar. */
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

function resolveContact(options: BuildPromptOptions) {
  return {
    name: options.contactName?.trim() || DEFAULT_REPORT_CONTACT.name,
    email: options.contactEmail?.trim() || DEFAULT_REPORT_CONTACT.email,
    phone: options.contactPhone?.trim() || DEFAULT_REPORT_CONTACT.phone,
  };
}

const TITLE_FORMAT_INSTRUCTION: Record<ReportTitleFormat, string> = {
  strategic_growth:
    'Use the title format "Strategic Growth Through AI" — this is for a growth-stage company.',
  ebitda_expansion:
    'Use the title format "Leveraging Generative AI for Operational Excellence & EBITDA Expansion" — this is for a PE-backed or margin-focused company.',
};

// =============================================================
// Stage 1: RESEARCH DOSSIER PROMPT
// =============================================================

export function buildResearchPrompt(options: BuildPromptOptions): string {
  return `You are a senior McKinsey-caliber AI consulting strategist working for CAIO (ChiefAIOfficer.com). You generate Strategic Growth Reports for million-dollar prospect companies. These reports drive multi-million-dollar consulting engagements, so the underlying research must be **board-meeting-ready**.

# YOUR TASK — STAGE 1 OF 2

You are doing the **deep research stage**. Your output is a comprehensive **research dossier** in markdown that captures everything we need to know about the prospect to make a defensible AI ROI case.

This dossier will later be distilled into a 10-slide presentation deck. You are NOT writing the slides yet — you are gathering and synthesizing the intelligence that the slides will pull from.

# REFERENCE EXAMPLES — match this style and depth

The following are real research dossiers we've produced for past prospects. Match their depth, structure, factual rigor, and source-citing discipline. Notice how each:
- Opens with a **bold TL;DR paragraph** containing the key thesis, dollar figures, and timeline
- Uses 6-10 H2 sections covering: company overview, leadership/ownership, financials (with sources), competitive position, current AI/tech baseline, industry pressures
- Cites specific sources (SEC filings, press releases, industry databases) wherever possible
- Flags every estimate clearly with the source and methodology
- Uses tables where appropriate for financial data
- Ends with a brief conclusion synthesizing the AI opportunity

---

## EXAMPLE DOSSIER 1: Widel, Inc. (small private company)

${REFERENCES.sample_research_widel || "(not loaded)"}

---

## EXAMPLE DOSSIER 2: Andrews McMeel Universal (mid-size private)

${REFERENCES.sample_research_andrews_mcmeel || "(not loaded)"}

---

## EXAMPLE DOSSIER 3: Alphapointe (nonprofit manufacturer)

${REFERENCES.sample_research_alphapointe || "(not loaded)"}

---

# RESEARCH METHODOLOGY

You have access to web_search. Use it aggressively but proportionally — aim for **15-30 high-quality searches**.

**Research checklist** — verify or estimate every item:
1. **Company background**: founding, HQ, current operations, business segments
2. **Confirmed financials**: revenue, headcount, growth rate, margin profile (last 2-3 years)
   - Primary sources: SEC filings (if public), press releases, leadership interviews
   - Secondary sources for private cos: D&B, ZoomInfo, Crunchbase, Owler, Buzzfile, PrivCo
   - Always note the source and confidence level
3. **Ownership / leadership context**: PE-backed? Family-owned? Recent transitions? Key executives?
4. **Industry benchmarks**: typical EBITDA margin, EV/EBITDA multiple, labor cost as % of revenue, RPE (revenue per employee)
5. **Recent news (last 18 months)**: acquisitions, expansions, funding, leadership moves, awards, regulatory changes
6. **Operational structure**: locations, key business units, customer concentration, supply chain
7. **Current AI/technology baseline**: any disclosed AI initiatives? Tech stack? Digital maturity signals?
8. **Industry pressures**: margin compression, labor scarcity, regulatory shifts, competitive AI adoption

**Source-quality bar:**
- Prefer primary sources (company website, SEC filings, official press releases, leadership LinkedIn)
- Reputable secondary (Forbes, WSJ, industry trade pubs, D&B, ZoomInfo, Crunchbase)
- Avoid: Wikipedia for financials, unsourced blog posts, AI content farms

**Estimation methodology** (when financials are private):
- Revenue: triangulate from headcount × industry-RPE benchmark, or from PPP loan data, or D&B estimates
- EBITDA: Revenue × industry-average margin (cite the benchmark source)
- Multiples: pull from recent transaction comps in the sector
- Always show **range, not point estimate** (e.g., "$140M-$220M; midpoint ~$180M based on industry RPE of $450K")
- ⚠️ **Flag every estimate explicitly**

# OUTPUT FORMAT — markdown research dossier

🚨 **CRITICAL — OUTPUT THE FULL DOSSIER AS YOUR MESSAGE TEXT** 🚨

Output the **entire dossier directly in your response message** as markdown text.

- ❌ **DO NOT** save to files, write files, use code execution, or any tool that exports output to a sandbox
- ❌ **DO NOT** summarize "I have created a dossier file" — actually output the dossier
- ❌ **DO NOT** truncate or abbreviate — the full multi-thousand-word dossier goes in the response
- ❌ **DO NOT** include any preamble, meta-commentary, or "thinking out loud" text. Forbidden phrases include:
  - "I have sufficient research to produce the dossier"
  - "Let me synthesize" / "Let me write the dossier now"
  - "I'll structure this as..." / "Here's my dossier:"
  - **Start your response DIRECTLY with the H1 title**: \`# {Company Name}: {subtitle}\`
- ✅ **DO** write all sections verbatim as part of your message text
- ✅ **DO** use markdown formatting (headers, bold, tables, lists) directly in the message

Your final message must BE the dossier. The first character of your response must be \`#\`. Treat the response as a markdown document the operator will read.

# TABLE FORMATTING RULES (avoid common pitfalls)

When you produce a table, **the entire table must be a single contiguous block of pipe-rows**. Then EITHER nothing OR a paragraph BEFORE/AFTER the table — never between rows.

✅ **DO**:
\`\`\`
| Metric | FY2025 | FY2024 | Source |
| --- | --- | --- | --- |
| Revenue | $2.26B | $2.26B | 10-K |
| Net Earnings | $463.4M | $477.6M | Press release |
| Gross Margin | 29.8% | 30.3% | 10-K |
| Adjusted EBITDA | ~$784M | ~$806M | 10-K |

Net earnings declined 3% year over year despite record revenue, driven by margin compression in cement.
\`\`\`

❌ **DO NOT** (this is what produces broken pipe-soup):
\`\`\`
| Metric | FY2025 | FY2024 | Source |
| Revenue | $2.26B | $2.26B | 10-K |

Net earnings declined 3% year over year.

| Net Earnings | $463.4M | $477.6M | Press release |

Margins compressed in cement.

| Gross Margin | 29.8% | 30.3% | 10-K |
\`\`\`

❌ **DO NOT** create one-cell "tables" like \`| iFactory |\`. If you only have one piece of data, write it as **bold prose** or a bullet, not a table.

❌ **DO NOT** end paragraphs with a stray pipe character.

If you need to attribute a source for a single fact (not a tabular set of facts), use parenthetical citation: "Net leverage of 1.5x (FY2025 10-K)" — NOT a one-row pseudo-table.

Structure:
1. **\`# {Company Name}: {one-line subtitle}\`** — descriptive, captures the angle
2. **Bolded TL;DR paragraph** — the money paragraph containing:
   - Company size (revenue, headcount)
   - The AI ROI thesis ("AI could unlock $XX-$XX M in annual SG&A savings — a XX-XX% reduction — with a XX-XX month payback")
   - One-sentence positioning of why this prospect is interesting
3. **\`---\`** separator
4. **6-10 H2 sections** covering the research checklist above. Adapt the section titles to what's most relevant for THIS company. Examples of section titles you've used:
   - "A {N}-person {category} in {location}"
   - "Leadership passed from founder to family"
   - "Active {industry} with competitive low bids"
   - "No public AI or technology initiatives exist"
   - "Industry pressures that frame the AI opportunity"
   - "{Specific verification or gap} could not be publicly verified"
5. **Tables** — use markdown tables for financial estimates with source columns. **Tables MUST use proper GitHub-Flavored Markdown table syntax with a separator row**, like this:
   \`\`\`
   | Metric | Value | Source |
   | --- | --- | --- |
   | Annual Revenue | $2.3B | FY2025 10-K |
   | EBITDA Margin | 29.8% | Press release |
   \`\`\`
   The pipe-and-dash separator row (\`| --- | --- | --- |\`) is **mandatory** — without it, the table renders as broken inline text. NEVER output multiple pipe-rows without a separator row between header and data.
6. **Concluding section** — brief synthesis of the AI ROI angle (does NOT need to be the 10-slide format)

**Length target:** 5,000-20,000 characters depending on company size and public information availability. Don't pad — every paragraph must add value. The Widel dossier (small company, limited info) is 9K chars; the Andrews McMeel dossier (mid-size with rich data) is 14K chars.

# CRITICAL CONSTRAINTS

- **Cite or estimate**: Every dollar/percentage figure either has a source link/reference OR is clearly flagged as an estimate with methodology
- **No filler**: No "rapidly evolving AI landscape" disclaimers. No generic industry overviews disconnected from this specific prospect.
- **Honest about gaps**: If you can't find something, say so explicitly (see Widel example with the MillerGroup connection)
- **No fabrication**: Better to say "exact figure unknown — estimated $X-Y based on Z" than invent a precise number
- **Use real industry data**: Cite real benchmarks (Bain, BCG, McKinsey reports), real comparable companies, real recent transactions

# QUICK CONTEXT ON THE FINAL DECK FORMAT

The dossier you produce will later be distilled into a 10-slide deck with this title format: ${TITLE_FORMAT_INSTRUCTION[options.titleFormat]} The slides will cover: company at-a-glance, the opportunity, why act now, AI applications by SG&A function, financial impact table, three-phase roadmap, risks, valuation transformation, and call-to-action. Keep this in mind so your dossier surfaces the data needed for those slides — but DO NOT format the output as 10 slides. Output the research dossier.

Begin your research now. Use web_search liberally. Then produce the dossier.`;
}

// =============================================================
// Stage 2: SLIDE DISTILLATION PROMPT
// =============================================================

export function buildSlideDeckPrompt(
  options: BuildPromptOptions,
  dossier: string,
): string {
  const contact = resolveContact(options);
  return `You are a senior McKinsey-caliber AI consulting strategist working for CAIO (ChiefAIOfficer.com).

# YOUR TASK — STAGE 2 OF 2

The research dossier for **${options.companyName}** is complete (provided below). Your job is to **distill it into a 10-slide markdown presentation** ready to paste into Gamma.

You are NOT doing more research. You are NOT inventing new facts. You are translating the dossier's intelligence into the 10-slide structure that has been approved by sales for client presentations.

# RESEARCH DOSSIER (your only source of truth)

${dossier}

---

# 10-SLIDE STRUCTURE (every slide is mandatory; never more, never fewer)

## SLIDE 1: Title Slide
- Primary title: ${TITLE_FORMAT_INSTRUCTION[options.titleFormat]}
- Subtitle line 1: \`${options.companyName}\`
- Subtitle line 2: One-line value proposition specific to the prospect (e.g., "Leveraging Generative AI to Scale a $1.5B Development Platform Beyond Kansas City")
- Footer: "PREPARED BY CHIEF AI OFFICER · CONFIDENTIAL"
- DO NOT include: dates, version numbers, multiple subtitles.

## SLIDE 2: Company at a Glance
- One short intro sentence
- 4-5 large stat blocks (revenue/employees/years/locations/one differentiator)
- Each stat block: number, label, brief context (e.g., "$120M / Annual Revenue / Midpoint estimate · Privately held")

## SLIDE 3: The Opportunity
- 2-3 strategic opportunity cards
- Each: bold title (e.g., "First-Mover Advantage", "Efficiency Gap", "Margin Expansion") + 2-3 sentences grounded in the prospect's specific context
- High-level — no dollar figures yet

## SLIDE 4: Why Act Now
- 3-4 pressure categories with bold names (e.g., "Margin Pressure", "Labor Escalation", "Operational Complexity", "Scale Disadvantage")
- 2-3 bullet facts per category, with real industry benchmarks from the dossier
- Optional one-line punchy summary at the bottom

## SLIDE 5: AI Applications Across SG&A Functions
- Grid of cards organized by SG&A FUNCTION (not industry use case names)
- Standard functions: Finance & Accounting, Sales & Marketing, Customer Service, HR & Talent, Legal & Compliance
- If prospect has manufacturing/operations: add a second grouping (Production & Quality, Supply Chain, R&D, Sustainability)
- Each card: 2-3 specific AI applications + impact metric + dollar range
- ALL on one slide — do not split

## SLIDE 6: Consolidated Financial Impact
- Markdown table: Function | Annual Value Range | Timeline
- TOTAL IMPACT row at bottom
- Below the table:
  - **Investment Required:** $X.XM - $X.XM over 36 months
  - **Payback Period:** X-X months
  - **3-Year ROI:** XXX% - X,XXX%
- Estimation rules: Investment = 10-15% of total annual value. Conservative end of value = 50-60% of theoretical max; ambitious = 80-90%.

## SLIDE 7: Three-Phase Transformation Roadmap (ALL THREE ON ONE SLIDE)
- **Phase 1 · Days 1-90 · Fast Wins** — 4-5 initiatives, investment range, run-rate value
  - ALWAYS include: Executive AI Training, one quick-win automation (AP/invoice or proposal AI), one customer-facing AI (chatbot/service), AI Governance Framework
- **Phase 2 · Months 4-12 · Scale & Integrate** — 4-5 initiatives + investment + value
- **Phase 3 · Months 13-36 · Optimize & Lead** — 4-5 initiatives + investment + value

## SLIDE 8: Risk Management
- 4-6 risks. Each: bold name + Probability/Impact rating + 1-2 line mitigation
- Standard risks: Fragmented Adoption, Data Quality Gaps, Change Resistance, Cybersecurity, Vendor Lock-In
- Plus ONE industry-specific risk tailored to this prospect (food safety, regulatory, creator relations, etc.)

## SLIDE 9: Enterprise Value / Valuation Transformation
- "Today" box: Current EBITDA (Revenue × industry margin) × industry multiple = Current EV range
- "Year 3 (Post-AI)" box: Projected EBITDA (current + AI value, conservative end) × improved multiple (+0.5-1.0x premium) = Future EV range
- "Enterprise Value Created" — the delta, prominent
- Strategic Optionality: 3 bullets (independent w/ improved margins, attract buyers at premium, scale revenue without proportional SG&A growth)

## SLIDE 10: Call to Action
- Two-option comparison:
  - **❌ Status Quo** — 3-4 consequences (margin erosion, talent attrition, valuation stagnation, competitive gap)
  - **✅ AI Transformation** — 3-4 outcomes using exact numbers from Slides 6 & 9
- **Immediate Next Steps — Week 1**:
  - Day 1-3: CEO convenes leadership; secure board endorsement
  - Week 1: Engage AI consulting partner; assign Phase 1 lead; allocate Phase 1 budget
  - Week 1-2: CEO-wide communication on AI vision; invite employee input
  - Week 2-4: Select Phase 1 pilots; begin Executive Immersion training
- Optional bold closing quote — one sentence, prospect-specific
- Contact: **${contact.name} — ${contact.email} · ${contact.phone}**

---

# REFERENCE DECK STRUCTURES (match this density and tone)

## REFERENCE 1: CII Foods (best example of financial rigor + EBITDA framing)

${REFERENCES.cii_foods}

---

## REFERENCE 2: PlanITROI (best example of clean SG&A focus)

${REFERENCES.planitroi}

---

## REFERENCE 3: Cable Dahmer Automotive (additional reference)

${REFERENCES.cable_dahmer}

---

# OUTPUT FORMAT

Generate the report as structured markdown ready to paste into Gamma:
- \`#\` for slide titles (one per slide)
- \`##\` for subsections within a slide
- **Bold** for key metrics and dollar figures
- Markdown tables for slide 6
- \`---\` between slides for clear separation (Gamma will use these as card breaks)
- Each section must fit a single Gamma slide

# CRITICAL CONSTRAINTS

- **EXACTLY 10 slides — no more, no less.** Every slide earns its place.
- **AI applications organized by SG&A function** — never by industry use case name.
- **No filler** — no "rapidly evolving AI" disclaimers, no academic language.
- **Flag every estimate** — match the dossier's source-flagging discipline.
- **Use the dossier's specific facts** — pull dollar figures, leadership names, recent events directly from the dossier above. Do not invent.
- **Match the reference deck density** — neither sparse nor overcrowded.

Now produce the 10-slide markdown.`;
}

/**
 * Brief user message — what the operator submitted as the prospect input.
 * Used as the user turn for stage 1 (research).
 */
export function buildUserMessage(options: BuildPromptOptions): string {
  const lines: string[] = [
    `Generate the deep research dossier for:`,
    ``,
    `**Company:** ${options.companyName}`,
  ];
  if (options.industry) lines.push(`**Industry:** ${options.industry}`);
  else lines.push(`**Industry:** needs clarification — research from scratch`);
  if (options.knownDetails) {
    lines.push(``);
    lines.push(`**Known details:**`);
    lines.push(options.knownDetails);
  }
  lines.push(``);
  lines.push(
    `Use web_search aggressively. Verify financials. Flag every estimate. Match the depth and rigor of the example dossiers in the system prompt.`,
  );
  return lines.join("\n");
}

// Backward-compatibility export — kept so older imports don't break,
// but new code should use buildResearchPrompt + buildSlideDeckPrompt.
export const buildSystemPrompt = buildResearchPrompt;
