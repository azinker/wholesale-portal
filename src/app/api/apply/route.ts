import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { toAlias } from "@/lib/utils";
import {
  sendApplicationReceivedEmail,
  sendNewApplicantNotification,
  sendReapplicationReceivedEmail,
} from "@/lib/email";

const applySchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  legalName: z.string().optional().default(""),
  businessAddress: z.string().min(1),
  phone: z.string().min(1),
  website: z.string().optional().default(""),
  primaryState: z.string().optional().default(""),
  attestation: z.literal(true, {
    errorMap: () => ({ message: "You must accept the attestation" }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = applySchema.parse(body);
    const email = data.email.trim().toLowerCase();

    // Check if already applied
    const existingAccount = await db.wholesaleAccount.findFirst({
      where: { email },
    });
    if (existingAccount) {
      if (existingAccount.status === "DENIED") {
        let customerId: number | null = existingAccount.customerId;

        if (!customerId) {
          try {
            const bcCustomer = await bc().getCustomerByEmail(email);
            if (bcCustomer) {
              customerId = bcCustomer.id;
            }
          } catch (err) {
            console.warn("Could not check BC customer on reapplication:", err);
          }
        }

        if (!customerId) {
          try {
            const newCustomer = await bc().createCustomer({
              email,
              first_name: data.firstName,
              last_name: data.lastName,
              company: data.companyName,
            });
            customerId = newCustomer.id;
          } catch (err) {
            console.warn("Could not create BC customer on reapplication:", err);
          }
        }

        if (customerId) {
          await db.portalUser.update({
            where: { id: existingAccount.userId },
            data: { linkedCustomerId: customerId },
          });
        }

        const alias = toAlias(data.companyName);
        const updatedAccount = await db.wholesaleAccount.update({
          where: { id: existingAccount.id },
          data: {
            customerId,
            email,
            companyName: data.companyName,
            alias,
            legalName: data.legalName || null,
            businessAddress: data.businessAddress,
            phone: data.phone,
            website: data.website || null,
            primaryState: data.primaryState || null,
            attestation: true,
            status: "PENDING",
            denialReason: null,
            approvedAt: null,
            lastTier: "NONE",
            lastCount7d: 0,
            welcomeExpiresAt: null,
            pausedUpgrades: false,
            onboardingDismissed: false,
            businessFields: {
              firstName: data.firstName,
              lastName: data.lastName,
            },
          },
        });

        await db.auditLog.create({
          data: {
            actorEmail: email,
            action: "application_reapplied",
            targetCustomerId: updatedAccount.customerId,
            targetAccountId: updatedAccount.id,
            details: {
              companyName: data.companyName,
              alias,
              previousDenialReason: existingAccount.denialReason,
              source: "portal",
            },
          },
        });

        await sendNewApplicantNotification({
          email,
          companyName: data.companyName,
          alias,
          source: "portal",
          reapplied: true,
          previousDenialReason: existingAccount.denialReason,
          firstName: data.firstName,
          lastName: data.lastName,
          legalName: data.legalName || undefined,
          businessAddress: data.businessAddress,
          phone: data.phone,
          website: data.website || undefined,
          primaryState: data.primaryState || undefined,
          customerId: updatedAccount.customerId ?? null,
        });
        await sendReapplicationReceivedEmail(email, data.companyName);

        console.log("Application resubmitted:", email);
        return NextResponse.json({ success: true, reapplied: true });
      }

      return NextResponse.json(
        { error: "An application for this email already exists. Sign in to check your status." },
        { status: 409 }
      );
    }

    // Find or create PortalUser
    let portalUser = await db.portalUser.findUnique({ where: { email } });
    if (!portalUser) {
      portalUser = await db.portalUser.create({ data: { email } });
    }

    // Check if a BigCommerce customer exists with this email
    let customerId: number | null = portalUser.linkedCustomerId;

    if (!customerId) {
      try {
        const bcCustomer = await bc().getCustomerByEmail(email);
        if (bcCustomer) {
          // Auto-link: email matches existing BC customer
          customerId = bcCustomer.id;
          await db.portalUser.update({
            where: { id: portalUser.id },
            data: { linkedCustomerId: customerId },
          });
        }
      } catch (err) {
        // BC API might fail (no store hash, etc.) -- continue without linking
        console.warn("Could not check BC customer:", err);
      }
    }

    // If no BC customer exists, create one
    if (!customerId) {
      try {
        const newCustomer = await bc().createCustomer({
          email,
          first_name: data.firstName,
          last_name: data.lastName,
          company: data.companyName,
        });
        customerId = newCustomer.id;
        await db.portalUser.update({
          where: { id: portalUser.id },
          data: { linkedCustomerId: customerId },
        });
      } catch (err) {
        // If BC customer creation fails (e.g., prod writes blocked), continue.
        // The customer can be linked later.
        console.warn("Could not create BC customer:", err);
      }
    }

    // Create the wholesale account
    const alias = toAlias(data.companyName);

    await db.wholesaleAccount.create({
      data: {
        userId: portalUser.id,
        customerId,
        email,
        companyName: data.companyName,
        alias,
        legalName: data.legalName || null,
        businessAddress: data.businessAddress,
        phone: data.phone,
        website: data.website || null,
        primaryState: data.primaryState || null,
        attestation: true,
        status: "PENDING",
        businessFields: {
          firstName: data.firstName,
          lastName: data.lastName,
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorEmail: email,
        action: "application_submitted",
        targetCustomerId: customerId,
        details: {
          companyName: data.companyName,
          alias,
          source: "portal",
          bcCustomerLinked: !!customerId,
        },
      },
    });

    await sendNewApplicantNotification({
      email,
      companyName: data.companyName,
      alias,
      source: "portal",
      firstName: data.firstName,
      lastName: data.lastName,
      legalName: data.legalName || undefined,
      businessAddress: data.businessAddress,
      phone: data.phone,
      website: data.website || undefined,
      primaryState: data.primaryState || undefined,
      customerId: customerId ?? null,
    });
    await sendApplicationReceivedEmail(email, data.companyName);

    console.log("Application submitted:", email);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    console.error("Apply error:", error);
    return NextResponse.json(
      { error: "Failed to process application" },
      { status: 500 }
    );
  }
}
