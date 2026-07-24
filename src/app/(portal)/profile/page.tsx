import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserCircle, Building2, Mail, ExternalLink } from "lucide-react";
import AvatarUploader from "./avatar-uploader";
import BusinessInfoForm from "./business-info-form";
import { loadTierWindowDays } from "@/lib/tier-engine";
import { loadPublisherTierConfig } from "@/lib/publisher-tier-engine";

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/");

  const account = user.wholesaleAccount;
  const publisher = account?.partnerType === "AFFILIATE_PUBLISHER";
  const tierWindowDays = publisher
    ? (await loadPublisherTierConfig()).windowDays
    : await loadTierWindowDays();

  // Fetch pending business info change if account exists
  let pendingChange = null;
  if (account) {
    const pending = await db.businessInfoChange.findFirst({
      where: { accountId: account.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (pending) {
      pendingChange = {
        id: pending.id,
        status: pending.status,
        newValues: pending.newValues as Record<string, string>,
        createdAt: pending.createdAt.toISOString(),
      };
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile picture and view your account details.
        </p>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-primary" />
            Profile Picture
          </CardTitle>
          <CardDescription>
            Upload a profile picture. Max 2MB, JPG/PNG/WebP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUploader
            userEmail={user.email}
            companyName={account?.companyName ?? null}
            currentAvatarUrl={user.avatarUrl ?? null}
          />
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user.email}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge status={account?.status || "RETAIL"} />
          </div>
          {account && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Tier</span>
                <TierBadge tier={account.lastTier} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tierWindowDays}-Day Orders</span>
                <span className="text-sm font-mono">{publisher ? account.lastCount14d : account.lastCount7d}</span>
              </div>
              {publisher && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Partner Type</span>
                    <Badge variant="secondary">Affiliate Publisher</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AWIN Publisher ID</span>
                    <span className="text-sm font-mono">{account.awinPublisherId || "Not added"}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Promotion Website</span>
                    {account.promoWebsite ? <a href={account.promoWebsite} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 truncate text-sm text-primary">{account.promoWebsite}<ExternalLink className="h-3 w-3 shrink-0" /></a> : <span className="text-sm">—</span>}
                  </div>
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Promotion Types</span>
                    <span className="text-right text-sm">{Array.isArray(account.promoTypes) ? account.promoTypes.join(", ") : "—"}</span>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Editable Business Info */}
      {account && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Business Information
            </CardTitle>
            <CardDescription>
              Update your business details. Changes will be reviewed before taking effect.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessInfoForm
              businessInfo={{
                companyName: account.companyName,
                legalName: account.legalName,
                phone: account.phone,
                businessAddress: account.businessAddress,
                primaryState: account.primaryState,
                website: account.website,
              }}
              pendingChange={pendingChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "APPROVED" ? "default" as const
    : status === "PENDING" ? "secondary" as const
    : status === "DENIED" ? "destructive" as const
    : "outline" as const;
  return <Badge variant={variant}>{status}</Badge>;
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    NONE: "bg-muted text-muted-foreground",
    WELCOME: "bg-purple-100 text-purple-700",
    T10: "bg-info-light text-info",
    T15: "bg-warning-light text-warning",
    T20: "bg-success-light text-success",
    T25: "bg-emerald-100 text-emerald-700",
    T30: "bg-emerald-200 text-emerald-800",
  };
  const label = tier === "NONE" ? "None" : tier === "WELCOME" ? "Welcome" : tier;
  return (
    <Badge variant="outline" className={styles[tier] || styles.NONE}>
      {label}
    </Badge>
  );
}
