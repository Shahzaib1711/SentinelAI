"""AI security planning agent — reads blueprint, applies user brief, proposes guards/cameras."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any

from app.services.blueprint_analyzer import analyze_blueprint_image
from app.services.coverage_engine import analyze_coverage
from app.services.camera_placement import propose_cameras_for_coverage


@dataclass
class UserConstraints:
    raw_instructions: str = ""
    min_guards: int = 2
    min_cameras: int = 0
    threat_posture: str = "standard"  # standard | elevated | maximum
    focus_areas: list[str] = field(default_factory=list)
    sentiment: str = "neutral"  # neutral | concerned | urgent | reassuring | curious
    intent_summary: str = ""


def _dist(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _center(box: dict[str, Any]) -> dict[str, float]:
    return {
        "x": round(float(box.get("x", 0)) + float(box.get("width", 0)) / 2, 1),
        "y": round(float(box.get("y", 0)) + float(box.get("height", 0)) / 2, 1),
    }


def _too_close(point: dict[str, float], others: list[dict[str, float]], min_sep: float = 7.0) -> bool:
    return any(_dist(point, o) < min_sep for o in others)


def parse_user_instructions(text: str) -> UserConstraints:
    """Extract planning constraints from natural-language operator brief."""
    t = (text or "").strip().lower()
    c = UserConstraints(raw_instructions=text or "")

    guard_match = re.search(r"(\d+)\s*guards?", t)
    if guard_match:
        c.min_guards = max(1, int(guard_match.group(1)))

    for add_match in re.finditer(r"add\s+(\d+)\s+(?:more\s+)?guards?", t):
        c.min_guards += int(add_match.group(1))

    reduce_guard = re.search(
        r"(?:reduce|lower|cut|only|just)\s+(?:to\s+)?(\d+)\s*guards?", t
    )
    if reduce_guard:
        c.min_guards = max(1, int(reduce_guard.group(1)))

    camera_match = re.search(r"(\d+)\s*cameras?", t)
    if camera_match:
        c.min_cameras = max(0, int(camera_match.group(1)))

    for add_cam in re.finditer(r"add\s+(\d+)\s+(?:more\s+)?cameras?", t):
        c.min_cameras += int(add_cam.group(1))

    if any(
        phrase in t
        for phrase in (
            "full coverage",
            "full venue",
            "whole venue",
            "whole place",
            "entire venue",
            "no blind spot",
            "blind spot",
            "cover the",
            "cover whole",
            "cover entire",
        )
    ):
        c.min_cameras = max(c.min_cameras, 4)

    if any(w in t for w in ("maximum security", "max security", "highest threat", "critical")):
        c.threat_posture = "maximum"
        c.min_guards = max(c.min_guards, 4)
    elif any(w in t for w in ("elevated", "high alert", "high threat", "tight security")):
        c.threat_posture = "elevated"
        c.min_guards = max(c.min_guards, 3)

    for area in ("lobby", "corridor", "hall", "kitchen", "parking", "stage", "backstage"):
        if area in t:
            c.focus_areas.append(area)

    return c


def _describe_blueprint(layout: dict[str, Any], summary: dict[str, Any]) -> str:
    walls = layout.get("walls") or []
    doors = layout.get("doors") or []
    windows = layout.get("windows") or []
    columns = layout.get("columns") or []
    entrances = layout.get("entrances") or []
    counts = layout.get("objectCounts") or {}
    method = summary.get("method", "analysis")

    count_bits = ", ".join(f"{k} {v}" for k, v in list(counts.items())[:5])

    parts = [
        f"Floor plan parsed via {method}:",
        f"{len(walls)} wall segment(s), {len(doors)} door(s), {len(windows)} window(s),",
        f"{len(columns)} column(s)",
    ]
    if count_bits:
        parts.append(f"— detected {count_bits}")
    if entrances:
        parts.append(f"with {len(entrances)} boundary entrance point(s).")
    return " ".join(parts)


def _build_blueprint_stats(layout: dict[str, Any], summary: dict[str, Any]) -> dict[str, Any]:
    return {
        "walls": len(layout.get("walls") or []),
        "doors": len(layout.get("doors") or []),
        "windows": len(layout.get("windows") or []),
        "columns": len(layout.get("columns") or []),
        "entrances": len(layout.get("entrances") or []),
        "objectCounts": layout.get("objectCounts") or {},
        "detectionMethod": summary.get("method", "analysis"),
        "confidence": summary.get("confidence"),
    }


def _build_security_findings(
    *,
    layout: dict[str, Any],
    coverage: dict[str, Any],
    markers: list[dict[str, Any]],
    constraints: UserConstraints,
) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    doors = layout.get("doors") or []
    blind_count = coverage.get("blindSpotsFound", 0)
    vuln = coverage.get("vulnerabilityScore", 0)
    cov_pct = coverage.get("coveragePercentage", 0)

    if doors:
        findings.append(
            {
                "severity": "info",
                "title": f"{len(doors)} door(s) detected on blueprint",
                "detail": "Place guards at primary access points and monitor chokepoints between zones.",
            }
        )
    elif not any(m.get("type") == "entrance" for m in markers):
        findings.append(
            {
                "severity": "medium",
                "title": "No doors or entrance markers identified",
                "detail": "Run auto-detect in Venue Setup or mark entrances manually before deployment.",
            }
        )

    if blind_count > 0:
        findings.append(
            {
                "severity": "high" if blind_count >= 3 else "medium",
                "title": f"{blind_count} blind spot(s) in current coverage",
                "detail": f"Coverage is {cov_pct}% — add cameras or roving patrols to close gaps.",
            }
        )

    if vuln > 55:
        findings.append(
            {
                "severity": "high",
                "title": f"Elevated vulnerability score ({vuln}/100)",
                "detail": "Increase guard density at entrances and large open zones.",
            }
        )

    if constraints.threat_posture == "maximum":
        findings.append(
            {
                "severity": "high",
                "title": "Maximum-security posture active",
                "detail": "Minimum guard grid, counter-surveillance sweep, and redundant camera coverage required.",
            }
        )

    if not findings:
        findings.append(
            {
                "severity": "info",
                "title": "Baseline blueprint analysis complete",
                "detail": "Review proposed guard and camera positions against your operational brief.",
            }
        )

    return findings


def _build_security_advisories(
    *,
    layout: dict[str, Any],
    coverage: dict[str, Any],
    constraints: UserConstraints,
) -> list[str]:
    advisories: list[str] = []
    if coverage.get("blindSpotsFound", 0) > 2:
        advisories.append(
            "Multiple blind spots detected — prioritize camera placement before event start."
        )
    if not layout.get("doors") and not layout.get("entrances"):
        advisories.append(
            "Door geometry not detected — validate entrance positions on the blueprint overlay."
        )
    if constraints.threat_posture in ("elevated", "maximum"):
        advisories.append(
            "Elevated threat posture: brief all personnel and enable enhanced access control."
        )
    return advisories


def propose_guard_positions(
    *,
    markers: list[dict[str, Any]],
    layout: dict[str, Any],
    blind_spots: list[dict[str, Any]],
    constraints: UserConstraints,
) -> list[dict[str, Any]]:
    """Place guard posts at chokepoints, doors, entrances, and blind spots."""
    existing = [
        {"x": float(m["x"]), "y": float(m["y"])}
        for m in markers
        if m.get("type") in ("guard", "camera")
    ]
    placed: list[dict[str, float]] = list(existing)
    proposals: list[dict[str, Any]] = []
    guard_num = sum(1 for m in markers if m.get("type") == "guard") + 1

    def add(x: float, y: float, label: str, reason: str) -> None:
        nonlocal guard_num
        pt = {"x": round(x, 1), "y": round(y, 1)}
        if _too_close(pt, placed, 6.5):
            return
        placed.append(pt)
        proposals.append(
            {
                "type": "guard",
                "x": pt["x"],
                "y": pt["y"],
                "label": label,
                "reason": reason,
                "proposed": True,
            }
        )
        guard_num += 1

    for door in (layout.get("doors") or [])[:6]:
        c = _center(door)
        add(
            c["x"],
            c["y"],
            f"GUARD-{guard_num:02d}",
            f"Door access control: {door.get('label', 'door')}",
        )

    for m in markers:
        if m.get("type") == "entrance":
            add(
                float(m["x"]),
                float(m["y"]),
                f"GUARD-{guard_num:02d}",
                f"Secure entrance: {m.get('label', 'entrance')}",
            )

    for spot in blind_spots[:4]:
        c = _center(spot)
        add(
            c["x"],
            c["y"],
            f"GUARD-{guard_num:02d}",
            f"Cover blind spot ({spot.get('severity', 'high')}): {spot.get('description', 'uncovered zone')[:60]}",
        )

    while len(proposals) + sum(1 for m in markers if m.get("type") == "guard") < constraints.min_guards:
        angle = len(proposals) * 1.2
        add(
            50 + 30 * math.cos(angle),
            50 + 30 * math.sin(angle),
            f"GUARD-{guard_num:02d}",
            "Additional perimeter post per operator brief",
        )
        if len(proposals) >= 12:
            break

    return proposals


def propose_camera_positions(
    *,
    markers: list[dict[str, Any]],
    blind_spots: list[dict[str, Any]],
    constraints: UserConstraints,
    layout: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    target = 88.0 if constraints.threat_posture == "maximum" else 86.0
    min_cams = max(constraints.min_cameras, 3 if blind_spots else 2)
    return propose_cameras_for_coverage(
        markers=markers,
        blind_spots=blind_spots,
        layout=layout,
        min_cameras=min_cams,
        target_coverage_pct=target,
    )


def _build_recommendations(
    *,
    coverage: dict[str, Any],
    guard_proposals: list[dict[str, Any]],
    camera_proposals: list[dict[str, Any]],
    constraints: UserConstraints,
    findings: list[dict[str, str]],
) -> list[dict[str, Any]]:
    recs: list[dict[str, Any]] = []

    if guard_proposals:
        recs.append(
            {
                "type": "guard",
                "title": f"Deploy {len(guard_proposals)} guard post(s)",
                "description": "Positions cover doors, entrances, blind spots, and high-traffic zones.",
                "priority": "high" if constraints.threat_posture != "standard" else "medium",
            }
        )

    if camera_proposals:
        recs.append(
            {
                "type": "camera",
                "title": f"Add {len(camera_proposals)} camera(s) for full-venue coverage",
                "description": (
                    "Positions chosen to maximize floor-plan coverage and overlap sightlines "
                    "so blind spots are eliminated or reduced."
                ),
                "priority": "high" if coverage.get("blindSpotsFound", 0) > 0 else "medium",
            }
        )

    if coverage.get("vulnerabilityScore", 0) > 55:
        recs.append(
            {
                "type": "general",
                "title": "Elevated venue vulnerability",
                "description": (
                    f"Coverage is {coverage.get('coveragePercentage', 0)}% with "
                    f"{coverage.get('blindSpotsFound', 0)} blind spot(s) — increase monitoring density."
                ),
                "priority": "high",
            }
        )

    for finding in findings:
        if finding.get("severity") == "high":
            recs.append(
                {
                    "type": "general",
                    "title": finding["title"],
                    "description": finding["detail"],
                    "priority": "high",
                }
            )

    return recs


def agent_review_plan(
    *,
    blueprint_summary: str,
    constraints: UserConstraints,
    markers: list[dict[str, Any]],
    layout: dict[str, Any],
    guard_proposals: list[dict[str, Any]],
    camera_proposals: list[dict[str, Any]],
    coverage_before: dict[str, Any],
    coverage_after: dict[str, Any],
    findings: list[dict[str, str]],
    summary: dict[str, Any],
) -> dict[str, Any]:
    """
    Security agent review pass — explains reasoning and applies improvements
    when the draft plan can be hardened further.
    """
    steps: list[dict[str, str]] = []
    modifications: list[str] = []
    revised_guards = list(guard_proposals)
    revised_cameras = list(camera_proposals)

    steps.append({"phase": "Read blueprint", "detail": blueprint_summary})

    stats = _build_blueprint_stats(layout, summary)
    if stats.get("objectCounts"):
        counts = ", ".join(f"{k}: {v}" for k, v in stats["objectCounts"].items())
        steps.append({"phase": "Blueprint detections", "detail": f"Object counts — {counts}"})

    intent_parts = [f"Minimum {constraints.min_guards} guard(s)"]
    if constraints.min_cameras:
        intent_parts.append(f"{constraints.min_cameras} camera(s)")
    if constraints.threat_posture != "standard":
        intent_parts.append(f"{constraints.threat_posture} threat posture")
    if constraints.focus_areas:
        intent_parts.append(f"focus: {', '.join(constraints.focus_areas)}")
    if constraints.raw_instructions:
        intent_parts.append(f'operator note: "{constraints.raw_instructions[:120]}"')
    steps.append({"phase": "Parse operator brief", "detail": "; ".join(intent_parts)})

    vuln = (
        f"Pre-plan coverage {coverage_before.get('coveragePercentage', 0)}%, "
        f"vulnerability {coverage_before.get('vulnerabilityScore', 0)}/100, "
        f"{coverage_before.get('blindSpotsFound', 0)} blind spot cluster(s)."
    )
    steps.append({"phase": "Assess vulnerabilities", "detail": vuln})

    high_findings = [f["title"] for f in findings if f.get("severity") == "high"]
    if high_findings:
        steps.append(
            {
                "phase": "Security findings",
                "detail": "; ".join(high_findings[:3]),
            }
        )

    steps.append(
        {
            "phase": "Camera coverage plan",
            "detail": (
                f"Greedy placement targets ≥{86}% floor coverage with overlapping FOV; "
                f"{len(revised_cameras)} camera(s) proposed."
            ),
        }
    )

    steps.append(
        {
            "phase": "Draft deployment",
            "detail": (
                f"Proposed {len(revised_guards)} guard(s) and {len(revised_cameras)} camera(s). "
                f"Post-plan coverage {coverage_after.get('coveragePercentage', 0)}%."
            ),
        }
    )

    existing_guard_count = sum(1 for m in markers if m.get("type") == "guard")
    total_guards = existing_guard_count + len(revised_guards)

    if constraints.threat_posture == "maximum" and total_guards < 5:
        extra = 5 - total_guards
        for i in range(extra):
            revised_guards.append(
                {
                    "type": "guard",
                    "x": round(15 + i * 18, 1),
                    "y": round(75 - i * 8, 1),
                    "label": f"GUARD-AG{i + 1:02d}",
                    "reason": "Agent upgrade: maximum-security posture requires denser guard grid",
                    "proposed": True,
                }
            )
        modifications.append(f"Added {extra} guard post(s) for maximum-security posture.")

    after_vuln = coverage_after.get("vulnerabilityScore", 100)
    after_pct = coverage_after.get("coveragePercentage", 0)
    if after_pct < 80 and len(revised_cameras) < 12:
        extra = propose_cameras_for_coverage(
            markers=markers + [{**c, "type": "camera", "id": f"ag-{i}"} for i, c in enumerate(revised_cameras)],
            blind_spots=[],
            layout=layout,
            min_cameras=1,
            target_coverage_pct=86.0,
            max_cameras=12 - len(revised_cameras),
        )
        if extra:
            revised_cameras.extend(extra[: max(1, 3 - (0 if after_pct > 75 else 2))])
            modifications.append(
                f"Added {len(extra)} camera(s) — coverage was {after_pct}% (target ≥86%)."
            )
    elif after_vuln > 45 and len(revised_cameras) < 3:
        extra = propose_cameras_for_coverage(
            markers=markers,
            blind_spots=[],
            layout=layout,
            min_cameras=1,
            target_coverage_pct=85.0,
            max_cameras=2,
        )
        if extra:
            revised_cameras.append(extra[0])
            modifications.append("Added coverage camera — vulnerability remained elevated.")

    if modifications:
        steps.append(
            {
                "phase": "Agent security review",
                "detail": " ".join(modifications) + " Plan hardened before handoff.",
            }
        )
    else:
        steps.append(
            {
                "phase": "Agent security review",
                "detail": "Draft plan meets posture requirements — no structural changes required.",
            }
        )

    measures = [
        "Brief all guards on access-control posts and radio check procedures.",
        "Verify door and entrance coverage against the blueprint overlay before go-live.",
        "Hold secondary team on standby at the primary entrance.",
    ]
    if constraints.threat_posture in ("elevated", "maximum"):
        measures.append("Enable counter-surveillance sweep 15 minutes before event start.")
    if coverage_after.get("blindSpotsFound", 0) > 0:
        measures.append("Assign roving patrol to cover residual blind spots not visible on cameras.")

    return {
        "reasoningSteps": steps,
        "modifications": modifications,
        "guardProposals": revised_guards,
        "cameraProposals": revised_cameras,
        "securityMeasures": measures,
    }


def build_security_plan(
    *,
    image_source: str | None,
    existing_markers: list[dict[str, Any]],
    existing_blind_spots: list[dict[str, Any]],
    event: dict[str, Any],
    instructions: str = "",
    constraints: UserConstraints | None = None,
    chat_history: list[dict[str, str]] | None = None,
    previous_plan: dict[str, Any] | None = None,
    start_marker_id: str | None = None,
    destination_marker_id: str | None = None,
) -> dict[str, Any]:
    """
    Full security planning pipeline:
    1. Deep-read blueprint structure (walls, doors, windows)
    2. Parse operator instructions
    3. Overall security analysis + guard/camera proposals
    4. Agent review and harden plan
    """
    _ = start_marker_id, destination_marker_id  # legacy API params — ignored

    layout: dict[str, Any] = {}
    summary: dict[str, Any] = {}

    if image_source:
        analysis = analyze_blueprint_image(image_source)
        layout = analysis.get("layout") or {}
        summary = analysis.get("summary") or {}
        detected = analysis.get("markers") or []
        if not existing_markers and detected:
            existing_markers = detected

    markers = [m for m in existing_markers if m.get("type") != "vip-route"]

    blueprint_summary = _describe_blueprint(layout, summary)
    blueprint_stats = _build_blueprint_stats(layout, summary)

    if constraints is None:
        from app.services.security_llm import interpret_user_constraints

        prev_c = (previous_plan or {}).get("constraints")
        constraints = interpret_user_constraints(
            instructions,
            history=chat_history,
            blueprint_stats=blueprint_stats,
            previous_constraints=prev_c,
            event=event,
        )
    bounds = (layout or {}).get("blueprintBounds")
    coverage_before = analyze_coverage(markers, bounds)
    blind_spots = existing_blind_spots or coverage_before.get("blindSpots", [])

    findings = _build_security_findings(
        layout=layout,
        coverage=coverage_before,
        markers=markers,
        constraints=constraints,
    )
    advisories = _build_security_advisories(
        layout=layout,
        coverage=coverage_before,
        constraints=constraints,
    )

    guard_proposals = propose_guard_positions(
        markers=markers,
        layout=layout,
        blind_spots=blind_spots,
        constraints=constraints,
    )
    camera_proposals = propose_camera_positions(
        markers=markers,
        blind_spots=blind_spots,
        constraints=constraints,
        layout=layout,
    )

    simulated = markers + [
        {**g, "id": f"sim-g{i}"} for i, g in enumerate(guard_proposals)
    ] + [{**c, "id": f"sim-c{i}"} for i, c in enumerate(camera_proposals)]
    coverage_after = analyze_coverage(simulated, bounds)

    review = agent_review_plan(
        blueprint_summary=blueprint_summary,
        constraints=constraints,
        markers=markers,
        layout=layout,
        guard_proposals=guard_proposals,
        camera_proposals=camera_proposals,
        coverage_before=coverage_before,
        coverage_after=coverage_after,
        findings=findings,
        summary=summary,
    )

    guard_proposals = review["guardProposals"]
    camera_proposals = review["cameraProposals"]

    simulated_final = markers + [
        {**g, "id": f"sim-g{i}"} for i, g in enumerate(guard_proposals)
    ] + [{**c, "id": f"sim-c{i}"} for i, c in enumerate(camera_proposals)]
    coverage_final = analyze_coverage(simulated_final, bounds)

    recommendations = _build_recommendations(
        coverage=coverage_final,
        guard_proposals=guard_proposals,
        camera_proposals=camera_proposals,
        constraints=constraints,
        findings=findings,
    )

    return {
        "summary": (
            f"Security analysis for {event.get('name', 'event')}: "
            f"{blueprint_stats['doors']} door(s), "
            f"{len(guard_proposals)} guard post(s), {len(camera_proposals)} camera(s). "
            f"Coverage {coverage_final.get('coveragePercentage', 0)}% "
            f"(vulnerability {coverage_final.get('vulnerabilityScore', 0)}/100)."
        ),
        "blueprintUnderstanding": blueprint_summary,
        "constraints": {
            "minGuards": constraints.min_guards,
            "minCameras": constraints.min_cameras,
            "threatPosture": constraints.threat_posture,
            "instructions": constraints.raw_instructions,
            "sentiment": constraints.sentiment,
            "intentSummary": constraints.intent_summary,
        },
        "layout": layout,
        "analysisSummary": summary,
        "securityAnalysis": {
            "blueprint": blueprint_stats,
            "findings": findings,
            "advisories": advisories,
        },
        "coverageBefore": {
            "coveragePercentage": coverage_before.get("coveragePercentage"),
            "vulnerabilityScore": coverage_before.get("vulnerabilityScore"),
            "blindSpotsFound": coverage_before.get("blindSpotsFound"),
        },
        "coverageAfter": {
            "coveragePercentage": coverage_final.get("coveragePercentage"),
            "vulnerabilityScore": coverage_final.get("vulnerabilityScore"),
            "blindSpotsFound": coverage_final.get("blindSpotsFound"),
        },
        "proposedGuards": guard_proposals,
        "proposedCameras": camera_proposals,
        "recommendations": recommendations,
        "securityMeasures": review["securityMeasures"],
        "agentReview": {
            "reasoningSteps": review["reasoningSteps"],
            "modifications": review["modifications"],
        },
    }
