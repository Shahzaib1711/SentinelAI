export type ThreatLevel = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "investigating" | "resolved" | "escalated";

export type MarkerType =
  | "camera"
  | "entrance"
  | "exit"
  | "guard"
  | "restricted"
  | "vip-route";

export interface BlueprintMarker {
  id: string;
  type: MarkerType;
  x: number;
  y: number;
  label: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  level: ThreatLevel;
  location: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface Incident {
  id: string;
  time: string;
  location: string;
  threatLevel: ThreatLevel;
  status: IncidentStatus;
  description: string;
  assignedTo: string;
  cameraId?: string;
  resolution?: string;
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  status: "online" | "offline" | "maintenance";
  feedUrl?: string;
  /** When set, live feed comes from phone WebRTC broadcast at /broadcast?camera={id} */
  useWebRTC?: boolean;
  coverage: number;
}

export interface Route {
  id: string;
  name: string;
  distance: string;
  estimatedTime: string;
  riskScore: number;
  waypoints: { x: number; y: number }[];
  isSafest?: boolean;
}

export interface RiskZone {
  id: string;
  name: string;
  riskLevel: ThreatLevel;
  riskScore: number;
  incidents: number;
  coverage: number;
}

export interface Recommendation {
  id: string;
  type: "camera" | "guard" | "entrance" | "general";
  title: string;
  description: string;
  priority: ThreatLevel;
  location?: string;
}

export interface ThreatTrend {
  time: string;
  level: number;
  incidents: number;
}

export interface ActiveThreat {
  id: string;
  type: string;
  location: string;
  level: ThreatLevel;
  detectedAt: string;
  confidence: number;
}

export interface SecuritySummary {
  title: string;
  value: string;
  change: number;
  icon: string;
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  level: ThreatLevel;
  description: string;
}

export type DetectionType = "person" | "vehicle" | "bag" | "animal" | "guard" | "vip";

export type PersonRole = "guard" | "vip" | "visitor" | "restricted" | "entrance";

export interface Detection {
  id: string;
  type: DetectionType;
  label: string;
  confidence: number;
  cameraId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Guard / VIP classification from zone + posture analysis */
  role?: PersonRole;
  trackId?: number;
  zone?: string;
  posture?: "standing" | "moving";
  standing?: boolean;
  blueprintX?: number;
  blueprintY?: number;
  cameraLocation?: string;
  enrolledPersonId?: string | null;
  enrolledName?: string | null;
  designation?: string | null;
  identified?: boolean;
  faceMatchScore?: number | null;
}

export interface LivePersonnel {
  id: string;
  trackId: number;
  role: PersonRole;
  label: string;
  zone: string;
  posture: string;
  confidence: number;
  cameraId: string;
  cameraLocation: string;
  blueprintX: number;
  blueprintY: number;
  frameX: number;
  frameY: number;
  enrolledPersonId?: string | null;
  enrolledName?: string | null;
  designation?: string | null;
  identified?: boolean;
  faceMatchScore?: number | null;
}

export interface PersonnelSummary {
  total: number;
  guards: number;
  vips: number;
  visitors: number;
  updatedAt: number;
}

export interface CoverageArea {
  id: string;
  cameraId: string;
  x: number;
  y: number;
  radius: number;
  angle: number;
}

export interface BlindSpot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  severity: ThreatLevel;
  description: string;
}
