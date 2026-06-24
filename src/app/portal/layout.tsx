// Partner portal shell. Renders the signed-in nav when a partner session
// exists; auth pages (login / set-password / forgot) render bare below it.
import { getPartnerSession } from "@/lib/partners/session";
import { PortalHeader } from "@/components/portal/portal-header";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartnerSession();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <PortalHeader
        partner={partner ? { name: partner.name, email: partner.email } : null}
      />
      <main>{children}</main>
    </div>
  );
}
