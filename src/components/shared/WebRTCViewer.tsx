"use client";

import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { getBroadcastPath } from "@/lib/camera-urls";
import { cn } from "@/lib/utils";
import { useFrameRelayView } from "@/hooks/useFrameRelayView";
import { DetectionOverlay } from "@/components/shared/DetectionOverlay";

interface WebRTCViewerProps {
  cameraId: string;
  className?: string;
}

/** Live phone feed via server-relayed frames (reliable through ngrok). */
export function WebRTCViewer({ cameraId, className }: WebRTCViewerProps) {
  const { state, frameSrc, detections } = useFrameRelayView(cameraId);

  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      {frameSrc && state === "connected" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frameSrc}
            alt={`Live feed ${cameraId}`}
            className="h-full w-full object-cover"
          />
          <DetectionOverlay detections={detections} />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/90 p-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          <p className="text-xs text-muted-foreground">Waiting for phone camera...</p>
          <Link
            href={getBroadcastPath(cameraId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-cyan-400 hover:underline"
          >
            Open broadcast link on phone →
          </Link>
        </div>
      )}

      {state === "connected" && (
        <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-[10px] text-red-400">LIVE</span>
          </div>
          {detections.length > 0 && (
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
              YOLO · {detections.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function WebRTCFeedPlaceholder({ cameraId }: { cameraId: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-900 p-4 text-center">
      <Camera className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-[10px] text-muted-foreground">
        Phone stream: /broadcast?camera={cameraId}
      </p>
    </div>
  );
}
