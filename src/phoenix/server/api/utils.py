from datetime import datetime, timedelta, timezone
from typing import List, Tuple

from sqlalchemy import delete

from phoenix.db import models
from phoenix.db.enums import UserRole
from phoenix.server.types import (
    AccessToken,
    AccessTokenAttributes,
    AccessTokenClaims,
    DbSessionFactory,
    RefreshToken,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    TokenStore,
    UserId,
)


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> List[int]:
    if not project_names:
        return []
    stmt = (
        delete(models.Project)
        .where(models.Project.name.in_(set(project_names)))
        .returning(models.Project.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> List[int]:
    if not trace_ids:
        return []
    stmt = (
        delete(models.Trace)
        .where(models.Trace.trace_id.in_(set(trace_ids)))
        .returning(models.Trace.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


async def log_in(
    user: models.User,
    token_store: TokenStore,
    refresh_token_expiry: timedelta,
    access_token_expiry: timedelta,
) -> Tuple[AccessToken, RefreshToken]:
    issued_at = datetime.now(timezone.utc)
    refresh_token_claims = RefreshTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + refresh_token_expiry,
        attributes=RefreshTokenAttributes(
            user_role=UserRole(user.role.name),
        ),
    )
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + access_token_expiry,
        attributes=AccessTokenAttributes(
            user_role=UserRole(user.role.name),
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    return access_token, refresh_token
