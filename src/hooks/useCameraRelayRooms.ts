"use client";

import { useEffect, useRef, useState } from "react";
import { pollRoom } from "@/lib/webrtc";
import { FRAME_RELAY_INTERVAL_MS } from "@/lib/streaming";
import type { Detection } from "@/types";

export type RelayState = "waiting" | "connected";

export interface CameraRelayState {
  state: RelayState;
  frameSrc: string | null;
  detections: Detection[];
}

type RelayRoom = {
  broadcasterOnline?: boolean;
  frame?: string;
  frameUpdatedAt?: number;
  detections?: Detection[];
  detectionsUpdatedAt?: number;
};

const RELAY_GRACE_MS = 5_000;

const EMPTY_RELAY: CameraRelayState = {
  state: "waiting",
  frameSrc: null,
  detections: [],
};

function relayEqual(a: CameraRelayState, b: CameraRelayState): boolean {
  return (
    a.state === b.state &&
    a.frameSrc === b.frameSrc &&
    a.detections === b.detections
  );
}

/**
 * Single poll loop per camera — shared by the feed grid and lightbox
 * (avoids duplicate /api/webrtc requests that can overload the relay).
 */
export function useCameraRelayRooms(
  cameraIds: string[],
  pollMs = FRAME_RELAY_INTERVAL_MS
) {
  const [byCamera, setByCamera] = useState<Record<string, CameraRelayState>>({});
  const lastFrameAtRef = useRef<Record<string, number>>({});
  const lastDetectionsAtRef = useRef<Record<string, number>>({});
  const lastOkAtRef = useRef<Record<string, number>>({});
  const cameraKey = cameraIds.join(",");

  useEffect(() => {
    const ids = cameraKey ? cameraKey.split(",") : [];

    if (ids.length === 0) {
      setByCamera({});
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const now = Date.now();

      await Promise.all(
        ids.map(async (cameraId) => {
          try {
            const room = (await pollRoom(cameraId)) as RelayRoom;

            setByCamera((prev) => {
              const cur = prev[cameraId] ?? EMPTY_RELAY;
              let next = cur;

              const online = Boolean(room.broadcasterOnline && room.frame);
              if (online) {
                lastOkAtRef.current[cameraId] = now;

                if (
                  room.frameUpdatedAt &&
                  room.frameUpdatedAt !== lastFrameAtRef.current[cameraId]
                ) {
                  lastFrameAtRef.current[cameraId] = room.frameUpdatedAt;
                  next = {
                    ...next,
                    frameSrc: room.frame ?? null,
                    state: "connected",
                  };
                } else if (next.frameSrc && next.state !== "connected") {
                  next = { ...next, state: "connected" };
                }

                if (
                  room.detectionsUpdatedAt &&
                  room.detectionsUpdatedAt !== lastDetectionsAtRef.current[cameraId]
                ) {
                  lastDetectionsAtRef.current[cameraId] = room.detectionsUpdatedAt;
                  next = { ...next, detections: room.detections ?? [] };
                }
              } else if (
                (lastOkAtRef.current[cameraId] ?? 0) + RELAY_GRACE_MS > now &&
                cur.frameSrc
              ) {
                if (cur.state !== "connected") {
                  next = { ...cur, state: "connected" };
                }
              } else if (!relayEqual(cur, EMPTY_RELAY)) {
                next = EMPTY_RELAY;
              }

              if (relayEqual(cur, next)) return prev;
              return { ...prev, [cameraId]: next };
            });
          } catch {
            setByCamera((prev) => {
              const cur = prev[cameraId] ?? EMPTY_RELAY;
              const lastOk = lastOkAtRef.current[cameraId] ?? 0;
              if (cur.frameSrc && lastOk + RELAY_GRACE_MS > now) {
                if (cur.state === "connected") return prev;
                return { ...prev, [cameraId]: { ...cur, state: "connected" } };
              }
              if (relayEqual(cur, EMPTY_RELAY)) return prev;
              return { ...prev, [cameraId]: EMPTY_RELAY };
            });
          }
        })
      );
    };

    void poll();
    const interval = setInterval(() => {
      if (!cancelled) void poll();
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cameraKey, pollMs]);

  return byCamera;
}
