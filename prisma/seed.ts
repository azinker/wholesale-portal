import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminUser = await db.portalUser.upsert({
    where: { email: "adam@theperfectpart.net" },
    update: {},
    create: {
      email: "adam@theperfectpart.net",
    },
  });
  console.log(`Admin user: ${adminUser.email} (${adminUser.id})`);

  // Create a sample wholesale applicant
  const sampleUser = await db.portalUser.upsert({
    where: { email: "demo-wholesale@example.com" },
    update: {},
    create: {
      email: "demo-wholesale@example.com",
      linkedCustomerId: null,
    },
  });

  const sampleAccount = await db.wholesaleAccount.upsert({
    where: { userId: sampleUser.id },
    update: {},
    create: {
      userId: sampleUser.id,
      email: "demo-wholesale@example.com",
      companyName: "Demo Wholesale Co.",
      alias: "DEMO-WHOLESALE-CO",
      legalName: "Demo Wholesale Co. LLC",
      businessAddress: "456 Commerce Ave, Austin, TX 78701",
      phone: "(512) 555-0200",
      website: "https://demowholesale.example.com",
      primaryState: "Texas",
      attestation: true,
      status: "PENDING",
      businessFields: {
        firstName: "Jane",
        lastName: "Smith",
      },
    },
  });
  console.log(`Sample applicant: ${sampleAccount.companyName} (${sampleAccount.id})`);

  // Create a second sample — approved
  const approvedUser = await db.portalUser.upsert({
    where: { email: "approved-wholesale@example.com" },
    update: {},
    create: {
      email: "approved-wholesale@example.com",
      linkedCustomerId: null,
    },
  });

  const approvedAccount = await db.wholesaleAccount.upsert({
    where: { userId: approvedUser.id },
    update: {},
    create: {
      userId: approvedUser.id,
      email: "approved-wholesale@example.com",
      companyName: "Approved Parts Inc.",
      alias: "APPROVED-PARTS",
      legalName: "Approved Parts Inc.",
      businessAddress: "789 Industry Blvd, Dallas, TX 75201",
      phone: "(214) 555-0300",
      attestation: true,
      status: "APPROVED",
      approvedAt: new Date(),
      lastTier: "T10",
      lastCount7d: 30,
      businessFields: {
        firstName: "John",
        lastName: "Doe",
      },
    },
  });
  console.log(`Approved account: ${approvedAccount.companyName} (${approvedAccount.id})`);

  // Create default global settings
  await db.globalSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      settings: {
        tierThresholds: {
          T10: 25,
          T15: 51,
          T20: 101,
        },
        riskRules: {
          rapid_low_value_threshold: 10,
          same_sku_farming_threshold: 5,
          tier_chasing_burst_threshold: 10,
        },
        flatRateShippingLabel: "Flat Rate",
      },
    },
  });
  console.log("Global settings created");

  // Audit log entry for seed
  await db.auditLog.create({
    data: {
      actorEmail: "system",
      action: "database_seeded",
      details: {
        timestamp: new Date().toISOString(),
        accounts: 2,
      },
    },
  });
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
