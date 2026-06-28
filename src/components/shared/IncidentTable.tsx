"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn, formatDateTime, getThreatBgColor, getThreatColor, getThreatDotColor } from "@/lib/utils";
import type { Incident, IncidentStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ThreatLevelBadge } from "./AlertCard";
import type { UpdateIncidentInput } from "@/lib/api/incidents";

interface IncidentTableProps {
  incidents: Incident[];
  onUpdate?: (id: string, patch: UpdateIncidentInput) => Promise<void>;
}

const statusColors: Record<string, string> = {
  open: "text-red-400 bg-red-500/10",
  investigating: "text-yellow-400 bg-yellow-500/10",
  resolved: "text-green-400 bg-green-500/10",
  escalated: "text-orange-400 bg-orange-500/10",
};

const STATUSES: IncidentStatus[] = ["open", "investigating", "escalated", "resolved"];

export function IncidentTable({ incidents, onUpdate }: IncidentTableProps) {
  const [selected, setSelected] = useState<Incident | null>(null);
  const [status, setStatus] = useState<IncidentStatus>("open");
  const [assignedTo, setAssignedTo] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status);
    setAssignedTo(selected.assignedTo);
    setResolution(selected.resolution ?? "");
    setSaveError(null);
  }, [selected]);

  const handleSave = async () => {
    if (!selected || !onUpdate) return;
    setSaving(true);
    setSaveError(null);
    try {
      const patch: UpdateIncidentInput = {
        status,
        assignedTo: assignedTo.trim() || "Unassigned",
      };
      if (resolution.trim()) patch.resolution = resolution.trim();
      if (status === "resolved" && !resolution.trim()) {
        setSaveError("Add a resolution note before marking resolved.");
        setSaving(false);
        return;
      }
      await onUpdate(selected.id, patch);
      setSelected(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <p className="text-sm text-muted-foreground">No incidents recorded for this event</p>
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
                <td className="px-4 py-3 font-mono text-xs text-cyan-400">{incident.id}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(incident.time)}
                </td>
                <td className="px-4 py-3 text-xs">{incident.location}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn("h-2 w-2 rounded-full", getThreatDotColor(incident.threatLevel))}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium uppercase",
                        getThreatColor(incident.threatLevel)
                      )}
                    >
                      {incident.threatLevel}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase", statusColors[incident.status])}
                  >
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
                {selected.cameraId && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Camera</p>
                    <p className="mt-1 font-mono text-sm text-cyan-400">{selected.cameraId}</p>
                  </div>
                )}

                {onUpdate && (
                  <>
                    <Separator />
                    <p className="text-xs font-medium uppercase text-cyan-400">Update incident</p>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Assigned to</p>
                      <Input
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        placeholder="Team / operator name"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Resolution notes</p>
                      <Textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Required when marking resolved"
                        rows={3}
                      />
                    </div>
                    {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                    <Button className="w-full" disabled={saving} onClick={() => void handleSave()}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </>
                )}

                {!onUpdate && selected.resolution && (
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
