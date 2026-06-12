"use client";

import { motion } from "framer-motion";
import { Shield, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { cn, getThreatBgColor, getThreatColor } from "@/lib/utils";
import type { ThreatLevel } from "@/types";

interface ThreatCardProps {
  title: string;
  value: string | number;
  level?: ThreatLevel;
  subtitle?: string;
  trend?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function ThreatCard({
  title,
  value,
  level,
  subtitle,
  trend,
  icon,
  className,
}: ThreatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "soc-panel p-4 transition-all hover:border-cyan-500/30 hover:shadow-glow",
        level && getThreatBgColor(level),
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              "text-2xl font-bold font-mono",
              level ? getThreatColor(level) : "text-foreground"
            )}
          >
            {typeof value === "string" ? value.toUpperCase() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          {icon || <Shield className="h-5 w-5" />}
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend >= 0 ? (
            <TrendingUp className="h-3 w-3 text-red-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-green-400" />
          )}
          <span className={trend >= 0 ? "text-red-400" : "text-green-400"}>
            {Math.abs(trend)}%
          </span>
          <span className="text-muted-foreground">vs last hour</span>
        </div>
      )}
    </motion.div>
  );
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  accentColor = "text-cyan-400",
  className,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "soc-panel group p-4 transition-all hover:border-cyan-500/30 hover:shadow-glow",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className={cn("mt-1 text-3xl font-bold font-mono", accentColor)}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/50 p-2.5 transition-colors group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

export function LiveThreatIndicator({ level }: { level: ThreatLevel }) {
  const config = {
    low: { color: "bg-green-500", label: "LOW", pulse: false },
    medium: { color: "bg-yellow-500", label: "MEDIUM", pulse: true },
    high: { color: "bg-orange-500", label: "HIGH", pulse: true },
    critical: { color: "bg-red-500", label: "CRITICAL", pulse: true },
  }[level];

  return (
    <motion.div
      animate={config.pulse ? { opacity: [1, 0.7, 1] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-2",
        getThreatBgColor(level)
      )}
    >
      <div className="relative">
        <div className={cn("h-3 w-3 rounded-full", config.color)} />
        {config.pulse && (
          <div
            className={cn(
              "absolute inset-0 h-3 w-3 animate-ping rounded-full opacity-75",
              config.color
            )}
          />
        )}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">LIVE THREAT LEVEL</p>
        <p className={cn("font-bold font-mono tracking-wider", getThreatColor(level))}>
          {config.label}
        </p>
      </div>
      <AlertTriangle className={cn("ml-auto h-5 w-5", getThreatColor(level))} />
    </motion.div>
  );
}
