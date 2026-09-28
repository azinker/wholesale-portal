/** Calendar dates in US Eastern, used for invoices and the card reminder. */

export function easternParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function easternMonthKey(date: Date): string {
  const { year, month } = easternParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function utcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 16, 0, 0));
}

/** True once the Eastern calendar date is at least one weekday later. */
export function atLeastOneBusinessDayLater(from: Date, now: Date): boolean {
  const start = easternParts(from);
  const end = easternParts(now);
  const cursor = utcNoon(start.year, start.month, start.day);
  const target = utcNoon(end.year, end.month, end.day);
  let businessDays = 0;
  while (cursor < target) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays >= 1;
}
