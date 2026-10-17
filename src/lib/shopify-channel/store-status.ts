export function shopifyStoreStatus(store: {
  disconnectedAt: Date | null;
  paused: boolean;
  addressTestStatus: string;
}): string {
  if (store.disconnectedAt) return "Disconnected";
  if (store.paused) return "Paused";
  if (store.addressTestStatus !== "PASSED") return "Connecting";
  return "Connected";
}
