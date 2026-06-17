"""The per-resource access oracle.

One seam answers the three shapes of access question over the ``acls`` grants:

- list  — :func:`accessible_scope` compiles grants to a ``WHERE`` clause;
- point — :func:`can_access` answers yes/no for one object;
- audit — :func:`subjects_for` answers "who can see this object?".

The model is **fail-closed and monotonic** (admin-only by default; grants only
ever *add*). There is no everyone-baseline and no shadowing: an object is
reachable only if the actor is an administrator, holds a grant that names it (or
a type-wide ``all`` grant), owns it (datasets/prompts are creator-private), or
reaches it *through its parent* (an experiment/evaluator trace project derives
its access from the dataset it runs on — access-by-parent).

Access is **tiered**: each grant carries an permission set (viewer / editor / manager),
and every question is asked at a permission level — ``OBJ_VIEW`` for reads (the
default), ``OBJ_EDIT`` for mutations, ``OBJ_MANAGE_ACCESS`` for administering an
object's access. A grant contributes to a check only if its role includes the
permission asked for; a grant with no role is visibility-only. Creators and
administrators hold every permission on what they own/all.

Two rules sit above the grant data, both centralized here rather than scattered
as bypasses:

- when enforcement is disabled, everything is accessible;
- an actor holding ADMINISTER has universal access — "admin sees everything" as
  a rule inside the oracle.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, FrozenSet, List, Optional, Set, Tuple, Union

from sqlalchemy import false, literal, or_, select, true, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from phoenix.db import models
from phoenix.server.access.permissions import DEFAULT_OBJECT_PERMISSIONS, Permission
from phoenix.server.access.resolution import permissions_for_user_id
from phoenix.server.access.subjects import Subject, SubjectKind

if TYPE_CHECKING:
    from sqlalchemy.orm import InstrumentedAttribute
    from sqlalchemy.sql.elements import ColumnElement

    _IntColumn = Union[ColumnElement[int], InstrumentedAttribute[int]]
    _OptionalIntColumn = Union[ColumnElement[Optional[int]], InstrumentedAttribute[Optional[int]]]

OBJECT_TYPE_ALL = "*"
OBJECT_TYPE_PROJECT = "project"
OBJECT_TYPE_DATASET = "dataset"
OBJECT_TYPE_PROMPT = "prompt"
_EFFECT_ALLOW = "allow"
_SELECTOR_ALL = "all"
_SELECTOR_IDS = "ids"
_SELECTOR_TAG = "tag"

# A subject as stored on a grant: (kind, id), with id None for "everyone".
_SubjectRef = Tuple[str, Optional[int]]


@dataclass(frozen=True)
class AccessScope:
    """Which objects of one type an actor may access. Monotonic: either
    everything, a type-wide allow, or an enumerated allow-set — never a baseline
    with exceptions carved out."""

    everything: bool
    type_allows: bool
    allowed_ids: FrozenSet[int]

    def allows(self, object_id: int) -> bool:
        if self.everything or self.type_allows:
            return True
        return object_id in self.allowed_ids

    def apply(self, column: "_IntColumn") -> "ColumnElement[bool]":
        """A WHERE clause restricting ``column`` (an object-id column) to the
        allowed set. Fail-closed: an empty allow-set matches nothing."""
        if self.everything or self.type_allows:
            return true()
        if not self.allowed_ids:
            return false()
        return column.in_(self.allowed_ids)


def _subject_match(subjects: Set[_SubjectRef]) -> "ColumnElement[bool]":
    clauses = []
    for kind, subject_id in subjects:
        clauses.append(
            (models.AccessGrant.subject_kind == kind)
            & (
                models.AccessGrant.subject_id.is_(None)
                if subject_id is None
                else (models.AccessGrant.subject_id == subject_id)
            )
        )
    return or_(*clauses) if clauses else false()


async def actor_subjects(session: AsyncSession, user_id: int) -> set[_SubjectRef]:
    """Every grant-subject a live actor matches: themselves, their role, and each
    group they belong to. Derived from the *current* user, so deleted subjects
    never appear here (the read-time existence guard is implicit on this side);
    the dangling-grant risk is on stale ``acls`` rows, swept on subject delete."""
    subjects: Set[_SubjectRef] = {(SubjectKind.USER.value, user_id)}
    role_id = await session.scalar(
        select(models.User.user_role_id).where(models.User.id == user_id)
    )
    if role_id is not None:
        subjects.add((SubjectKind.ROLE.value, role_id))
    group_ids = await session.scalars(
        select(models.UserGroupMembership.user_group_id).where(
            models.UserGroupMembership.user_id == user_id
        )
    )
    for group_id in group_ids:
        subjects.add((SubjectKind.GROUP.value, group_id))
    return subjects


async def _roles_with_permission(session: AsyncSession, permission: Permission) -> set[int]:
    """The object-role ids whose permission set includes ``permission``."""
    return set(
        await session.scalars(
            select(models.PermissionSetItem.permission_set_id).where(
                models.PermissionSetItem.permission == permission.value
            )
        )
    )


async def _granted_scope(
    session: AsyncSession,
    match: "ColumnElement[bool]",
    object_type: str,
    permission: Permission,
) -> Tuple[bool, Set[int]]:
    """The (type_allows, enumerated-ids) an actor's grants confer for one type *at the
    requested permission level*. A grant contributes its object only if the permission set it
    carries includes ``permission`` — so a viewer-tier grant counts toward a view check but
    not an edit check. A grant naming no role (``role_id`` NULL) confers the view-only
    default: a plain grant is visibility, never edit/manage."""
    grants = (
        await session.execute(
            select(
                models.AccessGrant.selector_kind,
                models.AccessGrant.object_id,
                models.AccessGrant.role_id,
                models.AccessGrant.tag_key,
                models.AccessGrant.tag_value,
            ).where(
                models.AccessGrant.effect == _EFFECT_ALLOW,
                models.AccessGrant.object_type.in_([object_type, OBJECT_TYPE_ALL]),
                match,
            )
        )
    ).all()
    roles_with_permission = await _roles_with_permission(session, permission)
    null_role_confers = permission in DEFAULT_OBJECT_PERMISSIONS

    def confers(role_id: Optional[int]) -> bool:
        if role_id is None:
            return null_role_confers
        return role_id in roles_with_permission

    type_allows = any(
        selector == _SELECTOR_ALL and confers(role_id) for selector, _, role_id, _, _ in grants
    )
    granted_ids = {
        object_id
        for selector, object_id, role_id, _, _ in grants
        if selector == _SELECTOR_IDS and object_id is not None and confers(role_id)
    }

    # Tag grants contribute *enumerated ids* — the objects of this type currently
    # carrying the granted key=value — never a type-wide allow. One query resolves
    # every conferring pair to ids; a pair that matches no object adds nothing (the
    # fail-closed, inert case). Matched exactly (==), never LIKE/regex/case-fold,
    # which diverge across SQLite and Postgres.
    #
    # A tag grant never confers manage-access. Manage is delegation authority, and a
    # tag's reach is object-manager-mutable (a manager can drop the object's tag), so
    # letting a tag grant be someone's only manage path would let a non-admin strand an
    # ownerless object in one step (removeResourceTag). Tag grants scope view/edit only;
    # manage stays on durable id/all grants. Enforced here (both oracle paths) and
    # rejected at authoring time.
    tag_pairs = {
        (tag_key, tag_value)
        for selector, _, role_id, tag_key, tag_value in grants
        if selector == _SELECTOR_TAG
        and tag_key is not None
        and tag_value is not None
        and confers(role_id)
    }
    if permission == Permission.OBJ_MANAGE_ACCESS:
        tag_pairs = set()
    if tag_pairs:
        tag_ids = await session.scalars(
            select(models.ResourceTag.object_id).where(
                models.ResourceTag.object_type == object_type,
                tuple_(models.ResourceTag.key, models.ResourceTag.value).in_(tag_pairs),
            )
        )
        granted_ids |= set(tag_ids)
    return type_allows, granted_ids


def _subject_match_sql(
    grant: Any,
    user_id: int,
) -> "ColumnElement[bool]":
    role_id = select(models.User.user_role_id).where(models.User.id == user_id).scalar_subquery()
    group_ids = select(models.UserGroupMembership.user_group_id).where(
        models.UserGroupMembership.user_id == user_id
    )
    return or_(
        (grant.subject_kind == SubjectKind.EVERYONE.value) & grant.subject_id.is_(None),
        (grant.subject_kind == SubjectKind.USER.value) & (grant.subject_id == user_id),
        (grant.subject_kind == SubjectKind.ROLE.value) & (grant.subject_id == role_id),
        (grant.subject_kind == SubjectKind.GROUP.value) & grant.subject_id.in_(group_ids),
    )


def _grant_role_confers(
    role_id: "_OptionalIntColumn",
    permission: Permission,
) -> "ColumnElement[bool]":
    role_has_permission = (
        select(models.PermissionSetItem.id)
        .where(
            models.PermissionSetItem.permission_set_id == role_id,
            models.PermissionSetItem.permission == permission.value,
        )
        .exists()
    )
    if permission in DEFAULT_OBJECT_PERMISSIONS:
        return role_id.is_(None) | role_has_permission
    return role_has_permission


def _access_predicate_for_user(
    *,
    user_id: int,
    object_type: str,
    id_column: "_IntColumn",
    permission: Permission,
) -> "ColumnElement[bool]":
    grant = aliased(models.AccessGrant)
    tag = aliased(models.ResourceTag)
    selectors = [
        grant.selector_kind == _SELECTOR_ALL,
        (grant.selector_kind == _SELECTOR_IDS) & (grant.object_id == id_column),
    ]
    # A tag grant never confers manage-access (see _granted_scope): scope view/edit
    # only, so the tag branch is omitted from a manage-permission predicate entirely.
    if permission != Permission.OBJ_MANAGE_ACCESS:
        selectors.append(
            # Tag grant: the object carries the granted key=value tag. The inner
            # EXISTS is nested two levels under the object query, so id_column's
            # table must be *correlated* from the outer query, not re-added to this
            # subquery's FROM — correlate_except(tag) forces that (without it the
            # subquery cross-joins the object table and matches every row). Kept
            # identical to the Python path's tag resolution (parity).
            (grant.selector_kind == _SELECTOR_TAG)
            & select(tag.id)
            .where(
                tag.object_type == object_type,
                tag.object_id == id_column,
                tag.key == grant.tag_key,
                tag.value == grant.tag_value,
            )
            .correlate_except(tag)
            .exists()
        )
    predicates: list["ColumnElement[bool]"] = [
        select(grant.id)
        .where(
            grant.effect == _EFFECT_ALLOW,
            grant.object_type.in_([object_type, OBJECT_TYPE_ALL]),
            _subject_match_sql(grant, user_id),
            _grant_role_confers(grant.role_id, permission),
            or_(*selectors),
        )
        .exists()
    ]
    if object_type == OBJECT_TYPE_DATASET:
        predicates.append(
            id_column.in_(select(models.Dataset.id).where(models.Dataset.user_id == user_id))
        )
    elif object_type == OBJECT_TYPE_PROMPT:
        predicates.append(
            id_column.in_(
                select(models.PromptVersion.prompt_id)
                .where(models.PromptVersion.user_id == user_id)
                .distinct()
            )
        )
    elif object_type == OBJECT_TYPE_PROJECT:
        experiment_dataset_access = _access_predicate_for_user(
            user_id=user_id,
            object_type=OBJECT_TYPE_DATASET,
            id_column=models.Experiment.dataset_id,
            permission=permission,
        )
        evaluator_dataset_access = _access_predicate_for_user(
            user_id=user_id,
            object_type=OBJECT_TYPE_DATASET,
            id_column=models.DatasetEvaluators.dataset_id,
            permission=permission,
        )
        # Access-by-parent as a correlated EXISTS keyed on ``id_column`` (the outer
        # project), not ``id_column IN (SELECT project_id ...)``. The two are logically
        # identical, but the EXISTS lets a *pinned* check (id_column bound to one id, as
        # in a point check) push ``project_id = <id>`` into the subquery and ride the
        # ``experiments.project_id`` / ``dataset_evaluators.project_id`` index — it scans
        # only that project's rows instead of every experiment. (List queries never reach
        # this predicate; they materialize the scope and filter with ``id IN (...)``.)
        predicates.extend(
            [
                select(1)
                .where(
                    models.Experiment.project_id == id_column,
                    experiment_dataset_access,
                )
                .exists(),
                select(1)
                .where(
                    models.DatasetEvaluators.project_id == id_column,
                    evaluator_dataset_access,
                )
                .exists(),
            ]
        )
    return or_(*predicates)


async def access_predicate(
    session: AsyncSession,
    *,
    user_id: int,
    object_type: str,
    id_column: "_IntColumn",
    enabled: bool,
    permission: Permission = Permission.OBJ_VIEW,
) -> "ColumnElement[bool]":
    """A SQL predicate for list/count queries.

    Unlike :func:`accessible_scope`, this keeps explicit grants, creator ownership, and
    inherited eval-project access as SQL subqueries, so pagination does not require
    materializing every accessible id in Python first.
    """
    if not enabled:
        return true()
    if Permission.ADMINISTER in await permissions_for_user_id(session, user_id):
        return true()
    return _access_predicate_for_user(
        user_id=user_id,
        object_type=object_type,
        id_column=id_column,
        permission=permission,
    )


async def _creator_owned_ids(session: AsyncSession, object_type: str, user_id: int) -> set[int]:
    """Ids of creator-private objects this actor owns. Datasets and prompts are
    creator-private; a project has no creator column, so the set is empty for projects."""
    if object_type == OBJECT_TYPE_DATASET:
        ids = await session.scalars(
            select(models.Dataset.id).where(models.Dataset.user_id == user_id)
        )
        return set(ids)
    if object_type == OBJECT_TYPE_PROMPT:
        # Prompts carry no creator column; ownership lives on the versions.
        ids = await session.scalars(
            select(models.PromptVersion.prompt_id)
            .where(models.PromptVersion.user_id == user_id)
            .distinct()
        )
        return set(ids)
    return set()


async def _accessible_eval_project_ids(
    session: AsyncSession, dataset_scope: AccessScope
) -> set[int]:
    """Access-by-parent: the trace-project ids of experiments and evaluators whose
    parent dataset the actor can access. A kind=EXPERIMENT/EVALUATOR project is
    plumbing — its access derives from the dataset, never an independent grant."""
    experiment_ids = select(models.Experiment.project_id).where(
        models.Experiment.project_id.isnot(None)
    )
    evaluator_ids = select(models.DatasetEvaluators.project_id).where(
        models.DatasetEvaluators.project_id.isnot(None)
    )
    if not (dataset_scope.everything or dataset_scope.type_allows):
        if not dataset_scope.allowed_ids:
            return set()
        experiment_ids = experiment_ids.where(
            models.Experiment.dataset_id.in_(dataset_scope.allowed_ids)
        )
        evaluator_ids = evaluator_ids.where(
            models.DatasetEvaluators.dataset_id.in_(dataset_scope.allowed_ids)
        )
    ids: Set[int] = set()
    ids.update(i for i in await session.scalars(experiment_ids) if i is not None)
    ids.update(i for i in await session.scalars(evaluator_ids) if i is not None)
    return ids


async def accessible_scope(
    session: AsyncSession,
    *,
    user_id: int,
    object_type: str,
    enabled: bool,
    permission: Permission = Permission.OBJ_VIEW,
) -> AccessScope:
    """The objects of ``object_type`` on which the actor holds ``permission`` (default
    ``OBJ_VIEW``, i.e. visibility). Pass ``OBJ_EDIT`` to compile the set the actor may
    mutate, ``OBJ_MANAGE_ACCESS`` the set whose access it may administer."""
    everything = AccessScope(True, True, frozenset())
    if not enabled:
        return everything
    if Permission.ADMINISTER in await permissions_for_user_id(session, user_id):
        return everything

    subjects = await actor_subjects(session, user_id)
    match = _subject_match(subjects)

    type_allows, allowed_ids = await _granted_scope(session, match, object_type, permission)
    if type_allows:
        return AccessScope(False, True, frozenset())

    # The creator of a creator-private object holds every object permission on it.
    allowed_ids |= await _creator_owned_ids(session, object_type, user_id)

    # Access-by-parent: an experiment/evaluator trace project inherits the actor's access to
    # the parent dataset *at the same permission level*.
    if object_type == OBJECT_TYPE_PROJECT:
        dataset_scope = await accessible_scope(
            session,
            user_id=user_id,
            object_type=OBJECT_TYPE_DATASET,
            enabled=True,
            permission=permission,
        )
        allowed_ids |= await _accessible_eval_project_ids(session, dataset_scope)

    return AccessScope(False, False, frozenset(allowed_ids))


async def can_access(
    session: AsyncSession,
    *,
    user_id: int,
    object_type: str,
    object_id: int,
    enabled: bool,
    permission: Permission = Permission.OBJ_VIEW,
) -> bool:
    """Whether the actor holds ``permission`` on one object (default ``OBJ_VIEW``).
    Unauthorized is indistinguishable from not-found to the caller, which must surface it
    as 404/null.

    A point check evaluates the grant predicate *pinned to this one id* — the same
    predicate :func:`access_predicate` compiles, but with ``id_column`` bound to
    ``object_id`` (a literal) so it collapses to a scalar boolean with no table scan.
    That is far cheaper than materializing the actor's whole accessible set only to ask
    whether one id is in it; the two agree by construction (parity with
    :func:`accessible_scope`)."""
    if not enabled:
        return True
    if Permission.ADMINISTER in await permissions_for_user_id(session, user_id):
        return True
    predicate = _access_predicate_for_user(
        user_id=user_id,
        object_type=object_type,
        id_column=literal(object_id),
        permission=permission,
    )
    return bool(await session.scalar(select(predicate)))


async def _existing_subject_ids(
    session: AsyncSession, kind: str, subject_ids: Set[int]
) -> Set[int]:
    """Which of ``subject_ids`` still exist, for one subject kind — the read-time
    existence guard that keeps a dangling grant (subject deleted) out of the audit
    view, batched to a single query per kind instead of one per subject."""
    if not subject_ids:
        return set()
    table: type[Any]
    if kind == SubjectKind.USER.value:
        table = models.User
    elif kind == SubjectKind.GROUP.value:
        table = models.UserGroup
    elif kind == SubjectKind.ROLE.value:
        table = models.UserRole
    else:
        return set(subject_ids)  # service accounts and any future kinds: not guarded here
    return set(await session.scalars(select(table.id).where(table.id.in_(subject_ids))))


async def subjects_for(
    session: AsyncSession,
    object_type: str,
    object_id: int,
) -> List[Subject]:
    """Who can access an object — for the "who can see this?" audit view. Returns
    the subjects of the grants that name it plus any type-wide ``all`` grants, any
    tag grant whose ``key=value`` the object currently carries, and the creator
    (datasets/prompts). Administrators have implicit access and are not enumerated.
    Subjects that no longer exist are filtered out (a dangling grant lists nobody)."""
    tag = aliased(models.ResourceTag)
    rows = (
        await session.execute(
            select(models.AccessGrant.subject_kind, models.AccessGrant.subject_id).where(
                models.AccessGrant.effect == _EFFECT_ALLOW,
                or_(
                    (models.AccessGrant.selector_kind == _SELECTOR_IDS)
                    & (models.AccessGrant.object_type == object_type)
                    & (models.AccessGrant.object_id == object_id),
                    (models.AccessGrant.selector_kind == _SELECTOR_ALL)
                    & models.AccessGrant.object_type.in_([object_type, OBJECT_TYPE_ALL]),
                    (models.AccessGrant.selector_kind == _SELECTOR_TAG)
                    & (models.AccessGrant.object_type == object_type)
                    & select(tag.id)
                    .where(
                        tag.object_type == object_type,
                        tag.object_id == object_id,
                        tag.key == models.AccessGrant.tag_key,
                        tag.value == models.AccessGrant.tag_value,
                    )
                    .exists(),
                ),
            )
        )
    ).all()

    # Dedup to first appearance, preserving order.
    seen: Set[_SubjectRef] = set()
    ordered: List[_SubjectRef] = []
    for kind, subject_id in rows:
        ref = (kind, subject_id)
        if ref not in seen:
            seen.add(ref)
            ordered.append(ref)

    # Apply the existence guard in one query per kind, not one per subject.
    ids_by_kind: dict[str, Set[int]] = {}
    for kind, subject_id in ordered:
        if subject_id is not None:
            ids_by_kind.setdefault(kind, set()).add(subject_id)
    existing_by_kind = {
        kind: await _existing_subject_ids(session, kind, ids) for kind, ids in ids_by_kind.items()
    }

    subjects: List[Subject] = []
    for kind, subject_id in ordered:
        if subject_id is None:
            if kind != SubjectKind.EVERYONE.value:
                continue
        elif subject_id not in existing_by_kind.get(kind, set()):
            continue
        try:
            subjects.append(Subject(SubjectKind(kind), subject_id if subject_id is not None else 0))
        except ValueError:
            continue

    creator_id = await _creator_user_id(session, object_type, object_id)
    if creator_id is not None and (SubjectKind.USER.value, creator_id) not in seen:
        subjects.append(Subject(SubjectKind.USER, creator_id))
    return subjects


async def _creator_user_id(
    session: AsyncSession, object_type: str, object_id: int
) -> Optional[int]:
    """The creator of a creator-private object, if any."""
    if object_type == OBJECT_TYPE_DATASET:
        return await session.scalar(
            select(models.Dataset.user_id).where(models.Dataset.id == object_id)
        )
    if object_type == OBJECT_TYPE_PROMPT:
        return await session.scalar(
            select(models.PromptVersion.user_id)
            .where(models.PromptVersion.prompt_id == object_id)
            .order_by(models.PromptVersion.id)
            .limit(1)
        )
    return None
