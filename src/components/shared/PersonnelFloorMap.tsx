"use client";

import { motion } from "framer-motion";
import { Crown, Shield, User } from "lucide-react";
import type { LivePersonnel } from "@/types";
import { cn } from "@/lib/utils";

const ROLE_STYLES = {
  guard: {
    bg: "bg-purple-500",
    ring: "ring-purple-300/50",
    icon: Shield,
    label: "text-purple-300",
  },
  vip: {
    bg: "bg-yellow-500",
    ring: "ring-yellow-300/50",
    icon: Crown,
    label: "text-yellow-300",
  },
  visitor: {
    bg: "bg-cyan-500",
    ring: "ring-cyan-300/50",
    icon: User,
    label: "text-cyan-300",
  },
  restricted: {
    bg: "bg-red-500",
    ring: "ring-red-300/50",
    icon: User,
    label: "text-red-300",
  },
  entrance: {
    bg: "bg-green-500",
    ring: "ring-green-300/50",
    icon: User,
    label: "text-green-300",
  },
} as const;

interface PersonnelFloorMapProps {
  personnel: LivePersonnel[];
  className?: string;
}

export function PersonnelFloorMap({ personnel, className }: PersonnelFloorMapProps) {
  const standing = personnel.filter((p) => p.posture === "standing");

  return (
    <div
      className={cn(
        "relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border/60 bg-[#0d1117]",
        className
      )}
    >
      <div className="absolute inset-0 soc-grid opacity-40" />

      <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="3" y="3" width="94" height="94" fill="none" stroke="#1e3a5f" strokeWidth="0.3" />
        <line x1="50" y1="3" x2="50" y2="97" stroke="#1e3a5f" strokeWidth="0.1" strokeDasharray="1,1" />
        <line x1="3" y1="50" x2="97" y2="50" stroke="#1e3a5f" strokeWidth="0.1" strokeDasharray="1,1" />
      </svg>

      {standing.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          No personnel detected — broadcast a phone feed with a person in frame
        </div>
      ) : (
        standing.map((person) => {
          const style = ROLE_STYLES[person.role] ?? ROLE_STYLES.visitor;
          const Icon = style.icon;
          return (
            <motion.div
              key={person.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
                style.ring
              )}
              style={{ left: `${person.blueprintX}%`, top: `${person.blueprintY}%` }}
              title={`${person.label} · ${person.zone} · ${person.cameraId}`}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full shadow-lg ring-2",
                  style.bg,
                  style.ring
                )}
              >
                <Icon className="h-3.5 w-3.5 text-black" />
              </div>
              <span className={cn("mt-1 max-w-[6rem] truncate text-[8px] font-mono", style.label)}>
                {person.enrolledName ?? person.label}
              </span>
              {person.designation && (
                <span className="max-w-[6rem] truncate text-[7px] text-muted-foreground">
                  {person.designation}
                </span>
              )}
            </motion.div>
          );
        })
      )}

      <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-cyan-400">
        LIVE PERSONNEL · {standing.length} standing
      </div>
    </div>
  );
}
