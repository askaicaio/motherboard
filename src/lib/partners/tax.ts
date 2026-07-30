// Standardized display/download filename for an affiliate's stored tax form.
// Format: {LASTNAME}_{FIRSTNAME}_{YYYY-MM-DD}_TAX-FORM.pdf (uppercased,
// alphanumeric-only names). This is the name shown/downloaded via the tax-form
// routes' Content-Disposition — the blob storage KEY stays a random UUID so
// two people with the same name+date can't collide.

function cleanNamePart(s: string | null | undefined): string {
  const cleaned = (s || "").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 40);
  return cleaned || "UNKNOWN";
}

export function standardTaxFormName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  submittedAt: Date = new Date(),
): string {
  const date = submittedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${cleanNamePart(lastName)}_${cleanNamePart(firstName)}_${date}_TAX-FORM.pdf`;
}
