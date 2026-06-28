import type {
  ActiveThreat,
  Alert,
  SecuritySummary,
  ThreatLevel,
  ThreatTrend,
} from "@/types";
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
    const detail = (body as { detail?: string; error?: string }).detail;
    const msg =
      (typeof detail === "string" ? detail : undefined) ??
      (body as { error?: string }).error ??
      `API error ${res.status}`;
    throw new Error(msg);
  }

  return res.json();
}

export interface DashboardKPIs {
  threatLevel: ThreatLevel;
  securityScore: number;
  activeAlerts: number;
  camerasOnline: number;
  totalCameras: number;
}

export interface RiskDistributionSlice {
  name: string;
  value: number;
  color: string;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  threatTrend: ThreatTrend[];
  riskDistribution: RiskDistributionSlice[];
  activeThreats: ActiveThreat[];
  recentAlerts: Alert[];
  securitySummaries: SecuritySummary[];
}

function asThreatTrend(raw: unknown): ThreatTrend[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ThreatTrend =>
      typeof item === "object" &&
      item !== null &&
      "time" in item &&
      "level" in item
  ) as ThreatTrend[];
}

function asRiskDistribution(raw: unknown): RiskDistributionSlice[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is RiskDistributionSlice =>
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      "value" in item &&
      "color" in item
  ) as RiskDistributionSlice[];
}

function asActiveThreats(raw: unknown): ActiveThreat[] {
  if (!Array.isArray(raw)) return [];
  return raw as ActiveThreat[];
}

function asSecuritySummaries(raw: unknown): SecuritySummary[] {
  if (!Array.isArray(raw)) return [];
  return raw as SecuritySummary[];
}

export const dashboardApi = {
  get: async (slug = getActiveEventSlug()): Promise<DashboardData> => {
    const res = await fetchJson<{
      kpis: {
        threatLevel: string;
        securityScore: number;
        activeAlerts: number;
        camerasOnline: number;
        totalCameras: number;
      };
      threatTrend: unknown;
      riskDistribution: unknown;
      activeThreats: unknown;
      recentAlerts: Alert[];
      securitySummaries: unknown;
    }>(`${BASE}/events/${slug}/dashboard`);

    return {
      kpis: {
        ...res.kpis,
        threatLevel: res.kpis.threatLevel as ThreatLevel,
      },
      threatTrend: asThreatTrend(res.threatTrend),
      riskDistribution: asRiskDistribution(res.riskDistribution),
      activeThreats: asActiveThreats(res.activeThreats),
      recentAlerts: res.recentAlerts ?? [],
      securitySummaries: asSecuritySummaries(res.securitySummaries),
    };
  },
};
