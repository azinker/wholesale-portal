export const EDITABLE_BUSINESS_FIELDS = [
  "companyName",
  "legalName",
  "phone",
  "businessAddress",
  "primaryState",
  "website",
] as const;

export type EditableBusinessField = (typeof EDITABLE_BUSINESS_FIELDS)[number];

export function filterEditableBusinessFields(
  values: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of EDITABLE_BUSINESS_FIELDS) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) {
      result[key] = value.trim();
    }
  }
  return result;
}
