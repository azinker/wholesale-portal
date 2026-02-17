"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle, ArrowRight, Loader2, AlertCircle, ScrollText } from "lucide-react";
import { TermsOfServiceContent } from "@/components/terms-of-service";

export default function ApplyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const data = {
      email: form.get("email") as string,
      firstName: form.get("firstName") as string,
      lastName: form.get("lastName") as string,
      companyName: form.get("companyName") as string,
      legalName: form.get("legalName") as string,
      businessAddress: form.get("businessAddress") as string,
      phone: form.get("phone") as string,
      website: form.get("website") as string,
      primaryState: form.get("primaryState") as string,
      attestation: form.get("attestation") === "on",
    };

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Application failed");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 bg-gradient-to-br from-background via-background to-secondary/30">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex justify-center">
            <Image src="/logo.png" alt="The Perfect Part" width={220} height={54} priority />
          </div>
          <Card className="shadow-lg border-success/30 bg-success-light/30">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
              </div>
              <h1 className="text-2xl font-bold">Application Submitted</h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Thank you for applying! We&apos;ll review your application and
                notify you by email. You can check your status anytime by signing in.
              </p>
              <Button asChild size="lg" className="mt-2">
                <Link href="/">
                  Sign In to Check Status
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-12 px-4 bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-3">
          <Image src="/logo.png" alt="The Perfect Part" width={220} height={54} priority />
          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-border" />
            <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              Wholesale Application
            </p>
            <div className="h-px w-8 bg-border" />
          </div>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">Apply for Wholesale</CardTitle>
            <CardDescription>
              Complete the form below to apply for a wholesale account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-3 rounded-lg bg-danger-light border border-danger/30 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-danger flex-shrink-0" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Contact Information
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                  <Input id="email" name="email" type="email" required placeholder="you@company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
                  <Input id="phone" name="phone" type="tel" required placeholder="(555) 123-4567" />
                </div>
              </div>

              <Separator />

              {/* Business Info */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Business Information
                </p>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
                  <Input id="companyName" name="companyName" required />
                  <p className="text-xs text-muted-foreground">Used to generate your wholesale coupon codes.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Business Name</Label>
                  <Input id="legalName" name="legalName" placeholder="If different from company name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address <span className="text-destructive">*</span></Label>
                  <Input id="businessAddress" name="businessAddress" required placeholder="123 Main St, City, State, ZIP" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" name="website" type="text" placeholder="www.yourcompany.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryState">Primary State</Label>
                  <select
                    id="primaryState"
                    name="primaryState"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Select a state (optional)</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Separator />

              {/* Terms of Service + Attestation */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Terms & Agreements
                </p>

                {/* Attestation */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="attestation"
                    required
                    className="mt-1 h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                    I attest that I am a legitimate business and intend to purchase
                    products for resale. I understand that wholesale pricing is subject
                    to approval and that I may be required to provide resale certificates
                    or business documentation.
                  </span>
                </label>

                {/* Terms of Service Agreement */}
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <ScrollText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-medium">Wholesale Program Terms of Service</p>
                      <p className="text-xs text-muted-foreground">
                        Please read our Terms of Service before submitting your application.
                        This includes our return policy, binding arbitration clause, limitation
                        of liability, and coupon code usage policies.
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs">
                            <ScrollText className="h-3.5 w-3.5 mr-1.5" />
                            Read Terms of Service
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <ScrollText className="h-5 w-5 text-primary" />
                              Wholesale Program Terms of Service
                            </DialogTitle>
                          </DialogHeader>
                          <TermsOfServiceContent />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <Separator />
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={tosAccepted}
                      onChange={(e) => setTosAccepted(e.target.checked)}
                      required
                      className="mt-1 h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                      I have read and agree to the{" "}
                      <Dialog>
                        <DialogTrigger asChild>
                          <button type="button" className="text-primary underline underline-offset-2 font-medium hover:opacity-80">
                            Wholesale Program Terms of Service
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <ScrollText className="h-5 w-5 text-primary" />
                              Wholesale Program Terms of Service
                            </DialogTitle>
                          </DialogHeader>
                          <TermsOfServiceContent />
                        </DialogContent>
                      </Dialog>
                      , including the binding arbitration clause, class action waiver,
                      return policy, and limitation of liability.
                    </span>
                  </label>
                </div>
              </div>

              <Button type="submit" disabled={loading || !tosAccepted} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already applied?{" "}
          <Link href="/" className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity">
            Sign in to check your status
          </Link>
        </p>
      </div>
    </main>
  );
}

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
];
