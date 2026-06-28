import type { Alert, Camera } from "@/types";
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

export const api = {
  dashboard: (slug = getActiveEventSlug()) =>
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

  cameras: (slug = getActiveEventSlug()) =>
    fetchJson<{ cameras: Camera[] }>(`${BASE}/events/${slug}/cameras`),

  alerts: (slug = getActiveEventSlug(), activeOnly = false) =>
    fetchJson<{ alerts: Alert[] }>(
      `${BASE}/events/${slug}/alerts${activeOnly ? "?active=true" : ""}`
    ),
};
