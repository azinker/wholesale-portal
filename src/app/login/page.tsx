import Link from "next/link";
import Image from "next/image";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Mail,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";

export default async function LoginPage({
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
    invalid_token:
      "This link has expired or is invalid. Please request a new one.",
    missing_token: "Invalid sign-in link. Please request a new one.",
  };

  return (
    <main className="flex min-h-screen">
      {/* Left — branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between bg-[#141414] text-white p-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,40,46,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(184,40,46,0.08),transparent_60%)]" />

        <div className="relative z-10">
          <Image
            src="/logo.png"
            alt="The Perfect Part"
            width={180}
            height={44}
            priority
            className="brightness-0 invert mb-2"
          />
          <p className="text-sm text-white/40 tracking-wide uppercase">
            Wholesale Portal
          </p>
        </div>

        <div className="relative z-10 space-y-8">
          <h2 className="text-3xl font-bold leading-tight">
            Welcome Back,
            <br />
            <span className="text-primary">Partner.</span>
          </h2>
          <p className="text-white/50 max-w-sm leading-relaxed">
            Sign in to access your wholesale dashboard, track orders, view your
            coupon code, and manage your business.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-white/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                <LayoutDashboard className="h-4 w-4 text-primary" />
              </div>
              Track orders & manage your account
            </div>
            <div className="flex items-center gap-3 text-sm text-white/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              Monitor tier progress & insights
            </div>
            <div className="flex items-center gap-3 text-sm text-white/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              Secure magic-link authentication
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/20">
          &copy; {new Date().getFullYear()} The Perfect Part, LLC. All rights
          reserved.
        </p>
      </div>

      {/* Right — sign-in form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 sm:px-8 bg-gradient-to-br from-background via-background to-secondary/30">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center space-y-3 lg:hidden">
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

          {/* Desktop heading */}
          <div className="hidden lg:block space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Access your wholesale partner dashboard
            </p>
          </div>

          {sent && (
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-light px-4 py-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
              <p className="text-sm text-success">
                Magic link sent! Check your email and click the link to sign in.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-light px-4 py-3">
              <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
              <p className="text-sm text-danger">
                {errorMessages[error] ||
                  "Something went wrong. Please try again."}
              </p>
            </div>
          )}

          <Card className="shadow-lg border-border/60">
            <CardHeader className="pb-4 lg:hidden">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>
                Enter your email to receive a magic link. No password needed.
              </CardDescription>
            </CardHeader>
            <CardHeader className="pb-4 hidden lg:block">
              <CardDescription>
                Enter your email to receive a secure magic link. No password
                needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action="/api/auth/magic-link"
                method="POST"
                className="space-y-4"
              >
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
                <Button type="submit" className="w-full cursor-pointer" size="lg">
                  Send Magic Link
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have a wholesale account?{" "}
            <Link
              href="/"
              className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Apply here
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
