"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Loader2, Shield, DoorOpen } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BlueprintViewer } from "@/components/shared/BlueprintViewer";
import { RiskIndicator } from "@/components/shared/RiskIndicator";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { blueprintApi, type CoverageAnalysisResult } from "@/lib/api/blueprint";
import type { BlindSpot, BlueprintMarker, CoverageArea } from "@/types";
import { cn, getThreatBgColor, getThreatColor } from "@/lib/utils";

const recIcons = {
  camera: Camera,
  guard: Shield,
  entrance: DoorOpen,
  general: Shield,
};

export default function CoverageAnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<BlueprintMarker[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CoverageAnalysisResult | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await blueprintApi.analyzeCoverage();
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await blueprintApi.get();
        setMarkers(res.blueprint.markers);
        setImageUrl(res.blueprint.storageUrl);
        await runAnalysis();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load blueprint");
      } finally {
        setLoading(false);
      }
    })();
  }, [runAnalysis]);

  const metrics = analysis?.metrics ?? {
    coveragePercentage: 0,
    blindSpotsFound: 0,
    vulnerabilityScore: 0,
  };
  const coverageAreas: CoverageArea[] = analysis?.coverageAreas ?? [];
  const blindSpots: BlindSpot[] = analysis?.blindSpots ?? [];
  const recommendations = analysis?.recommendations ?? [];

  if (loading) {
    return (
      <AppLayout title="Coverage Analysis" subtitle="Camera coverage assessment and blind spot detection">
        <LoadingState message="Loading coverage data..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Coverage Analysis"
      subtitle="Rule-based coverage engine — PostgreSQL markers"
    >
      <PageHeader
        title="Coverage Analysis"
        description="Analyze camera coverage, identify blind spots, and review security recommendations"
        action={
          <Button
            size="sm"
            onClick={() => void runAnalysis()}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Re-run analysis"
            )}
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="soc-panel">
          <CardContent className="p-4">
            <RiskIndicator
              score={metrics.coveragePercentage}
              label="Coverage Percentage"
            />
            <Progress value={metrics.coveragePercentage} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card className="soc-panel">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Blind Spots Found
            </p>
            <p className="mt-1 text-3xl font-bold font-mono text-red-400">
              {metrics.blindSpotsFound}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Requiring immediate attention
            </p>
          </CardContent>
        </Card>
        <Card className="soc-panel">
          <CardContent className="p-4">
            <RiskIndicator
              score={metrics.vulnerabilityScore}
              label="Vulnerability Score"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="soc-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Blueprint View — Coverage Overlay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BlueprintViewer
              markers={markers.filter((m) => m.type === "camera")}
              coverageAreas={coverageAreas}
              blindSpots={blindSpots}
              imageUrl={imageUrl}
              showFloorPlanSvg={!imageUrl}
              showCoverage
              showBlindSpots
            />
            <div className="mt-3 flex flex-wrap gap-4 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border border-cyan-500/30 bg-cyan-500/10" />
                <span className="text-muted-foreground">Coverage Area</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 border-2 border-dashed border-red-500/60 bg-red-500/10" />
                <span className="text-muted-foreground">Blind Spot</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-cyan-500" />
                <span className="text-muted-foreground">Camera Position</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="soc-panel">
            <CardHeader>
              <CardTitle className="text-sm">Blind Spot Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {blindSpots.length === 0 ? (
                <p className="text-xs text-muted-foreground">No blind spots detected.</p>
              ) : (
                blindSpots.map((spot, i) => (
                  <motion.div
                    key={spot.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={cn("rounded-lg border p-3", getThreatBgColor(spot.severity))}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{spot.id.toUpperCase()}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] uppercase", getThreatColor(spot.severity))}
                      >
                        {spot.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{spot.description}</p>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Security Recommendations
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {recommendations.map((rec, i) => {
            const Icon = recIcons[rec.type as keyof typeof recIcons] ?? Shield;
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="soc-panel h-full transition-all hover:border-cyan-500/20 hover:shadow-glow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-cyan-500/10 p-2">
                        <Icon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">{rec.title}</h4>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] uppercase", getThreatColor(rec.priority))}
                          >
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                        {rec.location && (
                          <p className="mt-2 text-[10px] text-cyan-400">{rec.location}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
