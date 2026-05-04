"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Lock,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { departmentLabel } from "@/types";

interface Props {
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberRole: "Admin" | "User";
  memberDepartment: string;
  hasPassword: boolean;
  token: string;
}

export function WelcomeFormClient({
  memberName,
  memberEmail,
  memberRole,
  memberDepartment,
  hasPassword: initialHasPassword,
  token,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "password" | "done">("choose");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasPassword, setHasPassword] = useState(initialHasPassword);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/welcome/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success("Password set. You can now sign in with email + password.");
      setHasPassword(true);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkipAndSignIn() {
    // Just consume the token (mark invite accepted) and bounce to login.
    setSubmitting(true);
    try {
      await fetch("/api/welcome/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      // Hand off to Google sign-in
      await signIn("google", { callbackUrl: "/" });
    } catch {
      router.push("/login");
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,520px)]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0" style={{ backgroundColor: "#6749e3" }} />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18) 0%, transparent 45%), radial-gradient(circle at 20% 80%, rgba(0,0,0,0.25) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <Image src="/icon-dark.png" alt="" width={28} height={28} priority />
            <span className="text-sm font-medium tracking-tight">Motherboard</span>
          </div>
          <div className="space-y-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-medium tracking-tight leading-tight max-w-md">
              Welcome to the team, {memberName.split(" ")[0]}.
            </h2>
            <p className="text-base text-white/75 leading-relaxed font-light max-w-md">
              You&apos;ve been added as a {memberRole} on the{" "}
              {departmentLabel(memberDepartment)} team. Activate your account to
              start using Motherboard.
            </p>
          </div>
          <div className="text-xs text-white/50">
            CAIO Internal Operations · {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col bg-white">
        <div className="flex h-14 items-center px-8 lg:hidden">
          <div className="flex items-center gap-2.5">
            <Image src="/icon-light.png" alt="" width={24} height={24} priority />
            <span className="text-sm font-medium text-zinc-900">Motherboard</span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-8 pb-12">
          <div className="w-full max-w-sm space-y-6">
            {/* Member info card */}
            <Card className="border-zinc-100 bg-zinc-50/50 p-4">
              <div className="text-xs text-zinc-500 mb-1">Account</div>
              <div className="text-sm font-medium text-zinc-900">{memberName}</div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5 truncate">
                {memberEmail}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="rounded-md bg-zinc-100 text-zinc-700 px-2 py-0.5">
                  {memberRole}
                </span>
                <span className="rounded-md bg-zinc-100 text-zinc-700 px-2 py-0.5">
                  {departmentLabel(memberDepartment)}
                </span>
              </div>
            </Card>

            {step === "choose" && (
              <>
                <div className="space-y-2">
                  <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
                    Activate your account
                  </h1>
                  <p className="text-sm text-zinc-500">
                    Sign in however you prefer — your account works with both.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleSkipAndSignIn}
                    disabled={submitting}
                    className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-medium"
                  >
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    Continue with Google
                  </Button>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-zinc-200" />
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">or</span>
                    <div className="flex-1 h-px bg-zinc-200" />
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setStep("password")}
                    className="w-full h-11"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    {hasPassword ? "Update password" : "Set up a password"}
                  </Button>

                  <p className="text-[11px] text-zinc-500 text-center pt-1">
                    {hasPassword
                      ? "You already have a password set — you can update it here."
                      : "Optional. Lets you sign in without Google if needed."}
                  </p>
                </div>
              </>
            )}

            {step === "password" && (
              <form onSubmit={handleSetPassword} className="space-y-5">
                <div className="space-y-2">
                  <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
                    {hasPassword ? "Update password" : "Set a password"}
                  </h1>
                  <p className="text-sm text-zinc-500">
                    Lets you sign in with email + password. Google sign-in keeps
                    working too.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoFocus
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter to confirm"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("choose")}
                    disabled={submitting}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save password
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {step === "done" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  </div>
                  <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
                    All set!
                  </h1>
                  <p className="text-sm text-zinc-500">
                    Your password is saved. You can now sign in with either Google
                    or email + password.
                  </p>
                </div>
                <Button onClick={() => router.push("/login")} className="w-full">
                  Go to sign-in
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-4 text-xs text-zinc-400 text-center border-t border-zinc-100">
          © {new Date().getFullYear()} Chief AI Officer · Internal use only
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#FFFFFF"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#FFFFFF"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FFFFFF"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#FFFFFF"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
