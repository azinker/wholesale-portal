"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Megaphone, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: string;
  published: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  authorEmail: string;
  createdAt: string;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [published, setPublished] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/admin/announcements");
      if (!res.ok) {
        setError(`Failed to load announcements (${res.status})`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAnnouncements(data.announcements || []);
      setError("");
    } catch {
      setError("Failed to load announcements");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setPriority("normal");
    setPublished(false);
    setExpiresAt("");
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (a: Announcement) => {
    setTitle(a.title);
    setBody(a.body);
    setPriority(a.priority);
    setPublished(a.published);
    setExpiresAt(a.expiresAt ? a.expiresAt.split("T")[0] : "");
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title || !body) return;
    setSaving(true);
    setError("");

    const payload = { title, body, priority, published, expiresAt: expiresAt || null };

    try {
      const res = editingId
        ? await fetch(`/api/admin/announcements/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to save (${res.status})`);
        setSaving(false);
        return;
      }

      await fetchAnnouncements();
      resetForm();
    } catch {
      setError("Failed to save announcement");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    await fetchAnnouncements();
  };

  const priorityColors: Record<string, string> = {
    urgent: "border-red-500 bg-red-50 dark:bg-red-950/20",
    important: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
    normal: "",
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Announcements
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage announcements visible to wholesale customers.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit Announcement" : "Create Announcement"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Announcement content..." rows={4} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expires At (optional)</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Published</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Switch checked={published} onCheckedChange={setPublished} />
                  <span className="text-sm text-muted-foreground">
                    {published ? "Visible to customers" : "Draft"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || !title || !body}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No announcements yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className={priorityColors[a.priority] || ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{a.title}</h3>
                      <Badge variant={a.published ? "default" : "secondary"} className="text-[10px]">
                        {a.published ? "Published" : "Draft"}
                      </Badge>
                      {a.priority !== "normal" && (
                        <Badge
                          variant={a.priority === "urgent" ? "destructive" : "outline"}
                          className="text-[10px]"
                        >
                          {a.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {a.body}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      By {a.authorEmail} &middot; {new Date(a.createdAt).toLocaleDateString()}
                      {a.expiresAt && ` · Expires ${new Date(a.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
