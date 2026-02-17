"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X, Rocket } from "lucide-react";

interface OnboardingStep {
  id: string;
  label: string;
  href: string;
  completed: boolean;
}

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  onDismiss: () => void;
}

export function OnboardingChecklist({ steps, onDismiss }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const completedCount = steps.filter((s) => s.completed).length;
  const allDone = completedCount === steps.length;
  const progress = (completedCount / steps.length) * 100;

  const handleDismiss = async () => {
    setDismissed(true);
    onDismiss();
  };

  if (allDone) {
    return (
      <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
        <CardContent className="pt-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                All set! You&apos;re ready to go.
              </p>
              <p className="text-sm text-muted-foreground">
                You&apos;ve completed all onboarding steps.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            Getting Started
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-7 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {completedCount} of {steps.length} completed
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
              step.completed
                ? "text-muted-foreground"
                : "hover:bg-muted/50"
            }`}
          >
            {step.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
            <span className={`text-sm ${step.completed ? "line-through" : "font-medium"}`}>
              {step.label}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
