"""Aggregate threat intelligence for an event from DB + live incident/alert signals."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from app.models.models import ActiveThreat, Alert, Incident, RiskZone, ThreatLevel

BREAKDOWN_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#3b82f6",
    "#06b6d4",
    "#8b5cf6",
    "#22c55e",
]

DEFAULT_RISK_DISTRIBUTION = [
    {"name": "Low Risk", "value": 45, "color": "#22c55e"},
    {"name": "Medium Risk", "value": 30, "color": "#eab308"},
    {"name": "High Risk", "value": 18, "color": "#f97316"},
    {"name": "Critical", "value": 7, "color": "#ef4444"},
]

WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

INCIDENT_CATEGORIES: list[tuple[str, tuple[str, ...]]] = [
    ("Unauthorized Access", ("unauthorized", "access", "restricted", "credentials")),
    ("Suspicious Objects", ("bag", "package", "object", "unattended", "k9")),
    ("Crowd Anomalies", ("crowd", "density", "capacity", "surge")),
    ("Vehicle Incidents", ("vehicle", "parking", "dock")),
    ("Perimeter Breaches", ("perimeter", "fence", "breach", "wildlife")),
    ("System Alerts", ("camera", "offline", "blind spot", "maintenance", "system")),
]


def _level_value(level: ThreatLevel) -> int:
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(
        level.value if hasattr(level, "value") else str(level), 2
    )


def _score_to_level(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def _map_risk_zone(zone: RiskZone) -> dict[str, Any]:
    return {
        "id": zone.id,
        "name": zone.name,
        "riskLevel": zone.riskLevel.value,
        "riskScore": zone.riskScore,
        "incidents": zone.incidents,
        "coverage": zone.coverage,
    }


def _map_active_threat(threat: ActiveThreat) -> dict[str, Any]:
    return {
        "id": threat.externalId,
        "type": threat.type,
        "location": threat.location,
        "level": threat.level.value,
        "detectedAt": threat.detectedAt.isoformat(),
        "confidence": threat.confidence,
    }


def _risk_distribution_from_incidents(incidents: list[Incident]) -> list[dict[str, Any]]:
    counts = Counter()
    for inc in incidents:
        level = inc.threatLevel.value if hasattr(inc.threatLevel, "value") else str(inc.threatLevel)
        counts[level] += 1

    total = sum(counts.values())
    if total == 0:
        return list(DEFAULT_RISK_DISTRIBUTION)

    labels = [
        ("low", "Low Risk", "#22c55e"),
        ("medium", "Medium Risk", "#eab308"),
        ("high", "High Risk", "#f97316"),
        ("critical", "Critical", "#ef4444"),
    ]
    return [
        {
            "name": name,
            "value": round(counts.get(key, 0) / total * 100),
            "color": color,
        }
        for key, name, color in labels
        if counts.get(key, 0) > 0
    ] or list(DEFAULT_RISK_DISTRIBUTION)


def _weekly_trend(incidents: list[Incident]) -> list[dict[str, int | str]]:
    buckets: dict[str, dict[str, int]] = {
        day: {"day": day, "threats": 0, "resolved": 0} for day in WEEKDAY_LABELS
    }
    for inc in incidents:
        day = inc.time.strftime("%a")
        if day not in buckets:
            continue
        buckets[day]["threats"] += 1
        status = inc.status.value if hasattr(inc.status, "value") else str(inc.status)
        if status == "resolved":
            buckets[day]["resolved"] += 1
    return [buckets[day] for day in WEEKDAY_LABELS]


def _threat_breakdown(
    active_threats: list[ActiveThreat],
    incidents: list[Incident],
    alerts: list[Alert],
) -> list[dict[str, Any]]:
    counts: Counter[str] = Counter()

    for threat in active_threats:
        counts[threat.type] += 1

    for inc in incidents:
        text = f"{inc.description} {inc.location}".lower()
        matched = False
        for category, keywords in INCIDENT_CATEGORIES:
            if any(kw in text for kw in keywords):
                counts[category] += 1
                matched = True
                break
        if not matched:
            counts["General Security"] += 1

    for alert in alerts:
        title = (alert.title or "").lower()
        for category, keywords in INCIDENT_CATEGORIES:
            if any(kw in title for kw in keywords):
                counts[category] += 1
                break

    if not counts:
        return []

    items = counts.most_common(8)
    return [
        {
            "type": label,
            "count": count,
            "color": BREAKDOWN_COLORS[i % len(BREAKDOWN_COLORS)],
        }
        for i, (label, count) in enumerate(items)
    ]


def _zones_from_incidents(incidents: list[Incident]) -> list[dict[str, Any]]:
    by_location: dict[str, list[Incident]] = defaultdict(list)
    for inc in incidents:
        key = inc.location.split(" - ")[0].strip() or inc.location
        by_location[key].append(inc)

    zones: list[dict[str, Any]] = []
    for i, (name, incs) in enumerate(
        sorted(by_location.items(), key=lambda item: (-len(item[1]), item[0]))[:8]
    ):
        severity = sum(_level_value(inc.threatLevel) for inc in incs)
        risk_score = min(100, len(incs) * 10 + severity * 5)
        zones.append(
            {
                "id": f"derived-{i + 1}",
                "name": name,
                "riskLevel": _score_to_level(risk_score),
                "riskScore": risk_score,
                "incidents": len(incs),
                "coverage": max(40, 100 - risk_score // 2),
            }
        )
    return zones


def build_threat_intelligence(
    *,
    risk_distribution_json: Any | None,
    risk_zones: list[RiskZone],
    active_threats: list[ActiveThreat],
    incidents: list[Incident],
    alerts: list[Alert],
) -> dict[str, Any]:
    zones = [_map_risk_zone(z) for z in risk_zones]
    if not zones:
        zones = _zones_from_incidents(incidents)

    if risk_distribution_json and isinstance(risk_distribution_json, list):
        risk_distribution = risk_distribution_json
    else:
        risk_distribution = _risk_distribution_from_incidents(incidents)

    threat_breakdown = _threat_breakdown(active_threats, incidents, alerts)
    weekly = _weekly_trend(incidents)

    open_incidents = sum(
        1
        for i in incidents
        if (i.status.value if hasattr(i.status, "value") else str(i.status)) != "resolved"
    )

    return {
        "riskZones": zones,
        "riskDistribution": risk_distribution,
        "threatTrendWeekly": weekly,
        "threatBreakdown": threat_breakdown,
        "activeThreats": [_map_active_threat(t) for t in active_threats],
        "summary": {
            "activeThreatCount": len(active_threats),
            "openIncidents": open_incidents,
            "totalIncidents": len(incidents),
            "unacknowledgedAlerts": sum(1 for a in alerts if not a.acknowledged),
            "highRiskZones": sum(1 for z in zones if z["riskLevel"] in ("high", "critical")),
        },
    }
