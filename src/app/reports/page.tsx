"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageElements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { reportData } from "@/lib/mock-data";
import { cn, getThreatColor } from "@/lib/utils";

export default function ReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const handleExport = (type: string) => {
    setExporting(type);
    setExported(null);
    setTimeout(() => {
      setExporting(null);
      setExported(type);
      setTimeout(() => setExported(null), 3000);
    }, 1500);
  };

  const { securityScore, coverageAnalysis, threatSummary, recommendations, eventDetails } =
    reportData;

  return (
    <AppLayout
      title="Reports"
      subtitle="Security assessment reports and documentation"
    >
      <PageHeader
        title="Security Reports"
        description="Generate and export comprehensive security assessment reports"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
            >
              {exporting === "pdf" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Download className="mr-2 h-4 w-4" />
                </motion.div>
              ) : exported === "pdf" ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={!!exporting}
            >
              {exporting === "csv" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Download className="mr-2 h-4 w-4" />
                </motion.div>
              ) : exported === "csv" ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Report Preview */}
      <Card className="soc-panel soc-glow-border">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Security Assessment Report</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {eventDetails.name} · Generated {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-bold text-cyan-400">{securityScore}</p>
              <p className="text-xs text-muted-foreground">Security Score</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 p-6">
          {/* Event Details */}
          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Event Details
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Event", value: eventDetails.name },
                { label: "Venue", value: eventDetails.venue },
                { label: "Date", value: eventDetails.date },
                { label: "VIPs", value: eventDetails.vipCount.toString() },
                { label: "Attendees", value: eventDetails.attendees.toLocaleString() },
                { label: "Security Staff", value: eventDetails.securityPersonnel.toString() },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Coverage Analysis */}
          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Coverage Analysis
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Overall Coverage", value: coverageAnalysis.overall },
                { label: "Perimeter", value: coverageAnalysis.perimeter },
                { label: "Interior", value: coverageAnalysis.interior },
                { label: "VIP Zones", value: coverageAnalysis.vipZones },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono text-cyan-400">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className="h-2" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-red-400">
              {coverageAnalysis.blindSpots} blind spots identified requiring remediation
            </p>
          </section>

          <Separator />

          {/* Threat Summary */}
          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Threat Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {[
                { label: "Total Incidents", value: threatSummary.totalIncidents, color: "text-foreground" },
                { label: "Critical", value: threatSummary.critical, color: getThreatColor("critical") },
                { label: "High", value: threatSummary.high, color: getThreatColor("high") },
                { label: "Medium", value: threatSummary.medium, color: getThreatColor("medium") },
                { label: "Low", value: threatSummary.low, color: getThreatColor("low") },
                { label: "Resolved", value: threatSummary.resolved, color: "text-green-400" },
                { label: "Avg Response", value: threatSummary.avgResponseTime, color: "text-cyan-400" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/60 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={cn("mt-1 text-lg font-bold font-mono", item.color)}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Recommendations */}
          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Recommendations
            </h3>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 rounded-lg bg-secondary/20 p-3"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] text-cyan-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{rec}</p>
                </motion.div>
              ))}
            </div>
          </section>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
