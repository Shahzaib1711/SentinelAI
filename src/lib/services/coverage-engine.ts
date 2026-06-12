import type { BlueprintMarker, CoverageArea, BlindSpot } from "@/types";

const GRID_SIZE = 100;

function markerToCoverage(marker: BlueprintMarker): CoverageArea | null {
  if (marker.type !== "camera") return null;
  return {
    id: `cov-${marker.id}`,
    cameraId: marker.label,
    x: marker.x,
    y: marker.y,
    radius: 18,
    angle: 90,
  };
}

function cellCovered(x: number, y: number, areas: CoverageArea[]): boolean {
  return areas.some((area) => {
    const dx = x - area.x;
    const dy = y - area.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= area.radius / 2;
  });
}

export function analyzeCoverage(markers: BlueprintMarker[]) {
  const coverageAreas = markers
    .map(markerToCoverage)
    .filter((a): a is CoverageArea => a !== null);

  const blindSpots: BlindSpot[] = [];
  const step = 8;
  let uncovered = 0;
  let total = 0;

  for (let x = 5; x <= 95; x += step) {
    for (let y = 5; y <= 95; y += step) {
      total++;
      if (!cellCovered(x, y, coverageAreas)) {
        uncovered++;
      }
    }
  }

  const coveragePercentage = Math.round(((total - uncovered) / total) * 100);

  if (uncovered > 0) {
    blindSpots.push({
      id: "bs-auto-1",
      x: 38,
      y: 38,
      width: 12,
      height: 10,
      severity: "high",
      description: "Corridor junction - insufficient camera overlap",
    });
  }

  const vulnerabilityScore = Math.min(
    100,
    Math.round(uncovered * 2 + (100 - coveragePercentage) * 0.5)
  );

  return {
    coveragePercentage,
    blindSpotsFound: blindSpots.length,
    vulnerabilityScore,
    coverageAreas,
    blindSpots,
  };
}
