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

function shiftDays(year: number, month: number, day: number, delta: number): { year: number; month: number; day: number } {
  const cursor = utcNoon(year, month, day);
  cursor.setUTCDate(cursor.getUTCDate() + delta);
  return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
}

function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = utcNoon(year, month, 1).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(year: number, month: number, weekday: number): number {
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDow = utcNoon(year, month, lastDate).getUTCDay();
  return lastDate - ((lastDow - weekday + 7) % 7);
}

/** Saturday holidays are observed Friday. Sunday holidays are observed Monday. */
function observedHoliday(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const weekday = utcNoon(year, month, day).getUTCDay();
  if (weekday === 6) return shiftDays(year, month, day, -1);
  if (weekday === 0) return shiftDays(year, month, day, 1);
  return { year, month, day };
}

function holidayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

const holidayKeys = new Map<number, Set<string>>();

function uspsHolidayKeys(year: number): Set<string> {
  const cached = holidayKeys.get(year);
  if (cached) return cached;
  const dates = [
    observedHoliday(year, 1, 1),
    observedHoliday(year, 1, nthWeekday(year, 1, 1, 3)),
    observedHoliday(year, 2, nthWeekday(year, 2, 1, 3)),
    observedHoliday(year, 5, lastWeekday(year, 5, 1)),
    observedHoliday(year, 6, 19),
    observedHoliday(year, 7, 4),
    observedHoliday(year, 9, nthWeekday(year, 9, 1, 1)),
    observedHoliday(year, 10, nthWeekday(year, 10, 1, 2)),
    observedHoliday(year, 11, 11),
    observedHoliday(year, 11, nthWeekday(year, 11, 4, 4)),
    observedHoliday(year, 12, 25),
  ];
  const keys = new Set(dates.map((date) => holidayKey(date.year, date.month, date.day)));
  holidayKeys.set(year, keys);
  return keys;
}

export function isUspsHoliday(year: number, month: number, day: number): boolean {
  return [year - 1, year, year + 1].some((candidate) => uspsHolidayKeys(candidate).has(holidayKey(year, month, day)));
}

function isPostalClosed(year: number, month: number, day: number): boolean {
  return isWeekend(year, month, day) || isUspsHoliday(year, month, day);
}

function nextPostalDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  let cursor = { year, month, day };
  do {
    cursor = shiftDays(cursor.year, cursor.month, cursor.day, 1);
  } while (isPostalClosed(cursor.year, cursor.month, cursor.day));
  return cursor;
}

/** Same weekday before 2 PM Eastern, when USPS is open. After that, or on a weekend or postal holiday, the next day USPS is open. */
export function expectedShipDate(from: Date): Date {
  const parts = easternParts(from);
  const target = isPostalClosed(parts.year, parts.month, parts.day) || easternHour(from) >= 14
    ? nextPostalDay(parts.year, parts.month, parts.day)
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
  return `We received this order and it's waiting to ship. It usually goes out within 1 business day. Weekends and USPS holidays are not shipping days. Expected ship date: ${expectedShipLabel(from)}.`;
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
