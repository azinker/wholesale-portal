"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus, Trash2, Loader2, Mail, Shield, ShoppingBag, Eye } from "lucide-react";

interface TeamMemberData {
  id: string;
  role: string;
  invitedBy: string;
  invitedAt: string;
  acceptedAt: string | null;
  user: {
    id: string;
    email: string;
    avatarKey: string | null;
  };
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  OWNER: { label: "Owner", icon: <Shield className="h-3 w-3" />, color: "text-primary" },
  ADMIN: { label: "Admin", icon: <Shield className="h-3 w-3" />, color: "text-blue-600" },
  PURCHASER: { label: "Purchaser", icon: <ShoppingBag className="h-3 w-3" />, color: "text-green-600" },
  VIEWER: { label: "Viewer", icon: <Eye className="h-3 w-3" />, color: "text-muted-foreground" },
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setError("");

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to invite");
      } else {
        setInviteEmail("");
        setShowInvite(false);
        await fetchMembers();
      }
    } catch {
      setError("Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    await fetch(`/api/team/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await fetchMembers();
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Remove this team member?")) return;
    await fetch(`/api/team/${memberId}`, { method: "DELETE" });
    await fetchMembers();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Team
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your wholesale team members and their access levels.
          </p>
        </div>
        {!showInvite && (
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite Team Member</CardTitle>
            <CardDescription>
              Send a magic-link invitation to a new team member.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="team@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="PURCHASER">Purchaser</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role descriptions */}
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded-md p-3">
              <p><strong>Admin:</strong> Full access except removing the owner.</p>
              <p><strong>Purchaser:</strong> Can browse products, place orders, and view tracking.</p>
              <p><strong>Viewer:</strong> Read-only access to dashboard, orders, and insights.</p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                {inviting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Send Invite
              </Button>
              <Button variant="outline" onClick={() => { setShowInvite(false); setError(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No team members yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              You are the account owner. Invite team members to collaborate.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {members.map((m) => {
                const config = ROLE_CONFIG[m.role] || ROLE_CONFIG.VIEWER;
                const initials = m.user.email.substring(0, 2).toUpperCase();

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-muted">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{m.user.email}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={config.color}>{config.icon}</span>
                          <span className={`text-xs ${config.color}`}>{config.label}</span>
                          {!m.acceptedAt && (
                            <Badge variant="outline" className="text-[9px] ml-1">Pending</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {m.role !== "OWNER" && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={m.role}
                          onValueChange={(val) => handleRoleChange(m.id, val)}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="PURCHASER">Purchaser</SelectItem>
                            <SelectItem value="VIEWER">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(m.id)}
                          className="h-8 px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
