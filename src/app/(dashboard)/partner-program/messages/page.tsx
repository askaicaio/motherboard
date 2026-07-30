// Partner Program — CAIO team inbox. Server component builds the conversation
// list (one thread per affiliate) + hands the selected partner id to the
// interactive inbox client, which polls the thread and sends replies.
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { partnerMessages, partners } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { MessagesInboxClient, type Conversation } from "@/components/partner-program/messages-inbox-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messages" };

export default async function PartnerMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ partner?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const selectedId = typeof sp.partner === "string" ? sp.partner : null;

  // Low volume (dozens of affiliates) → fetch messages newest-first and fold
  // into per-partner conversations in memory.
  const msgRows = await db
    .select({
      partnerId: partnerMessages.partnerId,
      senderType: partnerMessages.senderType,
      body: partnerMessages.body,
      createdAt: partnerMessages.createdAt,
      readByAdminAt: partnerMessages.readByAdminAt,
    })
    .from(partnerMessages)
    .orderBy(desc(partnerMessages.createdAt));

  const convMap = new Map<
    string,
    { partnerId: string; lastBody: string; lastAt: Date; lastFromPartner: boolean; unread: number }
  >();
  for (const m of msgRows) {
    let c = convMap.get(m.partnerId);
    if (!c) {
      // First seen = newest (rows are DESC).
      c = {
        partnerId: m.partnerId,
        lastBody: m.body,
        lastAt: m.createdAt,
        lastFromPartner: m.senderType === "partner",
        unread: 0,
      };
      convMap.set(m.partnerId, c);
    }
    if (m.senderType === "partner" && m.readByAdminAt === null) c.unread += 1;
  }

  const ids = [...convMap.keys()];
  const pInfo = ids.length
    ? await db
        .select({
          id: partners.id,
          name: partners.name,
          email: partners.email,
          refCode: partners.refCode,
        })
        .from(partners)
        .where(inArray(partners.id, ids))
    : [];
  const pMap = new Map(pInfo.map((p) => [p.id, p]));

  const conversations: Conversation[] = [...convMap.values()]
    .map((c) => ({
      partnerId: c.partnerId,
      name: pMap.get(c.partnerId)?.name ?? "Unknown",
      email: pMap.get(c.partnerId)?.email ?? "",
      refCode: pMap.get(c.partnerId)?.refCode ?? "",
      lastBody: c.lastBody,
      lastAt: c.lastAt.toISOString(),
      lastFromPartner: c.lastFromPartner,
      unread: c.unread,
    }))
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

  return (
    <MessagesInboxClient conversations={conversations} selectedId={selectedId} />
  );
}
