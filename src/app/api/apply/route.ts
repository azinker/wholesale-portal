import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { toAlias } from "@/lib/utils";
import {
  sendApplicationReceivedEmail,
  sendNewApplicantNotification,
  sendPublisherApplicationReceivedEmail,
  sendReapplicationReceivedEmail,
} from "@/lib/email";
import { applySchema } from "@/lib/partner-types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = applySchema.parse(body);
    const email = data.email.trim().toLowerCase();
    const publisher = data.partnerType === "AFFILIATE_PUBLISHER";

    // Check if already applied
    const existingAccount = await db.wholesaleAccount.findFirst({
      where: { email },
    });
    if (existingAccount) {
      if (existingAccount.status === "DENIED") {
        let customerId: number | null = existingAccount.customerId;

        if (!publisher && !customerId) {
          try {
            const bcCustomer = await bc().getCustomerByEmail(email);
            if (bcCustomer) {
              customerId = bcCustomer.id;
            }
          } catch (err) {
            console.warn("Could not check BC customer on reapplication:", err);
          }
        }

        if (!publisher && !customerId) {
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
            customerId: publisher ? null : customerId,
            email,
            companyName: data.companyName,
            alias,
            legalName: data.legalName || null,
            businessAddress: data.businessAddress,
            phone: data.phone,
            website: data.website || null,
            primaryState: data.primaryState || null,
            partnerType: data.partnerType,
            awinPublisherId: publisher ? data.awinPublisherId || null : null,
            promoWebsite: publisher ? data.promoWebsite : null,
            promoTypes: publisher ? data.promoTypes : undefined,
            audienceReach: publisher ? data.audienceReach || null : null,
            promoDescription: publisher ? data.promoDescription : null,
            attestation: true,
            status: "PENDING",
            denialReason: null,
            approvedAt: null,
            lastTier: publisher ? "P15" : "NONE",
            lastCount7d: 0,
            lastCount14d: 0,
            welcomeExpiresAt: null,
            pausedUpgrades: false,
            onboardingDismissed: false,
            businessFields: {
              firstName: data.firstName,
              lastName: data.lastName,
              ...(publisher ? { awinJoined: data.awinJoined } : {}),
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
          partnerType: data.partnerType,
          ...(publisher ? {
            promoWebsite: data.promoWebsite,
            promoTypes: data.promoTypes,
            promoDescription: data.promoDescription,
            audienceReach: data.audienceReach || undefined,
            awinPublisherId: data.awinPublisherId || undefined,
          } : {}),
          customerId: updatedAccount.customerId ?? null,
        });
        if (publisher) {
          await sendPublisherApplicationReceivedEmail(email, data.companyName);
        } else {
          await sendReapplicationReceivedEmail(email, data.companyName);
        }

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

    if (!publisher && !customerId) {
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
    if (!publisher && !customerId) {
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
        customerId: publisher ? null : customerId,
        email,
        companyName: data.companyName,
        alias,
        legalName: data.legalName || null,
        businessAddress: data.businessAddress,
        phone: data.phone,
        website: data.website || null,
        primaryState: data.primaryState || null,
        partnerType: data.partnerType,
        awinPublisherId: publisher ? data.awinPublisherId || null : null,
        promoWebsite: publisher ? data.promoWebsite : null,
        promoTypes: publisher ? data.promoTypes : undefined,
        audienceReach: publisher ? data.audienceReach || null : null,
        promoDescription: publisher ? data.promoDescription : null,
        attestation: true,
        status: "PENDING",
        businessFields: {
          firstName: data.firstName,
          lastName: data.lastName,
          ...(publisher ? { awinJoined: data.awinJoined } : {}),
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorEmail: email,
        action: "application_submitted",
        targetCustomerId: publisher ? null : customerId,
        details: {
          companyName: data.companyName,
          alias,
          source: "portal",
          bcCustomerLinked: !publisher && !!customerId,
          partnerType: data.partnerType,
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
      partnerType: data.partnerType,
      ...(publisher ? {
        promoWebsite: data.promoWebsite,
        promoTypes: data.promoTypes,
        promoDescription: data.promoDescription,
        audienceReach: data.audienceReach || undefined,
        awinPublisherId: data.awinPublisherId || undefined,
      } : {}),
      customerId: publisher ? null : customerId ?? null,
    });
    if (publisher) {
      await sendPublisherApplicationReceivedEmail(email, data.companyName);
    } else {
      await sendApplicationReceivedEmail(email, data.companyName);
    }

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
