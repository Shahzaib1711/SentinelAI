"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn, formatDateTime, getThreatBgColor, getThreatColor, getThreatDotColor } from "@/lib/utils";
import type { Incident } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ThreatLevelBadge } from "./AlertCard";

interface IncidentTableProps {
  incidents: Incident[];
}

const statusColors: Record<string, string> = {
  open: "text-red-400 bg-red-500/10",
  investigating: "text-yellow-400 bg-yellow-500/10",
  resolved: "text-green-400 bg-green-500/10",
  escalated: "text-orange-400 bg-orange-500/10",
};

export function IncidentTable({ incidents }: IncidentTableProps) {
  const [selected, setSelected] = useState<Incident | null>(null);

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <p className="text-sm text-muted-foreground">No incidents recorded</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-secondary/30">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Incident ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Threat Level
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident, i) => (
              <motion.tr
                key={incident.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(incident)}
                className="cursor-pointer border-b border-border/30 transition-colors hover:bg-cyan-500/5"
              >
                <td className="px-4 py-3 font-mono text-xs text-cyan-400">
                  {incident.id}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(incident.time)}
                </td>
                <td className="px-4 py-3 text-xs">{incident.location}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", getThreatDotColor(incident.threatLevel))} />
                    <span className={cn("text-xs font-medium uppercase", getThreatColor(incident.threatLevel))}>
                      {incident.threatLevel}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("text-[10px] uppercase", statusColors[incident.status])}>
                    {incident.status}
                  </Badge>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="overflow-y-auto scrollbar-thin">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-cyan-400">{selected.id}</SheetTitle>
                <SheetDescription>{selected.location}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <ThreatLevelBadge level={selected.threatLevel} />
                  <Badge variant="outline" className={cn("uppercase", statusColors[selected.status])}>
                    {selected.status}
                  </Badge>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Time</p>
                  <p className="mt-1 text-sm">{formatDateTime(selected.time)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {selected.description}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Assigned To</p>
                  <p className="mt-1 text-sm">{selected.assignedTo}</p>
                </div>
                {selected.cameraId && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Camera</p>
                    <p className="mt-1 font-mono text-sm text-cyan-400">{selected.cameraId}</p>
                  </div>
                )}
                {selected.resolution && (
                  <div className={cn("rounded-lg border p-3", getThreatBgColor("low"))}>
                    <p className="text-xs font-medium uppercase text-green-400">Resolution</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.resolution}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
