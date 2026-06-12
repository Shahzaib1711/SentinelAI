"use client";

import { useEffect, useRef, useState } from "react";
import {
  attachStreamToVideo,
  createPeerConnection,
  createSessionId,
  pollRoom,
  signalFetch,
} from "@/lib/webrtc";

type ViewState = "connecting" | "waiting" | "connected" | "error";

export function useWebRTCView(
  cameraId: string,
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const [state, setState] = useState<ViewState>("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sessionIdRef = useRef(createSessionId());
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appliedOfferRef = useRef(false);
  const appliedBroadcasterIceRef = useRef(0);
  const answerSentRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    const setup = async () => {
      await signalFetch(cameraId, {
        action: "viewer-register",
        sessionId: sessionIdRef.current,
      });

      heartbeatRef.current = setInterval(() => {
        void signalFetch(cameraId, {
          action: "heartbeat",
          sessionId: sessionIdRef.current,
          role: "viewer",
        });
      }, 3000);

      pollRef.current = setInterval(async () => {
        if (disposed) return;

        try {
          const room = await pollRoom(cameraId);

          if (!room.broadcasterOnline) {
            setState("waiting");
            appliedOfferRef.current = false;
            answerSentRef.current = false;
            appliedBroadcasterIceRef.current = 0;
            pcRef.current?.close();
            pcRef.current = null;
            return;
          }

          setState("connecting");

          if (!room.offer) return;

          if (!pcRef.current) {
            const pc = createPeerConnection();
            pcRef.current = pc;

            pc.ontrack = (event) => {
              if (disposed) return;
              const stream = event.streams[0] ?? new MediaStream([event.track]);
              attachStreamToVideo(videoRef.current, stream);
              setState("connected");
            };

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                void signalFetch(cameraId, {
                  action: "ice",
                  sessionId: sessionIdRef.current,
                  role: "viewer",
                  candidate: event.candidate.toJSON(),
                });
              }
            };
          }

          if (pcRef.current && !appliedOfferRef.current) {
            await pcRef.current.setRemoteDescription(room.offer);
            appliedOfferRef.current = true;

            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            await signalFetch(cameraId, {
              action: "answer",
              sessionId: sessionIdRef.current,
              answer,
            });
            answerSentRef.current = true;
          }

          if (pcRef.current && room.broadcasterIce) {
            for (let i = appliedBroadcasterIceRef.current; i < room.broadcasterIce.length; i++) {
              await pcRef.current.addIceCandidate(room.broadcasterIce[i]);
            }
            appliedBroadcasterIceRef.current = room.broadcasterIce.length;
          }
        } catch (err) {
          if (!disposed) {
            setState("error");
            setErrorMsg(err instanceof Error ? err.message : "Connection failed");
          }
        }
      }, 500);
    };

    void setup();

    return () => {
      disposed = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      pcRef.current?.close();
      void signalFetch(cameraId, {
        action: "disconnect",
        sessionId: sessionIdRef.current,
        role: "viewer",
      });
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [cameraId, videoRef]);

  return { state, errorMsg };
}
