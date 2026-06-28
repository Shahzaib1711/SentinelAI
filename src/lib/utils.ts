import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getThreatColor(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
      return "text-red-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-yellow-400";
    case "low":
      return "text-green-400";
    default:
      return "text-muted-foreground";
  }
}

export function getThreatBgColor(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
      return "bg-red-500/10 border-red-500/30";
    case "high":
      return "bg-orange-500/10 border-orange-500/30";
    case "medium":
      return "bg-yellow-500/10 border-yellow-500/30";
    case "low":
      return "bg-green-500/10 border-green-500/30";
    default:
      return "bg-muted/50 border-border";
  }
}

export function getThreatDotColor(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-muted-foreground";
  }
}
