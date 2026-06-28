import type { LivePersonnel, PersonnelSummary } from "@/types";
import { getActiveEventSlug } from "@/lib/services/events";

const BASE = "/api/v1";

export interface LivePersonnelResponse {
  summary: PersonnelSummary;
  personnel: LivePersonnel[];
}

export const personnelApi = {
  live: (slug = getActiveEventSlug()) =>
    fetch(`${BASE}/events/${slug}/personnel/live`, { cache: "no-store" }).then(
      async (res) => {
        if (!res.ok) throw new Error(`Personnel API error ${res.status}`);
        return res.json() as Promise<LivePersonnelResponse>;
      }
    ),
};
