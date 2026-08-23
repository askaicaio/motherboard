// Partner portal — Profile (contact address). Server component; scoped to the
// logged-in affiliate.
import { requirePartner } from "@/lib/partners/session";
import { ProfileClient } from "@/components/portal/profile-client";

export const dynamic = "force-dynamic";

// Slots into the portal layout's title template ("%s · Affiliate Portal").
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const partner = await requirePartner();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep your contact details current so we can reach you and your records
          stay accurate.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <ProfileClient
          name={partner.name}
          email={partner.email}
          address={partner.address}
          city={partner.city}
          state={partner.state}
          postalCode={partner.postalCode}
          country={partner.country}
        />
      </section>
    </div>
  );
}
