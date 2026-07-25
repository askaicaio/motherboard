// Partner portal shell. Renders the signed-in nav when a partner session
// exists; auth pages (login / set-password / forgot) render bare below it.
import type { Metadata } from "next";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { PortalHeader } from "@/components/portal/portal-header";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";

export const dynamic = "force-dynamic";

// Every portal page inherits this. Child pages set their own title via
// `title` and it slots into the template; it's private, so keep it out of
// search indexes.
export const metadata: Metadata = {
  title: {
    default: "Affiliate Portal — Chief AI Officer",
    template: "%s · Affiliate Portal",
  },
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartnerSession();
  const impersonating = partner ? await getImpersonation() : false;
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {impersonating && partner && <ImpersonationBanner name={partner.name} />}
      <PortalHeader
        partner={partner ? { name: partner.name, email: partner.email } : null}
      />
      <main>{children}</main>
    </div>
  );
}
