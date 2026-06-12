"use client";

import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { RiskHeatmapCell, RiskZoneCard } from "@/components/shared/RiskIndicator";
import { PageHeader } from "@/components/shared/PageElements";
import {
  ThreatBreakdownChart,
  WeeklyTrendChart,
  RiskDistributionChart,
} from "@/components/charts/SecurityCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  riskZones,
  threatBreakdown,
  threatTrendWeekly,
  riskDistribution,
} from "@/lib/mock-data";

export default function ThreatIntelligencePage() {
  return (
    <AppLayout
      title="Threat Intelligence"
      subtitle="Risk analysis and threat pattern recognition"
    >
      <PageHeader
        title="Threat Intelligence Center"
        description="Comprehensive threat analysis, risk zone mapping, and trend forecasting"
      />

      {/* Threat Heatmap */}
      <Card className="soc-panel mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Threat Heatmap — Risk Zones
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Threat Breakdown */}
        <Card className="soc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Threat Breakdown by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ThreatBreakdownChart data={threatBreakdown} />
          </CardContent>
        </Card>

        {/* Threat Trends */}
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

        {/* Risk Zone Details */}
        <Card className="soc-panel xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Risk Zone Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
