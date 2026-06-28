"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Camera, ExternalLink, Wifi, WifiOff, Wrench, X } from "lucide-react";
import { getBroadcastPath } from "@/lib/camera-urls";
import { cn } from "@/lib/utils";
import type { Camera as CameraType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WebRTCViewer } from "@/components/shared/WebRTCViewer";
import { DetectionOverlay } from "@/components/shared/DetectionOverlay";
import type { Detection } from "@/types";

interface CameraCardProps {
  camera: CameraType;
  showFeed?: boolean;
  detections?: Detection[];
  showBroadcastLink?: boolean;
  isSelected?: boolean;
  compareMode?: boolean;
  className?: string;
  onFeedClick?: () => void;
}

interface CameraFeedLightboxProps {
  cameras: CameraType[];
  getDetections: (cameraId: string) => Detection[];
  onClose: () => void;
  onRemoveCamera?: (cameraId: string) => void;
}

const statusConfig = {
  online: { icon: Wifi, color: "text-green-400", bg: "bg-green-500/10", label: "ONLINE" },
  offline: { icon: WifiOff, color: "text-red-400", bg: "bg-red-500/10", label: "OFFLINE" },
  maintenance: { icon: Wrench, color: "text-yellow-400", bg: "bg-yellow-500/10", label: "MAINT" },
};

function CameraFeedContent({
  camera,
  detections = [],
  className,
}: {
  camera: CameraType;
  detections?: Detection[];
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-video bg-black/80", className)}>
      <div className="absolute inset-0 soc-grid opacity-30" />
      {camera.status === "online" ? (
        <>
          {camera.useWebRTC ? (
            <WebRTCViewer cameraId={camera.id} className="absolute inset-0 z-0" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 h-px animate-scan bg-cyan-500/30" />
              </div>
              <DetectionOverlay detections={detections} />
            </>
          )}
          {!camera.useWebRTC && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-[10px] text-red-400">REC</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center">
          <Camera className="h-8 w-8 text-muted-foreground/30" />
          <span className="ml-2 text-xs text-muted-foreground">No Signal</span>
        </div>
      )}
    </div>
  );
}

function expandedMaxWidth(count: number): string {
  if (count <= 1) return "max-w-5xl";
  if (count === 2) return "max-w-6xl";
  return "max-w-7xl";
}

function expandedGridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  return "grid-cols-1 md:grid-cols-2";
}

export function CameraFeedLightbox({
  cameras,
  getDetections,
  onClose,
  onRemoveCamera,
}: CameraFeedLightboxProps) {
  const open = cameras.length > 0;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close expanded camera feeds"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${cameras.length} camera feeds`}
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className={cn(
                "pointer-events-auto my-auto w-full overflow-hidden rounded-xl border border-cyan-500/30 bg-card shadow-2xl shadow-cyan-500/10",
                expandedMaxWidth(cameras.length)
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {cameras.length === 1 ? "Expanded feed" : `Multi-view · ${cameras.length} feeds`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {cameras.length > 1
                      ? "Side-by-side monitoring — remove feeds or press Esc to close"
                      : "Press Esc or click outside to close"}
                  </p>
                </div>
                <Button variant="outline" size="icon" className="shrink-0" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className={cn("grid gap-px bg-border/40", expandedGridCols(cameras.length))}>
                {cameras.map((camera) => {
                  const status = statusConfig[camera.status];
                  const detections = camera.useWebRTC ? [] : getDetections(camera.id);

                  return (
                    <div key={camera.id} className="flex flex-col bg-card">
                      <CameraFeedContent camera={camera} detections={detections} className="aspect-video" />
                      <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Camera className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                            <span className="font-mono text-xs font-medium">{camera.id}</span>
                            <Badge
                              variant="outline"
                              className={cn("text-[9px]", status.bg, status.color)}
                            >
                              {status.label}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-foreground">{camera.name}</p>
                        </div>
                        {onRemoveCamera && cameras.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 text-[10px] text-muted-foreground"
                            onClick={() => onRemoveCamera(camera.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CameraCard({
  camera,
  showFeed = false,
  detections = [],
  showBroadcastLink = false,
  isSelected = false,
  compareMode = false,
  className,
  onFeedClick,
}: CameraCardProps) {
  const status = statusConfig[camera.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className={cn(
        "overflow-hidden rounded-lg border bg-card transition-all hover:shadow-glow",
        isSelected
          ? "border-cyan-400 ring-2 ring-cyan-400/40"
          : "border-border/60 hover:border-cyan-500/30",
        className
      )}
    >
      {showFeed ? (
        <button
          type="button"
          className={cn(
            "relative block w-full text-left",
            onFeedClick && "cursor-pointer group/feed"
          )}
          onClick={onFeedClick}
          disabled={!onFeedClick}
        >
          <CameraFeedContent camera={camera} detections={camera.useWebRTC ? [] : detections} />
          {onFeedClick && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/0 transition-colors group-hover/feed:bg-black/20">
              <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white opacity-0 transition-opacity group-hover/feed:opacity-100">
                {compareMode ? (isSelected ? "Deselect" : "Select") : "Expand"}
              </span>
            </div>
          )}
          {compareMode && isSelected && (
            <div className="absolute right-2 top-2 z-20 rounded-full bg-cyan-500 px-2 py-0.5 text-[9px] font-bold text-black">
              ✓
            </div>
          )}
        </button>
      ) : null}

      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-sm font-medium">{camera.id}</span>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", status.bg, status.color)}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{camera.name}</p>
        <p className="text-[10px] text-muted-foreground/70">{camera.location}</p>
        {showBroadcastLink && camera.status === "online" && (
          <Link
            href={getBroadcastPath(camera.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open broadcast link
          </Link>
        )}
        {camera.status === "online" && (
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="text-muted-foreground">Coverage</span>
              <span className="font-mono text-cyan-400">{camera.coverage}%</span>
            </div>
            <Progress value={camera.coverage} className="h-1" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
