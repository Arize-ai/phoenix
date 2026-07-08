from typing import Optional

import strawberry
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.access import would_strand_manager_by_role
from phoenix.server.api.auth import IsAdmin, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.PermissionSet import (
    ObjectPermission,
    PermissionSet,
    to_gql_permission_set,
)


@strawberry.input
class CreatePermissionSetInput:
    name: str
    permissions: list[ObjectPermission]


@strawberry.input
class PatchPermissionSetInput:
    id: GlobalID
    name: Optional[str] = UNSET
    permissions: Optional[list[ObjectPermission]] = UNSET


@strawberry.input
class DeletePermissionSetInput:
    id: GlobalID


@strawberry.type
class PermissionSetMutationPayload:
    permission_set: Optional[PermissionSet]
    query: Query


async def _load(session: AsyncSession, role_id: int) -> models.PermissionSet:
    # populate_existing refreshes the identity-mapped object so a permissions
    # collection loaded earlier in the request reflects an intervening edit.
    role: Optional[models.PermissionSet] = await session.scalar(
        select(models.PermissionSet)
        .options(joinedload(models.PermissionSet.permissions))
        .where(models.PermissionSet.id == role_id)
        .execution_options(populate_existing=True)
    )
    if role is None:
        raise NotFound(f"Unknown permission set: {role_id}")
    return role


def _permission_set_rowid(role_id: GlobalID) -> int:
    try:
        return from_global_id_with_expected_type(role_id, PermissionSet.__name__)
    except ValueError:
        raise NotFound(f"Unknown permission set: {role_id}") from None


async def _set_permissions(
    session: AsyncSession, role_id: int, permissions: list[ObjectPermission]
) -> None:
    """Replace a role's permissions. Delete-then-add with a flush between, so
    re-setting a permission a role already has doesn't trip the unique constraint
    (the ORM would otherwise insert the new row before deleting the old)."""
    await session.execute(
        delete(models.PermissionSetItem).where(
            models.PermissionSetItem.permission_set_id == role_id
        )
    )
    await session.flush()
    session.add_all(
        models.PermissionSetItem(permission_set_id=role_id, permission=p.value)
        for p in dict.fromkeys(permissions)
    )
    await session.flush()


@strawberry.type
class PermissionSetMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def create_permission_set(
        self, info: Info[Context, None], input: CreatePermissionSetInput
    ) -> PermissionSetMutationPayload:
        name = input.name.strip()
        if not name:
            raise BadRequest("Role name cannot be empty.")
        if not input.permissions:
            raise BadRequest("A role must have at least one permission.")
        async with info.context.db() as session:
            if await session.scalar(
                select(models.PermissionSet.id).where(models.PermissionSet.name == name)
            ):
                raise Conflict(f"A role named {name!r} already exists.")
            role = models.PermissionSet(name=name, is_built_in=False)
            session.add(role)
            await session.flush()
            await _set_permissions(session, role.id, input.permissions)
            role = await _load(session, role.id)
            gql = to_gql_permission_set(role)
        return PermissionSetMutationPayload(permission_set=gql, query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def patch_permission_set(
        self, info: Info[Context, None], input: PatchPermissionSetInput
    ) -> PermissionSetMutationPayload:
        async with info.context.db() as session:
            role = await _load(session, _permission_set_rowid(input.id))
            if role.is_built_in:
                raise BadRequest("Built-in roles cannot be edited.")
            if input.name is not UNSET and input.name is not None:
                name = input.name.strip()
                if not name:
                    raise BadRequest("Role name cannot be empty.")
                clash = await session.scalar(
                    select(models.PermissionSet.id).where(
                        models.PermissionSet.name == name, models.PermissionSet.id != role.id
                    )
                )
                if clash:
                    raise Conflict(f"A role named {name!r} already exists.")
                role.name = name
            if input.permissions is not UNSET and input.permissions is not None:
                if not input.permissions:
                    raise BadRequest("A role must have at least one permission.")
                # Dropping manage-access from this role revokes it from every grant that
                # carries the role at once — the same last-manager invariant the per-grant
                # revoke/downgrade guards protect, reached here through the role instead of a
                # grant. Refuse if it would strand a creatorless object. (The guard is inert
                # unless the role currently confers manage.)
                if ObjectPermission.MANAGE_ACCESS not in input.permissions:
                    if await would_strand_manager_by_role(session, role.id):
                        raise Conflict(
                            "Cannot remove manage-access from this role: it is the last "
                            "manager of an object that has no owner. Grant that object "
                            "another manager first."
                        )
                await _set_permissions(session, role.id, input.permissions)
            await session.flush()
            role = await _load(session, role.id)
            gql = to_gql_permission_set(role)
        return PermissionSetMutationPayload(permission_set=gql, query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdmin, IsLocked])  # type: ignore
    async def delete_permission_set(
        self, info: Info[Context, None], input: DeletePermissionSetInput
    ) -> PermissionSetMutationPayload:
        async with info.context.db() as session:
            role = await _load(session, _permission_set_rowid(input.id))
            if role.is_built_in:
                raise BadRequest("Built-in roles cannot be deleted.")
            # Deleting the role drops its grants to the view-only default (acls.role_id ON
            # DELETE SET NULL), so if it currently confers manage this strips manage from
            # every grant that carries it — refuse if that would strand a creatorless object.
            if await would_strand_manager_by_role(session, role.id):
                raise Conflict(
                    "Cannot delete this role: it is the last manager of an object that has "
                    "no owner. Grant that object another manager first."
                )
            # Grants referencing this role fall back to view (acls.role_id ON DELETE
            # SET NULL), so removing a role never orphans or deletes a grant.
            await session.execute(
                delete(models.PermissionSet).where(models.PermissionSet.id == role.id)
            )
        return PermissionSetMutationPayload(permission_set=None, query=Query())
