export function priceLabel(prices: number[]): string {
  if (prices.length === 0) return "—";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const money = (value: number) => `$${value.toFixed(2)}`;
  return low === high ? money(low) : `${money(low)}–${money(high)}`;
}
