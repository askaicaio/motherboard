// Marketing Toolkit — ready-to-use copy and brand assets for CAIO affiliates.
// Content sourced from the partner Marketing Toolkit (ChiefAIOfficer.com × Scaling Up).
// Gated behind the partner portal session.
import { requirePartner } from "@/lib/partners/session";
import { CopyBlockButton } from "@/components/portal/copy-block-button";

export const dynamic = "force-dynamic";

// --- Content data -----------------------------------------------------------

const VALUE_PROPS = [
  {
    n: "01",
    title: "Clarity, fast",
    body: "A structured AI assessment that shows exactly where to start — in days, not quarters.",
  },
  {
    n: "02",
    title: "Built for operators",
    body: "Grounded in the Scaling Up methodology trusted by thousands of growth companies.",
  },
  {
    n: "03",
    title: "Real ROI",
    body: "A prioritized roadmap tied to time saved and revenue gained — not a tool wishlist.",
  },
];

const ELEVATOR_PITCH = `CAIO helps business owners and executives turn AI from hype into a working advantage. Through ChiefAIOfficer.com — in partnership with Scaling Up — leaders get a clear assessment of where AI can save time and grow revenue, then a practical roadmap to put it to work. No jargon, no science projects: just the focused moves that move the business.`;

const AUDIENCE = `Business owners, founders, CEOs, and senior executives who know AI matters but aren't sure where it fits in their business. They're curious, time-poor, and skeptical of hype. Speak to the pressure they feel — falling behind, wasted experiments, competitors moving faster — and offer a clear, low-risk first step.`;

const EMAILS = [
  {
    label: "Email 1",
    subject: "The hidden truth about AI nobody's telling you",
    body: `Hi [First name],

Here's the part most of the AI conversation skips: the winners aren't the companies with the fanciest tools. They're the ones who figured out where AI actually moves the needle — and ignored the rest.

That's the whole idea behind CAIO. Instead of another "10 tools you must try" list, it starts with a short assessment of your business and shows you the two or three places AI will save real time or win real revenue. No hype, no science projects.

If you've been meaning to get serious about AI but didn't know where to start, this is the clearest first step I've seen. Take the free AI assessment here:

→ [Your referral link]

Worth 5 minutes. Tell me what you think.`,
  },
  {
    label: "Email 2",
    subject: "Do you make these AI mistakes?",
    body: `Hi [First name],

Most businesses experimenting with AI fall into the same three traps: chasing tools instead of outcomes, scattering effort across a dozen pilots, and never measuring whether any of it paid off.

It's not a knowledge problem — it's a focus problem. The fix is a clear, prioritized plan tied to your actual business goals.

CAIO does exactly that. A quick assessment, then a roadmap that tells you what to do first, what to skip, and what each move is worth. It's built on the Scaling Up methodology, so it speaks the language of operators, not engineers.

See where your business stands — take the assessment:

→ [Your referral link]

Happy to compare notes once you've run it.`,
  },
  {
    label: "Email 3",
    subject: "Why your competitors are beating you to AI",
    body: `Hi [First name],

The companies pulling ahead with AI right now usually aren't smarter or better funded. They just started with a plan while everyone else was still debating which chatbot to use.

Every quarter that gap compounds — faster service, lower costs, sharper decisions. The good news: catching up is mostly about getting focused, fast.

CAIO gives you that focus. Start with the assessment to see exactly where you stand, or book a call to walk through your roadmap with a specialist:

→ [Your referral link]

Don't let another quarter go by on the back foot.`,
  },
];

const SOCIAL_POSTS = [
  {
    channel: "LinkedIn",
    body: `Everyone's talking about AI. Almost no one can tell you where it'll actually pay off in their business.

That's the real gap. CAIO closes it with a quick assessment → a focused roadmap. Outcomes, not tools.

See where you stand: [link]`,
  },
  {
    channel: "X",
    body: `Most AI "strategies" are just a list of tools.

A real one starts with: where does this make or save us money?

That's the first question CAIO answers. Free assessment: [link]`,
  },
  {
    channel: "LinkedIn",
    body: `Your competitors aren't winning at AI because they're smarter.

They just started with a plan while everyone else debated chatbots.

Catch up fast. Take the CAIO assessment and see your roadmap: [link]`,
  },
  {
    channel: "X",
    body: `3 AI mistakes I see constantly:

1. Chasing tools, not outcomes
2. A dozen pilots, zero focus
3. Never measuring ROI

Fix all three: [link]`,
  },
  {
    channel: "LinkedIn",
    body: `If you're a business owner who keeps meaning to "get serious about AI" but never knows where to start — this is your sign.

CAIO gives you a clear first step in 5 minutes. Built on Scaling Up. Book a call or take the assessment: [link]`,
  },
  {
    channel: "X",
    body: `AI won't replace you.

But the business that figured out where to use it might.

Find your highest-ROI AI moves with CAIO: [link]`,
  },
];

const SUBJECT_LINES = [
  "The hidden truth about AI nobody's telling you",
  "Do you make these AI mistakes?",
  "Why your competitors are beating you to AI",
  "Where should AI actually start in your business?",
  "The AI plan you can act on this week",
  "Stop collecting AI tools. Start getting results.",
  "5 minutes to your AI roadmap",
  "Is your AI strategy just a tool list?",
  "The quiet way smart companies are using AI",
  "Your AI assessment is waiting",
];

const ONE_LINERS = [
  {
    tag: "Short · bios, signatures",
    body: "CAIO helps business leaders find their highest-ROI AI moves — outcomes, not hype.",
  },
  {
    tag: "Medium · posts, intros",
    body: "CAIO (ChiefAIOfficer.com, in partnership with Scaling Up) gives business owners and executives a clear AI assessment and a practical roadmap — so you know exactly where AI saves time and grows revenue, without the jargon or wasted experiments.",
  },
  {
    tag: "Long · landing pages, newsletters",
    body: "Most businesses know AI matters but can't tell where it fits. CAIO fixes that. Built on the Scaling Up methodology trusted by thousands of growth companies, it starts with a short assessment of your business, then delivers a prioritized roadmap tied to real time saved and revenue gained. No tool wishlists, no science projects — just the focused moves that move the business. Start with the free assessment or book a call with a specialist.",
  },
];

const REFERRAL_STEPS = [
  { title: "1. Share it", body: "Drop your link in emails, posts, your bio, or a talk." },
  { title: "2. They click", body: "A tracking cookie tags them as your referral." },
  { title: "3. You're credited", body: "If the cookie survives to checkout, the sale is yours." },
];

const WHERE_TO_PUT_IT = [
  "Email signature and newsletter footers",
  "LinkedIn & X bio, and the body of your posts",
  "Your website — a resources page or a dedicated CTA button",
  "Slide decks, webinars, and the description of any talk or podcast",
  "Direct messages and warm intros (with a personal note)",
];

const PROMO_DOS = [
  "Recommend CAIO where it's genuinely relevant",
  "Use your full tracking link, every time",
  "Add your own honest, personal endorsement",
  "Lead people to the AI assessment or a call",
];
const PROMO_DONTS = [
  "No spam — unsolicited bulk email or DMs",
  "No paid search bidding on the brand name",
  "No self-referrals or buying through your own link",
  "No misleading claims, fake urgency, or impersonation",
];

const BRAND_COLORS = [
  { name: "Indigo", hex: "#4F46E5", swatch: "#4F46E5", dark: true },
  { name: "Navy", hex: "#1E1B4B", swatch: "#1E1B4B", dark: true },
  { name: "Indigo tint", hex: "#EEF2FF", swatch: "#EEF2FF", dark: false },
  { name: "Off-white", hex: "#F8F8FC", swatch: "#F8F8FC", dark: false },
];

const TONE = [
  { word: "Confident", body: "Speak with authority. Make clear claims and stand behind them." },
  { word: "Clear", body: "Plain language. Short sentences. No jargon, no acronym soup." },
  { word: "No hype", body: 'No "revolutionary," no fake urgency. Let the outcomes do the selling.' },
];

// --- Page -------------------------------------------------------------------

export default async function PortalToolkitPage() {
  await requirePartner();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-indigo-600">
          Partner Program
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Marketing Toolkit
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ready-to-use copy and assets for promoting Chief AI Officer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["3 ready-to-send emails", "6 social posts", "10 subject lines", "Brand guidelines"].map(
            (chip) => (
              <span
                key={chip}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
              >
                {chip}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="space-y-12">
        {/* 01 — Positioning & messaging */}
        <section>
          <SectionLabel n="01" label="Positioning & messaging" />
          <h2 className="mb-5 text-xl font-semibold tracking-tight text-slate-900">
            Lead with the outcome, not the technology
          </h2>

          {/* Elevator pitch (copyable, on navy) */}
          <div className="mb-6 rounded-2xl bg-[#1e1b4b] p-6 text-white sm:p-7">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-indigo-300">
                The elevator pitch
              </span>
              <CopyBlockButton value={ELEVATOR_PITCH} variant="onDark" />
            </div>
            <p className="text-base leading-relaxed text-indigo-50">{ELEVATOR_PITCH}</p>
          </div>

          {/* Value props */}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Three core value props
          </h3>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {VALUE_PROPS.map((v) => (
              <div
                key={v.n}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="mb-2 text-2xl font-bold text-indigo-600">{v.n}</div>
                <div className="mb-1 font-semibold text-slate-900">{v.title}</div>
                <p className="text-sm leading-relaxed text-slate-500">{v.body}</p>
              </div>
            ))}
          </div>

          {/* Audience */}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Who you&apos;re talking to
          </h3>
          <div className="rounded-2xl border-l-[3px] border-indigo-600 bg-slate-50 p-5">
            <p className="text-sm leading-relaxed text-slate-700">{AUDIENCE}</p>
          </div>
        </section>

        {/* 02 — Your referral link */}
        <section>
          <SectionLabel n="02" label="Your referral link" />
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-slate-900">
            How you get credit
          </h2>
          <p className="mb-5 text-sm leading-relaxed text-slate-700">
            Your unique referral link tracks every person you send to CAIO. When someone
            clicks it and later purchases, you&apos;re credited — automatically. The whole
            system rests on one rule:{" "}
            <strong className="font-semibold text-slate-900">
              the link has to carry through to checkout.
            </strong>{" "}
            Grab your link on the{" "}
            <a href="/portal" className="font-medium text-indigo-600 hover:underline">
              Dashboard
            </a>
            .
          </p>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {REFERRAL_STEPS.map((s) => (
              <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-1 text-sm font-semibold text-indigo-600">{s.title}</div>
                <p className="text-sm leading-relaxed text-slate-500">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl bg-indigo-50 p-5 sm:p-6">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-indigo-600">
              The one rule that matters
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              Always link to CAIO using <strong>your full referral URL</strong> — never the bare
              ChiefAIOfficer.com address. If someone navigates away and comes back without your
              link, or you shorten the link in a way that strips the tracking code, the referral
              won&apos;t attach to you. When in doubt, paste the exact link you were given.
            </p>
          </div>

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Where to put it
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
            {WHERE_TO_PUT_IT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* 03 — Swipe emails */}
        <section>
          <SectionLabel n="03" label="Swipe emails" />
          <h2 className="mb-2 text-xl font-semibold tracking-tight text-slate-900">
            Three emails you can send today
          </h2>
          <p className="mb-5 text-sm leading-relaxed text-slate-500">
            Copy, swap in{" "}
            <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700">
              [Your referral link]
            </code>
            , add a personal line at the top, and send. Keep it conversational — these read best
            person-to-person.
          </p>

          <div className="space-y-4">
            {EMAILS.map((e) => (
              <div
                key={e.label}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] uppercase text-slate-400">
                      {e.label} · Subject
                    </div>
                    <div className="truncate font-semibold text-slate-900">{e.subject}</div>
                  </div>
                  <CopyBlockButton value={`Subject: ${e.subject}\n\n${e.body}`} />
                </div>
                <div className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-slate-700">
                  {e.body}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 04 — Social posts */}
        <section>
          <SectionLabel n="04" label="Social posts" />
          <h2 className="mb-2 text-xl font-semibold tracking-tight text-slate-900">
            Six posts — LinkedIn &amp; X ready
          </h2>
          <p className="mb-5 text-sm leading-relaxed text-slate-500">
            Each has a hook, a payoff, and a CTA. Swap in{" "}
            <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700">
              [link]
            </code>{" "}
            and post. Shorter ones suit X; longer ones suit LinkedIn.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_POSTS.map((p, i) => (
              <div
                key={i}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-indigo-600">
                    Post {i + 1} · {p.channel}
                  </span>
                  <CopyBlockButton value={p.body} size="sm" />
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 05 — One-liners & hooks */}
        <section>
          <SectionLabel n="05" label="One-liners & hooks" />
          <h2 className="mb-5 text-xl font-semibold tracking-tight text-slate-900">
            Blurbs &amp; subject lines to grab
          </h2>

          {/* Blurbs */}
          <div className="mb-8 space-y-3">
            {ONE_LINERS.map((o) => (
              <div key={o.tag} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    {o.tag}
                  </span>
                  <CopyBlockButton value={o.body} size="sm" />
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{o.body}</p>
              </div>
            ))}
          </div>

          {/* Subject line bank */}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Ten subject lines to test
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {SUBJECT_LINES.map((s, i) => (
              <div
                key={s}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-3 text-sm text-slate-700">
                  <span className="font-mono text-xs text-slate-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{s}</span>
                </span>
                <CopyBlockButton value={s} size="sm" />
              </div>
            ))}
          </div>
        </section>

        {/* 06 — Brand do's & don'ts */}
        <section>
          <SectionLabel n="06" label="Brand do's & don'ts" />
          <h2 className="mb-5 text-xl font-semibold tracking-tight text-slate-900">
            Keep it on-brand
          </h2>

          {/* Promotion do's & don'ts */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="mb-3 font-semibold text-emerald-700">✓&nbsp;&nbsp;Do</div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                {PROMO_DOS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="mb-3 font-semibold text-red-700">✗&nbsp;&nbsp;Don&apos;t</div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                {PROMO_DONTS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tone of voice */}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Tone of voice
          </h3>
          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {TONE.map((t, i) => (
              <div
                key={t.word}
                className={
                  i === 0
                    ? "rounded-2xl bg-[#1e1b4b] p-5 text-white"
                    : i === 1
                      ? "rounded-2xl bg-indigo-600 p-5 text-white"
                      : "rounded-2xl border border-slate-200 bg-white p-5"
                }
              >
                <div
                  className={
                    i === 2 ? "mb-1.5 text-lg font-semibold text-slate-900" : "mb-1.5 text-lg font-semibold"
                  }
                >
                  {t.word}
                </div>
                <p
                  className={
                    i === 2
                      ? "text-sm leading-relaxed text-slate-500"
                      : "text-sm leading-relaxed text-indigo-100"
                  }
                >
                  {t.body}
                </p>
              </div>
            ))}
          </div>

          {/* Brand colors */}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Colors
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BRAND_COLORS.map((c) => (
              <div
                key={c.name}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div
                  className="h-16 w-full border-b border-slate-100"
                  style={{ backgroundColor: c.swatch }}
                />
                <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                    <div className="font-mono text-xs text-slate-400">{c.hex}</div>
                  </div>
                  <CopyBlockButton value={c.hex} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 07 — Links & assets */}
        <section>
          <SectionLabel n="07" label="Links & assets" />
          <h2 className="mb-5 text-xl font-semibold tracking-tight text-slate-900">
            Where to find everything else
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="/portal/resources"
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">Resources library</div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                  Playbooks, the full toolkit PDF, brand assets, and logo files for download.
                </p>
                <span className="mt-2 inline-flex text-xs font-medium text-indigo-600">
                  Open Resources →
                </span>
              </div>
            </a>
            <a
              href="/portal"
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">Your referral link &amp; stats</div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                  Grab your tracking link and see clicks, referrals, and earnings.
                </p>
                <span className="mt-2 inline-flex text-xs font-medium text-indigo-600">
                  Open Dashboard →
                </span>
              </div>
            </a>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Questions? Reach your partner manager. CAIO Partner Program · ChiefAIOfficer.com ×
            Scaling Up · Confidential — for approved partners.
          </p>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-indigo-600">
      {n} — {label}
    </div>
  );
}
