"""Quick smoke test for API endpoints."""
import asyncio
import sys

from sqlalchemy import text

from app.database import engine
from app.services.security_chat import process_security_chat
from app.services.security_planner import build_security_plan


async def test_db() -> bool:
    try:
        async with engine.connect() as conn:
            r = await conn.execute(text('SELECT slug FROM "Event" LIMIT 1'))
            print("DB OK:", r.scalar())
            return True
    except Exception as exc:
        print("DB FAIL:", type(exc).__name__, exc)
        return False


def test_security_plan() -> bool:
    try:
        markers = [
            {"id": "a", "type": "entrance", "x": 20, "y": 50, "label": "ENT-01"},
            {"id": "b", "type": "guard", "x": 80, "y": 50, "label": "VIP ROOM"},
        ]
        plan = build_security_plan(
            image_source=None,
            existing_markers=markers,
            existing_blind_spots=[],
            event={"name": "t", "threatLevel": "medium", "vipCount": 1, "attendees": 1, "securityPersonnel": 4},
            instructions="4 guards maximum security",
            start_marker_id="a",
            destination_marker_id="b",
        )
        print("Security plan OK:", len(plan["proposedGuards"]), "guards")
        chat = process_security_chat(
            "add 2 more guards",
            [],
            base_instructions="4 guards",
            image_source=None,
            existing_markers=markers,
            existing_blind_spots=[],
            event={"name": "t", "threatLevel": "medium"},
            start_marker_id="a",
            destination_marker_id="b",
            previous_plan=plan,
        )
        print("Chat OK:", chat["reply"][:80])
        return True
    except Exception as exc:
        print("Security FAIL:", type(exc).__name__, exc)
        import traceback
        traceback.print_exc()
        return False


async def main() -> int:
    ok = True
    ok &= await test_db()
    ok &= test_security_plan()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
