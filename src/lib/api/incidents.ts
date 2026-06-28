import type { Incident, IncidentStatus, ThreatLevel } from "@/types";
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

export interface CreateIncidentInput {
  location: string;
  description: string;
  threatLevel: ThreatLevel;
  assignedTo: string;
  status?: IncidentStatus;
  cameraId?: string;
}

export interface UpdateIncidentInput {
  status?: IncidentStatus;
  assignedTo?: string;
  resolution?: string;
  threatLevel?: ThreatLevel;
  description?: string;
  location?: string;
}

export const incidentsApi = {
  list: (slug = getActiveEventSlug(), status?: string) => {
    const q = status && status !== "all" ? `?status=${status}` : "";
    return fetchJson<{ incidents: Incident[] }>(
      `${BASE}/events/${slug}/incidents${q}`
    );
  },

  create: (payload: CreateIncidentInput, slug = getActiveEventSlug()) =>
    fetchJson<{ incident: Incident }>(`${BASE}/events/${slug}/incidents`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  get: (incidentId: string) =>
    fetchJson<{ incident: Incident }>(`${BASE}/incidents/${incidentId}`),

  update: (incidentId: string, payload: UpdateIncidentInput) =>
    fetchJson<{ incident: Incident }>(`${BASE}/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
