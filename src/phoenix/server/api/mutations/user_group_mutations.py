from typing import Optional

import strawberry
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.access import SubjectKind
from phoenix.server.api.auth import IsAdmin, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.UserGroup import LOCAL_PROVIDER, UserGroup, to_gql_user_group


@strawberry.type
class UserGroupMutationPayload:
    query: Query
    user_group: Optional[UserGroup] = None


async def _local_group_or_not_found(session: AsyncSession, group_id: int) -> models.UserGroup:
    """Fetch an admin-managed group, or 'not found'. IdP-synced groups are invisible
    here — they are owned by the login-time reconcile, not editable in-product."""
    group = await session.scalar(
        select(models.UserGroup).where(
            models.UserGroup.id == group_id,
            models.UserGroup.provider == LOCAL_PROVIDER,
        )
    )
    if group is None:
        raise NotFound(f"Unknown local group: {group_id}")
    return group


async def _member_ids(session: AsyncSession, group_id: int) -> list[int]:
    return list(
        await session.scalars(
            select(models.UserGroupMembership.user_id).where(
                models.UserGroupMembership.user_group_id == group_id
            )
        )
    )


@strawberry.type
class UserGroupMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def create_user_group(
        self, info: Info[Context, None], name: str
    ) -> UserGroupMutationPayload:
        """Create an admin-managed (local) group — the no-IdP path so a basic-auth
        deployment can grant to teams rather than per-user. Coexists with IdP groups
        via a distinct provider namespace, so the login reconcile never touches it."""
        clean = name.strip()
        if not clean:
            raise BadRequest("Group name must be non-empty")
        async with info.context.db() as session:
            existing = await session.scalar(
                select(models.UserGroup.id).where(
                    models.UserGroup.provider == LOCAL_PROVIDER,
                    models.UserGroup.group_key == clean,
                )
            )
            if existing is not None:
                raise Conflict(f"A local group named {clean!r} already exists")
            group = models.UserGroup(provider=LOCAL_PROVIDER, group_key=clean, display_name=clean)
            session.add(group)
            await session.flush()
            gql = to_gql_user_group(group, [])
        return UserGroupMutationPayload(query=Query(), user_group=gql)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def delete_user_group(
        self, info: Info[Context, None], group_id: int
    ) -> UserGroupMutationPayload:
        """Delete a local group and sweep its grants. The group's acl rows carry no foreign
        key, so deleting the group does not cascade them — remove them in the same transaction
        before the id can be reused, otherwise a future group assigned this id would silently
        inherit the stale grants. Memberships cascade via their foreign key."""
        async with info.context.db() as session:
            await _local_group_or_not_found(session, group_id)
            await session.execute(
                delete(models.AccessGrant).where(
                    models.AccessGrant.subject_kind == SubjectKind.GROUP.value,
                    models.AccessGrant.subject_id == group_id,
                )
            )
            await session.execute(delete(models.UserGroup).where(models.UserGroup.id == group_id))
        return UserGroupMutationPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def add_user_group_member(
        self, info: Info[Context, None], group_id: int, user_id: int
    ) -> UserGroupMutationPayload:
        """Add a user to a local group. Idempotent. Takes effect immediately — the
        oracle reads memberships live per request."""
        async with info.context.db() as session:
            group = await _local_group_or_not_found(session, group_id)
            user_exists = await session.scalar(
                select(models.User.id).where(models.User.id == user_id)
            )
            if user_exists is None:
                raise NotFound(f"Unknown user: {user_id}")
            existing = await session.scalar(
                select(models.UserGroupMembership.user_id).where(
                    models.UserGroupMembership.user_group_id == group_id,
                    models.UserGroupMembership.user_id == user_id,
                )
            )
            if existing is None:
                session.add(models.UserGroupMembership(user_group_id=group_id, user_id=user_id))
                await session.flush()
            gql = to_gql_user_group(group, await _member_ids(session, group_id))
        return UserGroupMutationPayload(query=Query(), user_group=gql)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def remove_user_group_member(
        self, info: Info[Context, None], group_id: int, user_id: int
    ) -> UserGroupMutationPayload:
        """Remove a user from a local group. Takes effect on the member's next request."""
        async with info.context.db() as session:
            group = await _local_group_or_not_found(session, group_id)
            await session.execute(
                delete(models.UserGroupMembership).where(
                    models.UserGroupMembership.user_group_id == group_id,
                    models.UserGroupMembership.user_id == user_id,
                )
            )
            gql = to_gql_user_group(group, await _member_ids(session, group_id))
        return UserGroupMutationPayload(query=Query(), user_group=gql)
