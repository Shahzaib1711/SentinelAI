export const DEFAULT_EVENT_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "summit-2026";

export const ACTIVE_EVENT_SLUG_KEY = "sentinel-active-event-slug";

export function getStoredEventSlug(): string {
  if (typeof window === "undefined") return DEFAULT_EVENT_SLUG;
  return localStorage.getItem(ACTIVE_EVENT_SLUG_KEY) ?? DEFAULT_EVENT_SLUG;
}

export function setStoredEventSlug(slug: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_EVENT_SLUG_KEY, slug);
}

/** Default slug for API calls when no explicit slug is passed. */
export function getActiveEventSlug(): string {
  return getStoredEventSlug();
}
