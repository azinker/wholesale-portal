import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "./tip";

export const channelPrimaryBtn =
  "inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#9c2126] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8282E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";

export const channelGhostBtn =
  "inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#e4ddd9] bg-white px-4 py-2.5 text-sm font-medium text-[#1a1a1a] transition-colors duration-200 hover:border-[#2d2d2d] hover:bg-[#faf7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8282E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";

export const channelField =
  "w-full rounded-xl border border-[#e4ddd9] bg-white px-3 py-2.5 text-sm text-[#1a1a1a] outline-none transition-colors duration-200 placeholder:text-[#8a8481] focus:border-[#2d2d2d] focus:ring-2 focus:ring-[#B8282E]/20";

export function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

const STATUS_LABEL: Record<string, string> = {
  HELD: "Waiting",
  QUEUED: "Ready to charge",
  NEEDS_ATTENTION: "Needs a look",
  CHARGED: "Charged",
  SUBMITTED: "Getting ready",
  PICKING: "Packing",
  SHIPPED: "Shipped",
  FAILED: "Needs a look",
  REFUNDED: "Refunded",
};

const ATTENTION_LABEL: Record<string, string> = {
  store_paused: "This store is paused, so we didn't charge this order.",
  incomplete_address: "The shipping address needs a street and a country.",
  needs_retest: "We need to confirm this store's shipping address again.",
  missing_phone: "Orders outside the US need a phone number.",
  out_of_stock: "We didn't have enough in stock, so we didn't charge you.",
  card_missing: "Save a card on Billing so we can charge this order.",
  card_declined: "The card was declined. Update it on Billing and we'll try again.",
  warehouse_create_failed: "We refunded the charge because we couldn't start the shipment.",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] || status.replaceAll("_", " ").toLowerCase();
}

export function attentionLabel(note: string | null | undefined): string {
  if (!note) return "";
  return ATTENTION_LABEL[note] || note.replaceAll("_", " ");
}

export function ChannelPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-6 min-h-full bg-[#f6f3f1] p-6 pt-20 md:-m-8 md:p-8 md:pt-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-6">{children}</div>
    </div>
  );
}

export function ChannelHeading({
  kicker,
  title,
  lede,
  children,
}: {
  kicker?: string;
  title: string;
  lede: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="channel-in flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {kicker && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{kicker}</p>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[#1a1a1a]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#5c5654]">{lede}</p>
      </div>
      {children}
    </div>
  );
}

export function ChannelPanel({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn(
        "channel-in rounded-2xl border border-[#e7e1de] bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

export function SetupTrack({
  steps,
  compact = false,
}: {
  steps: Array<{ title: string; detail: string; done: boolean; href: string; tip: string }>;
  compact?: boolean;
}) {
  const doneCount = steps.filter((step) => step.done).length;
  return (
    <div className="space-y-3">
      {!compact && (
        <>
          <div className="flex items-center justify-between text-xs font-medium text-[#5c5654]">
            <span className="inline-flex items-center gap-1.5">
              Setup
              <Tip text="These three steps turn on Add. When they are done, this row stays small." />
            </span>
            <span>
              {doneCount} of {steps.length} done
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e1de]">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </>
      )}
      <ol className="grid gap-3 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="channel-in" style={{ animationDelay: `${index * 70}ms` }}>
            <div
              className={cn(
                "flex h-full items-center gap-3 rounded-2xl border bg-white shadow-sm",
                compact ? "px-3 py-2.5" : "p-4",
                step.done ? "border-emerald-200" : "border-[#e7e1de]"
              )}
            >
              <a href={step.href} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    compact ? "h-7 w-7" : "h-9 w-9",
                    step.done ? "bg-emerald-600 text-white" : "bg-[#2d2d2d] text-white"
                  )}
                >
                  {step.done ? <Check size={compact ? 14 : 16} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#1a1a1a]">{step.title}</span>
                  {!compact && <span className="block text-xs leading-5 text-[#5c5654]">{step.detail}</span>}
                </span>
              </a>
              <Tip text={step.tip} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "good" | "wait" | "bad" | "neutral"; children: React.ReactNode }) {
  const tones = {
    good: "bg-emerald-50 text-emerald-800",
    wait: "bg-amber-50 text-amber-800",
    bad: "bg-red-50 text-red-800",
    neutral: "bg-[#f3eeeb] text-[#3f3a38]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}
