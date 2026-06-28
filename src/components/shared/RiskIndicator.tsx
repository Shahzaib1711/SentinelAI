"use client";

import { cn, getThreatColor, getThreatBgColor } from "@/lib/utils";
import type { ThreatLevel } from "@/types";
import { Progress } from "@/components/ui/progress";

function scoreToLevel(score: number): ThreatLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
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
