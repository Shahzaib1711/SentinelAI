"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { cn, formatDateTime, getThreatBgColor, getThreatColor, getThreatDotColor } from "@/lib/utils";
import type { Alert, ThreatLevel } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AlertCardProps {
  alert: Alert;
  compact?: boolean;
  onAcknowledge?: (id: string) => void;
}

export function AlertCard({ alert, compact = false, onAcknowledge }: AlertCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "rounded-lg border p-3 transition-all hover:border-cyan-500/20",
        getThreatBgColor(alert.level),
        !alert.acknowledged && "border-l-2",
        !alert.acknowledged && alert.level === "critical" && "border-l-red-500",
        !alert.acknowledged && alert.level === "high" && "border-l-orange-500",
        !alert.acknowledged && alert.level === "medium" && "border-l-yellow-500"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", getThreatDotColor(alert.level))} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate text-sm font-medium", getThreatColor(alert.level))}>
              {alert.title}
            </p>
            {!alert.acknowledged && (
              <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                New
              </Badge>
            )}
          </div>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {alert.description}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-muted-foreground">
              {alert.location} · {formatDateTime(alert.timestamp)}
            </span>
            {!alert.acknowledged && onAcknowledge && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-2 text-[10px]"
                onClick={() => onAcknowledge(alert.id)}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Ack
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface AlertListProps {
  alerts: Alert[];
  emptyMessage?: string;
  compact?: boolean;
}

export function AlertList({ alerts, emptyMessage = "No active alerts", compact }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Bell className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <AlertCard alert={alert} compact={compact} />
        </motion.div>
      ))}
    </div>
  );
}

export function ThreatLevelBadge({ level }: { level: ThreatLevel }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] uppercase",
        getThreatBgColor(level),
        getThreatColor(level)
      )}
    >
      <AlertTriangle className="mr-1 h-3 w-3" />
      {level}
    </Badge>
  );
}
