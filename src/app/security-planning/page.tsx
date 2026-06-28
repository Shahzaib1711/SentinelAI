"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  Camera,
  CheckCircle2,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BlueprintViewer } from "@/components/shared/BlueprintViewer";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { blueprintApi } from "@/lib/api/blueprint";
import { securityPlanApi, type SecurityPlanPayload } from "@/lib/api/security-plan";
import { SecurityPlanRefine } from "@/components/shared/SecurityPlanRefine";
import { useEvent } from "@/contexts/EventContext";
import type { BlueprintMarker } from "@/types";
import { cn } from "@/lib/utils";

const EXAMPLE_BRIEF =
  "Analyze this floor plan for event security. Deploy 4 guards at doors and entrances. Cover the whole venue with cameras — no blind spots. Maximum security posture.";

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
};

export default function SecurityPlanningPage() {
  const { slug } = useEvent();
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [markers, setMarkers] = useState<BlueprintMarker[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [plan, setPlan] = useState<SecurityPlanPayload | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const bp = await blueprintApi.get(slug);
        const m = bp.blueprint.markers.filter((x) => x.type !== "vip-route");
        setMarkers(m);
        setImageUrl(bp.blueprint.storageUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load blueprint first in Venue Setup");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const runPlan = useCallback(
    async (persist = false) => {
      setPlanning(true);
      setError(null);
      if (!persist) setApplied(false);
      try {
        const res = await securityPlanApi.generate({ instructions, persist }, slug);
        setPlan(res.plan);
        if (persist) setApplied(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Planning failed");
      } finally {
        setPlanning(false);
        setApplying(false);
      }
    },
    [instructions, slug]
  );

  const handlePlanFromChat = useCallback((updated: SecurityPlanPayload) => {
    setPlan(updated);
    setApplied(false);
  }, []);

  const displayMarkers = useMemo((): BlueprintMarker[] => {
    if (!plan) return markers;
    const proposed: BlueprintMarker[] = [
      ...plan.proposedGuards.map((g, i) => ({
        id: `proposed-g-${i}`,
        type: "guard" as const,
        x: g.x,
        y: g.y,
        label: `[Proposed] ${g.label}`,
      })),
      ...plan.proposedCameras.map((c, i) => ({
        id: `proposed-c-${i}`,
        type: "camera" as const,
        x: c.x,
        y: c.y,
        label: `[Proposed] ${c.label}`,
      })),
    ];
    return [...markers, ...proposed];
  }, [markers, plan]);

  if (loading) {
    return (
      <AppLayout title="Security Planning" subtitle="AI agent — blueprint to deployment plan">
        <LoadingState message="Loading blueprint..." />
      </AppLayout>
    );
  }

  const blueprintStats = plan?.securityAnalysis?.blueprint;
  const findings = plan?.securityAnalysis?.findings ?? [];

  return (
    <AppLayout title="Security Planning" subtitle="Blueprint analysis · coverage · guard deployment">
      <PageHeader
        title="Security Planning Agent"
        description="Upload a floor plan in Venue Setup, describe your security requirements — the agent reads the drawing, runs overall security analysis, and proposes guard and camera deployment."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <Card className="soc-panel">
            <CardContent className="p-0">
              <BlueprintViewer
                markers={displayMarkers}
                imageUrl={imageUrl}
                showLayout={false}
                showBlindSpots={false}
                className="min-h-[420px]"
              />
            </CardContent>
          </Card>

          {blueprintStats && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Doors", value: blueprintStats.doors },
                { label: "Windows", value: blueprintStats.windows },
                { label: "Columns", value: blueprintStats.columns },
                { label: "Walls", value: blueprintStats.walls },
              ].map((stat) => (
                <Card key={stat.label} className="soc-panel">
                  <CardContent className="p-3 text-center">
                    <p className="font-mono text-lg text-cyan-400">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="soc-panel">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                Security brief
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Describe requirements, run analysis, then refine the plan below
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder={EXAMPLE_BRIEF}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                className="text-xs"
              />
              <Button
                className="w-full"
                disabled={planning || !imageUrl}
                onClick={() => void runPlan(false)}
              >
                {planning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing blueprint...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    {plan ? "Re-run analysis" : "Run security analysis"}
                  </>
                )}
              </Button>
              {plan && (
                <SecurityPlanRefine
                  instructions={instructions}
                  plan={plan}
                  slug={slug}
                  disabled={planning}
                  onPlanUpdate={handlePlanFromChat}
                />
              )}
            </CardContent>
          </Card>

          {plan && (
            <>
              <Card className="soc-panel border-cyan-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Analysis summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground">
                  <p className="text-foreground">{plan.summary}</p>
                  <p>{plan.blueprintUnderstanding}</p>
                  <div className="flex gap-4 font-mono text-[10px]">
                    <span>
                      Coverage {plan.coverageBefore.coveragePercentage}% →{" "}
                      <span className="text-cyan-400">{plan.coverageAfter.coveragePercentage}%</span>
                    </span>
                    <span>
                      Risk {plan.coverageBefore.vulnerabilityScore} →{" "}
                      <span className="text-green-400">{plan.coverageAfter.vulnerabilityScore}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>

              {findings.length > 0 && (
                <Card className="soc-panel">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Security findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-48 space-y-2 overflow-y-auto">
                    {findings.map((f, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded border p-2 text-[10px]",
                          SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info
                        )}
                      >
                        <p className="font-medium">{f.title}</p>
                        <p className="opacity-80">{f.detail}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="soc-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-purple-400" />
                    Proposed guards ({plan.proposedGuards.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-40 space-y-2 overflow-y-auto">
                  {plan.proposedGuards.map((g, i) => (
                    <div key={i} className="rounded border border-purple-500/20 bg-purple-500/5 p-2 text-[10px]">
                      <span className="font-mono text-purple-300">{g.label}</span>
                      <p className="text-muted-foreground">{g.reason}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="soc-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Camera className="h-4 w-4 text-cyan-400" />
                    Proposed cameras ({plan.proposedCameras.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-40 space-y-2 overflow-y-auto">
                  {plan.proposedCameras.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No additional cameras needed.</p>
                  ) : (
                    plan.proposedCameras.map((c, i) => (
                      <div key={i} className="rounded border border-cyan-500/20 bg-cyan-500/5 p-2 text-[10px]">
                        <span className="font-mono text-cyan-300">{c.label}</span>
                        <p className="text-muted-foreground">{c.reason}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="soc-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Agent reasoning</CardTitle>
                </CardHeader>
                <CardContent className="max-h-48 space-y-2 overflow-y-auto">
                  {plan.agentReview.reasoningSteps.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-l-2 border-cyan-500/40 pl-2"
                    >
                      <p className="text-[10px] font-medium text-cyan-400">{step.phase}</p>
                      <p className="text-[10px] text-muted-foreground">{step.detail}</p>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              <Button
                variant={applied ? "outline" : "default"}
                className={cn("w-full", applied && "border-green-500/40 text-green-400")}
                disabled={applying || applied}
                onClick={() => {
                  setApplying(true);
                  void runPlan(true);
                }}
              >
                {applied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Plan applied to blueprint
                  </>
                ) : applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Apply plan to Venue Setup"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
