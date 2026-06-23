"use client";

import { useSearchParams } from "next/navigation";

export default function ThankYouContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  if (!sessionId) return null;

  return (
    <p className="mt-3 text-xs text-gray-400">
      Order reference:{" "}
      <span className="font-mono text-gray-500">{sessionId}</span>
    </p>
  );
}
