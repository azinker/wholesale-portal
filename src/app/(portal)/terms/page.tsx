import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";
import { PublisherTermsOfServiceContent, TermsOfServiceContent } from "@/components/terms-of-service";

export default async function TermsPage() {
  const user = await getUser();
  if (!user) redirect("/");
  const publisher = user.wholesaleAccount?.partnerType === "AFFILIATE_PUBLISHER";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          Terms of Service
        </h1>
        <p className="text-muted-foreground mt-1">
          The {publisher ? "Affiliate Publisher" : "Wholesale"} Program Terms you agreed to when applying.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            {publisher ? "Affiliate Publisher Program Terms" : "Wholesale Program Terms of Service"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {publisher ? <PublisherTermsOfServiceContent /> : <TermsOfServiceContent />}
        </CardContent>
      </Card>
    </div>
  );
}
