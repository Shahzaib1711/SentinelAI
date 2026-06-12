import type {
  ActiveThreat,
  Alert,
  BlindSpot,
  BlueprintMarker,
  Camera,
  CoverageArea,
  Detection,
  Incident,
  Recommendation,
  RiskZone,
  Route,
  SecuritySummary,
  ThreatTrend,
  TimelineEvent,
} from "@/types";

export const dashboardKPIs = {
  threatLevel: "medium" as const,
  securityScore: 87,
  activeAlerts: 7,
  camerasOnline: 24,
  totalCameras: 28,
};

export const threatTrendData: ThreatTrend[] = [
  { time: "06:00", level: 15, incidents: 1 },
  { time: "08:00", level: 22, incidents: 2 },
  { time: "10:00", level: 35, incidents: 3 },
  { time: "12:00", level: 48, incidents: 5 },
  { time: "14:00", level: 62, incidents: 4 },
  { time: "16:00", level: 55, incidents: 6 },
  { time: "18:00", level: 71, incidents: 7 },
  { time: "20:00", level: 58, incidents: 5 },
  { time: "22:00", level: 42, incidents: 3 },
];

export const riskDistribution = [
  { name: "Low Risk", value: 45, color: "#22c55e" },
  { name: "Medium Risk", value: 30, color: "#eab308" },
  { name: "High Risk", value: 18, color: "#f97316" },
  { name: "Critical", value: 7, color: "#ef4444" },
];

export const recentAlerts: Alert[] = [
  {
    id: "ALT-001",
    title: "Unauthorized Access Attempt",
    description: "Individual detected attempting restricted area entry near VIP Lounge",
    level: "high",
    location: "VIP Lounge - North Wing",
    timestamp: "2026-06-05T18:42:00",
    acknowledged: false,
  },
  {
    id: "ALT-002",
    title: "Suspicious Package Detected",
    description: "Unattended bag identified in parking area sector B",
    level: "critical",
    location: "Parking Area - Sector B",
    timestamp: "2026-06-05T18:38:00",
    acknowledged: false,
  },
  {
    id: "ALT-003",
    title: "Crowd Density Warning",
    description: "Main entrance exceeding safe capacity threshold",
    level: "medium",
    location: "Main Entrance",
    timestamp: "2026-06-05T18:35:00",
    acknowledged: true,
  },
  {
    id: "ALT-004",
    title: "Camera Offline",
    description: "CAM-014 lost connection - blind spot created",
    level: "medium",
    location: "Emergency Exit - East",
    timestamp: "2026-06-05T18:30:00",
    acknowledged: false,
  },
  {
    id: "ALT-005",
    title: "Vehicle Loitering",
    description: "Dark sedan stationary for 15+ minutes near service entrance",
    level: "high",
    location: "Service Entrance",
    timestamp: "2026-06-05T18:25:00",
    acknowledged: true,
  },
];

export const activeThreats: ActiveThreat[] = [
  {
    id: "THR-001",
    type: "Unattended Object",
    location: "Parking Area B",
    level: "critical",
    detectedAt: "2026-06-05T18:38:00",
    confidence: 94,
  },
  {
    id: "THR-002",
    type: "Unauthorized Person",
    location: "VIP Lounge",
    level: "high",
    detectedAt: "2026-06-05T18:42:00",
    confidence: 87,
  },
  {
    id: "THR-003",
    type: "Crowd Surge",
    location: "Main Entrance",
    level: "medium",
    detectedAt: "2026-06-05T18:35:00",
    confidence: 91,
  },
  {
    id: "THR-004",
    type: "Vehicle Anomaly",
    location: "Service Entrance",
    level: "high",
    detectedAt: "2026-06-05T18:25:00",
    confidence: 82,
  },
  {
    id: "THR-005",
    type: "Perimeter Breach",
    location: "Loading Dock",
    level: "medium",
    detectedAt: "2026-06-05T18:15:00",
    confidence: 76,
  },
];

export const securitySummaries: SecuritySummary[] = [
  { title: "Perimeter Status", value: "Secure", change: 2, icon: "shield" },
  { title: "VIP Route Clear", value: "Active", change: 0, icon: "route" },
  { title: "Guard Deployment", value: "18/20", change: -1, icon: "users" },
  { title: "Response Time", value: "2.4 min", change: -12, icon: "clock" },
];

export const blueprintMarkers: BlueprintMarker[] = [
  { id: "m1", type: "camera", x: 15, y: 20, label: "CAM-01" },
  { id: "m2", type: "camera", x: 45, y: 15, label: "CAM-02" },
  { id: "m3", type: "camera", x: 75, y: 25, label: "CAM-03" },
  { id: "m4", type: "camera", x: 30, y: 55, label: "CAM-04" },
  { id: "m5", type: "camera", x: 60, y: 60, label: "CAM-05" },
  { id: "m6", type: "camera", x: 85, y: 50, label: "CAM-06" },
  { id: "e1", type: "entrance", x: 50, y: 5, label: "Main Entrance" },
  { id: "e2", type: "entrance", x: 10, y: 50, label: "Service Entry" },
  { id: "x1", type: "exit", x: 90, y: 80, label: "Emergency Exit" },
  { id: "x2", type: "exit", x: 5, y: 90, label: "Loading Dock Exit" },
  { id: "g1", type: "guard", x: 50, y: 10, label: "Guard Post A" },
  { id: "g2", type: "guard", x: 70, y: 70, label: "Guard Post B" },
  { id: "r1", type: "restricted", x: 65, y: 35, label: "VIP Lounge" },
  { id: "r2", type: "restricted", x: 20, y: 75, label: "Server Room" },
  {
    id: "v1",
    type: "vip-route",
    x: 50,
    y: 30,
    label: "VIP Route Alpha",
  },
];

export const coverageAreas: CoverageArea[] = [
  { id: "c1", cameraId: "CAM-01", x: 15, y: 20, radius: 18, angle: 90 },
  { id: "c2", cameraId: "CAM-02", x: 45, y: 15, radius: 20, angle: 120 },
  { id: "c3", cameraId: "CAM-03", x: 75, y: 25, radius: 16, angle: 180 },
  { id: "c4", cameraId: "CAM-04", x: 30, y: 55, radius: 22, angle: 270 },
  { id: "c5", cameraId: "CAM-05", x: 60, y: 60, radius: 18, angle: 45 },
  { id: "c6", cameraId: "CAM-06", x: 85, y: 50, radius: 15, angle: 225 },
];

export const blindSpots: BlindSpot[] = [
  {
    id: "bs1",
    x: 38,
    y: 38,
    width: 12,
    height: 10,
    severity: "high",
    description: "Corridor junction - no camera overlap",
  },
  {
    id: "bs2",
    x: 78,
    y: 65,
    width: 10,
    height: 8,
    severity: "medium",
    description: "Storage area rear corner",
  },
  {
    id: "bs3",
    x: 12,
    y: 68,
    width: 8,
    height: 12,
    severity: "critical",
    description: "Loading dock blind zone - high traffic",
  },
];

export const coverageMetrics = {
  coveragePercentage: 78,
  blindSpotsFound: 3,
  vulnerabilityScore: 34,
};

export const coverageRecommendations: Recommendation[] = [
  {
    id: "rec1",
    type: "camera",
    title: "Install Camera at Corridor Junction",
    description:
      "Deploy PTZ camera at junction point to eliminate 120° blind spot affecting VIP route visibility",
    priority: "high",
    location: "Corridor Junction - Level 2",
  },
  {
    id: "rec2",
    type: "guard",
    title: "Add Mobile Guard Patrol",
    description:
      "Station roving guard at loading dock during peak hours to cover camera gap",
    priority: "critical",
    location: "Loading Dock",
  },
  {
    id: "rec3",
    type: "entrance",
    title: "Secure Service Entrance",
    description:
      "Install access control and secondary camera at service entry point",
    priority: "medium",
    location: "Service Entrance - West",
  },
];

export const routes: Route[] = [
  {
    id: "route-a",
    name: "Route A — Direct",
    distance: "245m",
    estimatedTime: "4 min",
    riskScore: 72,
    waypoints: [
      { x: 50, y: 10 },
      { x: 50, y: 30 },
      { x: 65, y: 35 },
      { x: 70, y: 50 },
    ],
  },
  {
    id: "route-b",
    name: "Route B — Perimeter",
    distance: "380m",
    estimatedTime: "7 min",
    riskScore: 28,
    waypoints: [
      { x: 50, y: 10 },
      { x: 20, y: 15 },
      { x: 15, y: 50 },
      { x: 30, y: 70 },
      { x: 70, y: 50 },
    ],
    isSafest: true,
  },
  {
    id: "route-c",
    name: "Route C — Service",
    distance: "310m",
    estimatedTime: "6 min",
    riskScore: 45,
    waypoints: [
      { x: 50, y: 10 },
      { x: 10, y: 50 },
      { x: 20, y: 75 },
      { x: 50, y: 70 },
      { x: 70, y: 50 },
    ],
  },
];

export const locationOptions = [
  { value: "main-entrance", label: "Main Entrance" },
  { value: "vip-lounge", label: "VIP Lounge" },
  { value: "conference-hall", label: "Conference Hall" },
  { value: "parking-a", label: "Parking Area A" },
  { value: "emergency-exit", label: "Emergency Exit" },
  { value: "loading-dock", label: "Loading Dock" },
];

export const cameras: Camera[] = [
  { id: "CAM-01", name: "Main Entrance", location: "North Gate", status: "online", coverage: 95, useWebRTC: true },
  { id: "CAM-02", name: "Lobby Overview", location: "Central Lobby", status: "online", coverage: 88, useWebRTC: true },
  { id: "CAM-03", name: "VIP Lounge", location: "East Wing L3", status: "online", coverage: 92, useWebRTC: true },
  { id: "CAM-04", name: "Parking Sector A", location: "Exterior North", status: "online", coverage: 85, useWebRTC: true },
  { id: "CAM-05", name: "Conference Hall", location: "West Wing L2", status: "online", coverage: 90, useWebRTC: true },
  { id: "CAM-06", name: "Service Entrance", location: "South Gate", status: "online", coverage: 78, useWebRTC: true },
  { id: "CAM-07", name: "Loading Dock", location: "Rear Exterior", status: "offline", coverage: 0 },
  { id: "CAM-08", name: "Emergency Exit East", location: "East Corridor", status: "maintenance", coverage: 0 },
  { id: "CAM-09", name: "Perimeter North", location: "Fence Line N", status: "online", coverage: 82 },
];

export const liveDetections: Detection[] = [
  { id: "d1", type: "person", label: "Person #12", confidence: 97, cameraId: "CAM-01", x: 35, y: 45 },
  { id: "d2", type: "vehicle", label: "Vehicle #3", confidence: 94, cameraId: "CAM-04", x: 60, y: 55 },
  { id: "d3", type: "bag", label: "Bag #5", confidence: 89, cameraId: "CAM-04", x: 72, y: 38 },
  { id: "d4", type: "person", label: "Person #18", confidence: 96, cameraId: "CAM-02", x: 48, y: 62 },
  { id: "d5", type: "animal", label: "Animal #1", confidence: 78, cameraId: "CAM-09", x: 25, y: 30 },
];

export const threatTimeline: TimelineEvent[] = [
  {
    id: "tl1",
    time: "18:42:15",
    title: "Unauthorized Access",
    level: "high",
    description: "Individual detected in restricted VIP zone",
  },
  {
    id: "tl2",
    time: "18:38:42",
    title: "Suspicious Package",
    level: "critical",
    description: "Unattended bag flagged in parking sector B",
  },
  {
    id: "tl3",
    time: "18:35:10",
    title: "Crowd Density Alert",
    level: "medium",
    description: "Main entrance capacity at 92%",
  },
  {
    id: "tl4",
    time: "18:30:00",
    title: "Camera Failure",
    level: "medium",
    description: "CAM-014 offline - coverage gap detected",
  },
  {
    id: "tl5",
    time: "18:25:33",
    title: "Vehicle Loitering",
    level: "high",
    description: "Stationary vehicle at service entrance",
  },
  {
    id: "tl6",
    time: "18:15:08",
    title: "Perimeter Motion",
    level: "low",
    description: "Motion detected at north fence line",
  },
];

export const riskZones: RiskZone[] = [
  { id: "z1", name: "Main Entrance", riskLevel: "medium", riskScore: 62, incidents: 8, coverage: 95 },
  { id: "z2", name: "Parking Area", riskLevel: "high", riskScore: 78, incidents: 12, coverage: 72 },
  { id: "z3", name: "Conference Hall", riskLevel: "low", riskScore: 25, incidents: 2, coverage: 90 },
  { id: "z4", name: "VIP Lounge", riskLevel: "medium", riskScore: 55, incidents: 4, coverage: 92 },
  { id: "z5", name: "Emergency Exit", riskLevel: "critical", riskScore: 85, incidents: 6, coverage: 45 },
  { id: "z6", name: "Loading Dock", riskLevel: "high", riskScore: 71, incidents: 9, coverage: 58 },
  { id: "z7", name: "Service Entrance", riskLevel: "medium", riskScore: 48, incidents: 5, coverage: 78 },
  { id: "z8", name: "Perimeter North", riskLevel: "low", riskScore: 22, incidents: 1, coverage: 82 },
];

export const threatBreakdown = [
  { type: "Unauthorized Access", count: 14, color: "#ef4444" },
  { type: "Suspicious Objects", count: 8, color: "#f97316" },
  { type: "Crowd Anomalies", count: 12, color: "#eab308" },
  { type: "Vehicle Incidents", count: 6, color: "#3b82f6" },
  { type: "Perimeter Breaches", count: 4, color: "#06b6d4" },
  { type: "System Alerts", count: 9, color: "#8b5cf6" },
];

export const threatTrendWeekly = [
  { day: "Mon", threats: 12, resolved: 10 },
  { day: "Tue", threats: 18, resolved: 15 },
  { day: "Wed", threats: 8, resolved: 8 },
  { day: "Thu", threats: 22, resolved: 18 },
  { day: "Fri", threats: 15, resolved: 12 },
  { day: "Sat", threats: 28, resolved: 22 },
  { day: "Sun", threats: 20, resolved: 17 },
];

export const incidents: Incident[] = [
  {
    id: "INC-2026-0847",
    time: "2026-06-05T18:42:00",
    location: "VIP Lounge - North Wing",
    threatLevel: "high",
    status: "investigating",
    description: "Unauthorized individual detected attempting to access VIP restricted area. Subject wearing dark clothing, no visible credentials.",
    assignedTo: "Team Alpha - Cpt. Morrison",
    cameraId: "CAM-03",
  },
  {
    id: "INC-2026-0846",
    time: "2026-06-05T18:38:00",
    location: "Parking Area - Sector B",
    threatLevel: "critical",
    status: "open",
    description: "Unattended bag detected near parking structure pillar B-14. K9 unit dispatched. Area cordoned off pending inspection.",
    assignedTo: "Team Bravo - Sgt. Chen",
    cameraId: "CAM-04",
  },
  {
    id: "INC-2026-0845",
    time: "2026-06-05T18:35:00",
    location: "Main Entrance",
    threatLevel: "medium",
    status: "investigating",
    description: "Crowd density exceeding safe threshold. Flow management protocols activated. Additional staff deployed.",
    assignedTo: "Team Charlie - Lt. Davis",
    cameraId: "CAM-01",
  },
  {
    id: "INC-2026-0844",
    time: "2026-06-05T18:30:00",
    location: "Emergency Exit - East",
    threatLevel: "medium",
    status: "open",
    description: "Camera CAM-014 offline. Blind spot created in emergency exit corridor. Maintenance team notified.",
    assignedTo: "Tech Support - J. Walsh",
    cameraId: "CAM-08",
  },
  {
    id: "INC-2026-0843",
    time: "2026-06-05T18:25:00",
    location: "Service Entrance",
    threatLevel: "high",
    status: "escalated",
    description: "Dark sedan (License: ***-4821) stationary for 15+ minutes. Driver visible, no delivery scheduled.",
    assignedTo: "Team Alpha - Cpt. Morrison",
    cameraId: "CAM-06",
  },
  {
    id: "INC-2026-0842",
    time: "2026-06-05T18:15:00",
    location: "Loading Dock",
    threatLevel: "medium",
    status: "resolved",
    description: "Perimeter motion sensor triggered. Investigation confirmed authorized delivery personnel.",
    assignedTo: "Team Bravo - Sgt. Chen",
    cameraId: "CAM-07",
    resolution: "False alarm - authorized delivery confirmed at 18:22",
  },
  {
    id: "INC-2026-0841",
    time: "2026-06-05T17:55:00",
    location: "Conference Hall",
    threatLevel: "low",
    status: "resolved",
    description: "Minor equipment malfunction in AV system triggered motion sensor. No security threat.",
    assignedTo: "Facilities - M. Torres",
    resolution: "Equipment malfunction resolved. No security impact.",
  },
  {
    id: "INC-2026-0840",
    time: "2026-06-05T17:40:00",
    location: "Perimeter North",
    threatLevel: "low",
    status: "resolved",
    description: "Wildlife detected near north fence line. Animal cleared area without incident.",
    assignedTo: "Perimeter Patrol - Unit 7",
    cameraId: "CAM-09",
    resolution: "Wildlife cleared perimeter at 17:48",
  },
];

export const reportData = {
  securityScore: 87,
  coverageAnalysis: {
    overall: 78,
    perimeter: 92,
    interior: 74,
    vipZones: 95,
    blindSpots: 3,
  },
  threatSummary: {
    totalIncidents: 47,
    critical: 3,
    high: 12,
    medium: 18,
    low: 14,
    resolved: 38,
    avgResponseTime: "2.4 min",
  },
  recommendations: [
    "Deploy additional camera at corridor junction (Level 2)",
    "Increase guard patrol frequency at loading dock",
    "Install access control at service entrance",
    "Upgrade emergency exit camera coverage",
    "Implement crowd flow management at main entrance",
    "Schedule K9 sweep of parking sector B",
  ],
  eventDetails: {
    name: "Global Security Summit 2026",
    venue: "Metropolitan Convention Center",
    date: "June 5, 2026",
    vipCount: 24,
    attendees: 3500,
    securityPersonnel: 120,
  },
};

export const notifications = [
  { id: "n1", title: "Critical Alert", message: "Suspicious package in Parking B", time: "2m ago", read: false },
  { id: "n2", title: "Camera Offline", message: "CAM-014 requires attention", time: "12m ago", read: false },
  { id: "n3", title: "Report Ready", message: "Daily security report generated", time: "1h ago", read: true },
  { id: "n4", title: "Shift Change", message: "Team Bravo assuming post", time: "2h ago", read: true },
];
