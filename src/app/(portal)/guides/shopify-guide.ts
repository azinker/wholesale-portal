import { SHOPIFY_CONNECT_MAINTENANCE } from "@/lib/shopify-channel/constants";

export const SHOPIFY_GUIDE = {
  kicker: "Shopify",
  title: "Connect your Shopify store",
  intro: "Your customer pays you on your store. We charge your card, then ship the order to them.",
  video: "/guides/shopify-connection.mp4",
  href: "/my-shopify",
  action: "Open Shopify",
  steps: [
    { text: "On this dashboard, open Shopify in the menu." },
    { text: "Accept the terms. An owner or an admin does this once." },
    { text: "Open Billing and save a card. This is the card we charge when your customer pays you." },
    { text: "Store credit is used first. Your card pays the rest. We charge your wholesale price, not the price your customer paid you." },
    { text: SHOPIFY_CONNECT_MAINTENANCE
      ? "Connecting a store is under maintenance. The connect box on My Shopify will come back when it is fixed. You do not need to try again right now."
      : "Type your store address. It ends in .myshopify.com. Pasting the full link is fine. Shopify asks you to approve it. After you approve, the store is connected. You can connect up to 5 stores. Each store needs to use US dollars." },
    { text: "Open Catalog. Pick a product. Add it to Shopify. You choose the price your customer pays. We update how many are in stock. We do not change your price." },
    { text: "When a customer pays on your Shopify store, the order shows under Orders. We ship to the address they entered. It usually goes out within 1 business day. Weekends and USPS holidays are not shipping days. Tracking shows when it ships." },
    { text: "Shipping in the US is free, including PO Boxes, Alaska, and Hawaii. Outside the US, including Canada, shipping is $18.99 once per order. There is no tax." },
  ],
  notes: [
    "If a product is out of stock, we email you. We do not charge your card, and we do not ship that sale later. Refund your customer in Shopify.",
    "If you pause the store, customers can still buy on Shopify. We do not charge your card and we do not ship those sales. You handle them. When you resume, only new sales are charged and shipped.",
    "After we charge the card, changing the order in Shopify does not change what we ship. For an address change, open Support.",
    "If we refund our charge, that money goes back to your card. It does not refund the customer who paid you on Shopify. Refund them in Shopify if they need their money back.",
    "You can put your own product code on Shopify. We match the product you added.",
    "Export listings is a spreadsheet. It does not connect your store. Those sales are still placed on theperfectpart.net with your dashboard email and coupon.",
  ],
};
