import { prisma } from "@/lib/db/prisma";

export const DEFAULT_EVENT_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "summit-2026";

export async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: {
      venue: {
        include: {
          blueprints: {
            include: { markers: true, blindSpots: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      cameras: { orderBy: { id: "asc" } },
      incidents: { orderBy: { time: "desc" } },
      alerts: { orderBy: { timestamp: "desc" } },
      activeThreats: { orderBy: { detectedAt: "desc" } },
      timelineEvents: true,
      riskZones: true,
      routes: true,
      recommendations: true,
    },
  });
}
