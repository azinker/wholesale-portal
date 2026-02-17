"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

/** Get initials from a company name (first letter of first two words) */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function AvatarUploader({
  userEmail,
  companyName,
  currentAvatarUrl,
}: {
  userEmail: string;
  companyName?: string | null;
  currentAvatarUrl: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fallbackText = companyName ? getInitials(companyName) : userEmail.slice(0, 2).toUpperCase();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 2MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Upload failed");
      }

      // Fetch the new signed URL
      const urlRes = await fetch("/api/profile/avatar");
      const urlData = await urlRes.json();
      setAvatarUrl(urlData.url);

      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative group flex flex-col items-center gap-2">
        <Avatar className="h-20 w-20 border-2 border-border">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={companyName || userEmail} />}
          <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
            {fallbackText}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full h-20 w-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {/* Show company name below avatar */}
        {companyName && (
          <p className="text-xs font-semibold text-foreground text-center max-w-[120px] truncate">
            {companyName}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="h-4 w-4 mr-1" />
          {avatarUrl ? "Change Photo" : "Upload Photo"}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG, PNG or WebP. Max 2MB.
        </p>
      </div>
    </div>
  );
}
