"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const HEAR_OPTIONS = [
  "LinkedIn",
  "Facebook",
  "Instagram",
  "YouTube",
  "Google Search",
  "Referral",
  "Newsletter/Email",
  "Podcast",
  "Event/Webinar",
  "Other",
];

const AFFILIATE_LEVELS = [
  "None",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

const AI_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

const PLATFORM_OPTIONS = [
  "LinkedIn",
  "Facebook",
  "Instagram",
  "YouTube",
  "Email List",
  "Podcast",
  "Blog",
  "Speaking Gigs/Presentations",
  "Community",
];

const AUDIENCE_OPTIONS = [
  "Online Business Owners",
  "Biz Opp",
  "Executives",
  "Government Agencies",
  "Other",
];

const MAX_FILE_BYTES = 10 * 1024 * 1024; // ~10MB

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition";
const labelCls = "block text-sm font-medium text-slate-700";

export default function PartnerApplyPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    dateOfBirth: "",
    howDidYouHear: "",
    website: "",
    profession: "",
    promoExperience: "",
    promoExperienceDesc: "",
    affiliateExperienceLevel: "",
    aiExperienceLevel: "",
    audienceSize: "",
    homeRun: "",
    anythingElse: "",
    signature: "",
    company_website: "", // honeypot
  });
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [taxForm, setTaxForm] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggle(
    list: string[],
    setList: (v: string[]) => void,
    value: string,
  ) {
    setList(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setTaxForm(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Your tax form must be a PDF file.");
      setTaxForm(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Your tax form must be 10MB or smaller.");
      setTaxForm(null);
      e.target.value = "";
      return;
    }
    setTaxForm(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (platforms.length === 0) {
      setError("Please select at least one content/promotion platform.");
      return;
    }
    if (targetAudience.length === 0) {
      setError("Please select at least one target audience or niche.");
      return;
    }
    if (!taxForm) {
      setError("Please upload your W-9 or W-8BEN tax form (PDF).");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
        dateOfBirth: form.dateOfBirth,
        howDidYouHear: form.howDidYouHear,
        website: form.website.trim(),
        profession: form.profession.trim(),
        promoExperience: form.promoExperience === "yes",
        promoExperienceDesc: form.promoExperienceDesc.trim(),
        affiliateExperienceLevel: form.affiliateExperienceLevel,
        aiExperienceLevel: form.aiExperienceLevel,
        platforms,
        audienceSize: form.audienceSize,
        targetAudience,
        homeRun: form.homeRun.trim(),
        anythingElse: form.anythingElse.trim(),
        signature: form.signature.trim(),
        company_website: form.company_website, // honeypot
      };

      const fd = new FormData();
      fd.append("taxForm", taxForm);
      fd.append("payload", JSON.stringify(payload));

      const res = await fetch("/api/partners/apply", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
      router.push("/partners/thank-you");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {/* Logo / wordmark area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image
              src="/caio-scalingup.png"
              alt="Chief AI Officer — in partnership with Scaling Up"
              width={4000}
              height={1000}
              className="h-9 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Affiliate Onboarding
          </h1>
          <p className="mt-2 text-slate-500 text-base">
            Earn up to{" "}
            <span className="font-semibold text-indigo-600">$5,400</span> per
            referral. Tell us about yourself to get started.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {success ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
              <h2 className="text-xl font-semibold text-slate-900">
                Application received
              </h2>
              <p className="text-slate-500 max-w-sm">
                We review every application personally and will be in touch
                within 3 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-6" noValidate>
              {/* Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="firstName" className={labelCls}>
                    First name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="lastName" className={labelCls}>
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className={labelCls}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label htmlFor="address" className={labelCls}>
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  autoComplete="street-address"
                  value={form.address}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="city" className={labelCls}>
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    required
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="state" className={labelCls}>
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    required
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="postalCode" className={labelCls}>
                    Postal code <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    required
                    autoComplete="postal-code"
                    value={form.postalCode}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="country" className={labelCls}>
                    Country of Residence{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    required
                    autoComplete="country-name"
                    value={form.country}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="dateOfBirth" className={labelCls}>
                  Date of birth <span className="text-red-500">*</span>
                </label>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              {/* How did you hear */}
              <div className="space-y-1.5">
                <label htmlFor="howDidYouHear" className={labelCls}>
                  How did you hear about us?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  id="howDidYouHear"
                  name="howDidYouHear"
                  required
                  value={form.howDidYouHear}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">Select one…</option>
                  {HEAR_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="website" className={labelCls}>
                  Website or Social Media Link(s){" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  value={form.website}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profession" className={labelCls}>
                  What is your current profession or business?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="profession"
                  name="profession"
                  required
                  rows={3}
                  value={form.profession}
                  onChange={handleChange}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Promo experience */}
              <div className="space-y-2">
                <span className={labelCls}>
                  Do you have experience promoting online courses or digital
                  products? <span className="text-red-500">*</span>
                </span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="promoExperience"
                      value="yes"
                      required
                      checked={form.promoExperience === "yes"}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="promoExperience"
                      value="no"
                      checked={form.promoExperience === "no"}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    No
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="promoExperienceDesc" className={labelCls}>
                  If yes, please describe your experience.{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="promoExperienceDesc"
                  name="promoExperienceDesc"
                  rows={3}
                  value={form.promoExperienceDesc}
                  onChange={handleChange}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="affiliateExperienceLevel" className={labelCls}>
                  How experienced are you with affiliate marketing?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  id="affiliateExperienceLevel"
                  name="affiliateExperienceLevel"
                  required
                  value={form.affiliateExperienceLevel}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">Select one…</option>
                  {AFFILIATE_LEVELS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="aiExperienceLevel" className={labelCls}>
                  What is your AI experience level?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  id="aiExperienceLevel"
                  name="aiExperienceLevel"
                  required
                  value={form.aiExperienceLevel}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">Select one…</option>
                  {AI_LEVELS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platforms */}
              <div className="space-y-2">
                <span className={labelCls}>
                  What are your primary platforms for content or promotion?
                  (choose all that apply){" "}
                  <span className="text-red-500">*</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map((o) => (
                    <label
                      key={o}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={platforms.includes(o)}
                        onChange={() => toggle(platforms, setPlatforms, o)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="audienceSize" className={labelCls}>
                  What is your estimated audience size?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  id="audienceSize"
                  name="audienceSize"
                  type="number"
                  min={0}
                  required
                  value={form.audienceSize}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              {/* Target audience */}
              <div className="space-y-2">
                <span className={labelCls}>
                  Who is your target audience or niche?{" "}
                  <span className="text-red-500">*</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AUDIENCE_OPTIONS.map((o) => (
                    <label
                      key={o}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={targetAudience.includes(o)}
                        onChange={() =>
                          toggle(targetAudience, setTargetAudience, o)
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="homeRun" className={labelCls}>
                  What would make your experience as a CAIO affiliate a home
                  run? <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="homeRun"
                  name="homeRun"
                  required
                  rows={3}
                  value={form.homeRun}
                  onChange={handleChange}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="anythingElse" className={labelCls}>
                  Anything else we should know?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="anythingElse"
                  name="anythingElse"
                  required
                  rows={3}
                  value={form.anythingElse}
                  onChange={handleChange}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Tax form */}
              <div className="space-y-1.5">
                <label htmlFor="taxForm" className={labelCls}>
                  Tax form (W-9 or W-8BEN), PDF{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  id="taxForm"
                  name="taxForm"
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={handleFile}
                  className="w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {taxForm && (
                  <p className="text-xs text-slate-500">
                    Selected: {taxForm.name}
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  PDF only, max 10MB.
                </p>
              </div>

              {/* Signature */}
              <div className="space-y-1.5">
                <label htmlFor="signature" className={labelCls}>
                  Signature <span className="text-red-500">*</span>
                </label>
                <input
                  id="signature"
                  name="signature"
                  type="text"
                  required
                  placeholder="Your full legal name"
                  value={form.signature}
                  onChange={handleChange}
                  className={inputCls}
                />
                <p className="text-xs text-slate-400">
                  Typing your name acts as your electronic signature.
                </p>
              </div>

              {/* Honeypot — visually hidden, not for humans */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0 0 0 0)",
                  whiteSpace: "nowrap",
                }}
              >
                <label htmlFor="company_website">
                  Company website (leave blank)
                </label>
                <input
                  id="company_website"
                  name="company_website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.company_website}
                  onChange={handleChange}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {submitting ? "Submitting…" : "Complete My Affiliate Onboarding"}
              </button>

              <p className="text-center text-xs text-slate-400">
                We review every application personally and respond within 3
                business days.
              </p>
            </form>
          )}
        </div>

        {/* Credential bar */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-400">
          <span>10% flat commission</span>
          <span className="w-px h-3 bg-slate-300" />
          <span>60-day cookie window</span>
          <span className="w-px h-3 bg-slate-300" />
          <span>Net-45 payouts</span>
        </div>
      </div>
    </div>
  );
}
