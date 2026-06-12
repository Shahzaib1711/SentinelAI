"use client";

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, Loader2, Radio, XCircle } from "lucide-react";
import { useWebRTCBroadcast } from "@/hooks/useWebRTCBroadcast";
import { cn } from "@/lib/utils";

function BroadcastContent() {
  const searchParams = useSearchParams();
  const cameraId = searchParams.get("camera") || "CAM-01";
  const videoRef = useRef<HTMLVideoElement>(null);

  const { state, error, viewers, retry } = useWebRTCBroadcast(cameraId, videoRef);

  const broadcastUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0e17] text-foreground">
      <header className="border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-1.5">
            <Radio className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold">SentinelAI Broadcast</h1>
            <p className="font-mono text-[10px] text-cyan-400">{cameraId}</p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col p-4">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-cyan-500/30 bg-black shadow-glow">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          {(state === "initializing" || state === "requesting-camera") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="mt-3 text-sm text-muted-foreground">
                {state === "requesting-camera"
                  ? "Allow camera access when prompted..."
                  : "Starting broadcast..."}
              </p>
            </div>
          )}

          {state === "live" && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-500/90 px-2.5 py-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
              <span className="text-[10px] font-bold text-white">LIVE</span>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <StatusRow
            ok={state === "live"}
            label="Broadcast status"
            value={
              state === "live"
                ? "Streaming"
                : state === "error"
                  ? "Error"
                  : "Starting..."
            }
          />
          <StatusRow ok={state === "live"} label="Camera ID" value={cameraId} />
          <StatusRow
            ok={viewers > 0}
            label="Dashboard viewers"
            value={viewers > 0 ? `${viewers} connected` : "Waiting for viewer"}
          />
        </div>

        {state === "error" && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-400">Broadcast failed</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                <button
                  type="button"
                  onClick={() => void retry()}
                  className="mt-3 rounded-md bg-cyan-500 px-4 py-2 text-xs font-medium text-black"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {state === "live" && (
          <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-green-400">Broadcasting successfully</p>
                <p className="mt-2">Keep this page open and screen on.</p>
                <p className="mt-2">
                  On your PC, open <strong className="text-foreground">Live Monitoring</strong>{" "}
                  to view this feed in the SOC dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 break-all text-center font-mono text-[10px] text-muted-foreground/60">
          {broadcastUrl}
        </p>
      </main>
    </div>
  );
}

function StatusRow({
  ok,
  label,
  value,
}: {
  ok: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xs font-medium",
          ok ? "text-green-400" : "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function BroadcastPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0e17]">
          <Camera className="h-8 w-8 animate-pulse text-cyan-400" />
        </div>
      }
    >
      <BroadcastContent />
    </Suspense>
  );
}
