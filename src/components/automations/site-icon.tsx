// One automation website's brand logo, sized to sit beside its label.
// =============================================================
// ⚠️ EXTRACTED FROM `feature-integration-tables.tsx` ON 2026-09-29, when eight
// Feature Integration layout benches all needed to draw the same five logos.
// **Eight private copies of a CSS-mask incantation is exactly the kind of thing
// that drifts**, and a logo that renders differently on one bench would look
// like a finding about that layout.
//
// 📌 WHY THIS EXTRACTION IS ALLOWED when the bench PAGES must never share their
// layout: this is a leaf in `src/components/automations/`, which the version
// registry's own note calls out as fine to import. Same reasoning, same
// precedent as `version-tile.tsx`. **The rule is about page layout.**
//
// Monochrome SVG glyphs (Make, n8n) are tinted via a CSS mask; full-colour
// icons (GHL, GHL B2B, Zapier) render as a plain image.
//
// 🛑🛑 `block` IS LOAD-BEARING ON THE MASKED SPAN AND IS NOT COSMETIC. A `span`
// is inline by default, and **width/height do nothing on an inline element**,
// so a CSS-masked glyph silently measures 0x0 and the logo just is not there.
// The original copy got away without it because it was always a flex child
// (flex items are blockified), and the benches below do not all put it in one.
// ⚠️ ADDING IT CHANGES NOTHING WHERE IT ALREADY WORKED, for the same reason.
// =============================================================

export function SiteIcon({
  icon,
  iconColor,
  className = "h-4 w-4",
}: {
  icon: string;
  iconColor?: string;
  /** Size utilities. Defaults to the 16px the tables use. */
  className?: string;
}) {
  if (iconColor) {
    return (
      <span
        aria-hidden
        className={`block shrink-0 ${className}`}
        style={{
          backgroundColor: iconColor,
          maskImage: `url(${icon})`,
          WebkitMaskImage: `url(${icon})`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon}
      alt=""
      className={`block shrink-0 object-contain ${className}`}
    />
  );
}
