import type { Metadata } from "next";

const title = "Wholesale Products for Resellers | The Perfect Part";
const description =
  "Apply for wholesale pricing from The Perfect Part. Exclusive tiered discounts up to 30% off, drop-ship fulfillment, tax-free purchasing, personal coupon codes, and a dedicated partner portal. Get your welcome bonus today.";
const url = "https://wholesale.theperfectpart.net/apply";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "wholesale products for resale",
    "bulk wholesale supplier",
    "wholesale drop shipping",
    "reseller wholesale program",
    "wholesale supplier USA",
    "wholesale program for businesses",
    "The Perfect Part wholesale",
    "wholesale distributor",
    "reseller program with portal",
    "wholesale discount program",
  ],
  openGraph: {
    title,
    description,
    url,
    siteName: "The Perfect Part",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://wholesale.theperfectpart.net/og-apply.png",
        width: 1200,
        height: 630,
        alt: "The Perfect Part — Wholesale Program for Resellers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["https://wholesale.theperfectpart.net/og-apply.png"],
  },
  alternates: { canonical: url },
  robots: { index: true, follow: true },
};

const faqItems = [
  {
    question: "What types of businesses qualify for wholesale pricing?",
    answer:
      "Any legitimate business engaged in the resale of products can apply. This includes online retailers, brick-and-mortar shops, resellers, distributors, and more. You may be asked to provide a resale certificate or business documentation.",
  },
  {
    question: "How does the tiered pricing work?",
    answer:
      "Our wholesale program uses a tiered discount structure based on your order volume over a rolling evaluation window. As your qualifying orders grow, your discount percentage increases automatically. You receive a personal coupon code that reflects your current tier.",
  },
  {
    question: "Is there a minimum order requirement?",
    answer:
      "There is no minimum order requirement to get started. Simply place orders using your unique coupon code and your tier will grow naturally with your volume.",
  },
  {
    question: "How does drop shipping work with The Perfect Part?",
    answer:
      "When your customer places an order, you forward it to us through the portal. We pick, pack, and ship the product directly to your customer — no inventory needed on your end. This lets you focus on sales while we handle fulfillment.",
  },
  {
    question: "How long does the approval process take?",
    answer:
      "Most applications are reviewed within 24 hours during business days. Once approved, you will receive an email with your portal login credentials and unique wholesale coupon code.",
  },
  {
    question: "What is the welcome bonus?",
    answer:
      "Newly approved wholesale partners receive an exclusive welcome discount that applies to orders placed during your initial onboarding period. The exact discount and duration are provided upon approval.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "The Perfect Part",
      url: "https://theperfectpart.net",
      logo: "https://wholesale.theperfectpart.net/logo.png",
      description:
        "Wholesale distributor offering tiered pricing up to 30% off, drop-ship fulfillment, tax-free purchasing, and a dedicated reseller portal.",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        url: "https://wholesale.theperfectpart.net/apply",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    {
      "@type": "WebPage",
      name: title,
      description,
      url,
      isPartOf: {
        "@type": "WebSite",
        name: "The Perfect Part Wholesale Portal",
        url: "https://wholesale.theperfectpart.net",
      },
      potentialAction: {
        "@type": "Action",
        name: "Apply for Wholesale Account",
        target: url,
      },
    },
  ],
};

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
