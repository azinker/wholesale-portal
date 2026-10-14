"use client";

import { SHOPIFY_GUIDE } from "../guides/shopify-guide";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ShopifyGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#9c2126] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8282E] focus-visible:ring-offset-2">
        Help Guide Me
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{SHOPIFY_GUIDE.title}</DialogTitle>
          <DialogDescription>{SHOPIFY_GUIDE.intro}</DialogDescription>
        </DialogHeader>
        <video
          controls
          playsInline
          preload="metadata"
          className="mt-4 aspect-video w-full rounded-xl bg-[#1a1a1a]"
          src={SHOPIFY_GUIDE.video}
        />
        <ol className="mt-4 space-y-3">
          {SHOPIFY_GUIDE.steps.map((step, index) => (
            <li key={step.text} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {index + 1}
              </span>
              <p className="min-w-0 pt-0.5 text-sm leading-6 text-[#3f3a38]">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl bg-[#f6f3f1] px-4 py-4">
          <p className="text-sm font-semibold text-[#1a1a1a]">Good to know</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#5c5654]">
            {SHOPIFY_GUIDE.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
