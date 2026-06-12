"use client";

import { cn, getThreatColor, getThreatBgColor } from "@/lib/utils";
import type { ThreatLevel } from "@/types";
import { Progress } from "@/components/ui/progress";

interface RiskIndicatorProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showBar?: boolean;
  className?: string;
}

function scoreToLevel(score: number): ThreatLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function RiskIndicator({
  score,
  label,
  size = "md",
  showBar = true,
  className,
}: RiskIndicatorProps) {
  const level = scoreToLevel(score);

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <div className="flex items-end gap-2">
        <span className={cn("font-bold font-mono", sizeClasses[size], getThreatColor(level))}>
          {score}
        </span>
        <span className="mb-1 text-xs text-muted-foreground">/100</span>
      </div>
      {showBar && (
        <Progress
          value={score}
          className={cn(
            "h-1.5",
            level === "critical" && "[&>div]:bg-red-500",
            level === "high" && "[&>div]:bg-orange-500",
            level === "medium" && "[&>div]:bg-yellow-500",
            level === "low" && "[&>div]:bg-green-500"
          )}
        />
      )}
    </div>
  );
}

interface RiskZoneCardProps {
  name: string;
  riskScore: number;
  riskLevel: ThreatLevel;
  incidents: number;
  coverage: number;
  className?: string;
}

export function RiskZoneCard({
  name,
  riskScore,
  riskLevel,
  incidents,
  coverage,
  className,
}: RiskZoneCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all hover:border-cyan-500/20",
        getThreatBgColor(riskLevel),
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{name}</p>
        <span className={cn("font-mono text-sm font-bold", getThreatColor(riskLevel))}>
          {riskScore}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <span>Incidents: {incidents}</span>
        <span>Coverage: {coverage}%</span>
      </div>
      <Progress value={riskScore} className="mt-2 h-1" />
    </div>
  );
}

export function RiskHeatmapCell({
  score,
  label,
  className,
}: {
  score: number;
  label: string;
  className?: string;
}) {
  const level = scoreToLevel(score);
  const heatColors = {
    critical: "bg-red-500/80",
    high: "bg-orange-500/70",
    medium: "bg-yellow-500/60",
    low: "bg-green-500/50",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md p-3 transition-all hover:scale-105 hover:ring-1 hover:ring-cyan-500/50",
        heatColors[level],
        className
      )}
      title={`${label}: Risk ${score}`}
    >
      <span className="text-xs font-medium text-white/90">{label}</span>
      <span className="font-mono text-lg font-bold text-white">{score}</span>
    </div>
  );
}
