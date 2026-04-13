"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useInView,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  ScrollText,
  Package,
  Truck,
  Tag,
  LayoutDashboard,
  Zap,
  ShieldCheck,
  ChevronDown,
  Star,
  Gift,
  ClipboardCheck,
  UserCheck,
  Sparkles,
  DollarSign,
  BarChart3,
  Users,
  Timer,
  Receipt,
  TrendingUp,
  ShoppingCart,
  Mail,
  Lock,
  CircleDollarSign,
  ChevronRight,
  BadgePercent,
  LogIn,
  ClipboardList,
} from "lucide-react";
import { TermsOfServiceContent } from "@/components/terms-of-service";

/* ─── Animated section (scroll-triggered) ────────────────────────── */

function Anim({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Animated counter (counts up when in view) ──────────────────── */

function Counter({
  to,
  suffix = "",
  prefix = "",
  duration = 1.5,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: duration * 1000 });
  const rounded = useTransform(spring, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView) motionVal.set(to);
  }, [inView, to, motionVal]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return unsub;
  }, [rounded]);

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ─── Looping stock counter (4,000 → 4,593, then resets) ─────────── */

function LoopingStockCounter() {
  const FROM = 4000;
  const TO = 4593;
  const CLIMB_MS = 30000;
  const HOLD_MS = 5000;
  const [count, setCount] = useState(FROM);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    let holding = false;
    let timeout: ReturnType<typeof setTimeout>;

    function tick(ts: number) {
      if (holding) return;
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / CLIMB_MS, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setCount(Math.round(FROM + (TO - FROM) * eased));

      if (progress >= 1) {
        holding = true;
        timeout = setTimeout(() => {
          setCount(FROM);
          start = null;
          holding = false;
          raf = requestAnimationFrame(tick);
        }, HOLD_MS);
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeout); };
  }, []);

  return (
    <span className="tabular-nums font-bold">
      {count.toLocaleString()}+
    </span>
  );
}

/* ─── FAQ accordion ──────────────────────────────────────────────── */

function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Anim delay={index * 0.06}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left cursor-pointer group"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-foreground group-hover:text-primary transition-colors duration-200">
          {question}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 mt-0.5 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-muted-foreground leading-relaxed pr-10">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <Separator />
    </Anim>
  );
}

/* ─── Feature card ───────────────────────────────────────────────── */

function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <Anim
      delay={index * 0.08}
      className="group relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 transition-all duration-300 hover:bg-white/10 hover:border-primary/30 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(184,40,46,0.15)]"
    >
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:scale-110">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{description}</p>
    </Anim>
  );
}

/* ─── Infographic stat card ──────────────────────────────────────── */

function InfoCard({
  icon: Icon,
  value,
  label,
  accent = false,
  index,
}: {
  icon: React.ElementType;
  value: React.ReactNode;
  label: string;
  accent?: boolean;
  index: number;
}) {
  return (
    <Anim
      delay={index * 0.12}
      className={`relative flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 ${
        accent
          ? "bg-primary text-white border-primary shadow-[0_8px_40px_rgba(184,40,46,0.3)]"
          : "bg-card border-border shadow-md hover:shadow-xl hover:border-primary/30"
      }`}
    >
      <div
        className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full ${
          accent ? "bg-white/20" : "bg-primary/10"
        }`}
      >
        <Icon className={`h-6 w-6 ${accent ? "text-white" : "text-primary"}`} />
      </div>
      <div
        className={`text-3xl sm:text-4xl font-bold mb-1 ${accent ? "text-white" : "text-foreground"}`}
      >
        {value}
      </div>
      <div
        className={`text-sm font-medium ${accent ? "text-white/80" : "text-muted-foreground"}`}
      >
        {label}
      </div>
    </Anim>
  );
}

/* ─── Tier bar (visual tier progression) ─────────────────────────── */

const TIERS = [
  { id: "T10", pct: 10, orders: 5, color: "bg-emerald-500" },
  { id: "T15", pct: 15, orders: 25, color: "bg-emerald-500" },
  { id: "T20", pct: 20, orders: 50, color: "bg-emerald-500" },
  { id: "T25", pct: 25, orders: 100, color: "bg-primary" },
  { id: "T30", pct: 30, orders: 200, color: "bg-primary" },
];

function TierProgression() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <div ref={ref} className="w-full space-y-3">
      {TIERS.map((tier, i) => (
        <motion.div
          key={tier.id}
          initial={{ opacity: 0, x: -30 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.4, delay: i * 0.12 }}
          className="flex items-center gap-3 sm:gap-4"
        >
          <div className="w-16 sm:w-20 text-right">
            <span className="text-xs text-muted-foreground">
              {tier.orders}+ orders
            </span>
          </div>
          <div className="flex-1 h-9 bg-muted/50 rounded-lg overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: `${(tier.pct / 30) * 100}%` } : {}}
              transition={{ duration: 0.8, delay: 0.3 + i * 0.12, ease: "easeOut" }}
              className={`h-full ${tier.color} rounded-lg flex items-center justify-end pr-3`}
            >
              <span className="text-xs font-bold text-white whitespace-nowrap">
                {tier.pct}% OFF
              </span>
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function ApplyPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const openApplication = () => setSheetOpen(true);

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

  /* ─── Application Sheet ──────────────────────────────────────── */
  const applicationSheet = (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center px-4 gap-6"
            >
              <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">Application Submitted!</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Thank you for applying! We review most applications within
                  24 hours. You&apos;ll receive an email with your portal login
                  and unique coupon code once approved.
                </p>
              </div>
              <Button asChild size="lg" className="cursor-pointer">
                <Link href="/">
                  Sign In to Check Status
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SheetHeader className="pb-2">
                <SheetTitle className="text-xl">Apply for Wholesale</SheetTitle>
                <SheetDescription>
                  Takes about 2 minutes. Most applications are approved within 24 hours.
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-5 px-4 pb-8">
                {error && (
                  <div className="flex items-center gap-3 rounded-lg bg-danger-light border border-danger/30 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-danger flex-shrink-0" />
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

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
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      Use this same email at checkout on theperfectpart.net for tax-free pricing.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
                    <Input id="phone" name="phone" type="tel" required placeholder="(555) 123-4567" />
                  </div>
                </div>

                <Separator />

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
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer"
                    >
                      <option value="">Select a state (optional)</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Terms & Agreements
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" name="attestation" required className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer" />
                    <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                      I attest that I am a legitimate business and intend to purchase products for resale. I understand that wholesale pricing is subject to approval and that I may be required to provide resale certificates or business documentation.
                    </span>
                  </label>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <ScrollText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-medium">Wholesale Program Terms of Service</p>
                        <p className="text-xs text-muted-foreground">Please read our Terms of Service before submitting.</p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs cursor-pointer">
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
                        className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                        I have read and agree to the{" "}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button type="button" className="text-primary underline underline-offset-2 font-medium hover:opacity-80 cursor-pointer">
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
                        , including the binding arbitration clause, class action waiver, return policy, and limitation of liability.
                      </span>
                    </label>
                  </div>
                </div>

                <Button type="submit" disabled={loading || !tosAccepted} className="w-full cursor-pointer" size="lg">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</>
                  ) : (
                    <>Submit Application<ArrowRight className="ml-1 h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      {applicationSheet}

      {/* ── Sticky Header ──────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-border/40"
            : "bg-white/90 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Image src="/logo.png" alt="The Perfect Part" width={160} height={40} priority className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="cursor-pointer hidden sm:inline-flex">
              <Link href="/">Sign In</Link>
            </Button>
            <Button size="sm" onClick={openApplication} className="cursor-pointer">
              Apply Now <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ══════════════════════════════════════════════════════
           HERO — Dark
           ══════════════════════════════════════════════════════ */}
        <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 px-4 overflow-hidden bg-[#141414] text-white">
          {/* Ambient gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,40,46,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(184,40,46,0.08),transparent_60%)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 mb-6"
            >
              <Gift className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">
                New partners get 20% off for their first 72 hours
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            >
              Your Wholesale Supplier.
              <br />
              <span className="bg-gradient-to-r from-primary via-red-400 to-primary bg-clip-text text-transparent">
                We Ship. You Profit.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
            >
              Source from thousands of products at up to 30% off retail with
              tax-free purchasing. We handle fulfillment and ship directly to
              your customers — you focus on growing your business.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button
                size="lg"
                onClick={openApplication}
                className="text-base px-8 h-12 cursor-pointer shadow-[0_4px_20px_rgba(184,40,46,0.4)] hover:shadow-[0_6px_30px_rgba(184,40,46,0.5)] transition-shadow"
              >
                Apply Now — Get 20% Welcome Bonus
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="cursor-pointer h-12 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
              >
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </motion.div>

            {/* Social proof + trust indicators */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="mt-10 text-sm text-white/50 font-medium flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4 text-primary" />
              Join 1,000+ Sellers Already Growing With Us
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-white/40"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> No Minimum Orders
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> Approved in 24 Hours
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> No Contracts or Fees
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> White-Label Shipping
              </span>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           PRICE GUARANTEE STRIP
           ══════════════════════════════════════════════════════ */}
        <section className="relative z-10 bg-primary text-white py-3 px-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <p className="text-sm sm:text-base font-semibold tracking-wide">
                Best Prices Guaranteed on the Hottest-Selling Products Online
              </p>
            </div>
            <span className="hidden sm:block w-px h-5 bg-white/30" />
            <div className="flex items-center gap-1.5 text-sm sm:text-base font-semibold">
              <Package className="h-4 w-4 shrink-0" />
              <LoopingStockCounter /> Items in Stock
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           INFOGRAPHIC STATS BAR
           ══════════════════════════════════════════════════════ */}
        <section className="relative py-10 px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard
              icon={BadgePercent}
              value={<Counter to={30} suffix="%" />}
              label="Maximum Discount"
              accent
              index={0}
            />
            <InfoCard
              icon={Receipt}
              value="Tax Free"
              label="Wholesale Purchases"
              index={1}
            />
            <InfoCard
              icon={Truck}
              value="Free"
              label="Shipping Included"
              index={2}
            />
            <InfoCard
              icon={LayoutDashboard}
              value="24/7"
              label="Partner Portal Access"
              index={3}
            />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           HOW IT WORKS — detailed
           ══════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="pt-28 pb-20 sm:pb-28 px-4 scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <Anim className="text-center mb-16">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                How It Works
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                Simple. Fast. Profitable.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                From signing up to fulfilling your first customer order — here&apos;s
                the entire process at a glance.
              </p>
            </Anim>

            {/* Phase 1: Get Started */}
            <Anim className="mb-4">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">A</span>
                Get Started
              </p>
            </Anim>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
              {STEPS_SIGNUP.map((step, i) => (
                <Anim key={i} delay={i * 0.12}>
                  <div className="relative rounded-xl border border-border/60 bg-card p-6 h-full transition-all duration-300 hover:shadow-lg hover:border-primary/20">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                        {i + 1}
                      </span>
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold mb-1.5">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </Anim>
              ))}
            </div>

            {/* Phase 2: Place an Order */}
            <Anim className="mb-4">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">B</span>
                Place an Order
              </p>
            </Anim>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
              {STEPS_ORDER.map((step, i) => (
                <Anim key={i} delay={i * 0.1}>
                  <div className="relative rounded-xl border border-border/60 bg-card p-5 h-full transition-all duration-300 hover:shadow-lg hover:border-primary/20">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground text-xs font-bold">
                        {i + 1}
                      </span>
                      <step.icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </Anim>
              ))}
            </div>

            {/* Important reminder callout */}
            <Anim>
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 sm:p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Important: Use Your Registered Email
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Always sign into <strong className="text-foreground">theperfectpart.net</strong> with the same
                    email you register with here. This is required for your wholesale discount,
                    free shipping, and tax-free pricing to apply at checkout.
                  </p>
                </div>
              </div>
            </Anim>

            <Anim delay={0.3} className="mt-10 text-center">
              <Button size="lg" onClick={openApplication} className="cursor-pointer shadow-md">
                Start Your Application <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Anim>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           WELCOME BONUS + TIER SYSTEM
           ══════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-28 px-4 bg-muted/30 border-y border-border/40">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Welcome Bonus */}
              <Anim>
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
                    <Gift className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Welcome Bonus</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                    Start With <span className="text-primary">20% Off</span>
                    <br />For Your First 72 Hours
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Every newly approved wholesale partner receives an immediate
                    20% welcome discount — active for your first 72 hours. Place
                    as many orders as you want during this window, then transition
                    into our volume-based tier system where your discount grows
                    with your business.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-card border border-border/60 px-4 py-2.5">
                      <Timer className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">72-hour welcome window</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-card border border-border/60 px-4 py-2.5">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Free shipping included</span>
                    </div>
                  </div>
                  <Button size="lg" onClick={openApplication} className="cursor-pointer shadow-md">
                    Claim Your Welcome Bonus <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Anim>

              {/* Right: Tier Progression */}
              <Anim delay={0.2}>
                <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Volume-Based Tier System</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your discount grows as your order volume increases within a
                    rolling 7-day window. Tiers are recalculated automatically.
                  </p>
                  <TierProgression />
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                    Qualifying orders counted within a rolling 7-day window. Tiers
                    upgrade and downgrade automatically based on volume.
                  </p>
                </div>
              </Anim>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           FEATURES — Dark section
           ══════════════════════════════════════════════════════ */}
        <section id="features" className="py-20 sm:py-28 px-4 bg-[#1a1a1a] text-white">
          <div className="max-w-5xl mx-auto">
            <Anim className="text-center mb-14">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                Why Partner With Us
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold">
                Everything You Need to Grow Your Business
              </h2>
              <p className="mt-4 text-white/50 max-w-lg mx-auto">
                From competitive pricing to hands-free fulfillment — we handle
                the logistics so you can focus on selling.
              </p>
            </Anim>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <FeatureCard key={i} icon={f.icon} title={f.title} description={f.description} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           FAQ — Light
           ══════════════════════════════════════════════════════ */}
        <section id="faq" className="py-20 sm:py-28 px-4 bg-muted/20 scroll-mt-20">
          <div className="max-w-2xl mx-auto">
            <Anim className="text-center mb-12">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                Common Questions
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                Frequently Asked Questions
              </h2>
            </Anim>
            <div>
              {FAQ_ITEMS.map((item, i) => (
                <FAQItem key={i} question={item.question} answer={item.answer} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           FINAL CTA — Dark
           ══════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-28 px-4 bg-[#141414] text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,40,46,0.12),transparent_70%)]" />
          <Anim className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Grow Your Resale Business?
            </h2>
            <p className="text-lg text-white/50 max-w-xl mx-auto mb-8">
              Join The Perfect Part wholesale program — up to 30% off,
              tax-free purchasing, free shipping, and your own partner portal.
              Apply today and get your 20% welcome bonus.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={openApplication}
                className="text-base px-8 h-12 cursor-pointer shadow-[0_4px_20px_rgba(184,40,46,0.4)] hover:shadow-[0_6px_30px_rgba(184,40,46,0.5)] transition-shadow"
              >
                Apply Now — It Takes 2 Minutes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/35">
              <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Free to join</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> No contracts</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Cancel anytime</span>
            </div>
            <p className="mt-5 text-sm text-white/40">
              Already applied?{" "}
              <Link href="/" className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity">
                Sign in to check your status
              </Link>
            </p>
          </Anim>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-4 bg-[#111]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="The Perfect Part" width={120} height={30} className="h-6 w-auto brightness-0 invert opacity-70" />
            <span className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} The Perfect Part, LLC. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <Link href="/" className="hover:text-white/70 transition-colors">Sign In</Link>
            <Dialog>
              <DialogTrigger asChild>
                <button className="hover:text-white/70 transition-colors cursor-pointer">Terms of Service</button>
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
      </footer>
    </>
  );
}

/* ─── Data ─────────────────────────────────────────────────────── */

const STEPS_SIGNUP = [
  {
    icon: ClipboardCheck,
    title: "Apply in 2 Minutes",
    description:
      "Quick form — business name, contact info, address. No contracts, no fees.",
  },
  {
    icon: UserCheck,
    title: "Approved Within 24 Hrs",
    description:
      "We review fast. Once approved, you'll receive your portal login credentials via email.",
  },
  {
    icon: LayoutDashboard,
    title: "Log Into Your Dashboard",
    description:
      "Sign into your wholesale portal to view your unique coupon code, track orders, and manage your account.",
  },
];

const STEPS_ORDER = [
  {
    icon: LogIn,
    title: "Sign In & Shop",
    description:
      "Log into theperfectpart.net with the same email you registered with here, then browse and add products to your cart.",
  },
  {
    icon: Tag,
    title: "Enter Your Unique Coupon Code",
    description:
      "At checkout, enter the unique coupon code found on your wholesale portal dashboard. Your tier discount, free shipping, and tax-free pricing are applied instantly.",
  },
  {
    icon: Package,
    title: "We Ship Directly",
    description:
      "We fulfill and ship the order straight to your customer. Your business name stays on the package — fully white-labeled.",
  },
  {
    icon: ClipboardList,
    title: "Track in Your Portal",
    description:
      "The order number, recipient name, and status appear on your wholesale portal dashboard for easy tracking.",
  },
];

const FEATURES = [
  {
    icon: BadgePercent,
    title: "Up to 30% Off Retail",
    description:
      "Our five-tier discount system starts at 10% and scales up to 30% based on your order volume across all product categories. The more you sell, the more you save.",
  },
  {
    icon: Receipt,
    title: "Tax-Free Purchasing",
    description:
      "Approved wholesale accounts are placed in our tax-exempt customer group. Shop without paying sales tax on qualifying orders.",
  },
  {
    icon: Truck,
    title: "Free Shipping + Drop-Ship",
    description:
      "Every wholesale order ships free. We can also ship directly to your customers — no warehousing or inventory risk on your end.",
  },
  {
    icon: Tag,
    title: "Personal Coupon Codes",
    description:
      "Receive a unique coupon code tied to your account and tier. Apply it at checkout for seamless, instant savings every time.",
  },
  {
    icon: LayoutDashboard,
    title: "Dedicated Partner Portal",
    description:
      "Track orders, monitor your tier progress, upload documents, manage your team, and access support — all from your own portal.",
  },
  {
    icon: BarChart3,
    title: "Insights & Margin Calculator",
    description:
      "Built-in analytics, order insights, and a margin calculator help you price your products for maximum profitability.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Add team members with role-based permissions — owners, admins, purchasers, and viewers. Control who can order and who can see reports.",
  },
  {
    icon: Zap,
    title: "Same-Day Processing",
    description:
      "Orders placed before cutoff ship the same business day. Get your customers their products fast with reliable nationwide fulfillment.",
  },
  {
    icon: ShieldCheck,
    title: "Quality Guaranteed",
    description:
      "Every product meets rigorous quality standards. Sell with confidence knowing your customers receive premium items every time.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What types of businesses qualify for wholesale pricing?",
    answer:
      "Any legitimate business engaged in the resale of products can apply — online retailers, brick-and-mortar shops, resellers, distributors, and more. You may be asked to provide a resale certificate or business documentation.",
  },
  {
    question: "How does the tiered pricing work?",
    answer:
      "Our wholesale program has five discount tiers: 10%, 15%, 20%, 25%, and 30%. Your tier is based on your qualifying order volume within a rolling 7-day window. As you place more orders, your discount increases automatically. Every tier also includes free shipping.",
  },
  {
    question: "What is the welcome bonus?",
    answer:
      "Every newly approved partner receives a 20% welcome discount that's active for their first 72 hours. This lets you start with strong savings from day one. After the welcome period, your tier is determined by your order volume.",
  },
  {
    question: "Is there a minimum order requirement?",
    answer:
      "No. There are no minimum order requirements to get started. Place orders of any size using your unique coupon code and your tier will grow naturally with your volume.",
  },
  {
    question: "How does tax-free purchasing work?",
    answer:
      "When approved, your account is placed in our Wholesale customer group, which qualifies you for tax-exempt pricing on applicable orders. You must be signed into theperfectpart.net with your registered wholesale email for this to apply at checkout.",
  },
  {
    question: "Do I need to sign in to use my coupon code?",
    answer:
      "Yes. To receive both your wholesale discount and tax-free pricing, you must sign into your account on theperfectpart.net using the same email you registered with in the wholesale program. Then enter your coupon code at checkout.",
  },
  {
    question: "How does drop shipping work?",
    answer:
      "When your customer places an order with you, forward it to us through the portal. We pick, pack, and ship the product directly to your customer — no inventory needed on your end. You focus on sales, we handle fulfillment.",
  },
  {
    question: "How long does approval take?",
    answer:
      "Most applications are reviewed within 24 hours during business days. Once approved, you'll receive an email with your portal login credentials, your unique wholesale coupon code, and your 20% welcome discount activation.",
  },
];

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
