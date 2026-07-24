"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

interface EnrollResult {
  id: string;
  email: string;
  companyName: string;
  bcCustomerId?: number | null;
  partnerType?: string;
  wasNewBcCustomer?: boolean;
  groupAssigned: boolean;
}

export function EnrollCustomerForm() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [partnerType, setPartnerType] = useState("DROPSHIPPER");
  const [promoWebsite, setPromoWebsite] = useState("");
  const [awinPublisherId, setAwinPublisherId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnrollResult | null>(null);

  const resetForm = () => {
    setEmail("");
    setCompanyName("");
    setPartnerType("DROPSHIPPER");
    setPromoWebsite("");
    setAwinPublisherId("");
    setError("");
    setResult(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!email || !companyName) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/admin/enroll-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), companyName: companyName.trim(), partnerType, promoWebsite: promoWebsite.trim(), awinPublisherId: awinPublisherId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
      } else {
        setResult(data.account);
      }
    } catch {
      setError("Failed to enroll customer");
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)} variant="outline">
        <UserPlus className="h-4 w-4 mr-1" />
        Add Customer
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Enroll New Partner
            </CardTitle>
            <CardDescription className="mt-1">
              Add a reseller or affiliate publisher directly to the partner program.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={resetForm}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success result */}
        {result && (
          <div className="rounded-md border border-green-500/30 bg-green-50 dark:bg-green-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-semibold text-green-700 dark:text-green-400">
                Partner enrolled successfully!
              </p>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong>Email:</strong> {result.email}</p>
              <p><strong>Company:</strong> {result.companyName}</p>
              <p><strong>Program:</strong> {result.partnerType === "AFFILIATE_PUBLISHER" || partnerType === "AFFILIATE_PUBLISHER" ? "Affiliate Publisher" : "Reseller"}</p>
              {result.bcCustomerId && <p><strong>BC Customer ID:</strong> #{result.bcCustomerId}</p>}
              <div className="flex gap-2 mt-2">
                {partnerType !== "AFFILIATE_PUBLISHER" && <Badge variant={result.wasNewBcCustomer ? "secondary" : "default"} className="text-[10px]">{result.wasNewBcCustomer ? "New BC Account Created" : "Existing BC Account Linked"}</Badge>}
                {result.groupAssigned && (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-600">
                    Wholesale Group Assigned
                  </Badge>
                )}
              </div>
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={resetForm}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Form */}
        {!result && (
          <>
            <div className="space-y-2">
              <Label>Partner Program</Label>
              <select value={partnerType} onChange={(e) => setPartnerType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="DROPSHIPPER">Reseller / Drop shipper</option>
                <option value="AFFILIATE_PUBLISHER">Affiliate Publisher</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  placeholder="Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>
            {partnerType === "AFFILIATE_PUBLISHER" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Promotion Website</Label><Input type="url" placeholder="https://example.com" value={promoWebsite} onChange={(e) => setPromoWebsite(e.target.value)} /></div>
                <div className="space-y-2"><Label>AWIN Publisher ID</Label><Input value={awinPublisherId} onChange={(e) => setAwinPublisherId(e.target.value)} /></div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={loading || !email || !companyName}>
                {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Enroll {partnerType === "AFFILIATE_PUBLISHER" ? "Publisher" : "Reseller"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
