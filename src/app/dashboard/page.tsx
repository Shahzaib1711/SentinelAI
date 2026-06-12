"use client";

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
import { PageHeader } from "@/components/shared/PageElements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dashboardKPIs,
  threatTrendData,
  riskDistribution,
  recentAlerts,
  activeThreats,
  securitySummaries,
} from "@/lib/mock-data";
import { cn, formatDateTime, getThreatColor, getThreatDotColor } from "@/lib/utils";

const summaryIcons: Record<string, React.ReactNode> = {
  shield: <Shield className="h-4 w-4 text-green-400" />,
  route: <Route className="h-4 w-4 text-cyan-400" />,
  users: <Users className="h-4 w-4 text-blue-400" />,
  clock: <Clock className="h-4 w-4 text-yellow-400" />,
};

export default function DashboardPage() {
  return (
    <AppLayout
      title="Command Dashboard"
      subtitle="Global Security Summit 2026 · Metropolitan Convention Center"
    >
      <PageHeader
        title="Security Operations Dashboard"
        description="Real-time overview of venue security posture and active threats"
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ThreatCard
          title="Threat Level"
          value={dashboardKPIs.threatLevel}
          level={dashboardKPIs.threatLevel}
          trend={12}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KPICard
          title="Security Score"
          value={`${dashboardKPIs.securityScore}%`}
          subtitle="Above baseline threshold"
          icon={<Shield className="h-5 w-5 text-cyan-400" />}
        />
        <KPICard
          title="Active Alerts"
          value={dashboardKPIs.activeAlerts}
          subtitle="3 require immediate action"
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          accentColor="text-red-400"
        />
        <KPICard
          title="Cameras Online"
          value={`${dashboardKPIs.camerasOnline}/${dashboardKPIs.totalCameras}`}
          subtitle="2 offline · 1 maintenance"
          icon={<Camera className="h-5 w-5 text-green-400" />}
          accentColor="text-green-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Threat Trend */}
        <Card className="soc-panel xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Threat Trend — Last 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ThreatTrendChart data={threatTrendData} />
          </CardContent>
        </Card>

        {/* Risk Distribution */}
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
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Active Threats Table */}
        <Card className="soc-panel xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Active Threats
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                          <div className={cn("h-2 w-2 rounded-full", getThreatDotColor(threat.level))} />
                          <span className={cn("text-xs uppercase", getThreatColor(threat.level))}>
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
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="soc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Recent Incidents Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertList alerts={recentAlerts} compact />
          </CardContent>
        </Card>
      </div>

      {/* Security Summary Cards */}
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
                  <p className={cn(
                    "text-[10px]",
                    summary.change >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {summary.change >= 0 ? "+" : ""}{summary.change}% from baseline
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
