"use client";

import { useEffect, useRef, useState } from "react";
import { pollRoom } from "@/lib/webrtc";
import { FRAME_RELAY_INTERVAL_MS } from "@/lib/streaming";
import type { Detection } from "@/types";

type RelayRoom = {
  detections?: Detection[];
  detectionsUpdatedAt?: number;
};

/** Polls YOLO + face-ID detections for multiple camera relay rooms. */
export function useMultiCameraRelayDetections(
  cameraIds: string[],
  pollMs = FRAME_RELAY_INTERVAL_MS
) {
  const [byCamera, setByCamera] = useState<Record<string, Detection[]>>({});
  const lastAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (cameraIds.length === 0) {
      setByCamera({});
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const updates: Record<string, Detection[]> = {};

      await Promise.all(
        cameraIds.map(async (cameraId) => {
          try {
            const room = (await pollRoom(cameraId)) as RelayRoom;
            const updatedAt = room.detectionsUpdatedAt ?? 0;
            if (updatedAt && updatedAt !== lastAtRef.current[cameraId]) {
              lastAtRef.current[cameraId] = updatedAt;
              updates[cameraId] = room.detections ?? [];
            }
          } catch {
            /* room may be offline */
          }
        })
      );

      if (!cancelled && Object.keys(updates).length > 0) {
        setByCamera((prev) => ({ ...prev, ...updates }));
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cameraIds.join(","), pollMs]);

  return byCamera;
}
