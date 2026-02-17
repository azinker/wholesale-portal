import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

export default async function AnnouncementsPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const announcements = await db.announcement.findMany({
    where: {
      published: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const priorityBorder: Record<string, string> = {
    urgent: "border-l-4 border-l-red-500",
    important: "border-l-4 border-l-yellow-500",
    normal: "border-l-4 border-l-primary/30",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Announcements
        </h1>
        <p className="text-muted-foreground mt-1">
          Latest news and updates from The Perfect Part.
        </p>
      </div>

      {announcements.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No announcements at this time.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {announcements.map((a) => (
          <Card key={a.id} className={priorityBorder[a.priority] || ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{a.title}</h3>
                {a.priority === "urgent" && (
                  <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                )}
                {a.priority === "important" && (
                  <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">Important</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {a.body}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                {a.publishedAt
                  ? new Date(a.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : new Date(a.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
