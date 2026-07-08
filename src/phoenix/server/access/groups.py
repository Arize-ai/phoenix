"""Group materialization from IdP claims.

IdP/LDAP groups were previously parsed at login only to derive a role, then
discarded. :func:`sync_user_groups` persists them so access can be granted to a
group directly.

Refresh cadence: a user's memberships are reconciled at each login against the
provider's *current* group claims — groups gain a row, and memberships for that
provider not present in this login are removed. So a user added to or removed
from a group sees the effect on their next login (membership is not refreshed
mid-session). This is distinct from role and permission edits, which take effect
on the next request.
"""

from __future__ import annotations

from typing import Iterable

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


async def sync_user_groups(
    session: AsyncSession,
    *,
    user_id: int,
    provider: str,
    group_keys: Iterable[str],
) -> None:
    """Reconcile a user's group memberships for one provider to exactly the given
    set of group keys, creating group rows as needed.

    ``provider`` namespaces the keys (e.g. ``"oauth2:google"``, ``"ldap"``) so the
    same group name from two providers stays distinct.
    """
    desired = {key.strip() for key in group_keys if key and key.strip()}

    group_id_by_key: dict[str, int] = {}
    if desired:
        existing = await session.execute(
            select(models.UserGroup.id, models.UserGroup.group_key).where(
                models.UserGroup.provider == provider,
                models.UserGroup.group_key.in_(desired),
            )
        )
        for group_id, key in existing:
            group_id_by_key[key] = group_id
        for key in desired - set(group_id_by_key):
            group = models.UserGroup(provider=provider, group_key=key, display_name=key)
            session.add(group)
            await session.flush()
            group_id_by_key[key] = group.id

    desired_group_ids = set(group_id_by_key.values())

    # The user's current group ids *within this provider* only — memberships from other
    # providers must not be touched. Each (user, group) pair is unique, so the group id alone
    # identifies the membership.
    current_group_ids = set(
        await session.scalars(
            select(models.UserGroupMembership.user_group_id)
            .join(
                models.UserGroup,
                models.UserGroup.id == models.UserGroupMembership.user_group_id,
            )
            .where(
                models.UserGroupMembership.user_id == user_id,
                models.UserGroup.provider == provider,
            )
        )
    )

    for group_id in desired_group_ids - current_group_ids:
        session.add(models.UserGroupMembership(user_group_id=group_id, user_id=user_id))

    stale_group_ids = current_group_ids - desired_group_ids
    if stale_group_ids:
        await session.execute(
            delete(models.UserGroupMembership).where(
                models.UserGroupMembership.user_id == user_id,
                models.UserGroupMembership.user_group_id.in_(stale_group_ids),
            )
        )
    await session.flush()
