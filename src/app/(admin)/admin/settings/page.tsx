"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Settings, Plug, Webhook, Layers, Loader2, CheckCircle, XCircle, Plus, Trash2, Save, RefreshCw, Gift } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure BigCommerce connection, webhooks, and tier settings.
        </p>
      </div>

      <BigCommerceConnectionCard />
      <WebhookRegistrationCard />
      <TierSettingsCard />
      <WelcomeDiscountCard />
    </div>
  );
}

function BigCommerceConnectionCard() {
  const [result, setResult] = useState<{
    success?: boolean;
    store?: { name: string; domain: string; plan: string };
    target?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/bc-test");
      const data = await res.json();
      setResult(data);
      if (data.success) toast.success("Connected to BigCommerce");
      else toast.error("Connection failed");
    } catch {
      setResult({ success: false, error: "Request failed" });
      toast.error("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          BigCommerce Connection
        </CardTitle>
        <CardDescription>Test the API connection to your BigCommerce store.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testConnection} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Test Connection
        </Button>

        {result && (
          <div className={`rounded-lg border p-4 text-sm ${result.success ? "border-success/30 bg-success-light/50" : "border-danger/30 bg-danger-light/50"}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
              <span className="font-medium">{result.success ? "Connected" : "Failed"}</span>
            </div>
            {result.success && result.store && (
              <div className="space-y-1 text-muted-foreground">
                <p>Store: <strong className="text-foreground">{result.store.name}</strong></p>
                <p>Domain: {result.store.domain}</p>
                <p>Plan: {result.store.plan}</p>
                <p>Target: <Badge variant="outline" className="text-[10px] ml-1">{result.target}</Badge></p>
              </div>
            )}
            {result.error && <p className="text-danger">{result.error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookRegistrationCard() {
  const [destination, setDestination] = useState("");
  const [results, setResults] = useState<{ scope: string; status: string; error?: string }[] | null>(null);
  const [loading, setLoading] = useState(false);

  const registerWebhooks = async () => {
    if (!destination) return;
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      });
      const data = await res.json();
      setResults(data.results || []);
      const created = (data.results || []).filter((r: { status: string }) => r.status === "created").length;
      toast.success(`${created} webhooks registered`);
    } catch {
      toast.error("Failed to register webhooks");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          Webhook Registration
        </CardTitle>
        <CardDescription>
          Register BigCommerce webhooks. For local testing, use your ngrok URL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="url"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="https://wholesale.theperfectpart.net/api/webhooks/bigcommerce"
            className="flex-1"
          />
          <Button onClick={registerWebhooks} disabled={loading || !destination}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
            Register
          </Button>
        </div>

        {results && (
          <div className="space-y-1">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg ${
                r.status === "created" ? "bg-success-light/50" : "bg-danger-light/50"
              }`}>
                <code className="text-xs">{r.scope}</code>
                <Badge variant={r.status === "created" ? "default" : "destructive"} className="text-[10px]">
                  {r.status === "created" ? "Registered" : r.error}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Row-level editing state — each row has a stable key */
interface TierRow {
  key: number;       // stable unique key for React
  minOrders: string; // string for controlled input (avoid cursor jumps)
  discount: string;  // string for controlled input
}

let _nextKey = 1;
function nextKey() { return _nextKey++; }

/** Convert server tiers to editable rows */
function toRows(tiers: { minOrders: number; discount: number }[]): TierRow[] {
  return tiers.map((t) => ({
    key: nextKey(),
    minOrders: String(t.minOrders),
    discount: String(t.discount),
  }));
}

/** Convert rows back to the API shape (sorted by minOrders, ids generated) */
function fromRows(rows: TierRow[]) {
  return rows
    .map((r) => {
      const discount = Number(r.discount) || 0;
      const minOrders = Number(r.minOrders) || 0;
      return {
        id: `T${discount}`,
        label: `${discount}% Off`,
        minOrders,
        discount,
      };
    })
    .sort((a, b) => a.minOrders - b.minOrders);
}

function TierSettingsCard() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [windowDays, setWindowDays] = useState("7");
  const [savedJson, setSavedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTiers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tier-config");
      if (res.ok) {
        const data = await res.json();
        const initial = toRows(data.tiers || []);
        const initialWindowDays = String(data.windowDays ?? 7);
        setRows(initial);
        setWindowDays(initialWindowDays);
        setSavedJson(
          JSON.stringify({
            tiers: fromRows(initial),
            windowDays: initialWindowDays,
          })
        );
      }
    } catch {
      toast.error("Failed to load tier configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const currentJson = JSON.stringify({
    tiers: fromRows(rows),
    windowDays,
  });
  const hasChanges = currentJson !== savedJson;
  const windowDaysNum = Number(windowDays);
  const windowLabel = Number.isFinite(windowDaysNum) && windowDaysNum > 0
    ? `${Math.floor(windowDaysNum)} day${Math.floor(windowDaysNum) === 1 ? "" : "s"}`
    : "rolling window";

  function updateRow(key: number, field: "minOrders" | "discount", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey(), minOrders: "", discount: "" },
    ]);
  }

  function removeRow(key: number) {
    if (rows.length <= 1) {
      toast.error("At least one tier is required.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleSave() {
    const tiers = fromRows(rows);
    const parsedWindowDays = Number(windowDays);

    if (!Number.isInteger(parsedWindowDays) || parsedWindowDays < 1 || parsedWindowDays > 365) {
      toast.error("Rolling window must be a whole number between 1 and 365 days.");
      return;
    }

    // Validate
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t.discount <= 0 || t.discount > 100) {
        toast.error(`Tier ${i + 1}: Discount must be between 1% and 100%.`);
        return;
      }
      if (t.minOrders < 1) {
        toast.error(`Tier ${i + 1}: Min orders must be at least 1.`);
        return;
      }
    }
    const discounts = tiers.map((t) => t.discount);
    const orders = tiers.map((t) => t.minOrders);
    if (new Set(discounts).size !== discounts.length) {
      toast.error("Each tier must have a unique discount percentage.");
      return;
    }
    if (new Set(orders).size !== orders.length) {
      toast.error("Each tier must have a unique order threshold.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/tier-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers, windowDays: parsedWindowDays }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await res.json();
      const newRows = toRows(data.tiers);
      const savedWindowDays = String(data.windowDays ?? parsedWindowDays);
      setRows(newRows);
      setWindowDays(savedWindowDays);
      setSavedJson(
        JSON.stringify({
          tiers: fromRows(newRows),
          windowDays: savedWindowDays,
        })
      );
      toast.success("Tier configuration saved!", {
        description: `${data.recalc.processed} accounts recalculated (${savedWindowDays}-day window), ${data.recalc.changed} changed.`,
      });
    } catch (err) {
      toast.error("Failed to save tier configuration", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    fetchTiers();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading tier config...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Tier Configuration
        </CardTitle>
        <CardDescription>
          Configure discount tiers for wholesale applicants. Changes trigger a full recalculation for all accounts.
          Tiers are automatically sorted by min orders and assigned IDs on save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 max-w-xs">
          <Label htmlFor="tier-window-days" className="text-xs text-muted-foreground">
            Rolling Window (Days)
          </Label>
          <Input
            id="tier-window-days"
            type="number"
            min={1}
            max={365}
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
            className="h-9 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Tier thresholds are evaluated using a rolling {windowLabel}.
          </p>
        </div>

        <Separator />

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-3 px-3 text-xs font-medium text-muted-foreground">
          <span>Tier</span>
          <span>Min Orders ({windowLabel})</span>
          <span>Discount %</span>
          <span></span>
        </div>

        {/* Tier rows — order is stable, no re-sorting while editing */}
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_1fr_1fr_40px] gap-3 items-center p-3 rounded-lg border bg-muted/30"
            >
              {/* Tier label */}
              <div>
                <span className="text-sm font-medium">Tier {idx + 1}</span>
                {row.discount && Number(row.discount) > 0 && (
                  <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                    T{row.discount}
                  </Badge>
                )}
              </div>

              {/* Min orders */}
              <Input
                type="number"
                min={1}
                placeholder="e.g. 25"
                value={row.minOrders}
                onChange={(e) => updateRow(row.key, "minOrders", e.target.value)}
                className="h-9 text-sm"
              />

              {/* Discount % */}
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 10"
                  value={row.discount}
                  onChange={(e) => updateRow(row.key, "discount", e.target.value)}
                  className="h-9 text-sm pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add tier */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addRow}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Tier
        </Button>

        <Separator />

        {/* Preview of what will be saved */}
        {hasChanges && rows.length > 0 && rows.every((r) => Number(r.discount) > 0 && Number(r.minOrders) > 0) && (
          <div className="rounded-lg bg-muted/50 border p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Preview (sorted by min orders):</p>
            {fromRows(rows).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-[10px] font-mono w-10 justify-center">{t.id}</Badge>
                <span>{t.minOrders}+ orders</span>
                <span className="text-muted-foreground">&rarr;</span>
                <span className="font-semibold text-success">{t.discount}% off</span>
              </div>
            ))}
          </div>
        )}

        {/* Save / Reset */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Saving & Recalculating...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save & Recalculate All
              </>
            )}
          </Button>
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          )}
          {hasChanges && (
            <Badge variant="outline" className="text-[10px] text-warning border-warning">
              Unsaved changes
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────
 * Welcome Discount Card
 * ──────────────────────────────────────────────────────── */
function WelcomeDiscountCard() {
  const [enabled, setEnabled] = useState(true);
  const [discount, setDiscount] = useState("20");
  const [hours, setHours] = useState("72");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedJson, setSavedJson] = useState("");

  const currentJson = JSON.stringify({ enabled, discount, hours });
  const hasChanges = currentJson !== savedJson;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/tier-config");
        if (res.ok) {
          const data = await res.json();
          if (data.welcome) {
            setEnabled(data.welcome.enabled ?? true);
            setDiscount(String(data.welcome.discount ?? 20));
            setHours(String(data.welcome.hours ?? 72));
          }
          setSavedJson(JSON.stringify({
            enabled: data.welcome?.enabled ?? true,
            discount: String(data.welcome?.discount ?? 20),
            hours: String(data.welcome?.hours ?? 72),
          }));
        }
      } catch {
        toast.error("Failed to load welcome discount settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    const discountNum = Number(discount);
    const hoursNum = Number(hours);
    if (discountNum <= 0 || discountNum > 100) {
      toast.error("Discount must be between 1% and 100%.");
      return;
    }
    if (hoursNum < 1) {
      toast.error("Duration must be at least 1 hour.");
      return;
    }

    setSaving(true);
    try {
      // Fetch current tiers to send alongside
      const configRes = await fetch("/api/admin/tier-config");
      const configData = await configRes.json();

      const res = await fetch("/api/admin/tier-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiers: configData.tiers,
          welcome: { enabled, discount: discountNum, hours: hoursNum },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSavedJson(currentJson);
      toast.success("Welcome discount settings saved!");
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Welcome Discount
        </CardTitle>
        <CardDescription>
          Offer newly approved applicants a limited-time discount to encourage their first orders.
          After expiration, the applicant&apos;s discount is based on their configured rolling order volume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id="welcome-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <Label htmlFor="welcome-enabled" className="cursor-pointer font-medium">
            {enabled ? "Enabled — new applicants get a welcome discount" : "Disabled — no welcome discount"}
          </Label>
        </div>

        {enabled && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Discount %</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="pr-7"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="pr-7"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">hr</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm space-y-1">
              <p className="font-medium">How it works:</p>
              <ul className="list-disc ml-4 text-muted-foreground space-y-0.5">
                <li>
                  New applicants receive <strong className="text-foreground">{discount}% off + free shipping</strong> for{" "}
                  <strong className="text-foreground">
                    {Number(hours) >= 24
                      ? `${Math.round(Number(hours) / 24)} day${Math.round(Number(hours) / 24) === 1 ? "" : "s"}`
                      : `${hours} hour${Number(hours) === 1 ? "" : "s"}`}
                  </strong>{" "}
                  after approval.
                </li>
                <li>A countdown timer is shown on their dashboard.</li>
                <li>When time expires, they fall to their earned tier based on order volume.</li>
                <li>If they earn a higher tier before expiry, the higher discount is used.</li>
              </ul>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save Welcome Settings
              </>
            )}
          </Button>
          {hasChanges && (
            <Badge variant="outline" className="text-[10px] text-warning border-warning">
              Unsaved changes
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
