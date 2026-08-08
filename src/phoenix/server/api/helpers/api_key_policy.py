from typing import NamedTuple, Optional, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from phoenix.db import models


class ApiKeyOwner(NamedTuple):
    user_id: int
    role: models.UserRoleName

    @property
    def is_system(self) -> bool:
        return self.role == "SYSTEM"


class UserApiKeyAuthorization(NamedTuple):
    caller_role: models.UserRoleName
    owner: Optional[ApiKeyOwner]


async def get_user_role(
    session: AsyncSession,
    user_id: int,
) -> Optional[models.UserRoleName]:
    role = await session.scalar(
        select(models.UserRole.name)
        .join(models.User, models.User.user_role_id == models.UserRole.id)
        .where(models.User.id == user_id)
    )
    return role


async def get_api_key_owner(
    session: AsyncSession,
    api_key_id: int,
) -> Optional[ApiKeyOwner]:
    row = (
        await session.execute(
            select(models.ApiKey.user_id, models.UserRole.name)
            .join(models.User, models.User.id == models.ApiKey.user_id)
            .join(models.UserRole, models.UserRole.id == models.User.user_role_id)
            .where(models.ApiKey.id == api_key_id)
        )
    ).one_or_none()
    if row is None:
        return None
    return ApiKeyOwner(user_id=row.user_id, role=cast(models.UserRoleName, row.name))


async def get_user_api_key_authorization(
    session: AsyncSession,
    *,
    caller_id: int,
    api_key_id: int,
) -> Optional[UserApiKeyAuthorization]:
    caller = aliased(models.User)
    caller_role = aliased(models.UserRole)
    owner = aliased(models.User)
    owner_role = aliased(models.UserRole)
    row = (
        await session.execute(
            select(
                caller_role.name.label("caller_role"),
                models.ApiKey.user_id.label("owner_id"),
                owner_role.name.label("owner_role"),
            )
            .select_from(caller)
            .join(caller_role, caller.user_role_id == caller_role.id)
            .outerjoin(models.ApiKey, models.ApiKey.id == api_key_id)
            .outerjoin(owner, owner.id == models.ApiKey.user_id)
            .outerjoin(owner_role, owner.user_role_id == owner_role.id)
            .where(caller.id == caller_id)
        )
    ).one_or_none()
    if row is None:
        return None
    api_key_owner = (
        ApiKeyOwner(
            user_id=row.owner_id,
            role=cast(models.UserRoleName, row.owner_role),
        )
        if row.owner_id is not None and row.owner_role is not None
        else None
    )
    return UserApiKeyAuthorization(
        caller_role=cast(models.UserRoleName, row.caller_role),
        owner=api_key_owner,
    )


async def get_user_role_and_api_keys(
    session: AsyncSession,
    user_id: int,
) -> tuple[Optional[models.UserRoleName], list[models.ApiKey]]:
    rows = (
        await session.execute(
            select(models.UserRole.name, models.ApiKey)
            .select_from(models.User)
            .join(models.UserRole, models.User.user_role_id == models.UserRole.id)
            .outerjoin(models.ApiKey, models.ApiKey.user_id == models.User.id)
            .where(models.User.id == user_id)
            .order_by(models.ApiKey.id.desc())
        )
    ).all()
    if not rows:
        return None, []
    role = cast(models.UserRoleName, rows[0][0])
    return role, [api_key for _, api_key in rows if api_key is not None]


async def get_system_user_id(session: AsyncSession) -> Optional[int]:
    user_id = await session.scalar(
        select(models.User.id)
        .join(models.UserRole, models.UserRole.id == models.User.user_role_id)
        .where(models.UserRole.name == "SYSTEM")
        .order_by(models.User.id)
        .limit(1)
    )
    return int(user_id) if user_id is not None else None


def can_revoke_user_api_key(
    *,
    caller_id: int,
    caller_is_admin_secret: bool,
    authorization: Optional[UserApiKeyAuthorization],
) -> bool:
    """Authorize revocation of a user (non-SYSTEM) API key.

    ``caller_is_admin_secret`` is resolved from the authenticated credential itself (the
    admin-secret principal), not from a role claim. Its bootstrap admin authority is
    configuration-derived and cannot go stale, so it is trusted directly. Human callers are
    still authorized from their current database role, and a SYSTEM-role API key is denied.
    """
    if authorization is None:
        return False
    if (owner := authorization.owner) is None or owner.is_system:
        return False
    if caller_is_admin_secret:
        return True
    if authorization.caller_role == "SYSTEM":
        return False
    return authorization.caller_role == "ADMIN" or owner.user_id == caller_id
