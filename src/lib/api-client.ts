import type { Alert, Camera, Incident } from "@/types";
import { DEFAULT_EVENT_SLUG } from "@/lib/services/events";

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
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  return res.json();
}

export const api = {
  health: () => fetchJson<{ status: string; database: string }>("/api/health"),

  dashboard: (slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<{
      kpis: {
        threatLevel: string;
        securityScore: number;
        activeAlerts: number;
        camerasOnline: number;
        totalCameras: number;
      };
      threatTrend: unknown;
      riskDistribution: unknown;
      activeThreats: unknown[];
      recentAlerts: Alert[];
      securitySummaries: unknown[];
    }>(`${BASE}/events/${slug}/dashboard`),

  cameras: (slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<{ cameras: Camera[] }>(`${BASE}/events/${slug}/cameras`),

  incidents: (slug = DEFAULT_EVENT_SLUG, status?: string) => {
    const q = status ? `?status=${status}` : "";
    return fetchJson<{ incidents: Incident[] }>(
      `${BASE}/events/${slug}/incidents${q}`
    );
  },

  alerts: (slug = DEFAULT_EVENT_SLUG, activeOnly = false) =>
    fetchJson<{ alerts: Alert[] }>(
      `${BASE}/events/${slug}/alerts${activeOnly ? "?active=true" : ""}`
    ),

  acknowledgeAlert: (id: string) =>
    fetchJson<{ alert: Alert }>(`${BASE}/alerts/${id}/acknowledge`, {
      method: "PATCH",
    }),

  blueprint: (slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<{ blueprint: unknown }>(`${BASE}/events/${slug}/blueprint`),

  analyzeCoverage: (slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<unknown>(`${BASE}/events/${slug}/coverage/analyze`, {
      method: "POST",
    }),
};

export { blueprintApi } from "@/lib/api/blueprint";
export type { BlueprintData, BlueprintResponse, CoverageAnalysisResult } from "@/lib/api/blueprint";
