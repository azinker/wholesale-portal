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
    updatedAt: true,
    snapshots: {
      orderBy: { asOf: "desc" },
      take: 1,
      select: { asOf: true, tierLevel: true, paidOrders7d: true },
    },
  },
});

const mismatched = accounts.filter((a) => {
  const snap = a.snapshots[0];
  if (!snap) return false;
  return (
    snap.paidOrders7d !== a.lastCount7d ||
    snap.tierLevel !== a.lastTier ||
    a.updatedAt < snap.asOf
  );
});

console.log(
  JSON.stringify(
    {
      total: accounts.length,
      mismatchedCount: mismatched.length,
      mismatched: mismatched.map((a) => ({
        companyName: a.companyName,
        customerId: a.customerId,
        account: { tier: a.lastTier, count: a.lastCount7d, updatedAt: a.updatedAt },
        snapshot: a.snapshots[0],
      })),
    },
    null,
    2
  )
);

await db.$disconnect();
