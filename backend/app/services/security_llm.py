"""LLM-backed intent parsing and conversational replies for security planning."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.services.security_planner import UserConstraints, parse_user_instructions

logger = logging.getLogger(__name__)

_CONSTRAINTS_SCHEMA = {
    "type": "object",
    "properties": {
        "min_guards": {"type": "integer", "minimum": 1},
        "min_cameras": {"type": "integer", "minimum": 0},
        "threat_posture": {
            "type": "string",
            "enum": ["standard", "elevated", "maximum"],
        },
        "focus_areas": {
            "type": "array",
            "items": {"type": "string"},
        },
        "sentiment": {
            "type": "string",
            "enum": ["neutral", "concerned", "urgent", "reassuring", "curious"],
        },
        "intent_summary": {"type": "string"},
    },
    "required": [
        "min_guards",
        "min_cameras",
        "threat_posture",
        "focus_areas",
        "sentiment",
        "intent_summary",
    ],
    "additionalProperties": False,
}

_SYSTEM_INTERPRET = """You are a security operations planner assistant for VIP event venues.
Read the operator brief and conversation. Infer what they want — guards, cameras, threat posture,
and which areas matter — even when they do not use exact numbers.

Rules:
- "worried about back entrance", "crowd makes me nervous" → raise guards/posture, focus entrances
- "too many guards", "scale back", "keep it light" → lower min_guards, standard posture
- "full coverage", "no blind spots", "watch everything" → min_cameras at least 4
- "maximum security", "critical event", "high profile VIP" → threat_posture maximum
- Additive chat ("also add...", "more cameras") builds on previous constraints when provided
- sentiment reflects tone: urgent (time pressure), concerned (worry), curious (questions), etc.
- intent_summary: one short sentence of what the operator actually wants

Return JSON only matching the schema."""

_SYSTEM_REPLY = """You are a calm, professional security planning assistant.
Respond in 2–4 sentences. Acknowledge the operator's tone (urgent, concerned, etc.).
Explain what changed in the plan using the stats provided. Be specific with numbers.
Do not invent capabilities the system lacks. If they asked how to use the chat, explain briefly."""


def llm_available() -> bool:
    return bool(settings.llm_enabled and settings.openai_api_key)


def _call_llm(
    messages: list[dict[str, str]],
    *,
    json_mode: bool = False,
    temperature: float = 0.2,
) -> str | None:
    if not llm_available():
        return None

    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=settings.llm_timeout_s) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return (content or "").strip() or None
    except Exception as exc:
        logger.warning("LLM request failed: %s", exc)
        return None


def _parse_constraints_json(raw: str, fallback_text: str) -> UserConstraints | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    posture = str(data.get("threat_posture", "standard")).lower()
    if posture not in ("standard", "elevated", "maximum"):
        posture = "standard"

    sentiment = str(data.get("sentiment", "neutral")).lower()
    if sentiment not in ("neutral", "concerned", "urgent", "reassuring", "curious"):
        sentiment = "neutral"

    focus = [str(a).strip().lower() for a in (data.get("focus_areas") or []) if str(a).strip()]

    return UserConstraints(
        raw_instructions=fallback_text,
        min_guards=max(1, int(data.get("min_guards", 2))),
        min_cameras=max(0, int(data.get("min_cameras", 0))),
        threat_posture=posture,
        focus_areas=focus,
        sentiment=sentiment,
        intent_summary=str(data.get("intent_summary") or "").strip(),
    )


def interpret_user_constraints(
    text: str,
    *,
    history: list[dict[str, str]] | None = None,
    blueprint_stats: dict[str, Any] | None = None,
    previous_constraints: dict[str, Any] | None = None,
    event: dict[str, Any] | None = None,
) -> UserConstraints:
    """Resolve planning constraints via LLM; fall back to regex heuristics."""
    fallback = parse_user_instructions(text)

    if not llm_available():
        return fallback

    context_parts: list[str] = []
    if event:
        context_parts.append(
            f"Event: {event.get('name', 'event')}, threat level {event.get('threatLevel', 'medium')}, "
            f"{event.get('attendees', '?')} attendees, {event.get('vipCount', '?')} VIPs."
        )
    if blueprint_stats:
        context_parts.append(
            f"Blueprint: {blueprint_stats.get('doors', 0)} doors, "
            f"{blueprint_stats.get('windows', 0)} windows, "
            f"{blueprint_stats.get('walls', 0)} wall segments."
        )
    if previous_constraints:
        context_parts.append(
            f"Previous plan constraints: {json.dumps(previous_constraints)}"
        )

    user_content = "\n".join(context_parts + [f"Operator brief:\n{text.strip()}"])
    if history:
        turns = [
            f"{m.get('role', 'user').upper()}: {m.get('content', '')}"
            for m in history
            if m.get("content")
        ]
        user_content = "\n".join(context_parts + ["Conversation:"] + turns + [f"Latest message:\n{text.strip()}"])

    schema_hint = json.dumps(_CONSTRAINTS_SCHEMA)
    raw = _call_llm(
        [
            {"role": "system", "content": _SYSTEM_INTERPRET},
            {
                "role": "user",
                "content": f"{user_content}\n\nRespond with JSON matching this schema:\n{schema_hint}",
            },
        ],
        json_mode=True,
    )
    if not raw:
        return fallback

    parsed = _parse_constraints_json(raw, text)
    if not parsed:
        return fallback

    # Never go below regex-detected hard numbers (safety net for explicit "4 guards")
    parsed.min_guards = max(parsed.min_guards, fallback.min_guards)
    parsed.min_cameras = max(parsed.min_cameras, fallback.min_cameras)
    if fallback.threat_posture == "maximum":
        parsed.threat_posture = "maximum"
    elif fallback.threat_posture == "elevated" and parsed.threat_posture == "standard":
        parsed.threat_posture = "elevated"

    for area in fallback.focus_areas:
        if area not in parsed.focus_areas:
            parsed.focus_areas.append(area)

    return parsed


def generate_assistant_reply(
    user_message: str,
    *,
    history: list[dict[str, str]],
    previous_plan: dict[str, Any] | None,
    new_plan: dict[str, Any],
    constraints: UserConstraints,
    template_reply: str,
) -> str:
    """Natural-language reply; falls back to template when LLM unavailable."""
    if not llm_available():
        return template_reply

    before = new_plan.get("coverageBefore") or {}
    after = new_plan.get("coverageAfter") or {}
    prev_constraints = (previous_plan or {}).get("constraints") or {}

    stats = {
        "guards_before": len((previous_plan or {}).get("proposedGuards") or []),
        "guards_after": len(new_plan.get("proposedGuards") or []),
        "cameras_before": len((previous_plan or {}).get("proposedCameras") or []),
        "cameras_after": len(new_plan.get("proposedCameras") or []),
        "coverage_before_pct": before.get("coveragePercentage"),
        "coverage_after_pct": after.get("coveragePercentage"),
        "risk_before": before.get("vulnerabilityScore"),
        "risk_after": after.get("vulnerabilityScore"),
        "threat_posture": constraints.threat_posture,
        "sentiment_detected": constraints.sentiment,
        "intent_summary": constraints.intent_summary,
        "previous_constraints": prev_constraints,
        "agent_modifications": (new_plan.get("agentReview") or {}).get("modifications") or [],
    }

    messages: list[dict[str, str]] = [{"role": "system", "content": _SYSTEM_REPLY}]
    for msg in history[-8:]:
        role = msg.get("role", "user")
        if role in ("user", "assistant") and msg.get("content"):
            messages.append({"role": role, "content": str(msg["content"])})
    messages.append({"role": "user", "content": user_message})
    messages.append(
        {
            "role": "user",
            "content": f"Plan change stats (use these numbers):\n{json.dumps(stats, indent=2)}",
        }
    )

    reply = _call_llm(messages, temperature=0.4)
    return reply if reply else template_reply
