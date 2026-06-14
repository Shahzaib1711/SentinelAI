import { DEFAULT_EVENT_SLUG } from "@/lib/services/events";

const BASE = "/api/v1";

export type EnrolledRole = "guard" | "vip" | "staff" | "contractor";

export interface EnrolledPerson {
  id: string;
  name: string;
  designation: string;
  role: EnrolledRole;
  photoUrl: string | null;
  active: boolean;
  enrolled: boolean;
  createdAt: string | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: string | { msg?: string }[] }).detail;
    let msg = `API error ${res.status}`;
    if (typeof detail === "string") {
      msg = detail;
    } else if (Array.isArray(detail) && detail[0]?.msg) {
      msg = detail[0].msg;
    } else if (res.status === 500 || res.status === 503) {
      msg =
        "Personnel API unavailable. Run npm run db:push, then restart npm run api:dev and npm run dev.";
    }
    throw new Error(msg);
  }
  return res.json();
}

export const enrollmentApi = {
  list: (slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<{ personnel: EnrolledPerson[] }>(
      `${BASE}/events/${slug}/personnel/enrolled`
    ),

  enroll: (
    payload: {
      name: string;
      designation: string;
      role: EnrolledRole;
      photoUrl: string;
    },
    slug = DEFAULT_EVENT_SLUG
  ) =>
    fetchJson<{ ok: boolean; person: EnrolledPerson }>(
      `${BASE}/events/${slug}/personnel/enrolled`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  remove: (personId: string, slug = DEFAULT_EVENT_SLUG) =>
    fetchJson<{ ok: boolean }>(
      `${BASE}/events/${slug}/personnel/enrolled/${personId}`,
      { method: "DELETE" }
    ),
};
