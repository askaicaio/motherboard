import { redirect } from "next/navigation";

// Explicit title so this page never falls back to the staff dashboard title.
export const metadata = { title: "Affiliate Resources — CAIO Affiliate Program" };

export default function Page() {
  redirect("/portal/resources");
}
