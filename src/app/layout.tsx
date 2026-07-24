import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reseller & Affiliate Partner Programs | The Perfect Part",
  description:
    "Join The Perfect Part as a wholesale reseller or affiliate publisher. Access tiered reseller pricing or earn AWIN commission while sharing 15–25% audience discounts.",
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
    "affiliate publisher program",
    "AWIN affiliate publisher",
    "publisher discount codes",
  ],
  openGraph: {
    title: "Reseller & Affiliate Partner Programs | The Perfect Part",
    description:
      "Resell with wholesale pricing or promote to your audience with AWIN commission and 15–25% public discount codes.",
    url: "https://wholesale.theperfectpart.net",
    siteName: "The Perfect Part",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://wholesale.theperfectpart.net/og-apply.png",
        width: 1200,
        height: 630,
        alt: "The Perfect Part reseller and affiliate publisher programs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reseller & Affiliate Partner Programs | The Perfect Part",
    description:
      "Resell with wholesale pricing or promote with AWIN commission and audience discount codes.",
    images: ["https://wholesale.theperfectpart.net/og-apply.png"],
  },
  alternates: { canonical: "https://wholesale.theperfectpart.net" },
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
        "Partner programs for wholesale resellers and affiliate publishers using AWIN.",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        url: "https://wholesale.theperfectpart.net",
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
      name: "Reseller & Affiliate Partner Programs | The Perfect Part",
      description:
        "Apply as a wholesale reseller or affiliate publisher with The Perfect Part.",
      url: "https://wholesale.theperfectpart.net",
      isPartOf: {
        "@type": "WebSite",
        name: "The Perfect Part Partner Portal",
        url: "https://wholesale.theperfectpart.net",
      },
      potentialAction: {
        "@type": "Action",
        name: "Choose a Partner Program",
        target: "https://wholesale.theperfectpart.net/?apply=1",
      },
    },
  ],
};

const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <head>
        {gtmId ? (
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
        ) : null}
      </head>
      <body className="min-h-screen bg-background antialiased font-sans">
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
