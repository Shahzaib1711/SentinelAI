"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { CameraCard, CameraFeedLightbox } from "@/components/shared/CameraCard";
import { CameraFeedLinks } from "@/components/shared/CameraFeedLinks";
import { PersonnelFloorMap } from "@/components/shared/PersonnelFloorMap";
import { useCameraRelayRooms } from "@/hooks/useCameraRelayRooms";
import { useLivePersonnel } from "@/hooks/useLivePersonnel";
import { AlertList } from "@/components/shared/AlertCard";
import { LiveThreatIndicator } from "@/components/shared/ThreatCard";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api-client";
import { useEvent } from "@/contexts/EventContext";
import {
  cameras as mockCameras,
  recentAlerts as mockAlerts,
  threatTimeline,
  dashboardKPIs,
} from "@/lib/mock-data";
import type { Alert, Camera, ThreatLevel } from "@/types";
import { cn, getThreatBgColor, getThreatColor, getThreatDotColor } from "@/lib/utils";

const CAMERA_STATUS_ORDER: Record<Camera["status"], number> = {
  online: 0,
  maintenance: 1,
  offline: 2,
};

function sortCamerasForFeed(list: Camera[]): Camera[] {
  return [...list].sort(
    (a, b) => CAMERA_STATUS_ORDER[a.status] - CAMERA_STATUS_ORDER[b.status]
  );
}

export default function LiveMonitoringPage() {
  const { slug } = useEvent();
  const [cameras, setCameras] = useState<Camera[]>(mockCameras);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>(dashboardKPIs.threatLevel);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "mock">("mock");
  const [expandedCameras, setExpandedCameras] = useState<Camera[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);

  const MAX_COMPARE = 4;
  const feedCameras = useMemo(
    () => sortCamerasForFeed(cameras).slice(0, 6),
    [cameras]
  );
  const feedCameraIds = useMemo(
    () => feedCameras.map((c) => c.id),
    [feedCameras]
  );
  const relayRooms = useCameraRelayRooms(feedCameraIds);
  const { personnel, summary: personnelSummary } = useLivePersonnel(2000, slug);

  const toggleCompareMode = () => {
    setCompareMode((on) => {
      if (on) setSelectedCameraIds([]);
      return !on;
    });
  };

  const handleFeedClick = (camera: Camera) => {
    if (compareMode) {
      setSelectedCameraIds((prev) => {
        if (prev.includes(camera.id)) {
          return prev.filter((id) => id !== camera.id);
        }
        if (prev.length >= MAX_COMPARE) return prev;
        return [...prev, camera.id];
      });
      return;
    }
    setExpandedCameras([camera]);
  };

  const maximizeSelected = () => {
    const selected = feedCameras.filter((c) => selectedCameraIds.includes(c.id));
    if (selected.length >= 2) {
      setExpandedCameras(selected);
    }
  };

  const removeExpandedCamera = (cameraId: string) => {
    setExpandedCameras((prev) => {
      const next = prev.filter((c) => c.id !== cameraId);
      return next;
    });
  };

  useEffect(() => {
    void (async () => {
      try {
        const [camRes, alertRes, dashRes] = await Promise.all([
          api.cameras(slug),
          api.alerts(slug, true),
          api.dashboard(slug),
        ]);
        setCameras(camRes.cameras.length > 0 ? camRes.cameras : mockCameras);
        setAlerts(alertRes.alerts);
        setThreatLevel(dashRes.kpis.threatLevel as ThreatLevel);
        setDataSource("api");
      } catch {
        setDataSource("mock");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <AppLayout title="Live Monitoring" subtitle="Phase 2 — Real-time event security monitoring">
        <LoadingState message="Loading monitoring data..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Live Monitoring"
      subtitle={`Phase 2 — Real-time event security monitoring · ${dataSource === "api" ? "PostgreSQL" : "Mock data"}`}
    >
      <PageHeader
        title="Live Event Monitoring"
        description="YOLO person detection with guard/VIP zone identification and live floor-map tracking"
        action={<LiveThreatIndicator level={threatLevel} />}
      />

      <CameraFeedLinks cameras={feedCameras} className="mb-6" />

      <Card className="soc-panel mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm">Personnel Identification</CardTitle>
            <p className="text-xs text-muted-foreground">
              Face-matched staff from Personnel Registry — standing persons mapped to floor plan
            </p>
          </div>
          <div className="flex gap-3 font-mono text-[10px]">
            <span className="text-purple-400">{personnelSummary.guards} guards</span>
            <span className="text-yellow-400">{personnelSummary.vips} VIPs</span>
            <span className="text-cyan-400">{personnelSummary.visitors} visitors</span>
          </div>
        </CardHeader>
        <CardContent>
          <PersonnelFloorMap personnel={personnel} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <Card className="soc-panel soc-glow-border">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Camera Feed Grid
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={compareMode ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={toggleCompareMode}
                >
                  {compareMode ? "Compare on" : "Compare feeds"}
                </Button>
                {compareMode && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={selectedCameraIds.length < 2}
                      onClick={maximizeSelected}
                    >
                      Maximize ({selectedCameraIds.length})
                    </Button>
                    <span className="text-[10px] text-muted-foreground">
                      Select 2–{MAX_COMPARE} feeds
                    </span>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="font-mono text-xs text-red-400">LIVE</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feedCameras.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-16 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No cameras configured</p>
                  <p className="mt-2 max-w-sm text-xs text-muted-foreground/80">
                    Select the seeded event (summit-2026) or run{" "}
                    <code className="text-cyan-400">npm run db:seed</code> to load default camera
                    slots.
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {feedCameras.map((camera, i) => (
                  <motion.div
                    key={camera.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <CameraCard
                      camera={camera}
                      showFeed
                      showBroadcastLink
                      compareMode={compareMode}
                      isSelected={selectedCameraIds.includes(camera.id)}
                      relay={relayRooms[camera.id]}
                      onFeedClick={() => handleFeedClick(camera)}
                    />
                  </motion.div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="soc-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <AlertList alerts={alerts} compact />
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="soc-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Threat Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px]">
                <div className="relative space-y-0">
                  <div className="absolute bottom-0 left-[7px] top-0 w-px bg-border/60" />
                  {threatTimeline.map((event, i) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="relative flex gap-3 pb-4"
                    >
                      <div
                        className={cn(
                          "relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-background",
                          getThreatDotColor(event.level)
                        )}
                      />
                      <div className={cn("flex-1 rounded-lg border p-2.5", getThreatBgColor(event.level))}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-muted-foreground">{event.time}</span>
                          <span className={cn("text-[10px] font-medium uppercase", getThreatColor(event.level))}>
                            {event.level}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium">{event.title}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{event.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <CameraFeedLightbox
        cameras={expandedCameras}
        getRelay={(cameraId) => relayRooms[cameraId]}
        onClose={() => setExpandedCameras([])}
        onRemoveCamera={removeExpandedCamera}
      />
    </AppLayout>
  );
}
