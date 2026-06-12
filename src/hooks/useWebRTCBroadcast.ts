"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachStreamToVideo,
  createSessionId,
  getPhoneCameraStream,
  pollRoom,
  signalFetch,
} from "@/lib/webrtc";
import { useFrameRelayBroadcast } from "@/hooks/useFrameRelayBroadcast";

type BroadcastState = "initializing" | "requesting-camera" | "live" | "error";

export function useWebRTCBroadcast(
  cameraId: string,
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const [state, setState] = useState<BroadcastState>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);

  const sessionIdRef = useRef(createSessionId());
  const streamRef = useRef<MediaStream | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFrameRelayBroadcast(cameraId, sessionIdRef.current, videoRef, state === "live");

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void signalFetch(cameraId, {
      action: "disconnect",
      sessionId: sessionIdRef.current,
      role: "broadcaster",
    });
  }, [cameraId]);

  const startBroadcast = useCallback(async () => {
    try {
      setState("requesting-camera");
      setError(null);

      const stream = await getPhoneCameraStream();
      streamRef.current = stream;
      attachStreamToVideo(videoRef.current, stream);

      await signalFetch(cameraId, {
        action: "broadcaster-register",
        sessionId: sessionIdRef.current,
      });

      heartbeatRef.current = setInterval(() => {
        void signalFetch(cameraId, {
          action: "heartbeat",
          sessionId: sessionIdRef.current,
          role: "broadcaster",
        });
      }, 3000);

      pollRef.current = setInterval(async () => {
        try {
          const room = await pollRoom(cameraId);
          setViewers(room.viewerOnline ? 1 : 0);
        } catch {
          setViewers(0);
        }
      }, 2000);

      setState("live");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Camera access denied");
    }
  }, [cameraId, videoRef]);

  useEffect(() => {
    void startBroadcast();
    return () => cleanup();
  }, [startBroadcast, cleanup]);

  return { state, error, viewers, retry: startBroadcast };
}
