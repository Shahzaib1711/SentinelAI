"use client";

import { motion } from "framer-motion";
import { Clock, MapPin, Route, Shield, Star } from "lucide-react";
import { cn, getThreatColor } from "@/lib/utils";
import type { Route as RouteType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface RouteCardProps {
  route: RouteType;
  selected?: boolean;
  onSelect?: () => void;
}

export function RouteCard({ route, selected, onSelect }: RouteCardProps) {
  const riskLevel =
    route.riskScore >= 70 ? "critical" : route.riskScore >= 50 ? "high" : route.riskScore >= 30 ? "medium" : "low";

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-lg border p-4 transition-all",
        route.isSafest
          ? "border-green-500/40 bg-green-500/5 shadow-glow"
          : "border-border/60 bg-card/80",
        selected && "ring-2 ring-cyan-500/50",
        "hover:border-cyan-500/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-cyan-400" />
          <h3 className="font-medium">{route.name}</h3>
        </div>
        {route.isSafest && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <Star className="mr-1 h-3 w-3" />
            Safest
          </Badge>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="text-center">
          <MapPin className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-1 font-mono text-sm">{route.distance}</p>
          <p className="text-[10px] text-muted-foreground">Distance</p>
        </div>
        <div className="text-center">
          <Clock className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-1 font-mono text-sm">{route.estimatedTime}</p>
          <p className="text-[10px] text-muted-foreground">Est. Time</p>
        </div>
        <div className="text-center">
          <Shield className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className={cn("mt-1 font-mono text-sm font-bold", getThreatColor(riskLevel))}>
            {route.riskScore}
          </p>
          <p className="text-[10px] text-muted-foreground">Risk Score</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px]">
          <span className="text-muted-foreground">Risk Level</span>
          <span className={getThreatColor(riskLevel)}>{riskLevel.toUpperCase()}</span>
        </div>
        <Progress
          value={route.riskScore}
          className={cn(
            "h-1.5",
            riskLevel === "critical" && "[&>div]:bg-red-500",
            riskLevel === "high" && "[&>div]:bg-orange-500",
            riskLevel === "medium" && "[&>div]:bg-yellow-500",
            riskLevel === "low" && "[&>div]:bg-green-500"
          )}
        />
      </div>
    </motion.div>
  );
}
