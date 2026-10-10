/** Prefer the warehouse customer whose email is the wholesale account. Never keep a mismatched id. */
export function chooseDropshipperCustomerId(
  accountEmail: string,
  stored: { id: number; email: string } | null,
  byEmail: { id: number; email: string } | null
): number {
  const email = accountEmail.trim().toLowerCase();
  if (!email) {
    throw new Error("This wholesale account has no email, so we could not match the warehouse customer");
  }
  if (stored && stored.email.trim().toLowerCase() === email) return stored.id;
  if (byEmail && byEmail.email.trim().toLowerCase() === email) return byEmail.id;
  throw new Error(
    "This wholesale account is not linked to the matching warehouse customer, so the order was not filed under someone else"
  );
}
