import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const accounts = await db.wholesaleAccount.findMany({
  where: { status: "APPROVED" },
  select: {
    id: true,
    companyName: true,
    customerId: true,
    lastTier: true,
    lastCount7d: true,
    snapshots: {
      orderBy: { asOf: "desc" },
      take: 1,
      select: { asOf: true, tierLevel: true, paidOrders7d: true },
    },
  },
});

const toSync = accounts.filter((a) => {
  const snap = a.snapshots[0];
  if (!snap) return false;
  return snap.paidOrders7d !== a.lastCount7d || snap.tierLevel !== a.lastTier;
});

const results = [];
for (const account of toSync) {
  const snap = account.snapshots[0];
  const updated = await db.wholesaleAccount.update({
    where: { id: account.id },
    data: {
      lastTier: snap.tierLevel,
      lastCount7d: snap.paidOrders7d,
    },
    select: {
      companyName: true,
      customerId: true,
      lastTier: true,
      lastCount7d: true,
      updatedAt: true,
    },
  });
  results.push({
    before: {
      companyName: account.companyName,
      customerId: account.customerId,
      tier: account.lastTier,
      count: account.lastCount7d,
    },
    after: updated,
    snapshotAsOf: snap.asOf,
  });
}

console.log(
  JSON.stringify({ synced: results.length, results }, null, 2)
);

await db.$disconnect();
