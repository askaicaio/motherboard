// =============================================================
// Gamma Generate API client
// =============================================================
// Submits the markdown research output to Gamma's Generate API,
// polls until the deck is ready, and returns the share URL.
//
// Mock mode (REPORTS_MODE=mock or no GAMMA_API_KEY) returns a
// fake share URL after a 3-second delay.
//
// Gamma Generate API docs: https://developers.gamma.app/
// (Currently in closed beta — request access via Gamma support.)
// =============================================================

export interface GammaResult {
  success: true;
  generationId: string;
  url: string;
  provider: "gamma" | "mock";
}

export interface GammaError {
  success: false;
  error: string;
  provider: "gamma" | "mock";
}

export type GammaOutcome = GammaResult | GammaError;

const MOCK_DELAY_MS = 3000;
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 60; // 4 minutes total

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
  status?: string;
  url?: string;
}

interface GammaStatusResponse {
  generationId: string;
  status: "pending" | "processing" | "completed" | "failed";
  url?: string;
  error?: string;
}

async function liveGenerate(
  options: GenerateGammaOptions,
): Promise<GammaOutcome> {
  const apiKey = process.env.GAMMA_API_KEY!;
  const baseUrl = process.env.GAMMA_API_BASE_URL || "https://public-api.gamma.app/v0.2";

  try {
    // Step 1: Create the generation
    const createRes = await fetch(`${baseUrl}/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        inputText: options.markdown,
        format: "presentation",
        textMode: "preserve",
        themeName: process.env.GAMMA_THEME_NAME || "Default",
        numCards: 10,
        textOptions: {
          amount: "detailed",
          language: "en",
        },
        cardOptions: {
          dimensions: "fluid",
        },
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      return {
        success: false,
        provider: "gamma",
        error: `Gamma API ${createRes.status}: ${text.slice(0, 500)}`,
      };
    }

    const createData = (await createRes.json()) as GammaCreateResponse;
    const generationId = createData.generationId;

    // If Gamma already returned a URL synchronously, we're done
    if (createData.url && createData.status === "completed") {
      return {
        success: true,
        provider: "gamma",
        generationId,
        url: createData.url,
      };
    }

    // Step 2: Poll until ready
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetch(
        `${baseUrl}/generations/${generationId}`,
        {
          headers: { "X-API-KEY": apiKey },
        },
      );

      if (!statusRes.ok) {
        continue; // Try again next poll
      }

      const status = (await statusRes.json()) as GammaStatusResponse;

      if (status.status === "completed" && status.url) {
        return {
          success: true,
          provider: "gamma",
          generationId,
          url: status.url,
        };
      }

      if (status.status === "failed") {
        return {
          success: false,
          provider: "gamma",
          error: status.error || "Gamma generation failed",
        };
      }
    }

    return {
      success: false,
      provider: "gamma",
      error: "Gamma generation timed out (4 minutes)",
    };
  } catch (err) {
    return {
      success: false,
      provider: "gamma",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
