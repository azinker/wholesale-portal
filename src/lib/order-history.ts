/** Max order history window for portal pages (days). Keeps BC API usage bounded. */
export const ORDER_HISTORY_DAYS = 365;

export function orderHistoryMinDate(days: number = ORDER_HISTORY_DAYS): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().replace("T", " ").replace("Z", "");
}
