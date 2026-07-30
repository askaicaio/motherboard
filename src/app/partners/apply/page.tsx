"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  "Other",
];

const AUDIENCE_OPTIONS = [
  "Online Business Owners",
  "Biz Opp",
  "Executives",
  "Government Agencies",
  "Other",
];

// Program is US + Canada only for now. The tax-form type is derived from this
// (US → W-9, Canada → W-8BEN) so we never have to ask the applicant.
const COUNTRY_OPTIONS = ["United States", "Canada"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(year: number, month1: number): number {
  if (!year || !month1) return 31;
  return new Date(year, month1, 0).getDate();
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // ~10MB

// Real domain with a dot + TLD — rejects typos like "you@gmailcom".
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Common misspellings of popular providers — caught with a "did you mean" hint.
const TYPO_DOMAINS: Record<string, string> = {
  "gmailcom": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "iclould.com": "icloud.com",
  "icloud.co": "icloud.com",
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition";
const labelCls = "block text-sm font-medium text-slate-700";
const errRing =
  "border-red-400 ring-1 ring-red-300 focus:ring-red-400 focus:border-red-400";

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
  const [platformOther, setPlatformOther] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [audienceOther, setAudienceOther] = useState("");
  const [hearOther, setHearOther] = useState("");
  const [websites, setWebsites] = useState<string[]>([""]);
  const [taxForm, setTaxForm] = useState<File | null>(null);

  // Fields adapt to the selected country.
  const isCanada = form.country === "Canada";
  const stateLabel = isCanada ? "Province" : "State";
  const postalLabel = isCanada ? "Postal code" : "ZIP code";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const err = (name: string) => name in errors;
  const clearErr = (name: string) =>
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    clearErr(e.target.name);
  }

  function toggle(
    list: string[],
    setList: (v: string[]) => void,
    value: string,
    errKey: string,
  ) {
    setList(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    );
    clearErr(errKey);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    clearErr("taxForm");
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

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const req = (name: string, val: string, msg = "This field is required.") => {
      if (!val.trim()) next[name] = msg;
    };
    req("firstName", form.firstName);
    req("lastName", form.lastName);
    req("address", form.address);
    req("city", form.city);
    req("state", form.state);
    req("postalCode", form.postalCode);
    req("country", form.country);
    req("dateOfBirth", form.dateOfBirth);
    req("howDidYouHear", form.howDidYouHear, "Please choose an option.");
    req("profession", form.profession);
    req("affiliateExperienceLevel", form.affiliateExperienceLevel, "Please choose an option.");
    req("aiExperienceLevel", form.aiExperienceLevel, "Please choose an option.");
    req("audienceSize", form.audienceSize);
    req("homeRun", form.homeRun);
    req("signature", form.signature);

    // Email — format + common-typo guard.
    const email = form.email.trim();
    if (!email) {
      next.email = "This field is required.";
    } else if (!EMAIL_RE.test(email)) {
      next.email = "Please enter a valid email address.";
    } else {
      const domain = email.split("@")[1]?.toLowerCase();
      if (domain && TYPO_DOMAINS[domain]) {
        next.email = `Did you mean …@${TYPO_DOMAINS[domain]}?`;
      }
    }

    if (!form.promoExperience) next.promoExperience = "Please choose Yes or No.";

    if (platforms.length === 0) {
      next.platforms = "Please select at least one platform.";
    } else if (platforms.includes("Other") && !platformOther.trim()) {
      next.platformOther = "Please specify your other platform.";
    }

    if (targetAudience.length === 0) {
      next.targetAudience = "Please select at least one audience.";
    } else if (targetAudience.includes("Other") && !audienceOther.trim()) {
      next.audienceOther = "Please specify your other audience.";
    }

    if (form.howDidYouHear === "Other" && !hearOther.trim()) {
      next.hearOther = "Please tell us how you heard about us.";
    }

    if (!taxForm) next.taxForm = "Please upload your W-9 or W-8BEN (PDF).";

    // Optional, but guard the total length so it can't blow past the server cap.
    const joinedSites = websites.map((s) => s.trim()).filter(Boolean).join("\n");
    if (joinedSites.length > 2000) {
      next.website =
        "That's a lot of links — please keep them under 2000 characters total.";
    }

    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Please fill in the highlighted fields below.");
      // Scroll the first invalid field into view once it's rendered red.
      setTimeout(() => {
        document
          .querySelector('[data-invalid="true"]')
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }

    setSubmitting(true);
    try {
      const finalPlatforms = platforms.map((p) =>
        p === "Other" ? `Other: ${platformOther.trim()}` : p,
      );
      const finalAudience = targetAudience.map((a) =>
        a === "Other" ? `Other: ${audienceOther.trim()}` : a,
      );
      const website = websites.map((s) => s.trim()).filter(Boolean).join("\n");

      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
        // W-9 for US residents, W-8BEN for Canadian (non-US) individuals.
        taxFormStatus: form.country === "United States" ? "w9" : "w8ben",
        dateOfBirth: form.dateOfBirth,
        howDidYouHear:
          form.howDidYouHear === "Other"
            ? `Other: ${hearOther.trim()}`
            : form.howDidYouHear,
        website,
        profession: form.profession.trim(),
        promoExperience: form.promoExperience === "yes",
        promoExperienceDesc: form.promoExperienceDesc.trim(),
        affiliateExperienceLevel: form.affiliateExperienceLevel,
        aiExperienceLevel: form.aiExperienceLevel,
        platforms: finalPlatforms,
        audienceSize: form.audienceSize,
        targetAudience: finalAudience,
        homeRun: form.homeRun.trim(),
        anythingElse: form.anythingElse.trim(),
        signature: form.signature.trim(),
        company_website: form.company_website, // honeypot
      };

      const fd = new FormData();
      fd.append("taxForm", taxForm!);
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
            Affiliate Application
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
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={handleChange}
                    data-invalid={err("firstName") || undefined}
                    className={cn(inputCls, err("firstName") && errRing)}
                  />
                  <FieldError msg={errors.firstName} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="lastName" className={labelCls}>
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={handleChange}
                    data-invalid={err("lastName") || undefined}
                    className={cn(inputCls, err("lastName") && errRing)}
                  />
                  <FieldError msg={errors.lastName} />
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
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  data-invalid={err("email") || undefined}
                  className={cn(inputCls, err("email") && errRing)}
                />
                <FieldError msg={errors.email} />
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
                  autoComplete="street-address"
                  value={form.address}
                  onChange={handleChange}
                  data-invalid={err("address") || undefined}
                  className={cn(inputCls, err("address") && errRing)}
                />
                <FieldError msg={errors.address} />
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
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={handleChange}
                    data-invalid={err("city") || undefined}
                    className={cn(inputCls, err("city") && errRing)}
                  />
                  <FieldError msg={errors.city} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="state" className={labelCls}>
                    {stateLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={handleChange}
                    data-invalid={err("state") || undefined}
                    className={cn(inputCls, err("state") && errRing)}
                  />
                  <FieldError msg={errors.state} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="postalCode" className={labelCls}>
                    {postalLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    autoComplete="postal-code"
                    value={form.postalCode}
                    onChange={handleChange}
                    data-invalid={err("postalCode") || undefined}
                    className={cn(inputCls, err("postalCode") && errRing)}
                  />
                  <FieldError msg={errors.postalCode} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="country" className={labelCls}>
                    Country of Residence{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="country"
                    name="country"
                    autoComplete="country-name"
                    value={form.country}
                    onChange={handleChange}
                    data-invalid={err("country") || undefined}
                    className={cn(inputCls, err("country") && errRing)}
                  >
                    <option value="">Select…</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <FieldError msg={errors.country} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>
                  Date of birth <span className="text-red-500">*</span>
                </label>
                <DobPicker
                  value={form.dateOfBirth}
                  invalid={err("dateOfBirth")}
                  onChange={(v) => {
                    setForm((prev) => ({ ...prev, dateOfBirth: v }));
                    clearErr("dateOfBirth");
                  }}
                />
                <FieldError msg={errors.dateOfBirth} />
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
                  value={form.howDidYouHear}
                  onChange={handleChange}
                  data-invalid={err("howDidYouHear") || undefined}
                  className={cn(inputCls, err("howDidYouHear") && errRing)}
                >
                  <option value="">Select one…</option>
                  {HEAR_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {form.howDidYouHear === "Other" && (
                  <input
                    type="text"
                    value={hearOther}
                    onChange={(e) => {
                      setHearOther(e.target.value);
                      clearErr("hearOther");
                    }}
                    maxLength={190}
                    placeholder="Please tell us how you heard about us"
                    data-invalid={err("hearOther") || undefined}
                    className={cn(inputCls, "mt-1", err("hearOther") && errRing)}
                  />
                )}
                <FieldError msg={errors.howDidYouHear} />
                <FieldError msg={errors.hearOther} />
              </div>

              {/* Website / social links — add more with the + (on hover) */}
              <div className="space-y-1.5" data-invalid={err("website") || undefined}>
                <label className={labelCls}>
                  Website or Social Media Link(s){" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="space-y-2">
                  {websites.map((url, i) => (
                    <div key={i} className="group flex items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          setWebsites((prev) =>
                            prev.map((u, idx) => (idx === i ? e.target.value : u)),
                          );
                          clearErr("website");
                        }}
                        maxLength={500}
                        placeholder="https://…"
                        className={inputCls}
                      />
                      {websites.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setWebsites((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          aria-label="Remove this link"
                          className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setWebsites((prev) => [
                            ...prev.slice(0, i + 1),
                            "",
                            ...prev.slice(i + 1),
                          ])
                        }
                        aria-label="Add another link"
                        title="Add another link"
                        className="shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-indigo-50 hover:text-indigo-600 focus:opacity-100 group-hover:opacity-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <FieldError msg={errors.website} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profession" className={labelCls}>
                  What is your current profession or business?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="profession"
                  name="profession"
                  rows={3}
                  placeholder="Write your answer here…"
                  value={form.profession}
                  onChange={handleChange}
                  data-invalid={err("profession") || undefined}
                  className={cn(inputCls, "resize-none", err("profession") && errRing)}
                />
                <FieldError msg={errors.profession} />
              </div>

              {/* Promo experience */}
              <div className="space-y-2" data-invalid={err("promoExperience") || undefined}>
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
                <FieldError msg={errors.promoExperience} />
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
                  placeholder="Write your answer here…"
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
                  value={form.affiliateExperienceLevel}
                  onChange={handleChange}
                  data-invalid={err("affiliateExperienceLevel") || undefined}
                  className={cn(inputCls, err("affiliateExperienceLevel") && errRing)}
                >
                  <option value="">Select one…</option>
                  {AFFILIATE_LEVELS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <FieldError msg={errors.affiliateExperienceLevel} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="aiExperienceLevel" className={labelCls}>
                  What is your AI experience level?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  id="aiExperienceLevel"
                  name="aiExperienceLevel"
                  value={form.aiExperienceLevel}
                  onChange={handleChange}
                  data-invalid={err("aiExperienceLevel") || undefined}
                  className={cn(inputCls, err("aiExperienceLevel") && errRing)}
                >
                  <option value="">Select one…</option>
                  {AI_LEVELS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <FieldError msg={errors.aiExperienceLevel} />
              </div>

              {/* Platforms */}
              <div className="space-y-2" data-invalid={err("platforms") || undefined}>
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
                        onChange={() =>
                          toggle(platforms, setPlatforms, o, "platforms")
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {o}
                    </label>
                  ))}
                </div>
                {platforms.includes("Other") && (
                  <input
                    type="text"
                    value={platformOther}
                    onChange={(e) => {
                      setPlatformOther(e.target.value);
                      clearErr("platformOther");
                    }}
                    maxLength={190}
                    placeholder="Please specify your other platform"
                    data-invalid={err("platformOther") || undefined}
                    className={cn(inputCls, "mt-1", err("platformOther") && errRing)}
                  />
                )}
                <FieldError
                  msg={
                    errors.platforms ||
                    (platforms.includes("Other") ? errors.platformOther : undefined)
                  }
                />
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
                  value={form.audienceSize}
                  onChange={handleChange}
                  data-invalid={err("audienceSize") || undefined}
                  className={cn(inputCls, err("audienceSize") && errRing)}
                />
                <FieldError msg={errors.audienceSize} />
              </div>

              {/* Target audience */}
              <div className="space-y-2" data-invalid={err("targetAudience") || undefined}>
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
                          toggle(targetAudience, setTargetAudience, o, "targetAudience")
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {o}
                    </label>
                  ))}
                </div>
                {targetAudience.includes("Other") && (
                  <input
                    type="text"
                    value={audienceOther}
                    onChange={(e) => {
                      setAudienceOther(e.target.value);
                      clearErr("audienceOther");
                    }}
                    maxLength={190}
                    placeholder="Please specify your other audience"
                    data-invalid={err("audienceOther") || undefined}
                    className={cn(inputCls, "mt-1", err("audienceOther") && errRing)}
                  />
                )}
                <FieldError
                  msg={
                    errors.targetAudience ||
                    (targetAudience.includes("Other") ? errors.audienceOther : undefined)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="homeRun" className={labelCls}>
                  What would make your experience as a CAIO affiliate a home
                  run? <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="homeRun"
                  name="homeRun"
                  rows={3}
                  placeholder="Write your answer here…"
                  value={form.homeRun}
                  onChange={handleChange}
                  data-invalid={err("homeRun") || undefined}
                  className={cn(inputCls, "resize-none", err("homeRun") && errRing)}
                />
                <FieldError msg={errors.homeRun} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="anythingElse" className={labelCls}>
                  Anything else we should know?{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="anythingElse"
                  name="anythingElse"
                  rows={3}
                  placeholder="Write your answer here…"
                  value={form.anythingElse}
                  onChange={handleChange}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Tax form */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="taxForm" className={labelCls}>
                    Tax form (W-9 or W-8BEN), PDF{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="group relative shrink-0">
                    <button
                      type="button"
                      aria-label="What is this form?"
                      className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                    <span className="pointer-events-none absolute right-0 top-7 z-10 w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      A <strong>W-9</strong> (if you&apos;re a U.S. taxpayer) or a{" "}
                      <strong>W-8BEN</strong> (if you&apos;re outside the U.S.) is a
                      standard IRS form that lets us pay your commissions legally.
                      Both are free, take a couple of minutes to fill out, and you
                      can download the right one from the IRS website. We can&apos;t
                      issue any payout without it on file.
                    </span>
                  </span>
                </div>
                <input
                  id="taxForm"
                  name="taxForm"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFile}
                  data-invalid={err("taxForm") || undefined}
                  className={cn(
                    "w-full rounded-lg text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100",
                    err("taxForm") && "ring-1 ring-red-300 rounded-lg p-1",
                  )}
                />
                {taxForm && (
                  <p className="text-xs text-slate-500">
                    Selected: {taxForm.name}
                  </p>
                )}
                <p className="text-xs text-slate-400">PDF only, max 10MB.</p>
                <FieldError msg={errors.taxForm} />
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
                  placeholder="Your full legal name"
                  value={form.signature}
                  onChange={handleChange}
                  data-invalid={err("signature") || undefined}
                  className={cn(inputCls, err("signature") && errRing)}
                />
                <p className="text-xs text-slate-400">
                  Typing your name acts as your electronic signature.
                </p>
                <FieldError msg={errors.signature} />
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

              <p className="text-center text-xs text-slate-500">
                By submitting, you agree to our{" "}
                <a
                  href="/partners/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-indigo-600 underline hover:text-indigo-700"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="/partners/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-indigo-600 underline hover:text-indigo-700"
                >
                  Privacy Policy
                </a>
                .
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {submitting ? "Submitting…" : "Submit My Application"}
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

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600">{msg}</p>;
}

/**
 * Fast date-of-birth picker: three native selects (Month / Day / Year) instead
 * of the sluggish native date widget. Years are limited to 18–100 years ago,
 * the day list adapts to the chosen month/year, and it emits a `YYYY-MM-DD`
 * string (or "" until all three are chosen) to stay compatible with the DB
 * `date` column + the existing required-field validation.
 */
function DobPicker({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const parts = value ? value.split("-").map(Number) : [];
  const [year, setYear] = useState<number>(parts[0] || 0);
  const [month, setMonth] = useState<number>(parts[1] || 0);
  const [day, setDay] = useState<number>(parts[2] || 0);

  const now = new Date();
  const maxYear = now.getFullYear() - 18;
  const minYear = now.getFullYear() - 100;
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  const maxDay = daysInMonth(year, month);
  const days: number[] = [];
  for (let d = 1; d <= maxDay; d++) days.push(d);

  function emit(y: number, m: number, d: number) {
    if (y && m && d) {
      const clamped = Math.min(d, daysInMonth(y, m));
      onChange(
        `${y}-${String(m).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`,
      );
    } else {
      onChange("");
    }
  }

  const selectCls = cn(inputCls, invalid && errRing);

  return (
    <div className="grid grid-cols-3 gap-2" data-invalid={invalid || undefined}>
      <select
        aria-label="Birth month"
        value={month || ""}
        onChange={(e) => {
          const m = Number(e.target.value);
          const d = day > daysInMonth(year, m) ? 0 : day;
          setMonth(m);
          if (d !== day) setDay(d);
          emit(year, m, d);
        }}
        className={selectCls}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Birth day"
        value={day || ""}
        onChange={(e) => {
          const d = Number(e.target.value);
          setDay(d);
          emit(year, month, d);
        }}
        className={selectCls}
      >
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label="Birth year"
        value={year || ""}
        onChange={(e) => {
          const y = Number(e.target.value);
          const d = day > daysInMonth(y, month) ? 0 : day;
          setYear(y);
          if (d !== day) setDay(d);
          emit(y, month, d);
        }}
        className={selectCls}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
