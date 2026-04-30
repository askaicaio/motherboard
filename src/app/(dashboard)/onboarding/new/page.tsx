import { OnboardingRequestForm } from "@/components/onboarding/request-form";

export default function NewOnboardingPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          New Onboarding Request
        </h1>
        <p className="text-sm text-zinc-500">
          Fill in the details for the new team member. Required fields are
          marked with *.
        </p>
      </div>
      <OnboardingRequestForm />
    </div>
  );
}
