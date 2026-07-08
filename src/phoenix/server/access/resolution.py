"""Per-request permission resolution from the database.

Permissions are resolved from the database keyed off the actor's *identity*
rather than the role carried in the token, so the picture is always current:

- editing a role's permissions takes effect on the actor's next request;
- changing a user's role takes effect immediately, even for an API key minted
  under the old role (the key carries only identity, not authority);
- deleting a user resolves to no permissions, so their API keys stop working.

Callers cache the result for the request (see the GraphQL context) so repeated
checks cost one query.
"""

from __future__ import annotations

from typing import FrozenSet, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.access.permissions import DEFAULT_OBJECT_PERMISSIONS, Permission


def _to_permissions(values: object) -> FrozenSet[Permission]:
    resolved = set()
    for value in values:  # type: ignore[attr-defined]
        try:
            resolved.add(Permission(value))
        except ValueError:
            # A permission string this server does not recognize grants nothing
            # here — unknown authority fails closed.
            continue
    return frozenset(resolved)


async def permissions_for_user_id(session: AsyncSession, user_id: int) -> FrozenSet[Permission]:
    """The permissions a user currently holds, read live from the database via
    their role's persisted bundle. Empty if the user no longer exists."""
    values = await session.scalars(
        select(models.RolePermission.permission)
        .join(models.UserRole, models.UserRole.id == models.RolePermission.user_role_id)
        .join(models.User, models.User.user_role_id == models.UserRole.id)
        .where(models.User.id == user_id)
    )
    return _to_permissions(values)


async def object_permissions_for_grant_role(
    session: AsyncSession, role_id: Optional[int]
) -> FrozenSet[Permission]:
    """The object-level permissions a grant confers, from its permission set. A grant
    with no role (legacy grants, the everyone-allow default) confers view only."""
    if role_id is None:
        return DEFAULT_OBJECT_PERMISSIONS
    values = await session.scalars(
        select(models.PermissionSetItem.permission).where(
            models.PermissionSetItem.permission_set_id == role_id
        )
    )
    permissions = _to_permissions(values)
    return permissions or DEFAULT_OBJECT_PERMISSIONS
