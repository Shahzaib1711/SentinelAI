import type { Route } from "@/types";
import { DEFAULT_EVENT_SLUG } from "@/lib/services/events";

const BASE = "/api/v1";

export interface RouteLocation {
  value: string;
  label: string;
  type: string;
}

export interface RouteAdvisoryResponse {
  locations: RouteLocation[];
  routes: Route[];
  advisories: string[];
  event: {
    name: string;
    threatLevel: string;
    vipCount: number;
    attendees: number;
    securityPersonnel: number;
  };
  start: { id: string; label: string; type: string };
  destination: { id: string; label: string; type: string };
}

export const routesApi = {
  advise: (
    start: string,
    destination: string,
    slug = DEFAULT_EVENT_SLUG
  ): Promise<RouteAdvisoryResponse> =>
    fetch(
      `${BASE}/events/${slug}/routes/advise?start=${encodeURIComponent(start)}&destination=${encodeURIComponent(destination)}`,
      { cache: "no-store" }
    ).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { detail?: string }).detail ?? `Route API error ${res.status}`;
        throw new Error(msg);
      }
      return res.json() as Promise<RouteAdvisoryResponse>;
    }),
};
