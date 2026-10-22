import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ReviewLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const invalid = params.error === "invalid";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3f1] px-5 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <Image src="/logo.png" alt="The Perfect Part" width={160} height={40} priority className="h-8 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-[#1a1a1a]">Review sign-in</h1>
        <p className="mt-2 text-sm leading-6 text-[#5c5654]">
          This sign-in is only for the Shopify app review account.
        </p>
        {invalid && (
          <p className="mt-4 rounded-xl bg-[#fde8e8] px-4 py-3 text-sm text-[#9f1d24]">
            That email or password did not match.
          </p>
        )}
        <form action="/api/auth/review-login" method="POST" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
          </div>
          <Button type="submit" className="h-11 w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
