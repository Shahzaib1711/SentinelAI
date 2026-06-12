import { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase/admin";
import { prisma } from "@/lib/db/prisma";

/** Optional auth — returns user when Firebase token is valid, null in dev without auth */
export async function getOptionalUser(request: NextRequest) {
  const decoded = await verifyIdToken(request.headers.get("authorization"));
  if (!decoded) return null;

  return prisma.user.upsert({
    where: { firebaseUid: decoded.uid },
    update: {
      email: decoded.email ?? "",
      name: decoded.name ?? decoded.email ?? "Operator",
    },
    create: {
      firebaseUid: decoded.uid,
      email: decoded.email ?? `${decoded.uid}@sentinel.local`,
      name: decoded.name ?? "Security Operator",
      role: "operator",
    },
  });
}
