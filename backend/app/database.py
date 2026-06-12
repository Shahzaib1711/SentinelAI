from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def _normalize_database_url(url: str) -> str:
    # Prisma uses ?schema=public — asyncpg does not accept that query param.
    if "?" in url:
        base, query = url.split("?", 1)
        params = [p for p in query.split("&") if not p.lower().startswith("schema=")]
        url = f"{base}?{'&'.join(params)}" if params else base

    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


engine = create_async_engine(
    _normalize_database_url(settings.database_url),
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
