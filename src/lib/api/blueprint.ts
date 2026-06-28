import type { BlindSpot, BlueprintLayout, BlueprintMarker } from "@/types";
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
  coveragePct: number;
  vulnerabilityScore: number;
  markers: BlueprintMarker[];
  blindSpots: BlindSpot[];
}

export interface BlueprintResponse {
  venue: { name: string; floorLevel: string };
  blueprint: BlueprintData;
}

export const blueprintApi = {
  get: (slug = getActiveEventSlug()) =>
    fetchJson<BlueprintResponse>(`${BASE}/events/${slug}/blueprint`),

  addMarker: (
    payload: { type: string; x: number; y: number; label: string },
    slug = getActiveEventSlug()
  ) =>
    fetchJson<{ marker: BlueprintMarker }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({ action: "add-marker", ...payload }),
    }),

  deleteMarker: (markerId: string, slug = getActiveEventSlug()) =>
    fetchJson<{ ok: boolean }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({ action: "delete-marker", markerId }),
    }),

  updateStorage: (
    payload: {
      storageUrl?: string;
      name?: string;
      type?: string;
    },
    slug = getActiveEventSlug()
  ) =>
    fetchJson<{ ok: boolean }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({ action: "update-storage", ...payload }),
    }),

  autoDetect: (
    options: {
      replace?: boolean;
      storageUrl?: string;
      confidence?: number;
      labels?: string[];
    } = {},
    slug = getActiveEventSlug()
  ) =>
    fetchJson<{
      ok: boolean;
      markers: BlueprintMarker[];
      layout?: BlueprintLayout;
      summary: Record<string, unknown>;
    }>(`${BASE}/events/${slug}/blueprint`, {
      method: "POST",
      body: JSON.stringify({
        action: "auto-detect",
        replace: options.replace ?? true,
        ...(options.storageUrl ? { storageUrl: options.storageUrl } : {}),
        ...(options.confidence != null ? { confidence: options.confidence / 100 } : {}),
        ...(options.labels?.length ? { labels: options.labels } : {}),
      }),
    }),
};
