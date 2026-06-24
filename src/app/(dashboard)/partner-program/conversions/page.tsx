// Conversions merged into the unified Events pipeline.
// Redirect kept so old links don't 404.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ConversionsRedirect() {
  redirect("/partner-program/events");
}
