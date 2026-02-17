import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, body: content, priority, published, expiresAt } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  const announcement = await db.announcement.create({
    data: {
      title,
      body: content,
      priority: priority || "normal",
      published: published ?? false,
      publishedAt: published ? new Date() : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      authorEmail: user.email,
    },
  });

  return NextResponse.json({ announcement });
}
