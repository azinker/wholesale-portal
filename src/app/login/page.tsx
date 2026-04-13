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
  Package,
  BadgePercent,
  Truck,
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
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between bg-[#111] text-white p-10 xl:p-14 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,40,46,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(184,40,46,0.10),transparent_55%)]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />

        {/* Top — logo on white pill */}
        <div className="relative z-10">
          <div className="inline-flex items-center rounded-xl bg-white px-5 py-3 shadow-lg">
            <Image
              src="/logo.png"
              alt="The Perfect Part"
              width={160}
              height={40}
              priority
              className="h-8 w-auto"
            />
          </div>
        </div>

        {/* Middle — headline + features */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              Welcome Back,
              <br />
              <span className="bg-gradient-to-r from-primary via-red-400 to-primary bg-clip-text text-transparent">
                Partner.
              </span>
            </h2>
            <p className="mt-4 text-white/45 max-w-sm leading-relaxed text-[15px]">
              Access your wholesale dashboard to manage orders, track shipments,
              and grow your business.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: LayoutDashboard, label: "Order Dashboard" },
              { icon: TrendingUp, label: "Tier Progress" },
              { icon: Package, label: "Shipment Tracking" },
              { icon: BadgePercent, label: "Coupon Codes" },
              { icon: Truck, label: "Free Shipping" },
              { icon: ShieldCheck, label: "Secure Login" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-[13px] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white/70"
              >
                <item.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} The Perfect Part, LLC
          </p>
          <Link
            href="/"
            className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-4"
          >
            Back to homepage
          </Link>
        </div>
      </div>

      {/* Right — sign-in form */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 sm:px-10 py-12 bg-gradient-to-br from-background via-background to-muted/40">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center space-y-4 lg:hidden">
            <Image
              src="/logo.png"
              alt="The Perfect Part"
              width={220}
              height={56}
              priority
            />
            <div className="flex items-center gap-2.5">
              <div className="h-px w-10 bg-border" />
              <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
                Wholesale Portal
              </p>
              <div className="h-px w-10 bg-border" />
            </div>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block space-y-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Sign in
            </h1>
            <p className="text-muted-foreground">
              Access your wholesale partner dashboard
            </p>
          </div>

          {sent && (
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-light px-4 py-3.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-success">Magic link sent!</p>
                <p className="text-xs text-success/80 mt-0.5">
                  Check your email and click the link to sign in.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-light px-4 py-3.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger">
                {errorMessages[error] ||
                  "Something went wrong. Please try again."}
              </p>
            </div>
          )}

          <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-4 lg:hidden">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>
                Enter your email to receive a magic link. No password needed.
              </CardDescription>
            </CardHeader>
            <CardHeader className="pb-2 hidden lg:block">
              <CardDescription className="text-[15px]">
                Enter your wholesale email to receive a secure sign-in link.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form
                action="/api/auth/magic-link"
                method="POST"
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      required
                      placeholder="you@company.com"
                      className="pl-11 h-12 text-base"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full cursor-pointer h-12 text-base shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                  size="lg"
                >
                  Send Magic Link
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have a wholesale account?{" "}
              <Link
                href="/"
                className="text-primary font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                Apply here
              </Link>
            </p>
            <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Passwordless &middot; Secure &middot; No signup required
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
