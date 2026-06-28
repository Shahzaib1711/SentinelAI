"use client";

import { useEffect, useRef, useState } from "react";
import { pollRoom } from "@/lib/webrtc";
import { FRAME_RELAY_INTERVAL_MS } from "@/lib/streaming";
import type { Detection } from "@/types";

type RelayState = "waiting" | "connected";

interface RelayRoom {
  broadcasterOnline?: boolean;
  frame?: string;
  frameUpdatedAt?: number;
  detections?: Detection[];
  detectionsUpdatedAt?: number;
}

const RELAY_GRACE_MS = 5_000;

/** Polls relayed JPEG frames and YOLO detections from the API. */
export function useFrameRelayView(cameraId: string, enabled = true) {
  const [state, setState] = useState<RelayState>("waiting");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const lastFrameAtRef = useRef(0);
  const lastDetectionsAtRef = useRef(0);
  const lastOkAtRef = useRef(0);
  const hasFrameRef = useRef(false);

  useEffect(() => {
    if (!enabled || !cameraId) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      try {
        const room = (await pollRoom(cameraId)) as RelayRoom;

        if (!room.broadcasterOnline || !room.frame) {
          if (lastOkAtRef.current + RELAY_GRACE_MS > now && hasFrameRef.current) {
            return;
          }
          setState("waiting");
          return;
        }

        lastOkAtRef.current = now;

        if (room.frameUpdatedAt !== lastFrameAtRef.current) {
          lastFrameAtRef.current = room.frameUpdatedAt ?? 0;
          setFrameSrc(room.frame ?? null);
          hasFrameRef.current = true;
          setState("connected");
        } else if (hasFrameRef.current) {
          setState("connected");
        }

        if (
          room.detectionsUpdatedAt &&
          room.detectionsUpdatedAt !== lastDetectionsAtRef.current
        ) {
          lastDetectionsAtRef.current = room.detectionsUpdatedAt;
          setDetections(room.detections ?? []);
        }
      } catch {
        if (lastOkAtRef.current + RELAY_GRACE_MS > now && hasFrameRef.current) {
          return;
        }
        setState("waiting");
      }
    }, FRAME_RELAY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [cameraId, enabled]);

  return { state, frameSrc, detections };
}
