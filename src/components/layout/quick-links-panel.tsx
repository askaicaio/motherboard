// Team quick-links panel for the Motherboard home dashboard. Curated external
// destinations the team reaches for often. Extend QUICK_LINKS as new ones appear.
import { ExternalLink } from "lucide-react";

interface QuickLink {
  label: string;
  href: string;
}

const QUICK_LINKS: { group: string; links: QuickLink[] }[] = [
  {
    group: "Affiliate program",
    links: [
      { label: "Affiliate landing", href: "https://affiliates.chiefaiofficer.com/partners" },
      { label: "Apply (public)", href: "https://affiliates.chiefaiofficer.com/partners/apply" },
      { label: "Affiliate portal", href: "https://affiliates.chiefaiofficer.com/portal" },
      { label: "Enroll / checkout", href: "https://affiliates.chiefaiofficer.com/enroll" },
    ],
  },
  {
    group: "Marketing & funnels",
    links: [
      { label: "Roadmap landing", href: "https://roadmap.chiefaiofficer.com" },
      { label: "Playbook funnel", href: "https://playbook.chiefaiofficer.com" },
      { label: "Book a call (Dani)", href: "https://api.leadconnectorhq.com/widget/bookings/meetcaiodani" },
      { label: "Main site", href: "https://chiefaiofficer.com" },
    ],
  },
  {
    group: "Tools",
    links: [
      { label: "Stripe", href: "https://dashboard.stripe.com" },
      { label: "GoHighLevel", href: "https://app.gohighlevel.com" },
    ],
  },
];

export function QuickLinksPanel() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <ExternalLink className="h-4 w-4 text-zinc-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Quick links
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((section) => (
          <div key={section.group}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              {section.group}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {section.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
