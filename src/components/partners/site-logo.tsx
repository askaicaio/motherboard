import Image from "next/image";
import { cn } from "@/lib/utils";

// Single source of truth for the public "Chief AI Officer × Scaling Up" wordmark
// and its sizes. Every marketing/portal surface should render the logo through
// this component so the sizing is consistent (and changed in ONE place) instead
// of being hand-tuned per page.
const SIZES = {
  header: "h-10 w-auto",
  footer: "h-8 w-auto",
  hero: "h-16 w-auto",
} as const;

export function SiteLogo({
  variant = "header",
  color = "dark",
  priority = false,
  className,
}: {
  /** Standard size slot. */
  variant?: keyof typeof SIZES;
  /** "white" = the light wordmark for dark backgrounds. */
  color?: "dark" | "white";
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={color === "white" ? "/caio-scalingup-white.png" : "/caio-scalingup.png"}
      alt="Chief AI Officer — in partnership with Scaling Up"
      width={4000}
      height={1000}
      priority={priority}
      className={cn(SIZES[variant], className)}
    />
  );
}
