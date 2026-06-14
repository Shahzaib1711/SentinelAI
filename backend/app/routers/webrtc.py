import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services.signaling import get_room, reset_room, room_state
from app.services.person_identifier import enrich_person_detections
from app.services.personnel_store import clear_camera_personnel, update_camera_personnel
from app.services.yolo_detector import decode_frame_data_url, detect_frame

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webrtc", tags=["webrtc"])

_executor = ThreadPoolExecutor(max_workers=2)
_detection_busy: dict[str, bool] = {}


async def _run_detection(camera_id: str, frame: str) -> None:
    if _detection_busy.get(camera_id):
        return

    _detection_busy[camera_id] = True
    room = get_room(camera_id)
    now = int(time.time() * 1000)

    try:
        loop = asyncio.get_running_loop()
        def _detect_and_identify() -> tuple[list, list]:
            img = decode_frame_data_url(frame)
            raw_detections = detect_frame(
                img,
                model_name=settings.yolo_model,
                confidence=settings.yolo_confidence,
            )
            return enrich_person_detections(
                camera_id,
                raw_detections,
                frame_bgr=img,
            )

        enriched, personnel = await loop.run_in_executor(_executor, _detect_and_identify)
        room.latest_detections = enriched
        room.latest_personnel = personnel
        room.detections_updated_at = now
        room.last_detection_run_at = now
        update_camera_personnel(camera_id, personnel)
    except Exception as exc:
        logger.warning("Detection task failed for %s: %s", camera_id, exc)
    finally:
        _detection_busy[camera_id] = False


@router.get("/{camera_id}")
async def get_webrtc_room(camera_id: str):
    return room_state(camera_id, int(time.time() * 1000))


@router.post("/{camera_id}")
async def post_webrtc_signal(camera_id: str, body: dict):
    room = get_room(camera_id)
    now = int(time.time() * 1000)
    action = body.get("action")

    if action == "broadcaster-register":
        if (
            room.broadcaster_session_id
            and room.broadcaster_session_id != body.get("sessionId")
            and now - room.broadcaster_last_seen < 15_000
        ):
            raise HTTPException(status_code=409, detail="Broadcaster already active")
        room.broadcaster_session_id = body.get("sessionId")
        room.broadcaster_last_seen = now
        room.offer = None
        room.answer = None
        room.broadcaster_ice = []
        room.viewer_ice = []
        room.latest_detections = []
        room.detections_updated_at = 0
        room.last_detection_run_at = 0
        clear_camera_personnel(camera_id)
        return {"ok": True}

    if action == "viewer-register":
        room.viewer_session_id = body.get("sessionId")
        room.viewer_last_seen = now
        room.answer = None
        room.viewer_ice = []
        return {"ok": True}

    if action == "heartbeat":
        if body.get("role") == "broadcaster" and room.broadcaster_session_id == body.get("sessionId"):
            room.broadcaster_last_seen = now
        if body.get("role") == "viewer" and room.viewer_session_id == body.get("sessionId"):
            room.viewer_last_seen = now
        return {"ok": True}

    if action == "offer":
        if room.broadcaster_session_id != body.get("sessionId"):
            raise HTTPException(status_code=403, detail="Forbidden")
        room.offer = body.get("offer")
        room.answer = None
        room.viewer_ice = []
        return {"ok": True}

    if action == "answer":
        if room.viewer_session_id != body.get("sessionId"):
            raise HTTPException(status_code=403, detail="Forbidden")
        room.answer = body.get("answer")
        return {"ok": True}

    if action == "ice":
        candidate = body.get("candidate")
        if body.get("role") == "broadcaster" and room.broadcaster_session_id == body.get("sessionId"):
            room.broadcaster_ice.append(candidate)
        elif body.get("role") == "viewer" and room.viewer_session_id == body.get("sessionId"):
            room.viewer_ice.append(candidate)
        return {"ok": True}

    if action == "frame":
        if room.broadcaster_session_id == body.get("sessionId") and isinstance(body.get("frame"), str):
            frame = body["frame"]
            room.latest_frame = frame
            room.frame_updated_at = now
            room.broadcaster_last_seen = now

            if (
                settings.yolo_enabled
                and now - room.last_detection_run_at >= settings.yolo_interval_ms
            ):
                asyncio.create_task(_run_detection(camera_id, frame))

        return {"ok": True}

    if action == "disconnect":
        reset_room(camera_id, body.get("sessionId"), body.get("role"))
        _detection_busy.pop(camera_id, None)
        if body.get("role") == "broadcaster":
            clear_camera_personnel(camera_id)
        return {"ok": True}

    raise HTTPException(status_code=400, detail="Unknown action")
