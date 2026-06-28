import { getActiveEventSlug } from "@/lib/services/events";

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

export interface DetectedPerson {
  id: string;
  label: string;
  photoUrl: string | null;
  cameraId: string | null;
  sightingCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
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

export interface BulkEnrollResult {
  name: string;
  row: number;
  status: "ok" | "error";
  personId?: string;
  error?: string;
}

export interface BulkEnrollSummary {
  id: string;
  name: string;
  designation: string;
  role: EnrolledRole;
  enrolled: boolean;
}

export interface BulkEnrollResponse {
  ok: boolean;
  parsed: number;
  enrolled: number;
  failed: number;
  results: BulkEnrollResult[];
  personnel: BulkEnrollSummary[];
}

async function fetchMultipart<T>(path: string, formData: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Could not reach the API during bulk import. Ensure npm run api:dev is running, then retry."
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: string }).detail;
    throw new Error(detail ?? `Bulk import failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const enrollmentApi = {
  list: (slug = getActiveEventSlug()) =>
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
    slug = getActiveEventSlug()
  ) =>
    fetchJson<{ ok: boolean; person: EnrolledPerson }>(
      `${BASE}/events/${slug}/personnel/enrolled`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  bulkEnroll: (file: File, slug = getActiveEventSlug()) => {
    const form = new FormData();
    form.append("file", file);
    // /roster-upload avoids next.config /api/* rewrite (prevents ECONNRESET on large files)
    return fetchMultipart<BulkEnrollResponse>(`/roster-upload/${slug}`, form);
  },

  remove: (personId: string, slug = getActiveEventSlug()) =>
    fetchJson<{ ok: boolean }>(
      `${BASE}/events/${slug}/personnel/enrolled/${personId}`,
      { method: "DELETE" }
    ),

  listDetected: (slug = getActiveEventSlug()) =>
    fetchJson<{ detected: DetectedPerson[] }>(
      `${BASE}/events/${slug}/personnel/detected`
    ),

  removeDetected: (personId: string, slug = getActiveEventSlug()) =>
    fetchJson<{ ok: boolean }>(
      `${BASE}/events/${slug}/personnel/detected/${personId}`,
      { method: "DELETE" }
    ),
};
