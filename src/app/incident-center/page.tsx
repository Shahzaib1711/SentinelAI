"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { IncidentTable } from "@/components/shared/IncidentTable";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { incidents as mockIncidents } from "@/lib/mock-data";
import type { Incident } from "@/types";
import { cn, getThreatColor } from "@/lib/utils";

export default function IncidentCenterPage() {
  const [filter, setFilter] = useState("all");
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "mock">("mock");

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.incidents();
        setIncidents(res.incidents);
        setDataSource("api");
      } catch {
        setIncidents(mockIncidents);
        setDataSource("mock");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      <AppLayout title="Incident Center" subtitle="Security incident tracking and management">
        <LoadingState message="Loading incidents..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Incident Center"
      subtitle={`Security incident tracking · ${dataSource === "api" ? "PostgreSQL" : "Mock data"}`}
    >
      <PageHeader
        title="Incident Management Center"
        description="Track, investigate, and resolve security incidents across the venue"
      />

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
              <IncidentTable incidents={filtered} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
