"""Conversational refinements for the security planning agent."""

from __future__ import annotations

from typing import Any

from app.services.security_llm import generate_assistant_reply, llm_available
from app.services.security_planner import build_security_plan


def combine_instructions(base: str, history: list[dict[str, str]]) -> str:
    parts: list[str] = []
    if base.strip():
        parts.append(base.strip())
    for msg in history:
        if msg.get("role") == "user" and msg.get("content", "").strip():
            parts.append(msg["content"].strip())
    return "\n".join(parts)


def _plan_snapshot(plan: dict[str, Any] | None) -> dict[str, Any]:
    if not plan:
        return {"guards": 0, "cameras": 0, "coverage": 0, "risk": 0}
    cov = plan.get("coverageAfter") or {}
    return {
        "guards": len(plan.get("proposedGuards", [])),
        "cameras": len(plan.get("proposedCameras", [])),
        "coverage": cov.get("coveragePercentage", 0),
        "risk": cov.get("vulnerabilityScore", 0),
    }


def generate_chat_reply(
    user_message: str,
    *,
    previous_plan: dict[str, Any] | None,
    new_plan: dict[str, Any],
) -> str:
    before = _plan_snapshot(previous_plan)
    after = _plan_snapshot(new_plan)
    parts: list[str] = []

    if not previous_plan:
        analysis = new_plan.get("securityAnalysis") or {}
        blueprint = analysis.get("blueprint") or {}
        parts.append(
            f"I've analyzed the floor plan ({blueprint.get('doors', 0)} doors, "
            f"{blueprint.get('windows', 0)} windows) and drafted a security layout with "
            f"{after['guards']} guard post(s) and {after['cameras']} camera(s)."
        )
    else:
        parts.append("I've updated the plan based on your request.")

    if after["guards"] > before["guards"]:
        parts.append(
            f"Guard deployment increased from {before['guards']} to {after['guards']}."
        )
    elif after["guards"] < before["guards"]:
        parts.append(f"Guard count reduced to {after['guards']}.")

    if after["cameras"] > before["cameras"]:
        parts.append(f"Added cameras — now {after['cameras']} proposed.")
    elif after["cameras"] < before["cameras"]:
        parts.append(f"Camera proposals reduced to {after['cameras']}.")

    if after["coverage"] != before["coverage"] and previous_plan:
        parts.append(
            f"Coverage moved from {before['coverage']}% to {after['coverage']}%."
        )

    if after["risk"] != before["risk"] and previous_plan:
        parts.append(
            f"Vulnerability score moved from {before['risk']} to {after['risk']}."
        )

    constraints = new_plan.get("constraints") or {}
    posture = constraints.get("threatPosture", "standard")
    if posture != "standard":
        parts.append(f"Threat posture: {posture}.")

    findings = (new_plan.get("securityAnalysis") or {}).get("findings") or []
    high = [f["title"] for f in findings if f.get("severity") == "high"]
    if high and not previous_plan:
        parts.append(f"Key finding: {high[0]}.")

    if new_plan.get("agentReview", {}).get("modifications"):
        mods = new_plan["agentReview"]["modifications"]
        parts.append(f"Agent hardening: {mods[0]}")

    msg_lower = user_message.lower()
    if any(w in msg_lower for w in ("help", "what can", "how do")):
        parts.append(
            "You can ask me to add guards or cameras, focus on specific areas, "
            "or raise threat posture for a denser deployment."
        )

    return " ".join(parts)


def process_security_chat(
    message: str,
    history: list[dict[str, str]],
    *,
    base_instructions: str,
    image_source: str | None,
    existing_markers: list[dict[str, Any]],
    existing_blind_spots: list[dict[str, Any]],
    event: dict[str, Any],
    start_marker_id: str | None = None,
    destination_marker_id: str | None = None,
    previous_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Handle one chat turn — merge context, re-plan, return assistant reply."""
    _ = start_marker_id, destination_marker_id  # legacy API params — ignored

    user_msg = message.strip()
    if not user_msg:
        hint = (
            "Tell me what you'd like to change — for example tighter entrance control, "
            "more camera coverage, or a lighter guard footprint."
        )
        return {
            "reply": hint,
            "plan": previous_plan,
            "history": history,
            "llmEnabled": llm_available(),
        }

    updated_history = list(history) + [{"role": "user", "content": user_msg}]
    combined = combine_instructions(base_instructions, updated_history)

    plan = build_security_plan(
        image_source=image_source,
        existing_markers=existing_markers,
        existing_blind_spots=existing_blind_spots,
        event=event,
        instructions=combined,
        chat_history=updated_history,
        previous_plan=previous_plan,
    )

    template_reply = generate_chat_reply(
        user_msg,
        previous_plan=previous_plan,
        new_plan=plan,
    )
    c = plan.get("constraints") or {}
    from app.services.security_planner import UserConstraints

    constraints = UserConstraints(
        raw_instructions=combined,
        min_guards=int(c.get("minGuards", 2)),
        min_cameras=int(c.get("minCameras", 0)),
        threat_posture=str(c.get("threatPosture", "standard")),
        sentiment=str(c.get("sentiment", "neutral")),
        intent_summary=str(c.get("intentSummary", "")),
    )
    reply = generate_assistant_reply(
        user_msg,
        history=updated_history,
        previous_plan=previous_plan,
        new_plan=plan,
        constraints=constraints,
        template_reply=template_reply,
    )

    updated_history.append({"role": "assistant", "content": reply})

    return {
        "reply": reply,
        "plan": plan,
        "history": updated_history,
        "llmEnabled": llm_available(),
    }
