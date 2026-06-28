"""Default camera slots seeded for new events and empty event camera lists."""

from app.models.models import Camera, CameraStatus

DEFAULT_CAMERAS: list[dict] = [
    {
        "id": "CAM-01",
        "name": "Main Entrance",
        "location": "North Gate",
        "status": CameraStatus.online,
        "coverage": 95,
        "useWebRTC": True,
    },
    {
        "id": "CAM-02",
        "name": "Lobby Overview",
        "location": "Central Lobby",
        "status": CameraStatus.online,
        "coverage": 88,
        "useWebRTC": True,
    },
    {
        "id": "CAM-03",
        "name": "VIP Lounge",
        "location": "East Wing L3",
        "status": CameraStatus.online,
        "coverage": 92,
        "useWebRTC": True,
    },
    {
        "id": "CAM-04",
        "name": "Parking Sector A",
        "location": "Exterior North",
        "status": CameraStatus.online,
        "coverage": 85,
        "useWebRTC": True,
    },
    {
        "id": "CAM-05",
        "name": "Conference Hall",
        "location": "West Wing L2",
        "status": CameraStatus.online,
        "coverage": 90,
        "useWebRTC": True,
    },
    {
        "id": "CAM-06",
        "name": "Service Entrance",
        "location": "South Gate",
        "status": CameraStatus.online,
        "coverage": 78,
        "useWebRTC": True,
    },
    {
        "id": "CAM-07",
        "name": "Loading Dock",
        "location": "Rear Exterior",
        "status": CameraStatus.offline,
        "coverage": 0,
        "useWebRTC": False,
    },
    {
        "id": "CAM-08",
        "name": "Emergency Exit East",
        "location": "East Corridor",
        "status": CameraStatus.maintenance,
        "coverage": 0,
        "useWebRTC": False,
    },
    {
        "id": "CAM-09",
        "name": "Perimeter North",
        "location": "Fence Line N",
        "status": CameraStatus.online,
        "coverage": 82,
        "useWebRTC": False,
    },
]


async def ensure_default_cameras(db, event_id: str) -> list[Camera]:
    cameras = [
        Camera(eventId=event_id, **spec)
        for spec in DEFAULT_CAMERAS
    ]
    db.add_all(cameras)
    await db.commit()
    for camera in cameras:
        await db.refresh(camera)
    return cameras
