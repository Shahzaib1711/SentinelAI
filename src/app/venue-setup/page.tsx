"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  Camera,
  DoorOpen,
  FileImage,
  Loader2,
  LogOut,
  Map,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BlueprintViewer } from "@/components/shared/BlueprintViewer";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { blueprintApi } from "@/lib/api/blueprint";
import { cn } from "@/lib/utils";
import type { BlueprintLayout, BlueprintMarker, MarkerType } from "@/types";

const tools: { type: MarkerType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "camera", label: "Add Camera", icon: Camera, color: "text-cyan-400" },
  { type: "entrance", label: "Add Entrance", icon: DoorOpen, color: "text-green-400" },
  { type: "exit", label: "Add Exit", icon: LogOut, color: "text-blue-400" },
  { type: "guard", label: "Add Guard Post", icon: Shield, color: "text-purple-400" },
  { type: "restricted", label: "Restricted Zone", icon: Ban, color: "text-red-400" },
];

function nextMarkerLabel(type: MarkerType, markers: BlueprintMarker[]): string {
  const count = markers.filter((m) => m.type === type).length + 1;
  if (type === "camera") return `CAM-${String(count).padStart(2, "0")}`;
  return `${type.replace("-", "_")}-${count}`;
}

export default function VenueSetupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [floorLevel, setFloorLevel] = useState("L1");
  const [blueprintName, setBlueprintName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [markers, setMarkers] = useState<BlueprintMarker[]>([]);
  const [layout, setLayout] = useState<BlueprintLayout | null>(null);
  const [activeTool, setActiveTool] = useState<MarkerType | null>(null);
  const [uploadType, setUploadType] = useState("Floor Plan");
  const [detectSummary, setDetectSummary] = useState<string | null>(null);

  const loadBlueprint = useCallback(async () => {
    setError(null);
    try {
      const res = await blueprintApi.get();
      setVenueName(res.venue.name);
      setFloorLevel(res.venue.floorLevel);
      setBlueprintName(res.blueprint.name);
      setImageUrl(res.blueprint.storageUrl);
      setMarkers(res.blueprint.markers);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load blueprint";
      if (msg.includes("500") || msg.includes("fetch")) {
        setError(
          "Cannot reach the API. Start the backend with npm run api:dev and ensure PostgreSQL is running (npm run db:push && npm run db:seed)."
        );
      } else if (msg.toLowerCase().includes("not found")) {
        setError("Blueprint not found. Run npm run db:seed to load demo venue data.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlueprint();
  }, [loadBlueprint]);

  const handleAddMarker = useCallback(
    async (marker: Omit<BlueprintMarker, "id">) => {
      setSaving(true);
      setError(null);
      try {
        const label = nextMarkerLabel(marker.type, markers);
        const res = await blueprintApi.addMarker({
          type: marker.type,
          x: marker.x,
          y: marker.y,
          label,
        });
        setMarkers((prev) => [...prev, res.marker]);
        setActiveTool(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add marker");
      } finally {
        setSaving(false);
      }
    },
    [markers]
  );

  const runAutoDetect = useCallback(async (storageUrl?: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await blueprintApi.autoDetect(true, storageUrl);
      setMarkers(res.markers);
      setLayout(res.layout ?? null);
      const walls =
        typeof res.summary?.wallCount === "number" ? res.summary.wallCount : res.layout?.walls?.length ?? 0;
      const rooms =
        typeof res.summary?.roomCount === "number" ? res.summary.roomCount : res.layout?.rooms?.length ?? 0;
      const entrances = res.markers.filter((m) => m.type === "entrance").length;
      const method =
        typeof res.summary?.method === "string"
          ? res.summary.method.includes("ml_yolo")
            ? "ML"
            : "OpenCV"
          : "auto";
      const hint =
        typeof res.summary?.hint === "string" && method === "OpenCV"
          ? ` ${res.summary.hint}`
          : "";
      setDetectSummary(
        `Detected ${walls} walls, ${rooms} rooms, ${entrances} entrance(s) via ${method} — add cameras and guards manually${hint}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-detection failed");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleDeleteMarker = async (markerId: string) => {
    setSaving(true);
    setError(null);
    try {
      await blueprintApi.deleteMarker(markerId);
      setMarkers((prev) => prev.filter((m) => m.id !== markerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete marker");
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (file: File, type: string) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload a PNG or JPG image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      await blueprintApi.updateStorage({
        storageUrl: dataUrl,
        name: `${type} — ${file.name}`,
        type: type.toLowerCase().replace(" ", "_"),
      });
      setImageUrl(dataUrl);
      setBlueprintName(`${type} — ${file.name}`);
      await runAutoDetect(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Venue Setup" subtitle="Phase 1 — Pre-Event Security Assessment">
        <LoadingState message="Loading venue blueprint..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Venue Setup"
      subtitle="Phase 1 — Pre-Event Security Assessment"
    >
      <PageHeader
        title="Blueprint & Venue Configuration"
        description="Upload a floor plan — ML detects walls and splits rooms from layout. ROOM-01 labels are geometric zones (text on the drawing is not read yet)."
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={saving || !imageUrl}
            onClick={() => void runAutoDetect()}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4 text-cyan-400" />
            )}
            Re-run auto-detect
          </Button>
        }
      />

      {detectSummary && (
        <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
          {detectSummary}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-1">
          <Card className="soc-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Upload Blueprint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelect(file, uploadType);
                  e.target.value = "";
                }}
              />
              <Tabs defaultValue="floor-plan">
                <TabsList className="w-full">
                  <TabsTrigger value="floor-plan" className="flex-1 text-xs">Floor Plan</TabsTrigger>
                  <TabsTrigger value="blueprint" className="flex-1 text-xs">Blueprint</TabsTrigger>
                  <TabsTrigger value="site-map" className="flex-1 text-xs">Site Map</TabsTrigger>
                </TabsList>
                <TabsContent value="floor-plan" className="mt-3">
                  <UploadZone
                    onPick={() => {
                      setUploadType("Floor Plan");
                      fileRef.current?.click();
                    }}
                    uploading={saving}
                    type="Floor Plan"
                    hasImage={!!imageUrl}
                  />
                </TabsContent>
                <TabsContent value="blueprint" className="mt-3">
                  <UploadZone
                    onPick={() => {
                      setUploadType("Blueprint");
                      fileRef.current?.click();
                    }}
                    uploading={saving}
                    type="Blueprint"
                    hasImage={!!imageUrl}
                  />
                </TabsContent>
                <TabsContent value="site-map" className="mt-3">
                  <UploadZone
                    onPick={() => {
                      setUploadType("Site Map");
                      fileRef.current?.click();
                    }}
                    uploading={saving}
                    type="Site Map"
                    hasImage={!!imageUrl}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="soc-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Manual override (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Button
                    key={tool.type}
                    variant={activeTool === tool.type ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start text-xs",
                      activeTool === tool.type && "bg-cyan-500/20 text-cyan-400"
                    )}
                    onClick={() =>
                      setActiveTool(activeTool === tool.type ? null : tool.type)
                    }
                    disabled={saving}
                  >
                    <Icon className={cn("mr-2 h-4 w-4", tool.color)} />
                    {tool.label}
                  </Button>
                );
              })}
              {activeTool && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 rounded bg-cyan-500/10 p-2 text-[10px] text-cyan-400"
                >
                  Click on the blueprint to place a {activeTool.replace("-", " ")} marker
                </motion.p>
              )}
            </CardContent>
          </Card>

          <Card className="soc-panel">
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Markers Placed</span>
                  <span className="font-mono text-cyan-400">{markers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rooms (ML)</span>
                  <span className="font-mono text-emerald-400">{layout?.rooms?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Walls (ML)</span>
                  <span className="font-mono text-orange-400">{layout?.walls?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cameras</span>
                  <span className="font-mono">{markers.filter((m) => m.type === "camera").length}</span>
                </div>
              </div>
              {markers.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto border-t border-border/40 pt-2">
                  {markers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[10px] hover:bg-muted/30"
                    >
                      <span className="truncate font-mono text-cyan-400">{m.label}</span>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-red-400"
                        onClick={() => void handleDeleteMarker(m.id)}
                        disabled={saving}
                        aria-label={`Remove ${m.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="soc-panel soc-glow-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm">Venue Blueprint Workspace</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {venueName} — {floorLevel}
                  {blueprintName ? ` · ${blueprintName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-cyan-400" />
                <span className="font-mono text-xs text-cyan-400">ACTIVE</span>
              </div>
            </CardHeader>
            <CardContent>
              <BlueprintViewer
                markers={markers}
                layout={layout}
                showLayout={Boolean(imageUrl)}
                imageUrl={imageUrl}
                floorLabel={`${floorLevel} · ${blueprintName || "Venue map"}`}
                showFloorPlanSvg={!imageUrl}
                activeTool={activeTool}
                onAddMarker={handleAddMarker}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function UploadZone({
  onPick,
  uploading,
  type,
  hasImage,
}: {
  onPick: () => void;
  uploading: boolean;
  type: string;
  hasImage?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer flex-col items-center rounded-lg border border-dashed border-border/60 p-4 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5"
      onClick={onPick}
      disabled={uploading}
    >
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      ) : (
        <FileImage className="h-8 w-8 text-muted-foreground/40" />
      )}
      <p className="mt-2 text-xs font-medium">
        {uploading ? "Uploading..." : hasImage ? `Replace ${type}` : `Upload ${type}`}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        PNG, JPG, WebP · Max 8MB · auto-detects on upload
      </p>
    </button>
  );
}
