// Shared country / state-province lists for affiliate-facing address forms
// (the public apply form and the portal profile editor). Kept in one place so
// the two stay in sync.

export const COUNTRY_OPTIONS = ["United States", "Canada"] as const;

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

export const CA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
  "Yukon",
] as const;

/** State/province list for the given country label. */
export function regionsFor(country: string): readonly string[] {
  return country === "Canada" ? CA_PROVINCES : US_STATES;
}

/** Adaptive labels so the form reads correctly per country. */
export function regionLabel(country: string): string {
  return country === "Canada" ? "Province" : "State";
}
export function postalLabel(country: string): string {
  return country === "Canada" ? "Postal code" : "ZIP code";
}
