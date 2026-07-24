"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Tag,
  Users,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartnerPathDialog } from "@/components/partner-path-dialog";

/* ── primitives ─────────────────────────────────────────────────── */

function Reveal({
  children,
  className = "",
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
      <span className="inline-block h-[3px] w-[3px] bg-primary" />
      {children}
    </p>
  );
}

function BrandGrid({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-grid grid-cols-2 gap-[3px] ${className}`} aria-hidden>
      <span className="h-2.5 w-2.5 bg-[#3f3f3f]" />
      <span className="h-2.5 w-2.5 bg-primary" />
      <span className="h-2.5 w-2.5 bg-[#3f3f3f]" />
      <span className="h-2.5 w-2.5 bg-[#3f3f3f]" />
    </span>
  );
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const total = 42;
    const id = window.setInterval(() => {
      frame += 1;
      const eased = 1 - Math.pow(1 - frame / total, 3);
      setValue(Math.round(to * eased));
      if (frame >= total) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

/* ── hero diagram ───────────────────────────────────────────────── */

function PathsDiagram() {
  return (
    <svg viewBox="0 0 420 330" className="w-full h-auto" role="img" aria-label="Two partner paths">
      <defs>
        <linearGradient id="tppFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B8282E" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#B8282E" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <motion.g
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <rect x="120" y="8" width="180" height="58" rx="10" fill="url(#tppFade)" stroke="#B8282E" strokeWidth="1.5" />
        <text x="210" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill="#B8282E" letterSpacing="1.6">
          THE PERFECT PART
        </text>
        <text x="210" y="50" textAnchor="middle" fontSize="10" fill="#6b6462">
          Automotive catalog
        </text>
      </motion.g>

      <motion.path
        d="M210 66 V102 H88 V138"
        fill="none"
        stroke="#d9d2ce"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.35 }}
      />
      <motion.path
        d="M210 66 V102 H332 V138"
        fill="none"
        stroke="#d9d2ce"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.35 }}
      />

      {[
        {
          x: 8,
          title: "YOU RESELL",
          lines: ["Buy at 10–30% off", "We ship to your", "customer"],
          delay: 0.7,
        },
        {
          x: 252,
          title: "YOU PROMOTE",
          lines: ["Share code + links", "Audience saves,", "you earn"],
          delay: 0.85,
        },
      ].map((node) => (
        <motion.g
          key={node.title}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: node.delay }}
        >
          <rect x={node.x} y="138" width="160" height="118" rx="10" fill="#ffffff" stroke="#e5e0dd" strokeWidth="1.5" />
          <rect x={node.x} y="138" width="160" height="4" rx="2" fill="#B8282E" />
          <text x={node.x + 20} y="172" fontSize="11" fontWeight="700" fill="#1a1a1a" letterSpacing="1.4">
            {node.title}
          </text>
          {node.lines.map((line, i) => (
            <text key={line} x={node.x + 20} y={196 + i * 18} fontSize="11" fill="#6b6462">
              {line}
            </text>
          ))}
        </motion.g>
      ))}

      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.05 }}
      >
        <path d="M88 256 V286 H210 V300" fill="none" stroke="#d9d2ce" strokeWidth="1.5" />
        <path d="M332 256 V286 H210 V300" fill="none" stroke="#d9d2ce" strokeWidth="1.5" />
        <rect x="140" y="300" width="140" height="26" rx="13" fill="#1a1a1a" />
        <text x="210" y="317" textAnchor="middle" fontSize="10" fontWeight="600" fill="#ffffff" letterSpacing="1.2">
          YOU GET PAID
        </text>
      </motion.g>
    </svg>
  );
}

/* ── how it works ───────────────────────────────────────────────── */

type Step = {
  id: string;
  title: string;
  body: string;
};

const RESELLER_STEPS: Step[] = [
  {
    id: "r-apply",
    title: "Apply as a reseller",
    body: "Tell us about your business. Most applications are reviewed within one business day, and you may be asked for a resale certificate.",
  },
  {
    id: "r-price",
    title: "Unlock wholesale pricing",
    body: "You get a personal coupon tied to your account plus 20% welcome pricing for your first 72 hours after approval.",
  },
  {
    id: "r-order",
    title: "Sell on your own store",
    body: "List our parts wherever you sell. When a customer buys from you, place the order in the partner portal at your tier price.",
  },
  {
    id: "r-ship",
    title: "We pick, pack and ship",
    body: "Orders go straight to your customer. No inventory, no warehouse. Your volume grows your discount from 10% up to 30%.",
  },
];

const PUBLISHER_STEPS: Step[] = [
  {
    id: "p-apply",
    title: "Apply as a publisher",
    body: "Share your site, channel or newsletter. Approved publishers are connected through the AWIN affiliate network.",
  },
  {
    id: "p-tools",
    title: "Get your code and links",
    body: "You receive a public discount code your audience can use at checkout, plus AWIN tracking links for any product.",
  },
  {
    id: "p-share",
    title: "Share with your audience",
    body: "Drop links and codes into posts, videos, newsletters or deal pages. No inventory and no customer service on fulfillment.",
  },
  {
    id: "p-earn",
    title: "Earn on every sale",
    body: "AWIN pays your commission. Attributed volume raises your audience discount from 15% to 20% and then 25%.",
  },
];

function StepVisual({ id }: { id: string }) {
  const shell =
    "absolute inset-0 flex flex-col items-center justify-center gap-4 px-8";

  if (id === "r-apply" || id === "p-apply") {
    const isPublisher = id === "p-apply";
    return (
      <div className={shell}>
        <div className="w-full max-w-[300px] rounded-xl border border-border bg-white p-4 shadow-sm">
          {["Business name", "Website", isPublisher ? "Audience size" : "Resale certificate"].map(
            (label, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.14 }}
                className="mb-2.5 last:mb-0"
              >
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <div className="h-6 rounded-md bg-secondary" />
              </motion.div>
            ),
          )}
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.75, type: "spring", stiffness: 220 }}
          className="flex items-center gap-2 rounded-full bg-[#16a34a] px-4 py-1.5 text-xs font-semibold text-white"
        >
          <Check className="h-3.5 w-3.5" />
          Approved
        </motion.div>
      </div>
    );
  }

  if (id === "r-price") {
    return (
      <div className={shell}>
        <div className="w-full max-w-[320px] space-y-3">
          {[
            { label: "Retail price", value: "$129.99", muted: true },
            { label: "Your tier price", value: "$90.99", muted: false },
            { label: "Your margin", value: "$39.00", accent: true },
          ].map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.18 }}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                row.accent ? "border-primary/30 bg-primary/5" : "border-border bg-white"
              }`}
            >
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <span
                className={`font-display text-lg font-bold ${
                  row.muted
                    ? "text-muted-foreground line-through"
                    : row.accent
                      ? "text-primary"
                      : "text-foreground"
                }`}
              >
                {row.value}
              </span>
            </motion.div>
          ))}
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-[11px] text-muted-foreground"
        >
          Example at the 30% reseller tier
        </motion.p>
      </div>
    );
  }

  if (id === "r-order") {
    return (
      <div className={shell}>
        <div className="w-full max-w-[320px] overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[#d9d2ce]" />
            <span className="h-2 w-2 rounded-full bg-[#d9d2ce]" />
            <span className="ml-2 text-[10px] text-muted-foreground">your-store.com</span>
          </div>
          <div className="grid grid-cols-3 gap-2 p-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="space-y-1.5"
              >
                <div className="aspect-square rounded-md bg-secondary" />
                <div className="h-1.5 w-3/4 rounded bg-secondary" />
              </motion.div>
            ))}
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-4 py-2.5 shadow-sm"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="text-xs font-medium">New order · forward to portal</span>
        </motion.div>
      </div>
    );
  }

  if (id === "r-ship") {
    return (
      <div className={shell}>
        <div className="relative w-full max-w-[320px]">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-[#d9d2ce]" />
          <div className="relative flex items-center justify-between">
            <div className="flex flex-col items-center gap-2 bg-[#faf8f6] px-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white">
                <Package className="h-5 w-5 text-foreground" />
              </span>
              <span className="text-[10px] text-muted-foreground">Our warehouse</span>
            </div>
            <div className="flex flex-col items-center gap-2 bg-[#faf8f6] px-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
                <Truck className="h-5 w-5" />
              </span>
              <span className="text-[10px] text-muted-foreground">In transit</span>
            </div>
            <div className="flex flex-col items-center gap-2 bg-[#faf8f6] px-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white">
                <Users className="h-5 w-5 text-foreground" />
              </span>
              <span className="text-[10px] text-muted-foreground">Your customer</span>
            </div>
          </div>
          <motion.span
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary"
            initial={{ left: "12%" }}
            animate={{ left: ["12%", "88%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[11px] text-muted-foreground"
        >
          Blind shipped — your brand stays front and center
        </motion.p>
      </div>
    );
  }

  if (id === "p-tools") {
    return (
      <div className={shell}>
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-[300px] rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 px-5 py-4 text-center"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            Your audience code
          </p>
          <p className="font-display text-2xl font-bold tracking-[0.14em] text-foreground">
            CREATOR15
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">15% off for your followers</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex w-full max-w-[300px] items-center gap-2 rounded-lg border border-border bg-white px-3 py-2.5"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-[11px] text-muted-foreground">
            awin1.com/cread.php?…&amp;p=brake-kit
          </span>
        </motion.div>
      </div>
    );
  }

  if (id === "p-share") {
    return (
      <div className={shell}>
        <div className="grid w-full max-w-[320px] grid-cols-3 gap-2.5">
          {["Blog post", "Video", "Newsletter"].map((label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.13 }}
              className="rounded-lg border border-border bg-white p-2.5"
            >
              <div className="mb-2 aspect-[4/3] rounded bg-secondary" />
              <p className="text-[10px] font-medium">{label}</p>
              <p className="mt-0.5 text-[9px] text-primary">CREATOR15</p>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2 text-[11px] text-muted-foreground"
        >
          <Users className="h-3.5 w-3.5 text-primary" />
          Every click is tracked through AWIN
        </motion.div>
      </div>
    );
  }

  if (id === "p-earn") {
    return (
      <div className={shell}>
        <div className="flex w-full max-w-[300px] items-end justify-center gap-3">
          {[
            { h: 46, label: "15%", sub: "Day one" },
            { h: 74, label: "20%", sub: "50 orders" },
            { h: 104, label: "25%", sub: "125 orders" },
          ].map((bar, i) => (
            <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: bar.h }}
                transition={{ delay: 0.15 + i * 0.16, duration: 0.5, ease: "easeOut" }}
                className={`flex w-full items-start justify-center rounded-t-md pt-2 ${
                  i === 2 ? "bg-primary" : "bg-[#2d2d2d]"
                }`}
              >
                <span className="font-display text-sm font-bold text-white">{bar.label}</span>
              </motion.div>
              <span className="text-[10px] text-muted-foreground">{bar.sub}</span>
            </div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-[11px] font-medium"
        >
          <Wallet className="h-3.5 w-3.5 text-primary" />
          Commission paid through AWIN
        </motion.div>
      </div>
    );
  }

  return null;
}

function HowItWorks({ onApply }: { onApply: (source: string) => void }) {
  const [audience, setAudience] = useState<"reseller" | "publisher">("reseller");
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const steps = audience === "reseller" ? RESELLER_STEPS : PUBLISHER_STEPS;
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-120px" });

  useEffect(() => {
    if (!inView || paused) return;
    const duration = 6000;
    const started = Date.now();
    const id = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - started) / duration);
      setProgress(ratio);
      if (ratio >= 1) {
        setActive((i) => (i + 1) % steps.length);
        setProgress(0);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [inView, paused, active, steps.length]);

  const switchAudience = useCallback((next: "reseller" | "publisher") => {
    setAudience(next);
    setActive(0);
    setProgress(0);
  }, []);

  return (
    <div ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-white p-1 shadow-sm">
          {(
            [
              ["reseller", "For dropshippers", Package],
              ["publisher", "For publishers", Megaphone],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchAudience(key)}
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-6 ${
                audience === key ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {audience === key && (
                <motion.span
                  layoutId="audience-pill"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <div className="space-y-2">
          {steps.map((step, i) => {
            const isActive = i === active;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setActive(i);
                  setProgress(0);
                }}
                className={`relative block w-full overflow-hidden rounded-xl border px-5 py-4 text-left transition-colors ${
                  isActive
                    ? "border-primary/30 bg-white shadow-[0_10px_36px_rgba(26,26,26,0.07)]"
                    : "border-transparent bg-transparent hover:bg-white/60"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`font-display text-base font-bold tracking-tight ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </p>
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden text-sm leading-relaxed text-muted-foreground"
                        >
                          <span className="block pt-1.5">{step.body}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {isActive && (
                  <span className="absolute bottom-0 left-0 h-[3px] bg-primary" style={{ width: `${progress * 100}%` }} />
                )}
              </button>
            );
          })}

          <div className="pt-4 pl-5">
            <Button onClick={() => onApply(`how_it_works_${audience}`)} className="gap-2">
              {audience === "reseller" ? "Apply as a reseller" : "Apply as a publisher"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-[#faf8f6] sm:aspect-[5/4]">
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "radial-gradient(#e2dbd6 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={steps[active].id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              <StepVisual id={steps[active].id} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── comparison ─────────────────────────────────────────────────── */

const COMPARISON: Array<{ label: string; reseller: string; publisher: string }> = [
  { label: "You are", reseller: "A reseller or dropshipper", publisher: "A creator, blog or deal site" },
  { label: "How you earn", reseller: "Margin between your price and ours", publisher: "AWIN commission on tracked sales" },
  { label: "Your discount", reseller: "10% → 30% off wholesale", publisher: "15% → 25% off for your audience" },
  { label: "Who sells to the customer", reseller: "You do, on your own store", publisher: "We do, through your link" },
  { label: "Who ships", reseller: "We ship direct to your buyer", publisher: "We handle everything" },
  { label: "Inventory needed", reseller: "None", publisher: "None" },
  { label: "Paid through", reseller: "Your own checkout", publisher: "AWIN network payouts" },
];

/* ── faq ────────────────────────────────────────────────────────── */

const RESELLER_FAQ = [
  {
    q: "Who qualifies as a reseller?",
    a: "Any legitimate business reselling products — online stores, brick-and-mortar shops, distributors and dropshippers. You may be asked for a resale certificate or business documentation.",
  },
  {
    q: "How do the wholesale tiers work?",
    a: "Your discount grows with qualifying order volume over a rolling window, from 10% up to 30%. Your personal coupon code updates automatically as you move up — no renegotiation needed.",
  },
  {
    q: "Do I need to hold inventory?",
    a: "No. Place reseller orders in the portal and we pick, pack and ship directly to your customer. You focus on selling; we handle fulfillment.",
  },
  {
    q: "What is the welcome offer?",
    a: "Newly approved resellers get 20% off for their first 72 hours — a head start while your long-term tier builds from real volume.",
  },
  {
    q: "How long does approval take?",
    a: "Most applications are reviewed within one business day. Once approved you receive portal access and your wholesale coupon code by email.",
  },
];

const PUBLISHER_FAQ = [
  {
    q: "How is this different from reselling?",
    a: "Publishers never buy inventory. You promote The Perfect Part with AWIN tracking links and a public discount code. Your audience buys directly from us at a discount, and you earn commission on the sale.",
  },
  {
    q: "What discount does my audience get?",
    a: "Every approved publisher starts at 15%, and that floor never drops. Reach 50 attributed orders for 20%, and 125 for 25%. Your code is reissued when you level up.",
  },
  {
    q: "Who is a good fit?",
    a: "Automotive blogs, YouTube and TikTok creators, newsletters, enthusiast forums and deal sites with an audience that actually buys parts and accessories.",
  },
  {
    q: "How and when do I get paid?",
    a: "Commission is tracked and paid through AWIN on their payment schedule. Your Perfect Part portal shows attributed orders tied to your code so you can see progress toward the next tier.",
  },
  {
    q: "Do I need an AWIN account already?",
    a: "No. If you are not on AWIN yet, we point you to the join flow during onboarding and connect your account to our program once you are approved.",
  },
];

function FaqRow({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 py-5 text-left"
      >
        <span className="font-display text-base font-semibold tracking-tight text-foreground">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
            <p className="max-w-2xl pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

type TrackingWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

function trackEvent(event: string, data: Record<string, unknown> = {}) {
  const trackingWindow = window as TrackingWindow;
  trackingWindow.dataLayer = trackingWindow.dataLayer || [];
  trackingWindow.dataLayer.push({ event, ...data });
}

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#compare", label: "Compare" },
  { href: "#programs", label: "Programs" },
  { href: "#faq", label: "FAQ" },
];

export default function HomePage() {
  const [pathOpen, setPathOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqTab, setFaqTab] = useState<"reseller" | "publisher">("reseller");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reapply") === "1") {
      window.location.href = "/apply/reseller";
      return;
    }
    if (
      params.get("apply") === "1" ||
      window.location.hash === "#choose-path" ||
      window.location.hash === "#apply"
    ) {
      setPathOpen(true);
      trackEvent("wholesale_path_chooser_opened", { source: "deep_link" });
    }
  }, []);

  const openChooser = useCallback((source: string) => {
    setMenuOpen(false);
    setPathOpen(true);
    trackEvent("wholesale_path_chooser_opened", { source });
  }, []);

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "border-b border-border bg-white/90 backdrop-blur-md" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="The Perfect Part">
            <Image
              src="/logo.png"
              alt="The Perfect Part"
              width={838}
              height={150}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Sign In
            </Link>
            <Button onClick={() => openChooser("header")} className="gap-1.5">
              Apply Now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border lg:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border bg-white lg:hidden"
            >
              <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
                {[...NAV, { href: "/login", label: "Sign In" }].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block border-b border-border py-3 text-sm font-medium last:border-0"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-white pt-[72px]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "linear-gradient(#f1ece9 1px, transparent 1px), linear-gradient(90deg, #f1ece9 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, #000 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
        <div className="pointer-events-none absolute -right-40 -top-20 h-[520px] w-[520px] rounded-full bg-primary/[0.06] blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-24">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-border bg-white px-3.5 py-1.5 shadow-sm"
            >
              <BrandGrid className="scale-[0.55]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Partner program
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.06 }}
              className="font-display text-[clamp(2.15rem,5vw,3.6rem)] font-bold leading-[1.06] tracking-[-0.03em] text-foreground"
            >
              Two ways to earn
              <br />
              with <span className="relative whitespace-nowrap text-primary">
                The Perfect Part
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-1 left-0 h-[5px] w-full origin-left rounded-full bg-primary/20"
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Dropship our automotive catalog at wholesale pricing, or promote it
              to your audience and earn commission through AWIN. No inventory
              required either way.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.26 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" onClick={() => openChooser("hero")} className="h-12 gap-2 px-6 text-base">
                Apply Now
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12 grid max-w-lg grid-cols-2 gap-x-6 gap-y-6 border-t border-border pt-8 sm:grid-cols-4"
            >
              {[
                { value: <><Counter to={30} suffix="%" /></>, label: "Top reseller discount" },
                { value: <><Counter to={25} suffix="%" /></>, label: "Top audience discount" },
                { value: <><Counter to={24} suffix="h" /></>, label: "Typical review time" },
                { value: "$0", label: "Inventory required" },
              ].map((stat, i) => (
                <div key={i}>
                  <dt className="font-display text-2xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-[11px] leading-snug text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </motion.dl>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto w-full max-w-md lg:max-w-none"
          >
            <PathsDiagram />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-b border-border bg-[#faf8f6]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <div className="flex justify-center">
              <Eyebrow>How it works</Eyebrow>
            </div>
            <h2 className="font-display text-[clamp(1.9rem,4vw,2.9rem)] font-bold leading-tight tracking-[-0.02em]">
              Pick your side. See exactly what happens.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Two very different businesses, two very different playbooks. Switch
              between them below — each step walks through what you do and what we
              handle.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <HowItWorks onApply={openChooser} />
          </Reveal>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="scroll-mt-20 border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal className="mb-12 max-w-2xl">
            <Eyebrow>Side by side</Eyebrow>
            <h2 className="font-display text-[clamp(1.9rem,4vw,2.9rem)] font-bold leading-tight tracking-[-0.02em]">
              Which program fits you?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Not sure where you land? Here is the honest difference between the
              two paths in plain terms.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-secondary/60 sm:grid-cols-[1.2fr_1fr_1fr]">
              <div className="px-4 py-4 sm:px-6" />
              <div className="flex items-center gap-2 border-l border-border px-4 py-4 sm:px-6">
                <Package className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-display text-sm font-bold tracking-tight sm:text-base">
                  Dropshipper
                </span>
              </div>
              <div className="flex items-center gap-2 border-l border-border px-4 py-4 sm:px-6">
                <Megaphone className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-display text-sm font-bold tracking-tight sm:text-base">
                  Publisher
                </span>
              </div>
            </div>

            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.1fr_1fr_1fr] border-t border-border sm:grid-cols-[1.2fr_1fr_1fr] ${
                  i % 2 === 1 ? "bg-secondary/25" : "bg-white"
                }`}
              >
                <div className="px-4 py-4 text-xs font-medium text-muted-foreground sm:px-6 sm:text-sm">
                  {row.label}
                </div>
                <div className="border-l border-border px-4 py-4 text-xs sm:px-6 sm:text-sm">
                  {row.reseller}
                </div>
                <div className="border-l border-border px-4 py-4 text-xs sm:px-6 sm:text-sm">
                  {row.publisher}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-border bg-white sm:grid-cols-[1.2fr_1fr_1fr]">
              <div className="px-4 py-4 sm:px-6" />
              <div className="border-l border-border px-4 py-4 sm:px-6">
                <Button asChild size="sm" variant="outline" className="w-full gap-1.5">
                  <Link href="/apply/reseller">Apply</Link>
                </Button>
              </div>
              <div className="border-l border-border px-4 py-4 sm:px-6">
                <Button asChild size="sm" variant="outline" className="w-full gap-1.5">
                  <Link href="/apply/publisher">Apply</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="scroll-mt-20 border-b border-border bg-[#faf8f6]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          {/* Reseller */}
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <Eyebrow>Dropshipper program</Eyebrow>
              <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.02em]">
                Wholesale pricing that scales with your volume
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Start at 10% off after approval and climb to 30% as your
                qualifying orders build over a rolling window. Your coupon updates
                automatically — you never have to ask for a better rate.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "20% welcome pricing for your first 72 hours",
                  "Blind shipping straight to your customer",
                  "Portal ordering, reorder history and margin tools",
                  "Coupon locked to your wholesale account only",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => openChooser("reseller_program")} className="mt-8 gap-2">
                Apply as a reseller
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Reveal>

            <Reveal delay={0.1} className="rounded-2xl border border-border bg-white p-6 shadow-[0_16px_50px_rgba(26,26,26,0.06)] sm:p-8">
              <div className="mb-6 flex items-baseline justify-between">
                <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Reseller tiers
                </p>
                <p className="text-[11px] text-muted-foreground">Qualifying orders</p>
              </div>
              <div className="space-y-3.5">
                {[
                  { pct: 10, orders: "5+" },
                  { pct: 15, orders: "25+" },
                  { pct: 20, orders: "50+" },
                  { pct: 25, orders: "100+" },
                  { pct: 30, orders: "200+" },
                ].map((tier, i) => (
                  <div key={tier.pct} className="flex items-center gap-3">
                    <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {tier.orders}
                    </span>
                    <div className="h-9 flex-1 overflow-hidden rounded-md bg-secondary">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(tier.pct / 30) * 100}%` }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ duration: 0.75, delay: 0.1 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                        className={`flex h-full items-center justify-end rounded-md pr-3 ${
                          tier.pct >= 25 ? "bg-primary" : "bg-[#2d2d2d]"
                        }`}
                      >
                        <span className="font-display text-xs font-bold text-white">{tier.pct}% OFF</span>
                      </motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="my-16 h-px bg-border sm:my-20" />

          {/* Publisher */}
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 space-y-4 lg:order-1">
              {[
                { pct: 15, label: "From approval", note: "Your floor — it never drops" },
                { pct: 20, label: "50 attributed orders", note: "New code issued automatically" },
                { pct: 25, label: "125 attributed orders", note: "Top publisher tier" },
              ].map((tier, i) => (
                <motion.div
                  key={tier.pct}
                  initial={{ opacity: 0, x: -18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: i * 0.12 }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-white px-5 py-4"
                >
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold ${
                      i === 2 ? "bg-primary text-white" : "bg-[#2d2d2d] text-white"
                    }`}
                  >
                    {tier.pct}%
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold tracking-tight">{tier.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tier.note}</p>
                  </div>
                </motion.div>
              ))}
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                Attribution runs on a 14-day window from your publisher coupon.
                Commission is separate and paid by AWIN.
              </p>
            </Reveal>

            <Reveal delay={0.08} className="order-1 lg:order-2">
              <Eyebrow>Publisher program</Eyebrow>
              <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.02em]">
                Your audience saves. You earn on every order.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Join through AWIN, get a public discount code and tracking links,
                then share them wherever your audience already listens to you.
                We handle checkout, fulfillment and support.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  { icon: Tag, text: "Public code that works at checkout for anyone" },
                  { icon: Link2, text: "AWIN tracking links for any product page" },
                  { icon: Users, text: "Built for blogs, creators, newsletters and deal sites" },
                  { icon: Wallet, text: "Attributed order tracking inside your portal" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex gap-3 text-sm">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground/85">{text}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => openChooser("publisher_program")} className="mt-8 gap-2">
                Apply as a publisher
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <div className="flex justify-center">
              <Eyebrow>Why partners stay</Eyebrow>
            </div>
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.02em]">
              Real parts, real margins, no guesswork
            </h2>
          </Reveal>

          <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                icon: Tag,
                title: "Clean separation",
                body: "Reseller coupons only work on approved wholesale accounts. Publisher codes stay public. The two never bleed into each other.",
              },
              {
                icon: Truck,
                title: "Fulfillment handled",
                body: "We pick, pack and ship from our own inventory so you can scale sales without touching a single box.",
              },
              {
                icon: Users,
                title: "Transparent progress",
                body: "Your dashboard shows current tier, attributed volume and exactly how many orders remain before the next unlock.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-bold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-b border-border bg-[#faf8f6]">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal className="mb-8 text-center">
            <div className="flex justify-center">
              <Eyebrow>FAQ</Eyebrow>
            </div>
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.02em]">
              Questions, answered
            </h2>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="mb-6 flex justify-center gap-2">
              {(
                [
                  ["reseller", "Dropshippers"],
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
                      : "border border-border bg-white text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-white px-5 sm:px-7">
              {(faqTab === "reseller" ? RESELLER_FAQ : PUBLISHER_FAQ).map((item, i) => (
                <FaqRow key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-[#1a1a1a]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 70% 80% at 50% 40%, #000 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 50% 40%, #000 20%, transparent 85%)",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-primary/25 blur-[130px]" />

        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-bold leading-tight tracking-[-0.025em] text-white">
              Ready to start earning?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/60">
              Choose dropshipper or publisher — the application takes about two
              minutes, and most partners hear back within one business day.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => openChooser("footer_cta")} className="h-12 gap-2 px-8 text-base">
                Apply Now
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 border-white/25 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">Partner sign in</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center gap-6 border-b border-border pb-8 sm:flex-row sm:justify-between">
            <Image
              src="/logo.png"
              alt="The Perfect Part"
              width={838}
              height={150}
              className="h-8 w-auto"
            />
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {[
                { href: "#how-it-works", label: "How it works" },
                { href: "#compare", label: "Compare" },
                { href: "#faq", label: "FAQ" },
                { href: "/terms/publisher", label: "Publisher terms" },
                { href: "/login", label: "Sign in" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} The Perfect Part. All rights reserved.</p>
            <a
              href="https://theperfectpart.net"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              Visit the store
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>

      <PartnerPathDialog open={pathOpen} onOpenChange={setPathOpen} />
    </div>
  );
}
