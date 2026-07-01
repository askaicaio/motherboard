import { cookies } from "next/headers";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerPrograms } from "@/lib/db/schema";
import { AFF_COOKIE_NAME, decodeAffCookie } from "@/lib/partners/cookie";
import EnrollClient from "./enroll-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Enroll — Chief AI Officer",
  description:
    "Start your Chief AI Officer journey. Book a call to find the right fit, or enroll directly in a program.",
};

export default async function EnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const affParam = sp.aff_id;
  const fromUrl = Array.isArray(affParam) ? affParam[0] : affParam;

  const cookieValue = (await cookies()).get(AFF_COOKIE_NAME)?.value;
  const fromCookie = decodeAffCookie(cookieValue)?.refCode;

  const initialRef = fromUrl || fromCookie || "";

  const bookingUrl = process.env.AFFILIATE_BOOKING_URL || "";

  const programs = await db
    .select({
      id: partnerPrograms.id,
      name: partnerPrograms.name,
      slug: partnerPrograms.slug,
      listValueCents: partnerPrograms.listValueCents,
      isSample: partnerPrograms.isSample,
    })
    .from(partnerPrograms)
    .where(
      and(
        eq(partnerPrograms.salesLed, false),
        eq(partnerPrograms.active, true),
        isNull(partnerPrograms.archivedAt),
        isNotNull(partnerPrograms.stripePriceId),
      ),
    )
    .orderBy(asc(partnerPrograms.listValueCents));

  return (
    <EnrollClient
      programs={programs}
      initialRef={initialRef}
      bookingUrl={bookingUrl}
    />
  );
}
