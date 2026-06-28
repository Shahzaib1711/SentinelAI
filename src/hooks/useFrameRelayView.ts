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

/** Polls relayed JPEG frames and YOLO detections from the API. */
export function useFrameRelayView(cameraId: string) {
  const [state, setState] = useState<RelayState>("waiting");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const lastFrameAtRef = useRef(0);
  const lastDetectionsAtRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const room = (await pollRoom(cameraId)) as RelayRoom;

        if (!room.broadcasterOnline || !room.frame) {
          setState("waiting");
          return;
        }

        if (room.frameUpdatedAt !== lastFrameAtRef.current) {
          lastFrameAtRef.current = room.frameUpdatedAt ?? 0;
          setFrameSrc(room.frame ?? null);
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
        setState("waiting");
      }
    }, FRAME_RELAY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [cameraId]);

  return { state, frameSrc, detections };
}
