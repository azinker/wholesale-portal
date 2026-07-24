"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Package,
  Megaphone,
  Truck,
  Link2,
  BarChart3,
  Shield,
  Play,
  Pause,
  Tag,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartnerPathDialog } from "@/components/partner-path-dialog";

/* ─── helpers ─────────────────────────────────────────────────────── */

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
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm sm:text-base font-medium text-white/90">{question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-white/55 leading-relaxed max-w-2xl">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── How it works “video” ────────────────────────────────────────── */

const SCENES = [
  {
    id: "apply",
    title: "Apply once",
    body: "Choose reseller or publisher. We review most applications within one business day.",
    icon: Users,
  },
  {
    id: "access",
    title: "Get your tools",
    body: "Resellers receive a portal + tier coupon. Publishers get an AWIN invite and a public discount code.",
    icon: Zap,
  },
  {
    id: "sell",
    title: "Sell or share",
    body: "Drop-ship with no inventory — or share tracking links and codes with your audience.",
    icon: Package,
  },
  {
    id: "grow",
    title: "Grow automatically",
    body: "More attributed volume unlocks better reseller tiers or stronger publisher audience discounts.",
    icon: BarChart3,
  },
];

function HowItWorksPlayer() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const duration = 4200;

  useEffect(() => {
    if (!playing) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p >= 1) {
        setIndex((i) => (i + 1) % SCENES.length);
        setProgress(0);
      }
    };
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [playing, index]);

  const scene = SCENES[index];
  const Icon = scene.icon;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs font-medium tracking-wide text-white/60 uppercase">
            How it works · 0:{String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>
      </div>

      <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(184,40,46,0.45), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(255,255,255,0.06), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_12px_40px_rgba(184,40,46,0.45)]"
            >
              <Icon className="h-7 w-7" />
            </motion.div>
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] uppercase text-primary">
              Step {index + 1}
            </p>
            <h3 className="font-display text-3xl sm:text-4xl text-white tracking-tight mb-3">
              {scene.title}
            </h3>
            <p className="max-w-md text-sm sm:text-base text-white/65 leading-relaxed">
              {scene.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="h-1 bg-white/5">
        <div
          className="h-full bg-primary transition-[width] duration-75 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-px bg-white/5">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setProgress(0);
            }}
            className={`px-2 py-3 text-[10px] sm:text-xs font-medium transition-colors ${
              i === index ? "bg-white/10 text-white" : "bg-[#141414] text-white/40 hover:text-white/70"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Tier bars ───────────────────────────────────────────────────── */

const RESELLER_TIERS = [
  { pct: 10, orders: "5+" },
  { pct: 15, orders: "25+" },
  { pct: 20, orders: "50+" },
  { pct: 25, orders: "100+" },
  { pct: 30, orders: "200+" },
];

const PUBLISHER_TIERS = [
  { pct: 15, label: "Day one" },
  { pct: 20, label: "50 attributed" },
  { pct: 25, label: "125 attributed" },
];

/* ─── Page ────────────────────────────────────────────────────────── */

type TrackingWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

function trackEvent(event: string, data: Record<string, unknown> = {}) {
  const trackingWindow = window as TrackingWindow;
  trackingWindow.dataLayer = trackingWindow.dataLayer || [];
  trackingWindow.dataLayer.push({ event, ...data });
}

export default function HomePage() {
  const [pathOpen, setPathOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [faqTab, setFaqTab] = useState<"reseller" | "publisher">("reseller");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reapply") === "1") {
      window.location.href = "/apply/reseller";
      return;
    }
    const shouldOpen =
      params.get("apply") === "1" ||
      window.location.hash === "#choose-path" ||
      window.location.hash === "#apply";
    if (shouldOpen) {
      setPathOpen(true);
      trackEvent("wholesale_path_chooser_opened", { source: "deep_link" });
    }
  }, []);

  const openPathChooser = (source = "cta") => {
    setPathOpen(true);
    trackEvent("wholesale_path_chooser_opened", { source });
  };

  const resellerFaqs = [
    {
      q: "Who qualifies as a reseller?",
      a: "Legitimate businesses that resell products — online shops, brick-and-mortar stores, distributors, and dropshippers. You may be asked for a resale certificate or business docs.",
    },
    {
      q: "How do wholesale tiers work?",
      a: "Your discount starts after approval and grows with qualifying order volume on a rolling window — from 10% up to 30%. Your personal coupon code updates automatically.",
    },
    {
      q: "Do I need inventory?",
      a: "No. Place reseller orders in the portal and we pick, pack, and ship to your customer. You focus on sales; we handle fulfillment.",
    },
    {
      q: "What is the welcome offer?",
      a: "New resellers get 20% off for their first 72 hours after approval — a head start while your long-term tier builds.",
    },
  ];

  const publisherFaqs = [
    {
      q: "How is this different from reselling?",
      a: "Publishers don’t buy inventory. You promote The Perfect Part with AWIN tracking links and share a public discount code with your audience. You earn AWIN commission; shoppers get the discount.",
    },
    {
      q: "What discounts can my audience get?",
      a: "Every approved publisher starts at 15% forever. Hit 50 attributed orders for 20%, and 125 for 25%. Codes rotate when you level up.",
    },
    {
      q: "Who is a good fit?",
      a: "Automotive blogs, YouTube/TikTok creators, newsletters, forums, and deal sites with an engaged audience that buys parts and accessories.",
    },
    {
      q: "Where do I get paid?",
      a: "Commission is paid through AWIN. Your Perfect Part portal shows attributed orders tied to your discount code so you can track progress toward the next tier.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white overflow-x-hidden">
      {/* Header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0c0c0c]/90 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="The Perfect Part"
              width={36}
              height={36}
              className="h-9 w-9"
              priority
            />
            <span className="font-display text-lg tracking-[0.04em] text-white">
              THE PERFECT PART
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors px-2"
            >
              Sign In
            </Link>
            <Button
              onClick={() => openPathChooser("header")}
              className="gap-1.5 rounded-md bg-primary hover:bg-primary/90"
            >
              Apply Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — brand-first, full-bleed */}
      <section className="relative min-h-[100svh] flex flex-col justify-end pb-16 pt-28 sm:pb-24 sm:pt-32">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, #1a1212 0%, #0c0c0c 42%, #121416 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-24 h-[420px] w-[420px] rounded-full bg-primary/25 blur-[120px]"
          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-32 bottom-0 h-[360px] w-[360px] rounded-full bg-white/5 blur-[100px]"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase text-primary"
          >
            Partner portal
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.05 }}
            className="font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.92] tracking-tight text-white max-w-4xl"
          >
            THE PERFECT PART
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-5 max-w-xl text-lg sm:text-xl text-white/70 leading-relaxed"
          >
            Wholesale for dropshippers. Audience discounts for publishers. One
            brand. Two ways to grow.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button
              size="lg"
              onClick={() => openPathChooser("hero")}
              className="gap-2 h-12 px-6 text-base rounded-md"
            >
              Apply Now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-12 px-6 text-base rounded-md border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Dual audience intro — editorial, not chooser cards as primary CTA */}
      <section className="relative border-t border-white/10 bg-[#111111]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <Anim>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
              Built for two partner types
            </p>
            <h2 className="font-display text-3xl sm:text-5xl tracking-tight text-white max-w-2xl mb-4">
              Same catalog. Different business model.
            </h2>
            <p className="text-white/55 max-w-2xl text-base sm:text-lg leading-relaxed mb-14">
              Whether you fulfill orders yourself or send traffic through AWIN,
              you get a dedicated portal, clear economics, and tools that match
              how you actually work.
            </p>
          </Anim>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
            <Anim delay={0.08} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <h3 className="font-display text-2xl tracking-tight">
                  Dropshippers &amp; resellers
                </h3>
              </div>
              <p className="text-white/60 leading-relaxed">
                Buy at tiered wholesale prices, mark up for your customers, and
                let us ship. No warehouse. No packing. Your storefront — our
                fulfillment.
              </p>
              <ul className="space-y-3">
                {[
                  "Tiered discounts from 10% to 30%",
                  "20% welcome pricing for 72 hours",
                  "Portal ordering + free shipping thresholds",
                  "Personal coupon tied to your account",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-white/75">
                    <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Anim>

            <Anim delay={0.16} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Megaphone className="h-5 w-5" />
                </div>
                <h3 className="font-display text-2xl tracking-tight">
                  Publishers &amp; creators
                </h3>
              </div>
              <p className="text-white/60 leading-relaxed">
                Promote with AWIN links, share a public discount code, and earn
                commission when your audience buys. No inventory. No customer
                service on fulfillment.
              </p>
              <ul className="space-y-3">
                {[
                  "15% audience discount from day one",
                  "Unlock 20% and 25% with attributed volume",
                  "AWIN commission paid through the network",
                  "Share kit + performance view in your portal",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-white/75">
                    <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Anim>
          </div>
        </div>
      </section>

      {/* How it works animation */}
      <section id="how-it-works" className="relative bg-[#0c0c0c] border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-16 items-center">
            <Anim>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
                60-second overview
              </p>
              <h2 className="font-display text-3xl sm:text-5xl tracking-tight text-white mb-4">
                From apply to first sale
              </h2>
              <p className="text-white/55 leading-relaxed mb-8">
                A simple walkthrough of onboarding, tools, and how volume unlocks
                better economics — whether you resell or publish.
              </p>
              <Button
                onClick={() => openPathChooser("how_it_works")}
                className="gap-2"
              >
                Start your application
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Anim>
            <Anim delay={0.12}>
              <HowItWorksPlayer />
            </Anim>
          </div>
        </div>
      </section>

      {/* Reseller deep dive */}
      <section className="relative bg-[#f4f1ee] text-[#1a1a1a] border-t border-black/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <Anim>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
                Reseller program
              </p>
              <h2 className="font-display text-3xl sm:text-5xl tracking-tight mb-4">
                Wholesale that scales with you
              </h2>
              <p className="text-[#6b6462] leading-relaxed mb-8">
                Place orders in the portal, apply your tier coupon, and we ship
                to your customer. Volume over a rolling window moves you up
                automatically — no renegotiation.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {[
                  { icon: Tag, label: "Up to 30% off", sub: "Top reseller tier" },
                  { icon: Truck, label: "We fulfill", sub: "Direct to customer" },
                  { icon: Shield, label: "72h welcome", sub: "20% after approval" },
                ].map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="space-y-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <p className="font-semibold text-sm">{label}</p>
                    <p className="text-xs text-[#6b6462]">{sub}</p>
                  </div>
                ))}
              </div>
              <Button onClick={() => openPathChooser("reseller_section")} className="gap-2">
                Apply as a reseller
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Anim>
            <Anim delay={0.1} className="space-y-3 pt-2">
              {RESELLER_TIERS.map((tier, i) => (
                <div key={tier.pct} className="flex items-center gap-3">
                  <span className="w-14 text-right text-xs text-[#6b6462]">
                    {tier.orders}
                  </span>
                  <div className="flex-1 h-10 rounded-lg bg-[#e8e2de] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(tier.pct / 30) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.15 + i * 0.1 }}
                      className={`h-full flex items-center justify-end pr-3 ${
                        tier.pct >= 25 ? "bg-primary" : "bg-[#2d2d2d]"
                      }`}
                    >
                      <span className="text-xs font-bold text-white">{tier.pct}% OFF</span>
                    </motion.div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-[#6b6462] pt-2 pl-[4.25rem]">
                Qualifying orders in your evaluation window
              </p>
            </Anim>
          </div>
        </div>
      </section>

      {/* Publisher deep dive */}
      <section className="relative bg-white text-[#1a1a1a] border-t border-black/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <Anim className="order-2 lg:order-1 space-y-4">
              {PUBLISHER_TIERS.map((tier, i) => (
                <motion.div
                  key={tier.pct}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="flex items-center gap-4 rounded-xl border border-[#e5e0dd] bg-[#faf8f6] px-5 py-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white font-display text-lg">
                    {tier.pct}%
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Audience discount</p>
                    <p className="text-xs text-[#6b6462]">{tier.label}</p>
                  </div>
                  {i === 0 && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Floor forever
                    </span>
                  )}
                </motion.div>
              ))}
              <p className="text-xs text-[#6b6462] pt-1">
                Attribution via your publisher coupon · AWIN handles commission
              </p>
            </Anim>
            <Anim delay={0.08} className="order-1 lg:order-2">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
                Publisher program
              </p>
              <h2 className="font-display text-3xl sm:text-5xl tracking-tight mb-4">
                Earn while your audience saves
              </h2>
              <p className="text-[#6b6462] leading-relaxed mb-6">
                Join through AWIN, get a public discount code, and share product
                links with your community. Your portal tracks attributed orders
                so you always know how close you are to the next discount tier.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  { icon: Link2, text: "AWIN tracking links for every product" },
                  { icon: Tag, text: "Public codes shoppers can use at checkout" },
                  { icon: Users, text: "Ideal for blogs, creators, newsletters, deal sites" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex gap-3 text-sm text-[#3a3533]">
                    <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
              <Button onClick={() => openPathChooser("publisher_section")} className="gap-2">
                Apply as a publisher
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Anim>
          </div>
        </div>
      </section>

      {/* Theme / trust strip */}
      <section className="bg-[#111111] border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <Anim className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-white mb-3">
              Automotive parts. Partner-grade ops.
            </h2>
            <p className="text-white/50 max-w-xl mx-auto text-sm sm:text-base">
              The Perfect Part catalog — brakes, suspension, lighting, and more —
              backed by a portal built for real reseller and publisher workflows.
            </p>
          </Anim>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                title: "Clear separation",
                body: "Reseller coupons stay on wholesale accounts. Publisher codes stay public. No accidental mixing.",
              },
              {
                title: "Transparent progress",
                body: "See your tier, attributed volume, and next unlock inside the partner dashboard.",
              },
              {
                title: "Fast onboarding",
                body: "Most applications reviewed within one business day. Tools land in your inbox when you’re approved.",
              },
            ].map((item, i) => (
              <Anim key={item.title} delay={i * 0.08} className="text-center sm:text-left">
                <div className="mb-3 mx-auto sm:mx-0 h-px w-10 bg-primary" />
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.body}</p>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#0c0c0c] border-t border-white/10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28">
          <Anim className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
              FAQ
            </p>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-white">
              Questions, answered
            </h2>
          </Anim>
          <Anim delay={0.08}>
            <div className="flex justify-center gap-2 mb-8">
              {(
                [
                  ["reseller", "Resellers"],
                  ["publisher", "Publishers"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFaqTab(key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    faqTab === key
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              {(faqTab === "reseller" ? resellerFaqs : publisherFaqs).map((item) => (
                <FaqItem key={item.q} question={item.q} answer={item.a} />
              ))}
            </div>
          </Anim>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-white/10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(184,40,46,0.35), transparent 55%), #111111",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28 text-center">
          <Anim>
            <h2 className="font-display text-3xl sm:text-5xl tracking-tight text-white mb-4">
              Ready to partner?
            </h2>
            <p className="text-white/55 mb-8 max-w-lg mx-auto leading-relaxed">
              Pick reseller or publisher — takes about two minutes. We’ll email
              you as soon as you’re approved.
            </p>
            <Button
              size="lg"
              onClick={() => openPathChooser("footer_cta")}
              className="gap-2 h-12 px-8 text-base"
            >
              Apply Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Anim>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0c0c0c] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} The Perfect Part. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms/publisher" className="hover:text-white/70 transition-colors">
              Publisher terms
            </Link>
            <Link href="/login" className="hover:text-white/70 transition-colors">
              Sign In
            </Link>
            <a
              href="https://theperfectpart.net"
              className="hover:text-white/70 transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Store
            </a>
          </div>
        </div>
      </footer>

      <PartnerPathDialog open={pathOpen} onOpenChange={setPathOpen} />
    </div>
  );
}
