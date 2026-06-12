import { PrismaClient } from "@prisma/client";
import {
  activeThreats,
  blueprintMarkers,
  blindSpots,
  cameras,
  coverageMetrics,
  coverageRecommendations,
  incidents,
  recentAlerts,
  reportData,
  riskDistribution,
  riskZones,
  routes,
  threatTimeline,
  threatTrendData,
} from "../src/lib/mock-data";

const prisma = new PrismaClient();

async function main() {
  const slug = "summit-2026";

  await prisma.incident.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.activeThreat.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.riskZone.deleteMany();
  await prisma.route.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.blindSpot.deleteMany();
  await prisma.blueprintMarker.deleteMany();
  await prisma.blueprint.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.event.deleteMany();

  const event = await prisma.event.create({
    data: {
      slug,
      name: reportData.eventDetails.name,
      venueName: reportData.eventDetails.venue,
      eventDate: new Date("2026-06-05"),
      threatLevel: "medium",
      securityScore: reportData.securityScore,
      vipCount: reportData.eventDetails.vipCount,
      attendees: reportData.eventDetails.attendees,
      securityPersonnel: reportData.eventDetails.securityPersonnel,
      threatTrendJson: threatTrendData as object,
      riskDistributionJson: riskDistribution as object,
    },
  });

  const venue = await prisma.venue.create({
    data: {
      eventId: event.id,
      name: reportData.eventDetails.venue,
      floorLevel: "L1",
      blueprints: {
        create: {
          name: "Level 1 Floor Plan",
          type: "floor_plan",
          coveragePct: coverageMetrics.coveragePercentage,
          vulnerabilityScore: coverageMetrics.vulnerabilityScore,
          markers: {
            create: blueprintMarkers.map((m) => ({
              type: m.type === "vip-route" ? "vip_route" : m.type,
              x: m.x,
              y: m.y,
              label: m.label,
            })),
          },
          blindSpots: {
            create: blindSpots.map((b) => ({
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              severity: b.severity,
              description: b.description,
            })),
          },
        },
      },
    },
  });

  void venue;

  await prisma.camera.createMany({
    data: cameras.map((c) => ({
      id: c.id,
      eventId: event.id,
      name: c.name,
      location: c.location,
      status: c.status,
      coverage: c.coverage,
      useWebRTC: c.useWebRTC ?? false,
    })),
  });

  for (const inc of incidents) {
    await prisma.incident.create({
      data: {
        id: inc.id,
        eventId: event.id,
        time: new Date(inc.time),
        location: inc.location,
        threatLevel: inc.threatLevel,
        status: inc.status,
        description: inc.description,
        assignedTo: inc.assignedTo,
        cameraId: inc.cameraId,
        resolution: inc.resolution,
      },
    });
  }

  for (const alert of recentAlerts) {
    await prisma.alert.create({
      data: {
        eventId: event.id,
        title: alert.title,
        description: alert.description,
        level: alert.level,
        location: alert.location,
        timestamp: new Date(alert.timestamp),
        acknowledged: alert.acknowledged,
      },
    });
  }

  await prisma.activeThreat.createMany({
    data: activeThreats.map((t) => ({
      eventId: event.id,
      externalId: t.id,
      type: t.type,
      location: t.location,
      level: t.level,
      detectedAt: new Date(t.detectedAt),
      confidence: t.confidence,
    })),
  });

  await prisma.timelineEvent.createMany({
    data: threatTimeline.map((t) => ({
      eventId: event.id,
      time: t.time,
      title: t.title,
      level: t.level,
      description: t.description,
    })),
  });

  await prisma.riskZone.createMany({
    data: riskZones.map((z) => ({
      eventId: event.id,
      name: z.name,
      riskLevel: z.riskLevel,
      riskScore: z.riskScore,
      incidents: z.incidents,
      coverage: z.coverage,
    })),
  });

  for (const route of routes) {
    await prisma.route.create({
      data: {
        id: route.id,
        eventId: event.id,
        name: route.name,
        distance: route.distance,
        estimatedTime: route.estimatedTime,
        riskScore: route.riskScore,
        waypointsJson: route.waypoints,
        isSafest: route.isSafest ?? false,
      },
    });
  }

  await prisma.recommendation.createMany({
    data: coverageRecommendations.map((r) => ({
      eventId: event.id,
      type: r.type,
      title: r.title,
      description: r.description,
      priority: r.priority,
      location: r.location,
    })),
  });

  console.log(`Seeded event: ${slug} (${event.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
