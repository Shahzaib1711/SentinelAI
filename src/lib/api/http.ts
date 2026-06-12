import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  console.error("[API]", error);
  if (error instanceof Error) {
    return jsonError(error.message, 500);
  }
  return jsonError("Internal server error", 500);
}
