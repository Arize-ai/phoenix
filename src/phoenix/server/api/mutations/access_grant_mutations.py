from typing import Optional, cast

import strawberry
from sqlalchemy import ColumnElement, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.access import (
    DEFAULT_PERMISSION_SET,
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROJECT,
    OBJECT_TYPE_PROMPT,
    Permission,
    can_access,
    would_strand_last_manager,
)
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AccessObjectType import AccessObjectType
from phoenix.server.api.types.AccessSubjectKind import AccessSubjectKind
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.PermissionSet import PermissionSet
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.User import User
from phoenix.server.api.types.UserGroup import UserGroup


@strawberry.input(one_of=True)
class AccessGrantSubjectInput:
    user_id: Optional[GlobalID] = UNSET
    user_group_id: Optional[GlobalID] = UNSET
    is_everyone: Optional[bool] = UNSET


@strawberry.input(one_of=True)
class AccessGrantObjectInput:
    project_id: Optional[GlobalID] = UNSET
    dataset_id: Optional[GlobalID] = UNSET
    prompt_id: Optional[GlobalID] = UNSET


@strawberry.input
class AccessGrantInput:
    subject: AccessGrantSubjectInput
    object: AccessGrantObjectInput
    permission_set_id: Optional[GlobalID] = UNSET


@strawberry.input
class ResourceTagInput:
    """Apply/remove a curated ``key=value`` tag on one concrete object. Only ``key``
    identifies the tag on removal; ``value`` is required to set it."""

    object: AccessGrantObjectInput
    key: str
    value: Optional[str] = UNSET


@strawberry.input
class TagAccessGrantInput:
    """Author/revoke a tag grant: give a subject a permission set over every object
    of ``object_type`` carrying ``tag_key=tag_value``. Type-scoped, not object-scoped,
    so it is an administrator action rather than a per-object one."""

    subject: AccessGrantSubjectInput
    object_type: AccessObjectType
    tag_key: str
    tag_value: str
    permission_set_id: Optional[GlobalID] = UNSET


@strawberry.type
class AccessGrantMutationPayload:
    query: Query


async def _resolve_project_rowid(session: AsyncSession, project_id: GlobalID) -> int:
    try:
        rowid = from_global_id_with_expected_type(project_id, Project.__name__)
    except ValueError:
        raise NotFound(f"Unknown project: {project_id}") from None
    exists = await session.scalar(select(models.Project.id).where(models.Project.id == rowid))
    if exists is None:
        raise NotFound(f"Unknown project: {project_id}")
    return rowid


async def _resolve_prompt_rowid(session: AsyncSession, prompt_id: GlobalID) -> int:
    try:
        rowid = from_global_id_with_expected_type(prompt_id, Prompt.__name__)
    except ValueError:
        raise NotFound(f"Unknown prompt: {prompt_id}") from None
    exists = await session.scalar(select(models.Prompt.id).where(models.Prompt.id == rowid))
    if exists is None:
        raise NotFound(f"Unknown prompt: {prompt_id}")
    return rowid


async def _resolve_dataset_rowid(session: AsyncSession, dataset_id: GlobalID) -> int:
    try:
        rowid = from_global_id_with_expected_type(dataset_id, Dataset.__name__)
    except ValueError:
        raise NotFound(f"Unknown dataset: {dataset_id}") from None
    exists = await session.scalar(select(models.Dataset.id).where(models.Dataset.id == rowid))
    if exists is None:
        raise NotFound(f"Unknown dataset: {dataset_id}")
    return rowid


async def _resolve_object_rowid(
    session: AsyncSession, object: AccessGrantObjectInput
) -> tuple[str, int]:
    if object.dataset_id is None:
        raise BadRequest("datasetId must not be null")
    if object.dataset_id is not UNSET:
        return OBJECT_TYPE_DATASET, await _resolve_dataset_rowid(session, object.dataset_id)
    if object.project_id is None:
        raise BadRequest("projectId must not be null")
    if object.project_id is not UNSET:
        return OBJECT_TYPE_PROJECT, await _resolve_project_rowid(session, object.project_id)
    if object.prompt_id is None:
        raise BadRequest("promptId must not be null")
    if object.prompt_id is not UNSET:
        return OBJECT_TYPE_PROMPT, await _resolve_prompt_rowid(session, object.prompt_id)
    raise BadRequest("An object is required")


async def _resolve_permission_set_id(
    session: AsyncSession, permission_set_id: Optional[GlobalID]
) -> Optional[int]:
    """The permission set to attach to a grant — viewer (visibility), editor (mutate), or manager
    (manage access); the oracle enforces each tier at its permission level. An explicit id is
    validated; absent, it defaults to the built-in "Resource Viewer"."""
    if permission_set_id is not None and permission_set_id is not UNSET:
        try:
            permission_set_rowid = from_global_id_with_expected_type(
                permission_set_id, PermissionSet.__name__
            )
        except ValueError:
            raise NotFound(f"Unknown permission set: {permission_set_id}") from None
        role_id: Optional[int] = await session.scalar(
            select(models.PermissionSet.id).where(models.PermissionSet.id == permission_set_rowid)
        )
        if role_id is None:
            raise NotFound(f"Unknown permission set: {permission_set_id}")
        return role_id
    return cast(
        Optional[int],
        await session.scalar(
            select(models.PermissionSet.id).where(
                models.PermissionSet.name == DEFAULT_PERMISSION_SET
            )
        ),
    )


async def _assert_can_manage_object(
    info: Info[Context, None], session: AsyncSession, object_type: str, object_rowid: int
) -> None:
    """The caller must hold OBJ_MANAGE_ACCESS on the object. Unauthorized is surfaced as
    not-found (indistinguishable from an object the caller cannot see). A no-op when auth is
    disabled."""
    user_id = info.context.user_id
    if user_id is None:
        return
    if not await can_access(
        session,
        user_id=user_id,
        object_type=object_type,
        object_id=object_rowid,
        enabled=True,
        permission=Permission.OBJ_MANAGE_ACCESS,
    ):
        raise NotFound("Unknown access object")


async def _assert_revoke_keeps_a_manager(
    session: AsyncSession,
    object_type: str,
    object_rowid: int,
    subject_kind: AccessSubjectKind,
    subject_rowid: Optional[int],
    *,
    new_role_id: Optional[int] = None,
) -> None:
    """Refuse to strip the last manager of an object that has no owner.

    Managing access is a delegated capability stored as a grant row, so — unlike creator
    ownership, which lives on the object itself and cannot be revoked — it can be taken
    away from its holder. An object with no creator (every project, and any dataset/prompt
    whose creator was deprovisioned) that loses its final manage-conferring grant becomes
    reachable only by administrators: no non-admin could ever restore access to it. This
    refuses that change, the way a system refuses to delete its last administrator; the
    caller must designate another manager first.

    Two paths remove the last manager and both go through here: deleting the grant
    (``revoke_access``, ``new_role_id=None``) and *downgrading* it in place to a non-manager
    role (``grant_access`` re-granting the same subject as viewer/editor). The REST access
    routes call the same shared predicate directly. Decision logic lives in
    :func:`phoenix.server.access.would_strand_last_manager`; this only adapts it to the
    GraphQL ``Conflict``."""
    if await would_strand_last_manager(
        session,
        object_type=object_type,
        object_id=object_rowid,
        subject_kind=subject_kind.value,
        subject_id=subject_rowid,
        new_role_id=new_role_id,
    ):
        raise Conflict(
            "Cannot remove the last manager of an object that has no owner. "
            "Grant another manager first."
        )


async def _resolve_subject_rowid(
    session: AsyncSession, subject: AccessGrantSubjectInput
) -> tuple[AccessSubjectKind, Optional[int]]:
    """Validate and resolve the grant subject. EVERYONE carries no id; USER and GROUP must
    reference an existing row by Relay id."""
    if subject.user_id is None:
        raise BadRequest("userId must not be null")
    if subject.user_id is not UNSET:
        user_id = subject.user_id
        try:
            rowid = from_global_id_with_expected_type(user_id, User.__name__)
        except ValueError:
            raise NotFound(f"Unknown user: {user_id}") from None
        exists = await session.scalar(select(models.User.id).where(models.User.id == rowid))
        if exists is None:
            raise NotFound(f"Unknown user: {user_id}")
        return AccessSubjectKind.USER, rowid
    if subject.user_group_id is None:
        raise BadRequest("userGroupId must not be null")
    if subject.user_group_id is not UNSET:
        user_group_id = subject.user_group_id
        try:
            rowid = from_global_id_with_expected_type(user_group_id, UserGroup.__name__)
        except ValueError:
            raise NotFound(f"Unknown group: {user_group_id}") from None
        exists = await session.scalar(
            select(models.UserGroup.id).where(models.UserGroup.id == rowid)
        )
        if exists is None:
            raise NotFound(f"Unknown group: {user_group_id}")
        return AccessSubjectKind.GROUP, rowid
    if subject.is_everyone is not UNSET:
        if subject.is_everyone is not True:
            raise BadRequest("isEveryone must be true when provided")
        return AccessSubjectKind.EVERYONE, None
    raise BadRequest("A subject is required")


def _subject_id_clause(subject_id: Optional[int]) -> "ColumnElement[bool]":
    """Match a grant's subject id, treating EVERYONE's null id correctly (``== None`` would
    never match a NULL column)."""
    if subject_id is None:
        return models.AccessGrant.subject_id.is_(None)
    return models.AccessGrant.subject_id == subject_id


async def _role_confers_manage(session: AsyncSession, role_id: int) -> bool:
    """Whether a permission set includes OBJ_MANAGE_ACCESS."""
    return (
        await session.scalar(
            select(models.PermissionSetItem.id).where(
                models.PermissionSetItem.permission_set_id == role_id,
                models.PermissionSetItem.permission == Permission.OBJ_MANAGE_ACCESS.value,
            )
        )
    ) is not None


@strawberry.type
class AccessGrantMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def grant_access(
        self, info: Info[Context, None], input: AccessGrantInput
    ) -> AccessGrantMutationPayload:
        """Grant a user or group an permission set on an access-controlled object. The model is
        allow-only — the grant only *adds* a grantee to an object that is otherwise admin-only.
        Authoring requires OBJ_MANAGE_ACCESS on the target object. Idempotent:
        re-granting the same subject updates the role.

        Re-granting is also how a manager is *downgraded*, which can strip the last manager of
        an ownerless object just as a revoke can — so the same last-manager guard applies to
        that in-place change, not only to ``revoke_access``."""
        async with info.context.db() as session:
            object_type, object_rowid = await _resolve_object_rowid(session, input.object)
            await _assert_can_manage_object(info, session, object_type, object_rowid)
            subject_kind, subject_rowid = await _resolve_subject_rowid(session, input.subject)
            role_id = await _resolve_permission_set_id(session, input.permission_set_id)
            existing = await session.scalar(
                select(models.AccessGrant).where(
                    models.AccessGrant.subject_kind == subject_kind.value,
                    _subject_id_clause(subject_rowid),
                    models.AccessGrant.object_type == object_type,
                    models.AccessGrant.object_id == object_rowid,
                    models.AccessGrant.selector_kind == "ids",
                    models.AccessGrant.effect == "allow",
                )
            )
            if existing is None:
                session.add(
                    models.AccessGrant(
                        subject_kind=subject_kind.value,
                        subject_id=subject_rowid,
                        role_id=role_id,
                        object_type=object_type,
                        object_id=object_rowid,
                        selector_kind="ids",
                        effect="allow",
                    )
                )
            else:
                # A downgrade to a non-manager role is a manage-revoke in disguise; guard it.
                # No-op unless this grant is the object's last manager (helper decides).
                await _assert_revoke_keeps_a_manager(
                    session,
                    object_type,
                    object_rowid,
                    subject_kind,
                    subject_rowid,
                    new_role_id=role_id,
                )
                existing.role_id = role_id
        return AccessGrantMutationPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def revoke_access(
        self, info: Info[Context, None], input: AccessGrantInput
    ) -> AccessGrantMutationPayload:
        """Remove a subject's grant on an access-controlled object. Requires OBJ_MANAGE_ACCESS
        (or admin privileges)."""
        async with info.context.db() as session:
            object_type, object_rowid = await _resolve_object_rowid(session, input.object)
            await _assert_can_manage_object(info, session, object_type, object_rowid)
            subject_kind, subject_rowid = await _resolve_subject_rowid(session, input.subject)
            await _assert_revoke_keeps_a_manager(
                session, object_type, object_rowid, subject_kind, subject_rowid
            )
            await session.execute(
                delete(models.AccessGrant).where(
                    models.AccessGrant.subject_kind == subject_kind.value,
                    _subject_id_clause(subject_rowid),
                    models.AccessGrant.object_type == object_type,
                    models.AccessGrant.object_id == object_rowid,
                    models.AccessGrant.selector_kind == "ids",
                )
            )
        return AccessGrantMutationPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def set_resource_tag(
        self, info: Info[Context, None], input: ResourceTagInput
    ) -> AccessGrantMutationPayload:
        """Apply (or update) a curated key=value tag on an access-controlled object.
        A tag changes who can reach the object, so setting one requires OBJ_MANAGE_ACCESS
        on the target — the same gate as granting access, which is what makes tags
        server-curated rather than user/telemetry data. Idempotent: re-setting a key
        overwrites its value."""
        if input.value is None or input.value is UNSET:
            raise BadRequest("value must not be null")
        if not input.key:
            raise BadRequest("key must not be empty")
        async with info.context.db() as session:
            object_type, object_rowid = await _resolve_object_rowid(session, input.object)
            await _assert_can_manage_object(info, session, object_type, object_rowid)
            existing = await session.scalar(
                select(models.ResourceTag).where(
                    models.ResourceTag.object_type == object_type,
                    models.ResourceTag.object_id == object_rowid,
                    models.ResourceTag.key == input.key,
                )
            )
            if existing is None:
                session.add(
                    models.ResourceTag(
                        object_type=object_type,
                        object_id=object_rowid,
                        key=input.key,
                        value=input.value,
                        created_by=info.context.user_id,
                    )
                )
            else:
                existing.value = input.value
        return AccessGrantMutationPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def remove_resource_tag(
        self, info: Info[Context, None], input: ResourceTagInput
    ) -> AccessGrantMutationPayload:
        """Remove a curated tag from an object. Requires OBJ_MANAGE_ACCESS (or admin).
        A tag grant that reached the object via this key simply stops matching — no
        grant is deleted (tag grants carry the strings, not a link to this row)."""
        if not input.key:
            raise BadRequest("key must not be empty")
        async with info.context.db() as session:
            object_type, object_rowid = await _resolve_object_rowid(session, input.object)
            await _assert_can_manage_object(info, session, object_type, object_rowid)
            await session.execute(
                delete(models.ResourceTag).where(
                    models.ResourceTag.object_type == object_type,
                    models.ResourceTag.object_id == object_rowid,
                    models.ResourceTag.key == input.key,
                )
            )
        return AccessGrantMutationPayload(query=Query())

    @strawberry.mutation(
        permission_classes=[IsAdminIfAuthEnabled, IsNotReadOnly, IsNotViewer, IsLocked]
    )  # type: ignore
    async def grant_tag_access(
        self, info: Info[Context, None], input: TagAccessGrantInput
    ) -> AccessGrantMutationPayload:
        """Grant a subject a permission set over every object of a type carrying a given
        key=value tag. Type-scoped and additive — it only ever *adds* reach, to whatever
        objects currently carry the tag (none, harmlessly, if none do). Administrator-only:
        unlike a per-object grant, it is not anchored to one object the caller could hold
        OBJ_MANAGE_ACCESS on. Idempotent: re-granting the same (subject, type, tag) updates
        the permission set.

        A tag grant may confer view or edit, never *manage-access*. Manage is delegation
        authority; a tag's reach is object-manager-mutable (a manager can drop the object's
        tag), so a manage-conferring tag grant could be a non-admin's only manage path and
        let them strand an ownerless object in one step. The oracle already refuses to honor
        manage from a tag selector; this rejects authoring one, loudly, rather than storing a
        grant that is silently inert for manage."""
        if not input.tag_key or not input.tag_value:
            raise BadRequest("tagKey and tagValue must not be empty")
        object_type = input.object_type.value
        async with info.context.db() as session:
            subject_kind, subject_rowid = await _resolve_subject_rowid(session, input.subject)
            role_id = await _resolve_permission_set_id(session, input.permission_set_id)
            if role_id is not None and await _role_confers_manage(session, role_id):
                raise BadRequest(
                    "A tag grant cannot confer manage-access. Choose a viewer or editor "
                    "permission set, or author a per-object grant for manage-access."
                )
            existing = await session.scalar(
                select(models.AccessGrant).where(
                    models.AccessGrant.subject_kind == subject_kind.value,
                    _subject_id_clause(subject_rowid),
                    models.AccessGrant.object_type == object_type,
                    models.AccessGrant.selector_kind == "tag",
                    models.AccessGrant.tag_key == input.tag_key,
                    models.AccessGrant.tag_value == input.tag_value,
                    models.AccessGrant.effect == "allow",
                )
            )
            if existing is None:
                session.add(
                    models.AccessGrant(
                        subject_kind=subject_kind.value,
                        subject_id=subject_rowid,
                        role_id=role_id,
                        object_type=object_type,
                        object_id=None,
                        selector_kind="tag",
                        tag_key=input.tag_key,
                        tag_value=input.tag_value,
                        effect="allow",
                    )
                )
            else:
                existing.role_id = role_id
        return AccessGrantMutationPayload(query=Query())

    @strawberry.mutation(
        permission_classes=[IsAdminIfAuthEnabled, IsNotReadOnly, IsNotViewer, IsLocked]
    )  # type: ignore
    async def revoke_tag_access(
        self, info: Info[Context, None], input: TagAccessGrantInput
    ) -> AccessGrantMutationPayload:
        """Remove a subject's tag grant. Administrator-only, like authoring one.

        No last-manager guard applies here, by design. A tag manager grant *can* be the
        only manager path to an ownerless object, but tag-grant lifecycle is admin-only,
        and an administrator both always reaches the object and can re-author the grant —
        so an admin removing it is recoverable, unlike a non-admin manager stripping the
        last durable id-scoped manager (which ``revoke_access``/``grant_access`` do guard).
        Correspondingly, the last-manager guard never counts tag grants as a surviving
        manager (see ``_assert_revoke_keeps_a_manager``)."""
        if not input.tag_key or not input.tag_value:
            raise BadRequest("tagKey and tagValue must not be empty")
        object_type = input.object_type.value
        async with info.context.db() as session:
            subject_kind, subject_rowid = await _resolve_subject_rowid(session, input.subject)
            await session.execute(
                delete(models.AccessGrant).where(
                    models.AccessGrant.subject_kind == subject_kind.value,
                    _subject_id_clause(subject_rowid),
                    models.AccessGrant.object_type == object_type,
                    models.AccessGrant.selector_kind == "tag",
                    models.AccessGrant.tag_key == input.tag_key,
                    models.AccessGrant.tag_value == input.tag_value,
                )
            )
        return AccessGrantMutationPayload(query=Query())
