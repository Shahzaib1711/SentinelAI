from dataclasses import dataclass, field
from typing import Any


STALE_MS = 15_000


@dataclass
class WebRTCRoom:
    broadcaster_session_id: str | None = None
    broadcaster_last_seen: int = 0
    viewer_session_id: str | None = None
    viewer_last_seen: int = 0
    offer: dict[str, Any] | None = None
    answer: dict[str, Any] | None = None
    broadcaster_ice: list[dict[str, Any]] = field(default_factory=list)
    viewer_ice: list[dict[str, Any]] = field(default_factory=list)
    latest_frame: str | None = None
    frame_updated_at: int = 0
    latest_detections: list[dict[str, Any]] = field(default_factory=list)
    detections_updated_at: int = 0
    last_detection_run_at: int = 0


_rooms: dict[str, WebRTCRoom] = {}


def _is_online(last_seen: int, now: int) -> bool:
    return now - last_seen < STALE_MS


def get_room(camera_id: str) -> WebRTCRoom:
    if camera_id not in _rooms:
        _rooms[camera_id] = WebRTCRoom()
    return _rooms[camera_id]


def reset_room(camera_id: str, session_id: str, role: str) -> None:
    room = get_room(camera_id)
    if role == "broadcaster" and room.broadcaster_session_id == session_id:
        _rooms[camera_id] = WebRTCRoom()
    if role == "viewer" and room.viewer_session_id == session_id:
        room.viewer_session_id = None
        room.viewer_last_seen = 0
        room.answer = None
        room.viewer_ice = []


def room_state(camera_id: str, now: int) -> dict[str, Any]:
    room = get_room(camera_id)
    if not _is_online(room.broadcaster_last_seen, now):
        room.broadcaster_session_id = None
    if not _is_online(room.viewer_last_seen, now):
        room.viewer_session_id = None
        room.answer = None
        room.viewer_ice = []

    return {
        "broadcasterOnline": _is_online(room.broadcaster_last_seen, now),
        "viewerOnline": _is_online(room.viewer_last_seen, now),
        "offer": room.offer,
        "answer": room.answer,
        "broadcasterIce": room.broadcaster_ice,
        "viewerIce": room.viewer_ice,
        "frame": room.latest_frame,
        "frameUpdatedAt": room.frame_updated_at,
        "detections": room.latest_detections,
        "detectionsUpdatedAt": room.detections_updated_at,
    }
