"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Image
            src="/icon-light.png"
            alt="Motherboard"
            width={48}
            height={48}
            className="mx-auto mb-4"
            priority
          />
          <CardTitle className="text-xl">CAIO Internal Dashboard</CardTitle>
          <CardDescription>
            Sign in with your <strong>@chiefaiofficer.com</strong> Google account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
