import type {
  Alert,
  Camera,
  Incident,
  MarkerType,
  ThreatLevel,
} from "@/types";
import type {
  Alert as DbAlert,
  Camera as DbCamera,
  Incident as DbIncident,
  BlueprintMarker as DbMarker,
} from "@prisma/client";

export function mapCamera(c: DbCamera): Camera {
  return {
    id: c.id,
    name: c.name,
    location: c.location,
    status: c.status,
    coverage: c.coverage,
    useWebRTC: c.useWebRTC,
    feedUrl: c.streamUrl ?? undefined,
  };
}

export function mapAlert(a: DbAlert): Alert {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    level: a.level as ThreatLevel,
    location: a.location,
    timestamp: a.timestamp.toISOString(),
    acknowledged: a.acknowledged,
  };
}

export function mapIncident(i: DbIncident): Incident {
  return {
    id: i.id,
    time: i.time.toISOString(),
    location: i.location,
    threatLevel: i.threatLevel as ThreatLevel,
    status: i.status,
    description: i.description,
    assignedTo: i.assignedTo,
    cameraId: i.cameraId ?? undefined,
    resolution: i.resolution ?? undefined,
  };
}

export function mapMarkerType(type: DbMarker["type"]): MarkerType {
  if (type === "vip_route") return "vip-route";
  return type as MarkerType;
}

export function toDbMarkerType(type: MarkerType): DbMarker["type"] {
  if (type === "vip-route") return "vip_route";
  return type as DbMarker["type"];
}
