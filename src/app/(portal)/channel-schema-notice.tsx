import { Card, CardContent } from "@/components/ui/card";

export function ChannelSchemaNotice() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm">
        The Shopify channel tables are not in the database this app is using, so the preview cannot load orders yet.
      </CardContent>
    </Card>
  );
}
