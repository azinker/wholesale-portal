import Link from "next/link";
import Image from "next/image";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const user = await getUser();
  if (user) {
    if (isAdmin(user.email)) redirect("/admin");
    redirect("/dashboard");
  }

  const params = await searchParams;
  const sent = params.sent === "true";
  const error = params.error;

  const errorMessages: Record<string, string> = {
    invalid_email: "Please enter a valid email address.",
    rate_limited: "Too many requests. Please wait a few minutes.",
    send_failed: "Failed to send email. Please try again.",
    invalid_token: "This link has expired or is invalid. Please request a new one.",
    missing_token: "Invalid sign-in link. Please request a new one.",
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-3">
          <Image
            src="/logo.png"
            alt="The Perfect Part"
            width={260}
            height={64}
            priority
            className="mb-1"
          />
          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-border" />
            <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              Wholesale Portal
            </p>
            <div className="h-px w-8 bg-border" />
          </div>
        </div>

        {/* Success message */}
        {sent && (
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-light px-4 py-3">
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
            <p className="text-sm text-success">
              Magic link sent! Check your email and click the link to sign in.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-light px-4 py-3">
            <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
            <p className="text-sm text-danger">
              {errorMessages[error] || "Something went wrong. Please try again."}
            </p>
          </div>
        )}

        {/* Login Card */}
        <Card className="shadow-lg border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your email to receive a magic link. No password needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/auth/magic-link" method="POST" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="you@company.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg">
                Send Magic Link
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Apply link */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have a wholesale account?{" "}
          <Link href="/apply" className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity">
            Apply here
          </Link>
        </p>
      </div>
    </main>
  );
}
