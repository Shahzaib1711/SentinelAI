import type { ActiveThreat, RiskZone, ThreatLevel } from "@/types";
import { getActiveEventSlug } from "@/lib/services/events";

const BASE = "/api/v1";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: string | { msg?: string }[] }).detail;
    let msg = `API error ${res.status}`;
    if (typeof detail === "string") msg = detail;
    else if (Array.isArray(detail) && detail[0]?.msg) msg = detail[0].msg;
    throw new Error(msg);
  }

  return res.json();
}

export interface ThreatBreakdownItem {
  type: string;
  count: number;
  color: string;
}

export interface WeeklyThreatTrend {
  day: string;
  threats: number;
  resolved: number;
}

export interface RiskDistributionSlice {
  name: string;
  value: number;
  color: string;
}

export interface ThreatIntelligenceSummary {
  activeThreatCount: number;
  openIncidents: number;
  totalIncidents: number;
  unacknowledgedAlerts: number;
  highRiskZones: number;
}

export interface ThreatIntelligencePayload {
  riskZones: RiskZone[];
  riskDistribution: RiskDistributionSlice[];
  threatTrendWeekly: WeeklyThreatTrend[];
  threatBreakdown: ThreatBreakdownItem[];
  activeThreats: ActiveThreat[];
  summary: ThreatIntelligenceSummary;
}

export const threatIntelligenceApi = {
  get: (slug = getActiveEventSlug()) =>
    fetchJson<{ intelligence: ThreatIntelligencePayload }>(
      `${BASE}/events/${slug}/threat-intelligence`
    ),
};
