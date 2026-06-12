/** Path to open the phone broadcast page for a camera feed. */
export function getBroadcastPath(cameraId: string): string {
  return `/broadcast?camera=${encodeURIComponent(cameraId)}`;
}

/** Public app base URL — set NEXT_PUBLIC_APP_URL to your ngrok HTTPS URL for phone broadcasts. */
export function getAppOrigin(fallbackOrigin = ""): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return fallbackOrigin.replace(/\/$/, "");
}

/** Full broadcast URL (needs origin — use on client after mount). */
export function getBroadcastUrl(origin: string, cameraId: string): string {
  return `${getAppOrigin(origin)}${getBroadcastPath(cameraId)}`;
}
