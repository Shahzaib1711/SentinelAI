"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Shield } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RiskHeatmapCell, RiskZoneCard } from "@/components/shared/RiskIndicator";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import {
  ThreatBreakdownChart,
  WeeklyTrendChart,
  RiskDistributionChart,
} from "@/components/charts/SecurityCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvent } from "@/contexts/EventContext";
import {
  threatIntelligenceApi,
  type ThreatIntelligencePayload,
} from "@/lib/api/threat-intelligence";
import { cn, formatDateTime, getThreatColor, getThreatDotColor } from "@/lib/utils";

export default function ThreatIntelligencePage() {
  const { slug } = useEvent();
  const [data, setData] = useState<ThreatIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await threatIntelligenceApi.get(slug);
      setData(res.intelligence);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load threat intelligence");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AppLayout title="Threat Intelligence">
        <LoadingState message="Analyzing threat patterns..." />
      </AppLayout>
    );
  }

  const summary = data?.summary;
  const riskZones = data?.riskZones ?? [];
  const threatBreakdown = data?.threatBreakdown ?? [];
  const threatTrendWeekly = data?.threatTrendWeekly ?? [];
  const riskDistribution = data?.riskDistribution ?? [];
  const activeThreats = data?.activeThreats ?? [];

  return (
    <AppLayout title="Threat Intelligence">
      <PageHeader
        title="Threat Intelligence Center"
        description="Live risk zones, threat categories, and trends for the active event"
        action={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Active threats", value: summary.activeThreatCount, color: "text-red-400" },
            { label: "Open incidents", value: summary.openIncidents, color: "text-orange-400" },
            { label: "Unacked alerts", value: summary.unacknowledgedAlerts, color: "text-yellow-400" },
            { label: "High-risk zones", value: summary.highRiskZones, color: "text-cyan-400" },
          ].map((stat) => (
            <Card key={stat.label} className="soc-panel">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={cn("text-2xl font-bold font-mono", stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="soc-panel mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Threat Heatmap — Risk Zones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {riskZones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No risk zones yet. Log incidents or run the demo seed to populate zone data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {riskZones.map((zone, i) => (
                <motion.div
                  key={zone.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <RiskHeatmapCell score={zone.riskScore} label={zone.name} />
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeThreats.length > 0 && (
        <Card className="soc-panel mb-6 border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Active Threats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs uppercase text-muted-foreground">
                    <th className="pb-2 text-left">ID</th>
                    <th className="pb-2 text-left">Type</th>
                    <th className="pb-2 text-left">Location</th>
                    <th className="pb-2 text-left">Level</th>
                    <th className="pb-2 text-left">Confidence</th>
                    <th className="pb-2 text-left">Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {activeThreats.map((threat) => (
                    <tr key={threat.id} className="border-b border-border/30">
                      <td className="py-2 font-mono text-xs text-cyan-400">{threat.id}</td>
                      <td className="py-2 text-xs">{threat.type}</td>
                      <td className="py-2 text-xs text-muted-foreground">{threat.location}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", getThreatDotColor(threat.level))} />
                          <span className={cn("text-xs uppercase", getThreatColor(threat.level))}>
                            {threat.level}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 font-mono text-xs">{threat.confidence}%</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {formatDateTime(threat.detectedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="soc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Threat Breakdown by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {threatBreakdown.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No categorized threats yet for this event.
              </p>
            ) : (
              <ThreatBreakdownChart data={threatBreakdown} />
            )}
          </CardContent>
        </Card>

        <Card className="soc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Weekly Threat Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyTrendChart data={threatTrendWeekly} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="soc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RiskDistributionChart data={riskDistribution} />
          </CardContent>
        </Card>

        <Card className="soc-panel xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Risk Zone Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskZones.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Risk zone details appear when incidents are logged or zones are seeded.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {riskZones.map((zone, i) => (
                  <motion.div
                    key={zone.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <RiskZoneCard
                      name={zone.name}
                      riskScore={zone.riskScore}
                      riskLevel={zone.riskLevel}
                      incidents={zone.incidents}
                      coverage={zone.coverage}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
