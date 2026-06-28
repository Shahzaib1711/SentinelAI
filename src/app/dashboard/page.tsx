"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  Clock,
  Route,
  Shield,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThreatTrendChart, RiskDistributionChart } from "@/components/charts/SecurityCharts";
import { KPICard, ThreatCard } from "@/components/shared/ThreatCard";
import { AlertList } from "@/components/shared/AlertCard";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi, type DashboardData } from "@/lib/api/dashboard";
import { api } from "@/lib/api-client";
import { useEvent } from "@/contexts/EventContext";
import {
  activeThreats as mockActiveThreats,
  dashboardKPIs as mockKPIs,
  recentAlerts as mockRecentAlerts,
  riskDistribution as mockRiskDistribution,
  securitySummaries as mockSecuritySummaries,
  threatTrendData as mockThreatTrend,
} from "@/lib/mock-data";
import type { Alert, Camera, ThreatLevel } from "@/types";
import { cn, formatDateTime, getThreatColor, getThreatDotColor } from "@/lib/utils";

const REFRESH_MS = 30_000;

const summaryIcons: Record<string, React.ReactNode> = {
  shield: <Shield className="h-4 w-4 text-green-400" />,
  route: <Route className="h-4 w-4 text-cyan-400" />,
  users: <Users className="h-4 w-4 text-blue-400" />,
  clock: <Clock className="h-4 w-4 text-yellow-400" />,
};

function mockDashboard(): DashboardData {
  return {
    kpis: {
      threatLevel: mockKPIs.threatLevel,
      securityScore: mockKPIs.securityScore,
      activeAlerts: mockKPIs.activeAlerts,
      camerasOnline: mockKPIs.camerasOnline,
      totalCameras: mockKPIs.totalCameras,
    },
    threatTrend: mockThreatTrend,
    riskDistribution: mockRiskDistribution,
    activeThreats: mockActiveThreats,
    recentAlerts: mockRecentAlerts,
    securitySummaries: mockSecuritySummaries,
  };
}

function cameraStatusSubtitle(cameras: Camera[]): string {
  const offline = cameras.filter((c) => c.status === "offline").length;
  const maintenance = cameras.filter((c) => c.status === "maintenance").length;
  const parts: string[] = [];
  if (offline > 0) parts.push(`${offline} offline`);
  if (maintenance > 0) parts.push(`${maintenance} maintenance`);
  return parts.length > 0 ? parts.join(" · ") : "All cameras operational";
}

function urgentAlertsSubtitle(alerts: Alert[]): string {
  const urgent = alerts.filter(
    (a) => !a.acknowledged && (a.level === "critical" || a.level === "high")
  ).length;
  if (urgent === 0) return "No urgent alerts";
  return `${urgent} require immediate action`;
}

export default function DashboardPage() {
  const { slug } = useEvent();
  const [data, setData] = useState<DashboardData>(mockDashboard);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "mock">("mock");

  const load = useCallback(async () => {
    try {
      const [dashRes, camRes, alertRes] = await Promise.all([
        dashboardApi.get(slug),
        api.cameras(slug),
        api.alerts(slug, true),
      ]);
      setData(dashRes);
      setCameras(camRes.cameras);
      setActiveAlerts(alertRes.alerts);
      setDataSource("api");
    } catch {
      setData(mockDashboard());
      setCameras([]);
      setActiveAlerts(mockRecentAlerts.filter((a) => !a.acknowledged));
      setDataSource("mock");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    void load();
    const interval = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <AppLayout title="Command Dashboard">
        <LoadingState message="Loading dashboard..." />
      </AppLayout>
    );
  }

  const { kpis, threatTrend, riskDistribution, activeThreats, recentAlerts, securitySummaries } =
    data;

  const cameraSubtitle =
    cameras.length > 0
      ? cameraStatusSubtitle(cameras)
      : `${kpis.totalCameras - kpis.camerasOnline} not online`;

  const alertsSubtitle = urgentAlertsSubtitle(
    activeAlerts.length > 0 ? activeAlerts : recentAlerts
  );

  return (
    <AppLayout title="Command Dashboard">
      <PageHeader
        title="Security Operations Dashboard"
        description={`Real-time overview of venue security posture · ${dataSource === "api" ? "PostgreSQL" : "Mock data"}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ThreatCard
          title="Threat Level"
          value={kpis.threatLevel}
          level={kpis.threatLevel}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KPICard
          title="Security Score"
          value={`${kpis.securityScore}%`}
          subtitle={
            kpis.securityScore >= 80
              ? "Above baseline threshold"
              : "Below baseline threshold"
          }
          icon={<Shield className="h-5 w-5 text-cyan-400" />}
        />
        <KPICard
          title="Active Alerts"
          value={kpis.activeAlerts}
          subtitle={alertsSubtitle}
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          accentColor="text-red-400"
        />
        <KPICard
          title="Cameras Online"
          value={`${kpis.camerasOnline}/${kpis.totalCameras}`}
          subtitle={cameraSubtitle}
          icon={<Camera className="h-5 w-5 text-green-400" />}
          accentColor="text-green-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="soc-panel xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Threat Trend — Last 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {threatTrend.length > 0 ? (
              <ThreatTrendChart data={threatTrend} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No threat trend data for this event.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="soc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskDistribution.length > 0 ? (
              <RiskDistributionChart data={riskDistribution} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No risk distribution data for this event.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="soc-panel xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Active Threats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeThreats.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No active threats for this event.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs uppercase text-muted-foreground">
                      <th className="pb-3 text-left font-medium">ID</th>
                      <th className="pb-3 text-left font-medium">Type</th>
                      <th className="pb-3 text-left font-medium">Location</th>
                      <th className="pb-3 text-left font-medium">Level</th>
                      <th className="pb-3 text-left font-medium">Confidence</th>
                      <th className="pb-3 text-left font-medium">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeThreats.map((threat, i) => (
                      <motion.tr
                        key={threat.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="border-b border-border/30 hover:bg-cyan-500/5"
                      >
                        <td className="py-3 font-mono text-xs text-cyan-400">{threat.id}</td>
                        <td className="py-3 text-xs">{threat.type}</td>
                        <td className="py-3 text-xs text-muted-foreground">{threat.location}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full",
                                getThreatDotColor(threat.level)
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs uppercase",
                                getThreatColor(threat.level)
                              )}
                            >
                              {threat.level}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-xs">{threat.confidence}%</td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {formatDateTime(threat.detectedAt)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="soc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Recent Incidents Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAlerts.length > 0 ? (
              <AlertList alerts={recentAlerts} compact />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No recent alerts for this event.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {securitySummaries.map((summary, i) => (
          <motion.div
            key={summary.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="soc-panel transition-all hover:border-cyan-500/20">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  {summaryIcons[summary.icon]}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{summary.title}</p>
                  <p className="text-lg font-bold font-mono">{summary.value}</p>
                  <p
                    className={cn(
                      "text-[10px]",
                      summary.change >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {summary.change >= 0 ? "+" : ""}
                    {summary.change}% from baseline
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
