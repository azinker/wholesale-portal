import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { PublisherTermsOfServiceContent } from "@/components/terms-of-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Affiliate Publisher Program Terms | The Perfect Part",
};

export default function PublisherTermsPage() {
  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-5">
        <Button variant="ghost" asChild><Link href="/apply/publisher"><ArrowLeft className="h-4 w-4" /> Back to publisher application</Link></Button>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-primary" /> Affiliate Publisher Program Terms</CardTitle></CardHeader>
          <CardContent><PublisherTermsOfServiceContent /></CardContent>
        </Card>
      </div>
    </main>
  );
}
