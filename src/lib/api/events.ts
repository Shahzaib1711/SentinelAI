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
    const detail = (body as { detail?: unknown; error?: string }).detail;
    let msg: string;
    if (typeof detail === "string") {
      msg = detail;
    } else if (Array.isArray(detail) && detail[0]?.msg) {
      msg = String(detail[0].msg);
    } else if ((body as { error?: string }).error) {
      msg = (body as { error?: string }).error!;
    } else if (res.status === 503) {
      msg = "Database unavailable — check Neon connection and npm run api:dev";
    } else if (res.status >= 500) {
      msg = `Server error (${res.status}) — restart the API: npm run api:dev`;
    } else {
      msg = `API error ${res.status}`;
    }
    throw new Error(msg);
  }

  return res.json();
}

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  venueName: string;
  eventDate: string;
  threatLevel: string;
  securityScore: number;
  vipCount: number;
  attendees: number;
  securityPersonnel: number;
  hasFloorPlan: boolean;
  floorLevel?: string | null;
  blueprintId?: string | null;
}

export interface CreateEventInput {
  name: string;
  venueName: string;
  eventDate: string;
  slug?: string;
  floorLevel?: string;
  threatLevel?: string;
  vipCount?: number;
  attendees?: number;
  securityPersonnel?: number;
}

export const eventsApi = {
  list: () => fetchJson<{ events: EventSummary[] }>(`${BASE}/events`),

  get: (slug: string) =>
    fetchJson<{ event: EventSummary }>(`${BASE}/events/${slug}`),

  create: (payload: CreateEventInput) =>
    fetchJson<{ ok: boolean; event: EventSummary }>(`${BASE}/events`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
