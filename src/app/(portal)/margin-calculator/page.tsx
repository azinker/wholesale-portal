"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, DollarSign, Percent } from "lucide-react";

const PRESETS = [
  { label: "25%", markup: 0.25 },
  { label: "50%", markup: 0.50 },
  { label: "100%", markup: 1.00 },
  { label: "150%", markup: 1.50 },
];

export default function MarginCalculatorPage() {
  const [cost, setCost] = useState("");
  const [resell, setResell] = useState("");
  const [quantity, setQuantity] = useState("1");

  const costNum = parseFloat(cost);
  const resellNum = parseFloat(resell);
  const qtyNum = parseInt(quantity) || 1;

  const isValid = !isNaN(costNum) && costNum > 0 && !isNaN(resellNum) && resellNum > 0;

  const profitPerUnit = isValid ? resellNum - costNum : 0;
  const marginPct = isValid && resellNum > 0 ? ((resellNum - costNum) / resellNum) * 100 : 0;
  const totalProfit = profitPerUnit * qtyNum;
  const breakEven = isValid ? costNum : 0;

  const marginColor =
    marginPct >= 30
      ? "text-green-600"
      : marginPct >= 15
        ? "text-yellow-600"
        : "text-red-600";

  const applyPreset = (markup: number) => {
    if (!isNaN(costNum) && costNum > 0) {
      setResell((costNum * (1 + markup)).toFixed(2));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Margin Calculator
        </h1>
        <p className="text-muted-foreground mt-1">
          Calculate your profit margins and find optimal pricing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price Inputs</CardTitle>
          <CardDescription>Enter your cost and selling price to calculate margins.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Product Cost (Your Tier Price)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resell">Resell Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="resell"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={resell}
                  onChange={(e) => setResell(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (optional)</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-32"
            />
          </div>

          {/* Preset markup buttons */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">Quick markup:</span>
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(p.markup)}
                disabled={!costNum || costNum <= 0}
              >
                +{p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isValid && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Percent className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Margin</p>
              <p className={`text-2xl font-bold ${marginColor}`}>
                {marginPct.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Profit / Unit</p>
              <p className={`text-2xl font-bold ${profitPerUnit >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${profitPerUnit.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Profit</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${totalProfit.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Break-even</p>
              <p className="text-2xl font-bold">${breakEven.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isValid && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={marginPct >= 30 ? "default" : marginPct >= 15 ? "secondary" : "destructive"}
              >
                {marginPct >= 30 ? "Healthy Margin" : marginPct >= 15 ? "Moderate Margin" : "Low Margin"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {marginPct >= 30
                  ? "Great! This margin allows room for promotions and operational costs."
                  : marginPct >= 15
                    ? "Acceptable margin, but consider if overhead costs are covered."
                    : "Warning: This margin may not cover your operational expenses."}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
