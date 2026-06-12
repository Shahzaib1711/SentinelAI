export interface WebRTCRoom {
  broadcasterSessionId: string | null;
  broadcasterLastSeen: number;
  viewerSessionId: string | null;
  viewerLastSeen: number;
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  broadcasterIce: RTCIceCandidateInit[];
  viewerIce: RTCIceCandidateInit[];
  /** JPEG data URL relayed from phone when P2P WebRTC is blocked */
  latestFrame: string | null;
  frameUpdatedAt: number;
}

const rooms = new Map<string, WebRTCRoom>();

function createRoom(): WebRTCRoom {
  return {
    broadcasterSessionId: null,
    broadcasterLastSeen: 0,
    viewerSessionId: null,
    viewerLastSeen: 0,
    offer: null,
    answer: null,
    broadcasterIce: [],
    viewerIce: [],
    latestFrame: null,
    frameUpdatedAt: 0,
  };
}

export function getRoom(cameraId: string): WebRTCRoom {
  if (!rooms.has(cameraId)) {
    rooms.set(cameraId, createRoom());
  }
  return rooms.get(cameraId)!;
}

export function resetRoom(cameraId: string, sessionId: string, role: "broadcaster" | "viewer") {
  const room = getRoom(cameraId);
  if (role === "broadcaster" && room.broadcasterSessionId === sessionId) {
    rooms.set(cameraId, createRoom());
  }
  if (role === "viewer" && room.viewerSessionId === sessionId) {
    room.viewerSessionId = null;
    room.viewerLastSeen = 0;
    room.answer = null;
    room.viewerIce = [];
  }
}
