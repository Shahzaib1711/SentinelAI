import type { BlindSpot, BlueprintLayout, BlueprintMarker, CoverageArea, Recommendation, ThreatLevel } from "@/types";
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
    const msg =
      (body as { detail?: string; error?: string }).detail ??
      (body as { error?: string }).error ??
      `API error ${res.status}`;
    throw new Error(msg);
  }

  return res.json();
}

export interface BlueprintData {
  id: string;
  name: string;
  type: string;
  storageUrl: string | null;
  firebasePath: string | null;
  coveragePct: number;
  vulnerabilityScore: number;
  markers: BlueprintMarker[];
  blindSpots: BlindSpot[];
}

export interface BlueprintResponse {
  venue: { name: string; floorLevel: string };
  blueprint: BlueprintData;
}

export interface CoverageAnalysisResult {
  metrics: {
    coveragePercentage: number;
    blindSpotsFound: number;
    vulnerabilityScore: number;
  };
  coverageAreas: CoverageArea[];
  blindSpots: BlindSpot[];
  recommendations: Recommendation[];
}

export const blueprintApi = {
  get: (slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<BlueprintResponse>(`${BASE}/events/${slug}/blueprint`),

  addMarker: (
    payload: { type: string; x: number; y: number; label: string },
    slug = DEFAULT_EVENT_SLUG
  ) =>
    fetchJson<{ marker: BlueprintMarker }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({ action: "add-marker", ...payload }),
    }),

  deleteMarker: (markerId: string, slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<{ ok: boolean }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({ action: "delete-marker", markerId }),
    }),

  updateStorage: (
    payload: {
      storageUrl?: string;
      firebasePath?: string;
      name?: string;
      type?: string;
    },
    slug = DEFAULT_EVENT_SLUG
  ) =>
    fetchJson<{ ok: boolean }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({ action: "update-storage", ...payload }),
    }),

  analyzeCoverage: (slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<CoverageAnalysisResult>(`${BASE}/events/${slug}/coverage/analyze`, {
      method: "POST",
    }),

  autoDetect: (replace = true, storageUrl?: string, slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<{
      ok: boolean;
      markers: BlueprintMarker[];
      layout?: BlueprintLayout;
      summary: Record<string, unknown>;
    }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({
        action: "auto-detect",
        replace,
        ...(storageUrl ? { storageUrl } : {}),
      }),
    }),
};

export function mapApiBlindSpot(
  spot: BlindSpot & { severity: string }
): BlindSpot {
  return {
    ...spot,
    severity: spot.severity as ThreatLevel,
  };
}
