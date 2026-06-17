"""The last-manager guard, shared by every write path that can remove a manager.

A creatorless object (every project; any dataset/prompt whose creator was
deprovisioned) whose final manage-conferring grant is removed becomes reachable
only by administrators — no non-admin could restore access to it. Both the GraphQL
mutations and the REST access routes can reach that state (by revoke or by an
in-place downgrade), so the decision lives here as one predicate they both call and
each turns into its own error type (GraphQL ``Conflict`` / HTTP 409).

See the implementation invariants, B3.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.access.oracle import (
    OBJECT_TYPE_ALL,
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROMPT,
)
from phoenix.server.access.permissions import Permission

_SELECTOR_IDS = "ids"
_SELECTOR_ALL = "all"
_EFFECT_ALLOW = "allow"


async def _object_has_creator(session: AsyncSession, object_type: str, object_id: int) -> bool:
    """Whether the object has a creator-owner — a permanent, non-revocable manager.

    Datasets and prompts are creator-private (ownership lives on ``datasets.user_id`` and
    each prompt version's ``user_id``); a project has no creator column. A creator whose
    account was deprovisioned leaves the column NULL, so ownership can also be absent on a
    type that normally has it."""
    if object_type == OBJECT_TYPE_DATASET:
        creator = await session.scalar(
            select(models.Dataset.user_id).where(models.Dataset.id == object_id)
        )
        return creator is not None
    if object_type == OBJECT_TYPE_PROMPT:
        version = await session.scalar(
            select(models.PromptVersion.id).where(
                models.PromptVersion.prompt_id == object_id,
                models.PromptVersion.user_id.isnot(None),
            )
        )
        return version is not None
    return False  # projects carry no creator column


async def would_strand_last_manager(
    session: AsyncSession,
    *,
    object_type: str,
    object_id: int,
    subject_kind: str,
    subject_id: Optional[int],
    new_role_id: Optional[int] = None,
) -> bool:
    """Whether removing or downgrading this subject's id-scoped grant would leave a
    creatorless object reachable only by administrators.

    Two paths remove a manager and both must consult this: deleting the grant
    (``new_role_id=None``) and downgrading it in place to a non-manager role
    (``new_role_id`` = the new role). A change that keeps the grant a manager, or that
    was never a manager grant, cannot strand anything.

    Coverage that keeps the object safe is deliberately narrow — a live creator, another
    id-scoped manager, or a type-wide (``all``) manager. A **tag** manager grant does not
    count: its reach is object-manager-mutable, so relying on it would let the last durable
    manager be dropped and then the tag removed. (Tag grants cannot confer manage at all —
    see the oracle — so in practice none exist; this stays defensive regardless.)"""
    manager_role_ids = set(
        await session.scalars(
            select(models.PermissionSetItem.permission_set_id).where(
                models.PermissionSetItem.permission == Permission.OBJ_MANAGE_ACCESS.value
            )
        )
    )
    subject_id_clause = (
        models.AccessGrant.subject_id.is_(None)
        if subject_id is None
        else models.AccessGrant.subject_id == subject_id
    )
    removed = await session.scalar(
        select(models.AccessGrant).where(
            models.AccessGrant.subject_kind == subject_kind,
            subject_id_clause,
            models.AccessGrant.object_type == object_type,
            models.AccessGrant.object_id == object_id,
            models.AccessGrant.selector_kind == _SELECTOR_IDS,
            models.AccessGrant.effect == _EFFECT_ALLOW,
        )
    )
    if removed is None or removed.role_id not in manager_role_ids:
        return False  # not currently a manager grant — nothing to strand
    if new_role_id is not None and new_role_id in manager_role_ids:
        return False  # a downgrade that stays a manager keeps the object reachable
    if await _object_has_creator(session, object_type, object_id):
        return False
    # Another durable manage-conferring grant (id-scoped on this object, or type-wide
    # 'all' on this type) keeps the object reachable. Exclude the row being changed.
    another_manager = await session.scalar(
        select(models.AccessGrant.id)
        .where(
            models.AccessGrant.effect == _EFFECT_ALLOW,
            models.AccessGrant.role_id.in_(manager_role_ids),
            models.AccessGrant.id != removed.id,
            or_(
                (models.AccessGrant.selector_kind == _SELECTOR_IDS)
                & (models.AccessGrant.object_type == object_type)
                & (models.AccessGrant.object_id == object_id),
                (models.AccessGrant.selector_kind == _SELECTOR_ALL)
                & models.AccessGrant.object_type.in_([object_type, OBJECT_TYPE_ALL]),
            ),
        )
        .limit(1)
    )
    return another_manager is None


async def would_strand_manager_by_role(session: AsyncSession, role_id: int) -> bool:
    """Whether stripping OBJ_MANAGE_ACCESS from permission set ``role_id`` would leave some
    creatorless object reachable only by administrators.

    The per-grant guard above covers revoking or downgrading a single grant. A permission
    set is the other lever on the same invariant: editing a custom set to drop manage, or
    deleting it (its grants fall back to ``role_id`` NULL, i.e. view-only), silently strips
    manage authority from *every* grant that carries it at once. If any such grant is the
    sole durable manager of an ownerless object, the change strands it. Call this before the
    edit/delete and refuse when it returns True.

    An object stays safe if it has a live creator, or another durable manager grant whose
    role still confers manage *after* this set stops doing so (another id-scoped manager on
    the object, or a type-wide ``all`` manager on the type)."""
    # A set that does not confer manage today loses no manage authority when changed, so it
    # can strand nothing — short-circuit before scanning grants (also avoids a false positive
    # on deleting a view/edit-only role whose objects happen to lack another manager).
    role_confers_manage = await session.scalar(
        select(models.PermissionSetItem.id).where(
            models.PermissionSetItem.permission_set_id == role_id,
            models.PermissionSetItem.permission == Permission.OBJ_MANAGE_ACCESS.value,
        )
    )
    if role_confers_manage is None:
        return False
    # The sets that still confer manage once role_id no longer does.
    surviving_manager_role_ids = set(
        await session.scalars(
            select(models.PermissionSetItem.permission_set_id).where(
                models.PermissionSetItem.permission == Permission.OBJ_MANAGE_ACCESS.value,
                models.PermissionSetItem.permission_set_id != role_id,
            )
        )
    )
    # The objects whose only manage path today may be an id-scoped grant on this set.
    at_risk = (
        await session.execute(
            select(models.AccessGrant.object_type, models.AccessGrant.object_id)
            .where(
                models.AccessGrant.effect == _EFFECT_ALLOW,
                models.AccessGrant.selector_kind == _SELECTOR_IDS,
                models.AccessGrant.role_id == role_id,
                models.AccessGrant.object_id.isnot(None),
            )
            .distinct()
        )
    ).all()
    for object_type, object_id in at_risk:
        if await _object_has_creator(session, object_type, object_id):
            continue
        another_manager = await session.scalar(
            select(models.AccessGrant.id)
            .where(
                models.AccessGrant.effect == _EFFECT_ALLOW,
                models.AccessGrant.role_id.in_(surviving_manager_role_ids),
                or_(
                    (models.AccessGrant.selector_kind == _SELECTOR_IDS)
                    & (models.AccessGrant.object_type == object_type)
                    & (models.AccessGrant.object_id == object_id),
                    (models.AccessGrant.selector_kind == _SELECTOR_ALL)
                    & models.AccessGrant.object_type.in_([object_type, OBJECT_TYPE_ALL]),
                ),
            )
            .limit(1)
        )
        if another_manager is None:
            return True
    return False
