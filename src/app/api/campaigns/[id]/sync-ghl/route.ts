// POST /api/campaigns/[id]/sync-ghl — manually trigger a GHL sync for one campaign

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { syncCampaignFromGhl } from "@/lib/integrations/ghl-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await syncCampaignFromGhl(id);

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
