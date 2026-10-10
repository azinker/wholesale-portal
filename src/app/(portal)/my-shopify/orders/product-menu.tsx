"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { channelGhostBtn, channelPrimaryBtn } from "../../channel-ui";

export type ProductLink = {
  title: string;
  catalogHref: string;
  ordersHref: string;
  storeHref: string | null;
  adminHref: string | null;
};

export function ProductMenu({ label, products }: { label: string; products: ProductLink[] }) {
  const [open, setOpen] = useState(false);
  if (products.length === 0) return <span>{label}</span>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer text-left hover:underline">
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{products.length === 1 ? products[0].title : "Products on this order"}</DialogTitle>
            <DialogDescription>Pick where to open {products.length === 1 ? "this product" : "each product"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {products.map((product) => (
              <div key={`${product.title}-${product.catalogHref}`} className="space-y-2">
                {products.length > 1 && <p className="text-sm font-semibold text-[#1a1a1a]">{product.title}</p>}
                {product.storeHref && (
                  <a className={`${channelPrimaryBtn} w-full`} href={product.storeHref} target="_blank" rel="noreferrer">
                    View on your Shopify store
                  </a>
                )}
                {product.adminHref && (
                  <a className={`${channelGhostBtn} w-full`} href={product.adminHref} target="_blank" rel="noreferrer">
                    Edit in Shopify
                  </a>
                )}
                <Link className={`${channelGhostBtn} w-full`} href={product.catalogHref} onClick={() => setOpen(false)}>
                  View in catalog
                </Link>
                <Link className={`${channelGhostBtn} w-full`} href={product.ordersHref} onClick={() => setOpen(false)}>
                  Orders for this product
                </Link>
                <p className="text-xs leading-5 text-[#5c5654]">
                  The store link is what your customer sees. Edit in Shopify changes the price on your store. Catalog is our product, cost, and stock.
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
