import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, ShieldCheck, Clock, Package, Zap, UserPlus, FileText, Download } from "lucide-react";
import { loadTierWindowDays, loadTiers, getTierConfig, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { formatTierWindowLabel } from "@/lib/tier-window";
import { ImpersonateButton } from "@/components/impersonate-button";
import { RemoveApplicantButton } from "@/components/remove-applicant-button";
import { getAvatarUrl } from "@/lib/avatar";
import TierOverrideForm from "./tier-override-form";
import { ResetOnboardingButton } from "./reset-onboarding-button";
import { ResetWelcomeButton } from "./reset-welcome-button";
import { RecalcTierButton } from "./recalc-tier-button";
import { VerifyCustomerGroupButton } from "./verify-customer-group-button";
import { DocumentScanActions } from "../../applicants/[id]/document-scan-actions";
import { loadPublisherTierConfig } from "@/lib/publisher-tier-engine";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const account = await db.wholesaleAccount.findUnique({
    where: { id },
    include: {
      user: true,
      promotions: {
        orderBy: { createdAt: "desc" },
      },
      snapshots: {
        orderBy: { asOf: "desc" },
        take: 20,
      },
      riskFlags: {
        where: { status: "OPEN" },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true, filename: true, mime: true, size: true,
          scanStatus: true, docType: true, state: true, note: true, uploadedAt: true,
        },
      },
    },
  });

  if (!account || account.status !== "APPROVED") {
    notFound();
  }

  const publisher = account.partnerType === "AFFILIATE_PUBLISHER";
  const activePromo = account.promotions.find((p) => p.enabled);
  const publisherConfig = publisher ? await loadPublisherTierConfig() : null;
  const dynamicTiers = publisher ? publisherConfig!.tiers : await loadTiers();
  const tierConfig = publisher ? dynamicTiers.find((tier) => tier.id === account.lastTier) ?? null : await getTierConfig(account.lastTier);
  const avatarUrl = await getAvatarUrl(account.user.avatarKey);

  // Welcome discount info
  const welcomeActive = isWelcomeActive(account.welcomeExpiresAt);
  const welcomeConfig = await loadWelcomeConfig();
  const tierWindowDays = publisher ? publisherConfig!.windowDays : await loadTierWindowDays();
  const tierWindowLabel = formatTierWindowLabel(tierWindowDays);
  const rollingCount = publisher ? account.lastCount14d : account.lastCount7d;

  // Check if this customer was manually enrolled by an admin
  const enrollAudit = await db.auditLog.findFirst({
    where: {
      action: "admin_enroll_customer",
      targetAccountId: id,
    },
    orderBy: { createdAt: "desc" },
  });

  /** Get initials from company name */
  function getInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-12 w-12 border-2 border-border flex-shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={account.companyName} />}
          <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
            {getInitials(account.companyName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{account.companyName}</h1><Badge variant={publisher ? "secondary" : "outline"}>{publisher ? "Publisher" : "Reseller"}</Badge></div>
          <p className="text-muted-foreground text-sm">{account.email}</p>
        </div>
        <ImpersonateButton userId={account.userId} userEmail={account.email} size="sm" />
        <RemoveApplicantButton
          accountId={account.id}
          companyName={account.companyName}
          email={account.email}
          redirectTo="/admin/customers"
        />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/applicants/${id}`}>
            View Application <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {enrollAudit && (
              <>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Manually Enrolled by {enrollAudit.actorEmail}
                    </p>
                    <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                      {enrollAudit.createdAt.toLocaleDateString()} at {enrollAudit.createdAt.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">BC Customer ID</span>
              <span className="font-mono">#{account.customerId || "N/A"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Alias</span>
              <span className="font-mono text-xs">{account.alias}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Approved</span>
              <span>{account.approvedAt?.toLocaleDateString() || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">State</span>
              <span>{account.primaryState || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{account.phone || "—"}</span>
            </div>
            {account.website && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Website</span>
                  <a href={account.website} target="_blank" rel="noopener" className="text-primary underline text-xs">
                    {account.website}
                  </a>
                </div>
              </>
            )}
            {publisher && (
              <>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">AWIN Publisher ID</span><span className="font-mono text-xs">{account.awinPublisherId || "—"}</span></div>
                <Separator />
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Promotion Website</span><span className="truncate text-xs">{account.promoWebsite || "—"}</span></div>
              </>
            )}
            <Separator />
            <ResetOnboardingButton accountId={account.id} />
            {!publisher && <ResetWelcomeButton accountId={account.id} companyName={account.companyName} welcomeExpiresAt={account.welcomeExpiresAt?.toISOString() ?? null} welcomeHours={welcomeConfig.hours} />}
          </CardContent>
        </Card>

        {/* Current Tier + Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Current Tier
            </CardTitle>
            <CardDescription>
              {tierWindowLabel} rolling window: {rollingCount} {publisher ? "attributed" : "qualifying"} orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <TierBadge tier={account.lastTier} />
              {tierConfig && (
                <span className="text-sm text-muted-foreground">
                  {tierConfig.discount}% discount
                </span>
              )}
              {account.pausedUpgrades && (
                <Badge variant="outline" className="text-xs border-warning text-warning">
                  Locked
                </Badge>
              )}
            </div>

            {/* Welcome Discount Status */}
            {!publisher && welcomeActive && account.welcomeExpiresAt && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white text-[10px]">Welcome Discount</Badge>
                  <span className="text-xs text-purple-600">{welcomeConfig.discount}% Off</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Expires: {account.welcomeExpiresAt.toLocaleString()}
                </p>
              </div>
            )}
            {!publisher && !welcomeActive && account.welcomeExpiresAt && (
              <div className="rounded-lg bg-muted/50 border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Welcome Expired</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Welcome discount expired {account.welcomeExpiresAt.toLocaleString()}. Now using earned tier.
                </p>
              </div>
            )}
            {activePromo && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Active Promo Code</p>
                <p className="font-mono text-sm font-semibold mt-0.5">{activePromo.code}</p>
              </div>
            )}
            {account.riskFlags.length > 0 && (
              <div className="rounded-lg bg-danger-light border border-danger/20 p-3">
                <p className="text-xs text-danger font-medium">
                  {account.riskFlags.length} open risk flag{account.riskFlags.length > 1 ? "s" : ""}
                </p>
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{tierWindowLabel} {publisher ? "attributed" : "qualifying"} count: <strong className="text-foreground">{rollingCount}</strong></p>
              <div className="flex gap-2">
                <RecalcTierButton accountId={account.id} />
                {!publisher && <VerifyCustomerGroupButton accountId={account.id} />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Override */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Manual Tier Override
          </CardTitle>
          <CardDescription>
            Override the automatic tier calculation. When locked, the tier will not change
            during automatic recalculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TierOverrideForm
            accountId={account.id}
            currentTier={account.lastTier}
            isLocked={account.pausedUpgrades}
            tierOptions={[
              ...(publisher ? [] : [{ value: "NONE", label: "None (0% discount)" }]),
              ...dynamicTiers.map((t) => ({
                value: t.id,
                label: `${t.id} (${t.discount}% discount)`,
              })),
            ]}
          />
        </CardContent>
      </Card>

      {/* Tier Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Tier Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {dynamicTiers.map((t) => {
              const isActive = account.lastTier === t.id;
              const isAchieved = rollingCount >= t.minOrders;
              return (
                <div
                  key={t.id}
                  className={`rounded-lg border p-4 text-center transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : isAchieved
                        ? "border-success/50 bg-success-light/50"
                        : "border-border"
                  }`}
                >
                  <p className="text-2xl font-bold">{t.discount}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.minOrders}+ orders
                  </p>
                  {isActive && (
                    <Badge className="mt-2 text-[10px]">Current</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Documents ({account.documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {account.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium">File</th>
                    <th className="text-left px-4 py-2.5 font-medium">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium">State</th>
                    <th className="text-left px-4 py-2.5 font-medium">Scan</th>
                    <th className="text-left px-4 py-2.5 font-medium">Uploaded</th>
                    <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {account.documents.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">{doc.filename}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{doc.docType || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{doc.state || "—"}</td>
                      <td className="px-4 py-2.5"><ScanBadge status={doc.scanStatus} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {doc.scanStatus === "CLEAN" && (
                            <>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`/api/admin/documents/${doc.id}/view`} target="_blank" rel="noopener noreferrer">
                                  View <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`/api/admin/documents/${doc.id}/download`} download>
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            </>
                          )}
                          {doc.scanStatus === "PENDING" && (
                            <>
                              <Button variant="outline" size="sm" asChild>
                                <a href={`/api/admin/documents/${doc.id}/bypass-and-view`} target="_blank" rel="noopener noreferrer">
                                  Bypass &amp; view
                                </a>
                              </Button>
                              <DocumentScanActions documentId={doc.id} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier History */}
      {account.snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Tier History
            </CardTitle>
            <CardDescription>Last 20 tier snapshots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium">Tier</th>
                    <th className="text-left px-4 py-2.5 font-medium">{tierWindowDays}d Orders</th>
                    <th className="text-left px-4 py-2.5 font-medium">Promo Code</th>
                  </tr>
                </thead>
                <tbody>
                  {account.snapshots.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.asOf.toLocaleDateString()} {s.asOf.toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <TierBadge tier={s.tierLevel} />
                      </td>
                      <td className="px-4 py-2.5 font-mono">{s.paidOrders7d}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {s.activeCode || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  // Dynamic color assignment based on tier ID
  const styles: Record<string, string> = {
    NONE: "bg-muted text-muted-foreground",
    WELCOME: "bg-purple-100 text-purple-700",
  };
  // Assign colors in order: info, warning, success, then cycle
  const colors = ["bg-info-light text-info", "bg-warning-light text-warning", "bg-success-light text-success"];
  if (tier !== "NONE" && tier !== "WELCOME" && !styles[tier]) {
    // Extract the number from the tier ID for consistent coloring
    const num = parseInt(tier.replace(/\D/g, "")) || 0;
    styles[tier] = colors[num % colors.length] || colors[0];
  }

  return (
    <Badge variant="outline" className={styles[tier] || styles.NONE}>
      {tier === "NONE" ? "None" : tier === "WELCOME" ? "Welcome" : tier}
    </Badge>
  );
}

function ScanBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    CLEAN: "default", INFECTED: "destructive", SCANNING: "secondary", PENDING: "outline",
  };
  return <Badge variant={variants[status] || "outline"} className="text-[10px]">{status}</Badge>;
}
