"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Headphones,
  Send,
  Loader2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Flame,
  HelpCircle,
} from "lucide-react";

const CATEGORIES = [
  { value: "order_issue", label: "Order Issue" },
  { value: "tier_question", label: "Tier / Discount Question" },
  { value: "promo_code", label: "Promo Code Not Working" },
  { value: "document_upload", label: "Document Upload Issue" },
  { value: "account_access", label: "Account Access" },
  { value: "billing", label: "Billing / Invoice" },
  { value: "shipping", label: "Shipping Question" },
  { value: "general", label: "General Inquiry" },
  { value: "other", label: "Other" },
];

const URGENCY_LEVELS = [
  {
    value: "low",
    label: "Low",
    description: "General question, no rush",
    icon: <HelpCircle className="h-4 w-4" />,
    color: "text-success border-success/30 bg-success-light/30",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Needs attention within a day",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-warning border-warning/30 bg-warning-light/30",
  },
  {
    value: "high",
    label: "High",
    description: "Urgent, affecting my business",
    icon: <AlertCircle className="h-4 w-4" />,
    color: "text-orange-600 border-orange-300 bg-orange-50",
  },
  {
    value: "critical",
    label: "Critical",
    description: "Order/account blocked, need help now",
    icon: <Flame className="h-4 w-4" />,
    color: "text-danger border-danger/30 bg-danger-light/30",
  },
];

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [urgency, setUrgency] = useState("low");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!subject.trim()) { toast.error("Please enter a subject"); return; }
    if (!message.trim()) { toast.error("Please enter your message"); return; }

    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, urgency, category }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to send");
      }

      setSent(true);
      toast.success("Message sent to support");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            Support
          </h1>
        </div>
        <Card className="border-success/30 bg-success-light/20">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </div>
            <h2 className="text-xl font-bold">Message Sent</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your support request has been sent to The Perfect Part wholesale team.
              We&apos;ll respond to your email as soon as possible.
            </p>
            <Button onClick={() => { setSent(false); setSubject(""); setMessage(""); setCategory("general"); setUrgency("low"); }} variant="outline">
              Send Another Message
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Headphones className="h-6 w-6 text-primary" />
          Support
        </h1>
        <p className="text-muted-foreground mt-1">
          Need help? Send us a message and we&apos;ll get back to you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Support</CardTitle>
          <CardDescription>
            Your account details will be automatically included with your message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Urgency Selection */}
            <div className="space-y-2">
              <Label>Urgency</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {URGENCY_LEVELS.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUrgency(u.value)}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      urgency === u.value
                        ? `${u.color} ring-2 ring-offset-1 ring-current`
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {u.icon}
                      <span className="text-xs font-semibold">{u.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{u.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description of your issue"
                maxLength={200}
                required
              />
              <p className="text-xs text-muted-foreground">{subject.length}/200</p>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message <span className="text-destructive">*</span></Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue in detail. Include order numbers, screenshots, or any relevant information..."
                rows={6}
                maxLength={5000}
                required
              />
              <p className="text-xs text-muted-foreground">{message.length}/5,000</p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Your account info, tier, and company details are sent automatically.
              </p>
              <Button type="submit" disabled={sending}>
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Message</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-5 pb-4">
          <p className="text-sm font-medium mb-2">What happens next?</p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Your message is emailed directly to our wholesale support team.</li>
            <li>We typically respond within 1 business day (sooner for urgent issues).</li>
            <li>We&apos;ll reply to the email address associated with your account.</li>
            <li>For order-specific issues, please include the order number in your message.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
