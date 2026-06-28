from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def _is_neon_host(host: str | None) -> bool:
    return bool(host and "neon.tech" in host)


def _parse_database_url(url: str) -> tuple[str, dict]:
    """
    Normalize Prisma/Neon URLs for asyncpg:
    - postgresql:// → postgresql+asyncpg://
    - strip schema= (Prisma-only)
    - map sslmode= to asyncpg connect_args
    """
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    parsed = urlparse(url)
    query = parse_qs(parsed.query, keep_blank_values=False)

    sslmode = (query.get("sslmode") or query.get("ssl") or [None])[0]
    if not sslmode and _is_neon_host(parsed.hostname):
        sslmode = "require"

    for key in ("schema", "sslmode", "ssl", "channel_binding"):
        query.pop(key, None)

    clean_query = urlencode([(k, v[0]) for k, v in query.items()])
    clean_url = urlunparse(parsed._replace(query=clean_query))

    connect_args: dict = {"timeout": 15, "command_timeout": 60}
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = True

    return clean_url, connect_args


_db_url, _connect_args = _parse_database_url(settings.database_url or "")

engine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=2,
    pool_timeout=15,
    connect_args=_connect_args,
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
