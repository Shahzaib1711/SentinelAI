import enum
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ThreatLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    resolved = "resolved"
    escalated = "escalated"


class MarkerType(str, enum.Enum):
    camera = "camera"
    entrance = "entrance"
    exit = "exit"
    guard = "guard"
    vip_route = "vip_route"


class CameraStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    maintenance = "maintenance"


class UserRole(str, enum.Enum):
    director = "director"
    operator = "operator"
    analyst = "analyst"
    admin = "admin"


class RecommendationType(str, enum.Enum):
    camera = "camera"
    guard = "guard"
    entrance = "entrance"
    general = "general"


class PersonnelRole(str, enum.Enum):
    guard = "guard"
    vip = "vip"
    staff = "staff"
    contractor = "contractor"


ThreatLevelEnum = ENUM(ThreatLevel, name="ThreatLevel", create_type=False)
IncidentStatusEnum = ENUM(IncidentStatus, name="IncidentStatus", create_type=False)
MarkerTypeEnum = ENUM(MarkerType, name="MarkerType", create_type=False)
CameraStatusEnum = ENUM(CameraStatus, name="CameraStatus", create_type=False)
UserRoleEnum = ENUM(UserRole, name="UserRole", create_type=False)
RecommendationTypeEnum = ENUM(RecommendationType, name="RecommendationType", create_type=False)
PersonnelRoleEnum = ENUM(PersonnelRole, name="PersonnelRole", create_type=False)


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[UserRole] = mapped_column(UserRoleEnum, default=UserRole.operator)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )


class Event(Base):
    __tablename__ = "Event"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    slug: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    venueName: Mapped[str] = mapped_column(String)
    eventDate: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    threatLevel: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum, default=ThreatLevel.medium)
    securityScore: Mapped[int] = mapped_column(Integer, default=87)
    vipCount: Mapped[int] = mapped_column(Integer, default=0)
    attendees: Mapped[int] = mapped_column(Integer, default=0)
    securityPersonnel: Mapped[int] = mapped_column(Integer, default=0)
    threatTrendJson: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    riskDistributionJson: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    venue: Mapped["Venue | None"] = relationship(back_populates="event", uselist=False)
    cameras: Mapped[list["Camera"]] = relationship(back_populates="event")
    incidents: Mapped[list["Incident"]] = relationship(back_populates="event")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="event")
    activeThreats: Mapped[list["ActiveThreat"]] = relationship(back_populates="event")
    timelineEvents: Mapped[list["TimelineEvent"]] = relationship(back_populates="event")
    riskZones: Mapped[list["RiskZone"]] = relationship(back_populates="event")
    routes: Mapped[list["Route"]] = relationship(back_populates="event")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="event")
    enrolledPersonnel: Mapped[list["EnrolledPerson"]] = relationship(back_populates="event")
    detectedPersons: Mapped[list["DetectedPerson"]] = relationship(back_populates="event")


class Venue(Base):
    __tablename__ = "Venue"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(String)
    floorLevel: Mapped[str] = mapped_column(String, default="L1")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    event: Mapped["Event"] = relationship(back_populates="venue")
    blueprints: Mapped[list["Blueprint"]] = relationship(back_populates="venue")


class Blueprint(Base):
    __tablename__ = "Blueprint"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    venueId: Mapped[str] = mapped_column(String, ForeignKey("Venue.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, default="floor_plan")
    storageUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    coveragePct: Mapped[int] = mapped_column(Integer, default=0)
    vulnerabilityScore: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    venue: Mapped["Venue"] = relationship(back_populates="blueprints")
    markers: Mapped[list["BlueprintMarker"]] = relationship(back_populates="blueprint")
    blindSpots: Mapped[list["BlindSpot"]] = relationship(back_populates="blueprint")


class BlueprintMarker(Base):
    __tablename__ = "BlueprintMarker"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    blueprintId: Mapped[str] = mapped_column(String, ForeignKey("Blueprint.id", ondelete="CASCADE"))
    type: Mapped[MarkerType] = mapped_column(MarkerTypeEnum)
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    label: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    blueprint: Mapped["Blueprint"] = relationship(back_populates="markers")


class BlindSpot(Base):
    __tablename__ = "BlindSpot"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    blueprintId: Mapped[str] = mapped_column(String, ForeignKey("Blueprint.id", ondelete="CASCADE"))
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    width: Mapped[float] = mapped_column(Float)
    height: Mapped[float] = mapped_column(Float)
    severity: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum)
    description: Mapped[str] = mapped_column(Text)

    blueprint: Mapped["Blueprint"] = relationship(back_populates="blindSpots")


class Camera(Base):
    __tablename__ = "Camera"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    location: Mapped[str] = mapped_column(String)
    status: Mapped[CameraStatus] = mapped_column(CameraStatusEnum, default=CameraStatus.offline)
    coverage: Mapped[int] = mapped_column(Integer, default=0)
    useWebRTC: Mapped[bool] = mapped_column(Boolean, default=False)
    streamUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    event: Mapped["Event"] = relationship(back_populates="cameras")
    incidents: Mapped[list["Incident"]] = relationship(back_populates="camera")


class Incident(Base):
    __tablename__ = "Incident"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(String)
    threatLevel: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum)
    status: Mapped[IncidentStatus] = mapped_column(IncidentStatusEnum)
    description: Mapped[str] = mapped_column(Text)
    assignedTo: Mapped[str] = mapped_column(String)
    cameraId: Mapped[str | None] = mapped_column(String, ForeignKey("Camera.id"), nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    event: Mapped["Event"] = relationship(back_populates="incidents")
    camera: Mapped["Camera | None"] = relationship(back_populates="incidents")


class Alert(Base):
    __tablename__ = "Alert"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    level: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum)
    location: Mapped[str] = mapped_column(String)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship(back_populates="alerts")


class ActiveThreat(Base):
    __tablename__ = "ActiveThreat"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    externalId: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    location: Mapped[str] = mapped_column(String)
    level: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum)
    detectedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confidence: Mapped[int] = mapped_column(Integer)

    event: Mapped["Event"] = relationship(back_populates="activeThreats")


class TimelineEvent(Base):
    __tablename__ = "TimelineEvent"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    time: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    level: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum)
    description: Mapped[str] = mapped_column(Text)

    event: Mapped["Event"] = relationship(back_populates="timelineEvents")


class RiskZone(Base):
    __tablename__ = "RiskZone"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    riskLevel: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum)
    riskScore: Mapped[int] = mapped_column(Integer)
    incidents: Mapped[int] = mapped_column(Integer)
    coverage: Mapped[int] = mapped_column(Integer)

    event: Mapped["Event"] = relationship(back_populates="riskZones")


class Route(Base):
    __tablename__ = "Route"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    distance: Mapped[str] = mapped_column(String)
    estimatedTime: Mapped[str] = mapped_column(String)
    riskScore: Mapped[int] = mapped_column(Integer)
    waypointsJson: Mapped[Any] = mapped_column(JSONB)
    isSafest: Mapped[bool] = mapped_column(Boolean, default=False)

    event: Mapped["Event"] = relationship(back_populates="routes")


class Recommendation(Base):
    __tablename__ = "Recommendation"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    type: Mapped[RecommendationType] = mapped_column(RecommendationTypeEnum)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    priority: Mapped[ThreatLevel] = mapped_column(ThreatLevelEnum)
    location: Mapped[str | None] = mapped_column(String, nullable=True)

    event: Mapped["Event"] = relationship(back_populates="recommendations")


class EnrolledPerson(Base):
    __tablename__ = "EnrolledPerson"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    designation: Mapped[str] = mapped_column(String)
    role: Mapped[PersonnelRole] = mapped_column(PersonnelRoleEnum)
    photoUrl: Mapped[str | None] = mapped_column(Text, nullable=True)
    embeddingJson: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    event: Mapped["Event"] = relationship(back_populates="enrolledPersonnel")


class DetectedPerson(Base):
    __tablename__ = "DetectedPerson"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    eventId: Mapped[str] = mapped_column(String, ForeignKey("Event.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String)
    photoUrl: Mapped[str | None] = mapped_column(Text, nullable=True)
    embeddingJson: Mapped[Any] = mapped_column(JSONB)
    cameraId: Mapped[str | None] = mapped_column(String, nullable=True)
    sightingCount: Mapped[int] = mapped_column(Integer, default=1)
    firstSeenAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lastSeenAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    event: Mapped["Event"] = relationship(back_populates="detectedPersons")
