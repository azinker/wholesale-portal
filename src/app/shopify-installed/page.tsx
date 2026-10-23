import Image from "next/image";
import Link from "next/link";

export default function ShopifyInstalledPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3f1] px-5 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <Image src="/logo.png" alt="The Perfect Part" width={160} height={40} priority className="h-8 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-[#1a1a1a]">The Perfect Part Wholesale</h1>
        <p className="mt-2 text-sm leading-6 text-[#5c5654]">
          The app is installed on your Shopify store. Sign in to the wholesale portal to finish connecting it,
          add products, and see orders.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#B8282E] text-sm font-medium text-white"
        >
          Sign in to the wholesale portal
        </Link>
      </div>
    </main>
  );
}
