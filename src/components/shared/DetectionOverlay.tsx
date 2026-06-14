"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Detection, DetectionType } from "@/types";

const TYPE_STYLES: Record<
  DetectionType,
  { border: string; bg: string; label: string }
> = {
  guard: {
    border: "border-purple-400",
    bg: "bg-purple-400/15",
    label: "bg-purple-500/95 text-white",
  },
  vip: {
    border: "border-yellow-400",
    bg: "bg-yellow-400/15",
    label: "bg-yellow-500/95 text-black",
  },
  person: {
    border: "border-cyan-400",
    bg: "bg-cyan-400/10",
    label: "bg-cyan-500/90 text-black",
  },
  vehicle: {
    border: "border-amber-400",
    bg: "bg-amber-400/10",
    label: "bg-amber-500/90 text-black",
  },
  bag: {
    border: "border-orange-400",
    bg: "bg-orange-400/10",
    label: "bg-orange-500/90 text-black",
  },
  animal: {
    border: "border-emerald-400",
    bg: "bg-emerald-400/10",
    label: "bg-emerald-500/90 text-black",
  },
};

interface DetectionOverlayProps {
  detections: Detection[];
  className?: string;
}

export function DetectionOverlay({ detections, className }: DetectionOverlayProps) {
  if (detections.length === 0) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      {detections.map((det) => {
        const roleStyle =
          det.role === "guard"
            ? TYPE_STYLES.guard
            : det.role === "vip"
              ? TYPE_STYLES.vip
              : null;
        const style = roleStyle ?? TYPE_STYLES[det.type] ?? TYPE_STYLES.person;
        const subtitle = [det.zone, det.posture === "standing" ? "Standing" : null]
          .filter(Boolean)
          .join(" · ");

        return (
          <motion.div
            key={det.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn("absolute border-2", style.border, style.bg)}
            style={{
              left: `${det.x}%`,
              top: `${det.y}%`,
              width: `${det.width ?? 15}%`,
              height: `${det.height ?? 20}%`,
            }}
          >
            <span
              className={cn(
                "absolute -top-5 left-0 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-mono",
                style.label
              )}
            >
              {det.label} {det.confidence}%
            </span>
            {subtitle && (
              <span className="absolute -bottom-4 left-0 whitespace-nowrap text-[8px] text-white/80">
                {subtitle}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
