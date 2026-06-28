import asyncio
import os
import re
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

url = os.environ.get("DATABASE_URL", "")
print("Host:", re.search(r"@([^/]+)", url).group(1) if "@" in url else "missing")


async def main() -> None:
    m = re.match(r"postgresql://([^:]+):([^@]+)@([^/]+)/([^?]+)", url)
    if not m:
        print("Invalid DATABASE_URL")
        return
    user, password, hostport, database = m.groups()
    host = hostport.split(":")[0]
    port = int(hostport.split(":")[1]) if ":" in hostport else 5432
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(
                user=user,
                password=password,
                host=host,
                port=port,
                database=database,
                ssl="require",
            ),
            timeout=20,
        )
        val = await conn.fetchval("SELECT 1")
        print("NEON OK:", val)
        await conn.close()
    except Exception as exc:
        print("NEON FAIL:", type(exc).__name__, exc)


asyncio.run(main())
