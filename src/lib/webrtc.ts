export function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getPhoneCameraStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
}

export function attachStreamToVideo(
  video: HTMLVideoElement | null,
  stream: MediaStream
) {
  if (!video) return;
  video.srcObject = stream;
  void video.play().catch(() => {});
}

export async function signalFetch(
  cameraId: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(`/api/webrtc/${encodeURIComponent(cameraId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function pollRoom(cameraId: string) {
  const res = await fetch(`/api/webrtc/${encodeURIComponent(cameraId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to poll signaling room");
  return res.json();
}
