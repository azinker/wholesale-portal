const BRAND = /the\s+perfect\s+part/gi;
const SITE = /(?:https?:\/\/)?(?:www\.)?theperfectpart\.net\S*/gi;
const PHONE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

/** Remove our name, site, and phone numbers from listing copy. HTML tags stay. */
export function scrubListingText(input: string): string {
  return input
    .replace(SITE, "")
    .replace(BRAND, "")
    .replace(PHONE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
