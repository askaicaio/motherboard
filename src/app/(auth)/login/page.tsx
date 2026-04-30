"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---- Left side: sign-in form ---- */}
      <div className="flex flex-col bg-white">
        {/* Top brand bar (Motherboard wordmark) */}
        <div className="flex h-16 items-center px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/icon-light.png"
              alt="Motherboard"
              width={28}
              height={28}
              priority
            />
            <span className="text-sm font-medium tracking-tight text-zinc-900">
              Motherboard
            </span>
          </div>
        </div>

        {/* Sign-in form, centered */}
        <div className="flex flex-1 items-center justify-center px-8 pb-16">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
                Sign in
              </h1>
              <p className="text-sm text-zinc-500">
                Internal operations control center for{" "}
                <span className="font-medium text-zinc-700">
                  Chief AI Officer
                </span>
                .
              </p>
            </div>

            <div className="space-y-4">
              <Button
                className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-medium"
                onClick={() => signIn("google", { callbackUrl: "/" })}
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="text-xs leading-relaxed text-zinc-500">
                  Access is restricted to{" "}
                  <span className="font-mono text-zinc-700">
                    @chiefaiofficer.com
                  </span>{" "}
                  Google accounts. If you don&apos;t have access, contact your
                  workspace administrator.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-8 py-5 text-xs text-zinc-400">
          <span>© {new Date().getFullYear()} Chief AI Officer</span>
          <div className="flex items-center gap-6">
            <span>Internal use only</span>
          </div>
        </div>
      </div>

      {/* ---- Right side: brand panel ---- */}
      <div className="relative hidden overflow-hidden lg:block">
        {/* Layered backdrop: solid purple + radial gradients + grain */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "#6749e3" }}
        />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18) 0%, transparent 45%), radial-gradient(circle at 20% 80%, rgba(0,0,0,0.25) 0%, transparent 50%)",
          }}
        />
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          {/* Top: nothing, just space */}
          <div />

          {/* Middle: logo + tagline */}
          <div className="space-y-8">
            <Image
              src="/caio-logo-white.png"
              alt="Chief AI Officer"
              width={140}
              height={140}
              className="drop-shadow-sm"
              priority
            />
            <div className="space-y-3 max-w-md">
              <h2 className="text-3xl font-medium tracking-tight leading-tight">
                The operations OS for{" "}
                <span className="italic font-light">Chief AI Officer.</span>
              </h2>
              <p className="text-base text-white/70 leading-relaxed font-light">
                Onboard new team members, provision tool access across the
                stack, and keep your operations stack in sync — from a single
                control surface.
              </p>
            </div>
          </div>

          {/* Bottom: feature pills */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <FeaturePill label="Automated provisioning" />
              <FeaturePill label="Role-based access" />
              <FeaturePill label="Audit trail" />
              <FeaturePill label="Slack notifications" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-sm">
      <div className="h-1.5 w-1.5 rounded-full bg-white/70" />
      <span className="text-white/80 font-light">{label}</span>
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
