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

function easternHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value || 0);
}

function isWeekend(year: number, month: number, day: number): boolean {
  const weekday = utcNoon(year, month, day).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function nextBusinessDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const cursor = utcNoon(year, month, day);
  do {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  } while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6);
  return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
}

/** Same weekday before 2 PM Eastern. After that, or on a weekend, the next weekday. */
export function expectedShipDate(from: Date): Date {
  const parts = easternParts(from);
  const target = isWeekend(parts.year, parts.month, parts.day) || easternHour(from) >= 14
    ? nextBusinessDay(parts.year, parts.month, parts.day)
    : parts;
  return utcNoon(target.year, target.month, target.day);
}

export function expectedShipLabel(from: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(expectedShipDate(from));
}

export function gettingReadyTip(from: Date): string {
  return `We received this order and it's waiting to ship. It usually goes out within 1 business day. Expected ship date: ${expectedShipLabel(from)}.`;
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
