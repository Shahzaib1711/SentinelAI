import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";
const BULK_TIMEOUT_MS = 5 * 60 * 1000;

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Bulk roster upload — lives OUTSIDE /api/* so next.config rewrites do not
 * proxy large multipart bodies directly to FastAPI (that causes ECONNRESET).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const target = `${FASTAPI_URL}/api/v1/events/${slug}/personnel/enrolled/bulk`;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Invalid upload payload" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ detail: "Roster file is required" }, { status: 400 });
  }

  const outbound = new FormData();
  const filename = file instanceof File && file.name ? file.name : "roster.csv";
  outbound.append("file", file, filename);

  try {
    const upstream = await fetchWithTimeout(
      target,
      { method: "POST", body: outbound },
      BULK_TIMEOUT_MS
    );

    const body = await upstream.text();
    let detail: string | undefined;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      detail = parsed.detail;
    } catch {
      detail = body.slice(0, 300) || undefined;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          detail:
            detail ??
            (upstream.status === 405
              ? "Bulk import API is outdated — stop and restart npm run api:dev, then retry."
              : `Bulk import failed (${upstream.status})`),
        },
        { status: upstream.status }
      );
    }

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy failed";
    const isTimeout = message.includes("timeout") || message.includes("aborted");
    const isReset = message.includes("ECONNRESET") || message.includes("fetch failed");

    return NextResponse.json(
      {
        detail: isTimeout
          ? "Bulk import timed out. Try fewer people per file or smaller photos."
          : isReset
            ? "API connection lost during import. Restart npm run api:dev and retry."
            : `Bulk import failed: ${message}`,
      },
      { status: isTimeout || isReset ? 504 : 502 }
    );
  }
}
