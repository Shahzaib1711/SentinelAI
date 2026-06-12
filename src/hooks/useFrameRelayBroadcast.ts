"use client";

import { useEffect, useRef } from "react";
import { signalFetch } from "@/lib/webrtc";

/** Captures video frames and POSTs JPEGs through the API (works reliably via ngrok). */
export function useFrameRelayBroadcast(
  cameraId: string,
  sessionId: string,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    canvasRef.current = document.createElement("canvas");

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      if (w === 0 || h === 0) return;

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, w, h);
      const frame = canvas.toDataURL("image/jpeg", 0.6);

      void signalFetch(cameraId, {
        action: "frame",
        sessionId,
        frame,
      });
    }, 300);

    return () => clearInterval(interval);
  }, [cameraId, sessionId, videoRef, enabled]);
}
