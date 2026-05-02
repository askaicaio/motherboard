// =============================================================
// Gamma Generate API client — top-quality McKinsey-style decks
// =============================================================
// Sends the markdown research output to Gamma's Generate API,
// polls until ready, returns the share URL.
//
// Optimized for board-level prospect decks:
//   - 16x9 dimensions (professional presentation aspect)
//   - "preserve" text mode (keeps our exact 10-slide structure)
//   - Free-to-use commercial images (legitimate, royalty-free)
//   - Detailed additionalInstructions enforcing McKinsey style
//
// Mock mode (REPORTS_MODE=mock or no GAMMA_API_KEY) returns a
// fake share URL after a 3-second delay.
//
// API base: https://public-api.gamma.app/v1.0
// Auth header: X-API-KEY
// Docs: https://developers.gamma.app
// =============================================================

export interface GammaResult {
  success: true;
  generationId: string;
  url: string;
  creditsDeducted?: number;
  creditsRemaining?: number;
  provider: "gamma" | "mock";
}

export interface GammaError {
  success: false;
  error: string;
  provider: "gamma" | "mock";
}

export type GammaOutcome = GammaResult | GammaError;

const MOCK_DELAY_MS = 3000;
const POLL_INTERVAL_MS = 5000; // Gamma recommends every 5 seconds
const MAX_POLL_ATTEMPTS = 48; // 4 minutes total — generations typically take 1-3 min

function isMockMode(): boolean {
  return (
    process.env.REPORTS_MODE === "mock" ||
    !process.env.GAMMA_API_KEY
  );
}

export interface GenerateGammaOptions {
  markdown: string;
  companyName: string;
}

export async function generateGammaDeck(
  options: GenerateGammaOptions,
): Promise<GammaOutcome> {
  if (isMockMode()) {
    return mockGenerate(options);
  }
  return liveGenerate(options);
}

// ---------------------------------------------------------------------------
// Mock — pretend to generate a deck and return a fake URL
// ---------------------------------------------------------------------------
async function mockGenerate(
  options: GenerateGammaOptions,
): Promise<GammaOutcome> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const slug = options.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    success: true,
    provider: "mock",
    generationId: `mock-${Date.now()}`,
    url: `https://gamma.app/docs/MOCK-${slug}-strategic-growth`,
  };
}

// ---------------------------------------------------------------------------
// Live — call the real Gamma Generate API
// ---------------------------------------------------------------------------

interface GammaCreateResponse {
  generationId: string;
  warnings?: string;
}

interface GammaStatusResponse {
  generationId: string;
  status: "pending" | "completed" | "failed";
  gammaId?: string;
  gammaUrl?: string;
  exportUrl?: string;
  error?: { message?: string; statusCode?: number };
  credits?: { deducted?: number; remaining?: number };
}

/**
 * Detailed instructions to push Gamma toward McKinsey/BCG/Bain-quality output.
 * These supplement the markdown content and shape the visual layout.
 */
const MCKINSEY_INSTRUCTIONS = [
  "Generate a board-level executive presentation matching the visual standard of top consulting firms (McKinsey, BCG, Bain).",
  "Use a clean, restrained, professional aesthetic. Heavy whitespace. Crisp typography. Minimal color — black/dark grey for text, one accent color (deep navy or muted purple) used sparingly.",
  "Convert markdown tables into clean, well-structured slide tables (NOT screenshots of code).",
  "Convert bulleted lists into visual cards or grids when more than 3 items — these are KPI cards / pillar cards, not text lists.",
  "Render dollar figures and percentages as large, prominent stat blocks where they appear (e.g., '$X.X M', '25-35%', '6-9 months').",
  "Charts: render the financial impact tables and roadmap as proper data visualizations — never just plain tables when a chart fits.",
  "Use icons sparingly — only where they clarify (a checkmark for the AI Transformation column, an X for Status Quo, etc.).",
  "Slide 1 (Title) should be cinematic and minimal — large title, single subtitle, footer.",
  "Slide 2 (Company at a Glance) — render the 4-5 metrics as large stat cards in a horizontal row.",
  "Slide 5 (AI Applications by SG&A) — render as a 2x3 or 3x2 grid of function cards. Each card has the function name, 2-3 bullet applications, and the dollar impact range as a footer.",
  "Slide 6 (Consolidated Financial Impact) — clean table with the bottom row visually emphasized (different background color, larger text).",
  "Slide 7 (Three-Phase Roadmap) — render as three horizontal phase blocks side-by-side, each with its initiatives, investment, and value range.",
  "Slide 9 (Valuation) — two large boxes side-by-side (Today vs Year 3) with EBITDA and multiple stacked, then the delta in a prominent third box.",
  "Slide 10 (Call to Action) — two columns: red-tinted Status Quo on the left, green-tinted AI Transformation on the right, then the Week 1 actions below.",
  "Match the density of the reference reports — no slide is overcrowded; every element has breathing room.",
  "Color palette: backgrounds white/very-light-grey; primary text near-black (#18181B); accent for emphasis only; no rainbow effects, no gradients except subtle.",
].join(" ");

async function liveGenerate(
  options: GenerateGammaOptions,
): Promise<GammaOutcome> {
  const apiKey = process.env.GAMMA_API_KEY!;
  const baseUrl = process.env.GAMMA_API_BASE_URL || "https://public-api.gamma.app";
  const themeId = process.env.GAMMA_THEME_ID || undefined;

  // Image source default: aiGenerated — Gamma's built-in AI image
  // generation (flux-1-pro). Reasons:
  //   - Custom imagery for every prospect, no generic stock cliches
  //   - Zero watermarks (Pexels is OK, web filters surface watermarked previews)
  //   - Editorial / McKinsey style via stylePreset + style
  //   - Cost is negligible vs the $50K+ deals these decks support
  //
  // Override via GAMMA_IMAGE_SOURCE env var:
  //   pexels         — curated free stock photography (good fallback)
  //   themeAccent    — solid color blocks, pure McKinsey minimalism
  //   pictographic   — clean iconography, abstract
  //   noImages       — text-only deck
  //   webFreeToUse*  — NOT recommended (surfaces watermarked Alamy previews)
  const imageSource = (process.env.GAMMA_IMAGE_SOURCE || "aiGenerated") as
    | "aiGenerated"
    | "pictographic"
    | "pexels"
    | "webFreeToUse"
    | "webFreeToUseCommercially"
    | "themeAccent"
    | "placeholder"
    | "noImages";

  try {
    // ---- Step 1: Create the generation ----
    const createBody: Record<string, unknown> = {
      inputText: options.markdown,
      // "preserve" — don't let Gamma rewrite our carefully-crafted slides
      textMode: "preserve",
      format: "presentation",
      numCards: 10,
      cardSplit: "inputTextBreaks", // We use --- between slides
      additionalInstructions: MCKINSEY_INSTRUCTIONS,
      cardOptions: {
        dimensions: "16x9", // Professional presentation aspect
      },
      textOptions: {
        amount: "medium",
        tone:
          "Professional executive consulting voice. Direct, declarative, McKinsey-style. No filler. No qualifiers like 'rapidly evolving' or 'in today's world'.",
        audience: "C-suite executives and PE board members",
        language: "en",
      },
      imageOptions: {
        source: imageSource,
        // If using AI-generated, prefer a clean editorial style
        ...(imageSource === "aiGenerated"
          ? {
              model: "flux-1-pro",
              stylePreset: "photorealistic",
              style:
                "Editorial business photography, muted tones, depth of field, professional, McKinsey-style — no stock-photo cliches.",
            }
          : {}),
      },
      sharingOptions: {
        workspaceAccess: "fullAccess", // Anyone in CAIO workspace can edit
        externalAccess: "view", // External viewers (prospects) can view via link
      },
    };

    if (themeId) {
      createBody.themeId = themeId;
    }

    const createRes = await fetch(`${baseUrl}/v1.0/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(createBody),
    });

    const createText = await createRes.text();

    if (!createRes.ok) {
      let msg = `Gamma create ${createRes.status}`;
      try {
        const j = JSON.parse(createText) as { message?: string; error?: { message?: string } };
        msg += `: ${j.error?.message || j.message || createText.slice(0, 300)}`;
      } catch {
        msg += `: ${createText.slice(0, 300)}`;
      }
      return { success: false, provider: "gamma", error: msg };
    }

    const createData = JSON.parse(createText) as GammaCreateResponse;
    const generationId = createData.generationId;

    if (!generationId) {
      return {
        success: false,
        provider: "gamma",
        error: "Gamma did not return a generationId",
      };
    }

    // ---- Step 2: Poll until completed ----
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetch(
        `${baseUrl}/v1.0/generations/${generationId}`,
        {
          headers: { "X-API-KEY": apiKey },
        },
      );

      if (!statusRes.ok) {
        // Transient failures — keep polling
        continue;
      }

      const status = (await statusRes.json()) as GammaStatusResponse;

      if (status.status === "completed" && status.gammaUrl) {
        return {
          success: true,
          provider: "gamma",
          generationId,
          url: status.gammaUrl,
          creditsDeducted: status.credits?.deducted,
          creditsRemaining: status.credits?.remaining,
        };
      }

      if (status.status === "failed") {
        return {
          success: false,
          provider: "gamma",
          error:
            status.error?.message ||
            `Gamma generation failed with status code ${status.error?.statusCode || "unknown"}`,
        };
      }

      // status === "pending" → keep polling
    }

    return {
      success: false,
      provider: "gamma",
      error: `Gamma generation timed out after ${(POLL_INTERVAL_MS * MAX_POLL_ATTEMPTS) / 1000}s`,
    };
  } catch (err) {
    return {
      success: false,
      provider: "gamma",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
