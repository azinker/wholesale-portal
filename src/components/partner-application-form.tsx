"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle, Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TermsOfServiceContent, PublisherTermsOfServiceContent } from "@/components/terms-of-service";

type ApplicationType = "DROPSHIPPER" | "AFFILIATE_PUBLISHER";

const PROMO_TYPES = [
  "Content / blog",
  "Coupons / deals",
  "Email newsletter",
  "Social media",
  "Video / streaming",
  "Community / forum",
];

export function PartnerApplicationForm({ partnerType }: { partnerType: ApplicationType }) {
  const publisher = partnerType === "AFFILIATE_PUBLISHER";
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [awinJoined, setAwinJoined] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      partnerType,
      email: String(form.get("email") || ""),
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      companyName: String(form.get("companyName") || ""),
      phone: String(form.get("phone") || ""),
      primaryState: String(form.get("primaryState") || ""),
      attestation: form.get("attestation") === "on",
      legalName: String(form.get("legalName") || ""),
      businessAddress: String(form.get("businessAddress") || ""),
      website: String(form.get("website") || ""),
      ...(publisher
        ? {
            promoWebsite: String(form.get("promoWebsite") || ""),
            promoTypes: form.getAll("promoTypes").map(String),
            promoDescription: String(form.get("promoDescription") || ""),
            audienceReach: String(form.get("audienceReach") || ""),
            awinJoined,
            awinPublisherId: String(form.get("awinPublisherId") || ""),
          }
        : {}),
    };

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Application failed");
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <ApplicationShell>
        <Card className="mx-auto max-w-xl text-center">
          <CardContent className="flex flex-col items-center gap-5 py-12">
            <CheckCircle className="h-14 w-14 text-success" />
            <div>
              <h1 className="text-2xl font-bold">Application submitted</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We review most {publisher ? "publisher" : "reseller"} applications within 24 hours and will email you with the next step.
              </p>
            </div>
            <Button asChild><Link href="/login">Sign in to check status</Link></Button>
          </CardContent>
        </Card>
      </ApplicationShell>
    );
  }

  return (
    <ApplicationShell>
      <div className="mx-auto max-w-2xl">
        <Link href="/#choose-path" className="mb-5 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Choose another partner path
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{publisher ? "Apply as an Affiliate Publisher" : "Apply as a Reseller"}</CardTitle>
            <CardDescription>
              {publisher
                ? "Promote The Perfect Part with your AWIN link and an audience discount code."
                : "Access wholesale pricing, tax-free purchasing, and drop-ship fulfillment."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex gap-2 rounded-lg border border-danger/30 bg-danger-light p-3 text-sm text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <Section title="Contact information">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="firstName" label="First name" required />
                  <Field name="lastName" label="Last name" required />
                </div>
                <Field name="email" label="Email" type="email" required />
                <Field name="phone" label="Phone" type="tel" required />
              </Section>

              <Separator />

              <Section title={publisher ? "Publisher information" : "Business information"}>
                <Field name="companyName" label={publisher ? "Brand / company name" : "Company name"} required />
                {!publisher && (
                  <>
                    <Field name="legalName" label="Legal business name" />
                    <Field name="businessAddress" label="Business address" required />
                    <Field name="website" label="Website" />
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="primaryState">Primary state / region *</Label>
                  <select id="primaryState" name="primaryState" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Select a state</option>
                    {US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </div>
              </Section>

              {publisher && (
                <>
                  <Separator />
                  <Section title="Promotion plan">
                    <Field name="promoWebsite" label="Promotion website" type="url" placeholder="https://example.com" required />
                    <div className="space-y-2">
                      <Label>How will you promote us? *</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PROMO_TYPES.map((type) => (
                          <label key={type} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                            <input type="checkbox" name="promoTypes" value={type} className="accent-primary" />
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="promoDescription">Describe your audience and promotion plan *</Label>
                      <Textarea id="promoDescription" name="promoDescription" required rows={4} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="audienceReach">Estimated audience reach</Label>
                      <select id="audienceReach" name="audienceReach" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                        <option value="">Select range (optional)</option>
                        <option>Under 1,000</option><option>1,000–10,000</option><option>10,000–50,000</option>
                        <option>50,000–250,000</option><option>250,000+</option>
                      </select>
                    </div>
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-medium">Are you already joined to The Perfect Part on AWIN? *</p>
                      <div className="flex gap-5">
                        <label className="flex items-center gap-2 text-sm"><input type="radio" name="awinJoined" checked={awinJoined} onChange={() => setAwinJoined(true)} /> Yes</label>
                        <label className="flex items-center gap-2 text-sm"><input type="radio" name="awinJoined" checked={!awinJoined} onChange={() => setAwinJoined(false)} /> No</label>
                      </div>
                      {awinJoined && <Field name="awinPublisherId" label="AWIN publisher ID" required />}
                      {!awinJoined && <p className="text-xs text-muted-foreground">You can apply now; we&apos;ll help you join our AWIN program before approval.</p>}
                    </div>
                  </Section>
                </>
              )}

              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-medium"><ScrollText className="h-4 w-4 text-primary" /> Program terms</div>
                <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/20 p-4">
                  {publisher ? <PublisherTermsOfServiceContent /> : <TermsOfServiceContent />}
                </div>
                {publisher && <Link href="/terms/publisher" target="_blank" className="inline-flex text-xs font-medium text-primary underline underline-offset-2">Open publisher terms in a full page</Link>}
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input type="checkbox" name="attestation" required className="mt-1 accent-primary" />
                  <span>
                    {publisher
                      ? "I agree to the Affiliate Publisher Program Terms, will use my AWIN tracking link with my audience code, and understand codes rotate when tiers change."
                      : "I attest that I am a legitimate resale business and agree to the Wholesale Program Terms of Service."}
                  </span>
                </label>
              </div>

              <Button type="submit" disabled={loading} size="lg" className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <>Submit application <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ApplicationShell>
  );
}

function ApplicationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12">
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <Link href="/"><Image src="/logo.png" alt="The Perfect Part" width={160} height={40} className="h-8 w-auto" /></Link>
        <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
      </div>
      {children}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>{children}</section>;
}

function Field({ name, label, type = "text", required, placeholder }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}{required ? " *" : ""}</Label><Input id={name} name={name} type={type} required={required} placeholder={placeholder} /></div>;
}

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts",
  "Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
  "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];
