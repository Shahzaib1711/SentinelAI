"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { IncidentTable } from "@/components/shared/IncidentTable";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEvent } from "@/contexts/EventContext";
import { incidentsApi, type UpdateIncidentInput } from "@/lib/api/incidents";
import type { Incident, IncidentStatus, ThreatLevel } from "@/types";
import { cn } from "@/lib/utils";

const THREAT_LEVELS: ThreatLevel[] = ["low", "medium", "high", "critical"];

export default function IncidentCenterPage() {
  const { slug } = useEvent();
  const [filter, setFilter] = useState("all");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    location: "",
    description: "",
    threatLevel: "medium" as ThreatLevel,
    assignedTo: "",
    status: "open" as IncidentStatus,
    cameraId: "",
  });

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await incidentsApi.list(slug);
      setIncidents(res.incidents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incidents");
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await incidentsApi.create(
        {
          location: form.location.trim(),
          description: form.description.trim(),
          threatLevel: form.threatLevel,
          assignedTo: form.assignedTo.trim() || "Unassigned",
          status: form.status,
          ...(form.cameraId.trim() ? { cameraId: form.cameraId.trim() } : {}),
        },
        slug
      );
      setIncidents((prev) => [res.incident, ...prev]);
      setForm({
        location: "",
        description: "",
        threatLevel: "medium",
        assignedTo: "",
        status: "open",
        cameraId: "",
      });
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string, patch: UpdateIncidentInput) => {
    const res = await incidentsApi.update(id, patch);
    setIncidents((prev) => prev.map((i) => (i.id === id ? res.incident : i)));
  };

  const filtered = incidents.filter((inc) => {
    if (filter === "all") return true;
    return inc.status === filter;
  });

  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => i.status === "open").length,
    investigating: incidents.filter((i) => i.status === "investigating").length,
    escalated: incidents.filter((i) => i.status === "escalated").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
  };

  if (loading) {
    return (
      <AppLayout title="Incident Center">
        <LoadingState message="Loading incidents..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Incident Center">
      <PageHeader
        title="Incident Management Center"
        description="Track, investigate, and resolve security incidents for the active event"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadIncidents()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? "Hide form" : "Log incident"}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void loadIncidents()}>
            Retry
          </Button>
        </div>
      )}

      {showForm && (
        <Card className="soc-panel mb-6 border-cyan-500/20">
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium">Location</label>
                <Input
                  required
                  placeholder="Main Entrance"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Threat level</label>
                <Select
                  value={form.threatLevel}
                  onValueChange={(v) => setForm((f) => ({ ...f, threatLevel: v as ThreatLevel }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THREAT_LEVELS.map((level) => (
                      <SelectItem key={level} value={level} className="capitalize">
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium">Description</label>
                <Textarea
                  required
                  rows={3}
                  placeholder="What happened?"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Assigned to</label>
                <Input
                  placeholder="Team Alpha — optional"
                  value={form.assignedTo}
                  onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Camera ID</label>
                <Input
                  placeholder="CAM-01 — optional"
                  value={form.cameraId}
                  onChange={(e) => setForm((f) => ({ ...f, cameraId: e.target.value }))}
                />
              </div>
              {formError && (
                <p className="text-sm text-red-400 md:col-span-2">{formError}</p>
              )}
              <div className="md:col-span-2">
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create incident"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Open", value: stats.open, color: "text-red-400" },
          { label: "Investigating", value: stats.investigating, color: "text-yellow-400" },
          { label: "Escalated", value: stats.escalated, color: "text-orange-400" },
          { label: "Resolved", value: stats.resolved, color: "text-green-400" },
        ].map((stat) => (
          <Card key={stat.label} className="soc-panel">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={cn("text-2xl font-bold font-mono", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="soc-panel">
        <CardContent className="p-4">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
              <TabsTrigger value="investigating">Investigating ({stats.investigating})</TabsTrigger>
              <TabsTrigger value="escalated">Escalated ({stats.escalated})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
            </TabsList>
            <TabsContent value={filter}>
              <IncidentTable incidents={filtered} onUpdate={handleUpdate} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
