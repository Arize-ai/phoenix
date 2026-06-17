from secrets import token_bytes, token_hex
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.access import (
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROJECT,
    Permission,
    SubjectKind,
    access_predicate,
    accessible_scope,
    can_access,
    delete_object_grants,
    delete_object_tags,
    subjects_for,
    would_strand_manager_by_role,
)
from phoenix.server.access.subjects import Subject
from phoenix.server.types import DbSessionFactory

_PROJECT = OBJECT_TYPE_PROJECT
_DATASET = OBJECT_TYPE_DATASET
_VIEW = Permission.OBJ_VIEW
_EDIT = Permission.OBJ_EDIT
_MANAGE = Permission.OBJ_MANAGE_ACCESS


async def _role(session: AsyncSession, name: str, permissions: set[str]) -> int:
    role = models.UserRole(name=name)
    session.add(role)
    await session.flush()
    for permission in permissions:
        session.add(models.RolePermission(user_role_id=role.id, permission=permission))
    await session.flush()
    return role.id


async def _permission_set(session: AsyncSession, name: str, permissions: set[str]) -> int:
    """An permission set (viewer/editor/owner tier) with its object-level permission set."""
    role = models.PermissionSet(name=name, is_built_in=False)
    session.add(role)
    await session.flush()
    for permission in permissions:
        session.add(models.PermissionSetItem(permission_set_id=role.id, permission=permission))
    await session.flush()
    return role.id


async def _user(session: AsyncSession, role_id: int) -> int:
    user = models.LocalUser(
        user_role_id=role_id,
        username=token_hex(8),
        email=f"{token_hex(8)}@x.test",
        reset_password=False,
        password_salt=token_bytes(32),
        password_hash=token_bytes(32),
    )
    session.add(user)
    await session.flush()
    return user.id


async def _project(session: AsyncSession, name: str, kind: str = "TELEMETRY") -> int:
    project = models.Project(name=name, kind=kind)
    session.add(project)
    await session.flush()
    return project.id


async def _dataset(session: AsyncSession, name: str, user_id: Optional[int] = None) -> int:
    dataset = models.Dataset(name=name, metadata_={}, user_id=user_id)
    session.add(dataset)
    await session.flush()
    return dataset.id


async def _experiment(session: AsyncSession, *, dataset_id: int, project_id: int) -> int:
    version = models.DatasetVersion(dataset_id=dataset_id, metadata_={})
    session.add(version)
    await session.flush()
    experiment = models.Experiment(
        dataset_id=dataset_id,
        dataset_version_id=version.id,
        name=token_hex(8),
        repetitions=1,
        metadata_={},
        project_id=project_id,
    )
    session.add(experiment)
    await session.flush()
    return experiment.id


async def _group(session: AsyncSession, user_id: int, key: str) -> int:
    group = models.UserGroup(provider="test", group_key=key, display_name=key)
    session.add(group)
    await session.flush()
    session.add(models.UserGroupMembership(user_group_id=group.id, user_id=user_id))
    await session.flush()
    return group.id


async def _grant(
    session: AsyncSession,
    *,
    subject_kind: str,
    subject_id: Optional[int],
    object_type: str,
    object_id: Optional[int],
    selector_kind: str,
    role_id: Optional[int] = None,
    tag_key: Optional[str] = None,
    tag_value: Optional[str] = None,
) -> None:
    session.add(
        models.AccessGrant(
            subject_kind=subject_kind,
            subject_id=subject_id,
            role_id=role_id,
            object_type=object_type,
            object_id=object_id,
            selector_kind=selector_kind,
            tag_key=tag_key,
            tag_value=tag_value,
            effect="allow",
        )
    )
    await session.flush()


async def _tag(
    session: AsyncSession,
    *,
    object_type: str,
    object_id: int,
    key: str,
    value: str,
) -> None:
    session.add(
        models.ResourceTag(object_type=object_type, object_id=object_id, key=key, value=value)
    )
    await session.flush()


async def _accessible_ids(
    session: AsyncSession,
    user_id: int,
    object_type: str,
    enabled: bool,
    permission: Permission = Permission.OBJ_VIEW,
) -> set[int]:
    scope = await accessible_scope(
        session, user_id=user_id, object_type=object_type, enabled=enabled, permission=permission
    )
    column = models.Project.id if object_type == _PROJECT else models.Dataset.id
    table = models.Project if object_type == _PROJECT else models.Dataset
    ids = await session.scalars(select(table.id).where(scope.apply(column)))
    return set(ids)


async def _predicate_ids(
    session: AsyncSession,
    user_id: int,
    object_type: str,
    enabled: bool,
    permission: Permission = Permission.OBJ_VIEW,
) -> set[int]:
    column = models.Project.id if object_type == _PROJECT else models.Dataset.id
    table = models.Project if object_type == _PROJECT else models.Dataset
    predicate = await access_predicate(
        session,
        user_id=user_id,
        object_type=object_type,
        id_column=column,
        enabled=enabled,
        permission=permission,
    )
    ids = await session.scalars(select(table.id).where(predicate))
    return set(ids)


class TestEnforcementDisabled:
    async def test_flag_off_sees_everything(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_id = await _user(session, await _role(session, "MEMBER", {"read"}))
            p1, p2 = await _project(session, "a"), await _project(session, "b")
            # A grant naming p1 — ignored entirely while the flag is off.
            await _grant(
                session,
                subject_kind="group",
                subject_id=999,
                object_type=_PROJECT,
                object_id=p1,
                selector_kind="ids",
            )
        async with db() as session:
            assert await _accessible_ids(session, user_id, _PROJECT, enabled=False) == {p1, p2}
            assert await can_access(
                session, user_id=user_id, object_type=_PROJECT, object_id=p1, enabled=False
            )


class TestAdminOnlyDefault:
    async def test_member_with_no_grants_sees_nothing(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_id = await _user(session, await _role(session, "MEMBER", {"read"}))
            await _project(session, "a")
            await _project(session, "b")
        async with db() as session:
            # Fail-closed: no everyone-baseline, so an ungranted member sees no
            # ingest-born projects at all.
            assert await _accessible_ids(session, user_id, _PROJECT, enabled=True) == set()

    async def test_admin_sees_everything(self, db: DbSessionFactory) -> None:
        async with db() as session:
            admin = await _user(session, await _role(session, "ADMIN", {"read", "administer"}))
            p1, p2 = await _project(session, "a"), await _project(session, "b")
        async with db() as session:
            assert await _accessible_ids(session, admin, _PROJECT, enabled=True) == {p1, p2}
            assert await can_access(
                session, user_id=admin, object_type=_PROJECT, object_id=p1, enabled=True
            )


class TestMonotonicGrants:
    async def test_grant_only_adds_access(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice, bob = await _user(session, member), await _user(session, member)
            team_a = await _group(session, alice, "team-a")
            a_proj = await _project(session, "team-a-proj")
            other = await _project(session, "other")
            # Grant Team A its project. Nothing else becomes visible to anyone.
            await _grant(
                session,
                subject_kind="group",
                subject_id=team_a,
                object_type=_PROJECT,
                object_id=a_proj,
                selector_kind="ids",
            )
        async with db() as session:
            # Alice (Team A) sees only the granted project — not `other`.
            alice_ids = await _accessible_ids(session, alice, _PROJECT, enabled=True)
            assert alice_ids == {a_proj}
            assert other not in alice_ids
            # Bob, in no group, sees nothing.
            assert await _accessible_ids(session, bob, _PROJECT, enabled=True) == set()
            # Point lookup: Bob probing Team A's project is denied (caller -> 404).
            assert not await can_access(
                session, user_id=bob, object_type=_PROJECT, object_id=a_proj, enabled=True
            )

    async def test_two_teams_isolated(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice, bob = await _user(session, member), await _user(session, member)
            team_a = await _group(session, alice, "team-a")
            team_b = await _group(session, bob, "team-b")
            a_proj = await _project(session, "a")
            b_proj = await _project(session, "b")
            for team, proj in ((team_a, a_proj), (team_b, b_proj)):
                await _grant(
                    session,
                    subject_kind="group",
                    subject_id=team,
                    object_type=_PROJECT,
                    object_id=proj,
                    selector_kind="ids",
                )
        async with db() as session:
            assert await _accessible_ids(session, alice, _PROJECT, enabled=True) == {a_proj}
            assert await _accessible_ids(session, bob, _PROJECT, enabled=True) == {b_proj}

    async def test_type_wide_grant_opens_all_of_a_type(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            p1, p2 = await _project(session, "a"), await _project(session, "b")
            # An explicit type-wide grant (e.g. a support group) — monotonic, adds all.
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_PROJECT,
                object_id=None,
                selector_kind="all",
            )
        async with db() as session:
            assert await _accessible_ids(session, alice, _PROJECT, enabled=True) == {p1, p2}


class TestCreatorPrivate:
    async def test_creator_sees_own_dataset_without_a_grant(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice, bob = await _user(session, member), await _user(session, member)
            mine = await _dataset(session, "mine", user_id=alice)
            theirs = await _dataset(session, "theirs", user_id=bob)
        async with db() as session:
            assert await _accessible_ids(session, alice, _DATASET, enabled=True) == {mine}
            assert await _accessible_ids(session, bob, _DATASET, enabled=True) == {theirs}
            assert not await can_access(
                session, user_id=alice, object_type=_DATASET, object_id=theirs, enabled=True
            )


class TestAccessByParent:
    async def test_experiment_project_inherits_dataset(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice, bob = await _user(session, member), await _user(session, member)
            ds = await _dataset(session, "ds", user_id=alice)  # alice owns it
            exp_proj = await _project(session, f"Experiment-{token_hex(6)}", kind="EXPERIMENT")
            await _experiment(session, dataset_id=ds, project_id=exp_proj)
        async with db() as session:
            # Alice can read the experiment's trace project *because* she can read
            # the dataset it runs on — access-by-parent, no grant on the project.
            assert exp_proj in await _accessible_ids(session, alice, _PROJECT, enabled=True)
            assert await can_access(
                session, user_id=alice, object_type=_PROJECT, object_id=exp_proj, enabled=True
            )
            # Bob, who cannot read the dataset, cannot read its experiment project.
            assert exp_proj not in await _accessible_ids(session, bob, _PROJECT, enabled=True)


class TestAccessPredicate:
    async def test_sql_predicate_matches_materialized_scope(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice, bob = await _user(session, member), await _user(session, member)
            team = await _group(session, alice, "team")
            viewer = await _permission_set(session, "Viewer", {"obj_view"})
            editor = await _permission_set(session, "Editor", {"obj_view", "obj_edit"})
            visible = await _project(session, "visible")
            editable = await _project(session, "editable")
            hidden = await _project(session, "hidden")
            owned_dataset = await _dataset(session, "owned", user_id=alice)
            other_dataset = await _dataset(session, "other", user_id=bob)
            experiment_project = await _project(session, f"Experiment-{token_hex(6)}")
            await _experiment(session, dataset_id=owned_dataset, project_id=experiment_project)
            await _grant(
                session,
                subject_kind="group",
                subject_id=team,
                object_type=_PROJECT,
                object_id=visible,
                selector_kind="ids",
                role_id=viewer,
            )
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_PROJECT,
                object_id=editable,
                selector_kind="ids",
                role_id=editor,
            )
        async with db() as session:
            for object_type, permission in (
                (_PROJECT, _VIEW),
                (_PROJECT, _EDIT),
                (_DATASET, _VIEW),
                (_DATASET, _EDIT),
            ):
                assert await _predicate_ids(
                    session, alice, object_type, enabled=True, permission=permission
                ) == await _accessible_ids(
                    session, alice, object_type, enabled=True, permission=permission
                )
            assert hidden not in await _predicate_ids(session, alice, _PROJECT, enabled=True)
            assert other_dataset not in await _predicate_ids(session, alice, _DATASET, enabled=True)

    async def test_project_list_predicate_and_point_scope_match_for_member(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            user_id = await _user(session, member)
            granted = await _project(session, "granted")
            hidden = await _project(session, "hidden")
            await _grant(
                session,
                subject_kind=SubjectKind.USER.value,
                subject_id=user_id,
                object_type=_PROJECT,
                object_id=granted,
                selector_kind="ids",
            )

        async with db() as session:
            listed_ids = await _predicate_ids(session, user_id, _PROJECT, enabled=True)
            scoped_ids = await _accessible_ids(session, user_id, _PROJECT, enabled=True)

        assert listed_ids == scoped_ids == {granted}
        assert hidden not in listed_ids


class TestAclCleanup:
    async def test_delete_object_grants_sweeps_only_concrete_object_grants(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            deleted_project = await _project(session, "deleted")
            kept_project = await _project(session, "kept")
            await _grant(
                session,
                subject_kind=SubjectKind.USER.value,
                subject_id=alice,
                object_type=_PROJECT,
                object_id=deleted_project,
                selector_kind="ids",
            )
            await _grant(
                session,
                subject_kind=SubjectKind.USER.value,
                subject_id=alice,
                object_type=_PROJECT,
                object_id=kept_project,
                selector_kind="ids",
            )
            await _grant(
                session,
                subject_kind=SubjectKind.USER.value,
                subject_id=alice,
                object_type=_PROJECT,
                object_id=None,
                selector_kind="all",
            )
            await delete_object_grants(session, _PROJECT, deleted_project)

            rows = (
                await session.execute(
                    select(models.AccessGrant.selector_kind, models.AccessGrant.object_id).where(
                        models.AccessGrant.subject_kind == SubjectKind.USER.value,
                        models.AccessGrant.subject_id == alice,
                        models.AccessGrant.object_type == _PROJECT,
                    )
                )
            ).all()
        assert set(rows) == {("ids", kept_project), ("all", None)}


class TestPermissionSetTiers:
    """Grants carry an permission set; the oracle answers per permission. A viewer-tier grant
    confers view but not edit; an editor-tier grant confers both; a grant with no role is
    view-only; creators and admins hold every permission."""

    async def test_viewer_grant_sees_but_cannot_edit(self, db: DbSessionFactory) -> None:
        async with db() as session:
            alice = await _user(session, await _role(session, "MEMBER", {"read"}))
            team = await _group(session, alice, "team")
            proj = await _project(session, "p")
            viewer = await _permission_set(session, "Viewer", {"obj_view"})
            await _grant(
                session,
                subject_kind="group",
                subject_id=team,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
                role_id=viewer,
            )
        async with db() as session:
            assert proj in await _accessible_ids(session, alice, _PROJECT, True, _VIEW)
            assert proj not in await _accessible_ids(session, alice, _PROJECT, True, _EDIT)
            assert await can_access(
                session,
                user_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                enabled=True,
                permission=_VIEW,
            )
            assert not await can_access(
                session,
                user_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                enabled=True,
                permission=_EDIT,
            )

    async def test_editor_grant_can_view_and_edit(self, db: DbSessionFactory) -> None:
        async with db() as session:
            alice = await _user(session, await _role(session, "MEMBER", {"read"}))
            team = await _group(session, alice, "team")
            proj = await _project(session, "p")
            editor = await _permission_set(session, "Editor", {"obj_view", "obj_edit"})
            await _grant(
                session,
                subject_kind="group",
                subject_id=team,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
                role_id=editor,
            )
        async with db() as session:
            assert proj in await _accessible_ids(session, alice, _PROJECT, True, _VIEW)
            assert proj in await _accessible_ids(session, alice, _PROJECT, True, _EDIT)

    async def test_roleless_grant_is_view_only(self, db: DbSessionFactory) -> None:
        async with db() as session:
            alice = await _user(session, await _role(session, "MEMBER", {"read"}))
            proj = await _project(session, "p")
            # role_id=None — a plain/legacy grant.
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
            )
        async with db() as session:
            assert await can_access(
                session,
                user_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                enabled=True,
                permission=_VIEW,
            )
            assert not await can_access(
                session,
                user_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                enabled=True,
                permission=_EDIT,
            )

    async def test_type_wide_grant_respects_tier(self, db: DbSessionFactory) -> None:
        async with db() as session:
            alice = await _user(session, await _role(session, "MEMBER", {"read"}))
            p1, p2 = await _project(session, "a"), await _project(session, "b")
            viewer = await _permission_set(session, "Viewer", {"obj_view"})
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_PROJECT,
                object_id=None,
                selector_kind="all",
                role_id=viewer,
            )
        async with db() as session:
            assert await _accessible_ids(session, alice, _PROJECT, True, _VIEW) == {p1, p2}
            assert await _accessible_ids(session, alice, _PROJECT, True, _EDIT) == set()

    async def test_creator_can_edit_own_dataset(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice, bob = await _user(session, member), await _user(session, member)
            mine = await _dataset(session, "mine", user_id=alice)
        async with db() as session:
            # The creator owns it — every object permission, including edit.
            assert await can_access(
                session,
                user_id=alice,
                object_type=_DATASET,
                object_id=mine,
                enabled=True,
                permission=_EDIT,
            )
            assert not await can_access(
                session,
                user_id=bob,
                object_type=_DATASET,
                object_id=mine,
                enabled=True,
                permission=_EDIT,
            )

    async def test_admin_can_edit_everything(self, db: DbSessionFactory) -> None:
        async with db() as session:
            admin = await _user(session, await _role(session, "ADMIN", {"read", "administer"}))
            proj = await _project(session, "p")
        async with db() as session:
            assert await can_access(
                session,
                user_id=admin,
                object_type=_PROJECT,
                object_id=proj,
                enabled=True,
                permission=_EDIT,
            )

    async def test_manager_tier_confers_manage_access_editor_does_not(
        self, db: DbSessionFactory
    ) -> None:
        # The semantic that backs decentralized grant authoring: a manager holds
        # OBJ_MANAGE_ACCESS on the object (so may administer its access), an editor does not.
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            manager_user, editor_user = await _user(session, member), await _user(session, member)
            proj = await _project(session, "p")
            manager = await _permission_set(
                session, "Manager", {"obj_view", "obj_edit", "obj_manage_access"}
            )
            editor = await _permission_set(session, "Editor", {"obj_view", "obj_edit"})
            for subject, role in ((manager_user, manager), (editor_user, editor)):
                await _grant(
                    session,
                    subject_kind="user",
                    subject_id=subject,
                    object_type=_PROJECT,
                    object_id=proj,
                    selector_kind="ids",
                    role_id=role,
                )
        async with db() as session:
            assert await can_access(
                session,
                user_id=manager_user,
                object_type=_PROJECT,
                object_id=proj,
                enabled=True,
                permission=_MANAGE,
            )
            assert not await can_access(
                session,
                user_id=editor_user,
                object_type=_PROJECT,
                object_id=proj,
                enabled=True,
                permission=_MANAGE,
            )


class TestSubjectsFor:
    async def test_granted_object_lists_its_grantees(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            team_a = await _group(session, alice, "team-a")
            proj = await _project(session, "p")
            await _grant(
                session,
                subject_kind="group",
                subject_id=team_a,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
            )
        async with db() as session:
            who = await subjects_for(session, _PROJECT, proj)
        assert Subject(SubjectKind.GROUP, team_a) in who

    async def test_ungranted_project_lists_nobody_explicit(self, db: DbSessionFactory) -> None:
        async with db() as session:
            proj = await _project(session, "p")
        async with db() as session:
            who = await subjects_for(session, _PROJECT, proj)
        # No everyone-default any more: an ungranted project has no explicit
        # subjects (admins are implicit, not enumerated).
        assert who == []

    async def test_dangling_user_grant_is_not_listed(self, db: DbSessionFactory) -> None:
        async with db() as session:
            proj = await _project(session, "p")
            # A grant to a user id that does not exist (deleted/recycled).
            await _grant(
                session,
                subject_kind="user",
                subject_id=987654,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
            )
        async with db() as session:
            who = await subjects_for(session, _PROJECT, proj)
        # The read-time existence guard keeps the dangling subject out of the view.
        assert who == []


class TestStrandByPermissionSet:
    """A permission set is the other lever on the last-manager invariant: editing a custom
    set to drop manage, or deleting it (its grants fall back to view), strips manage from
    every grant carrying it at once. ``would_strand_manager_by_role`` catches the case where
    that leaves a creatorless object reachable only by administrators."""

    async def test_sole_manager_via_role_would_strand(self, db: DbSessionFactory) -> None:
        async with db() as session:
            manager = await _permission_set(session, "mgr", {"obj_view", "obj_manage_access"})
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            proj = await _project(session, "p")  # projects are creatorless
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
                role_id=manager,
            )
        async with db() as session:
            assert await would_strand_manager_by_role(session, manager) is True

    async def test_another_id_manager_via_a_different_role_is_safe(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            manager = await _permission_set(session, "mgr", {"obj_view", "obj_manage_access"})
            other_mgr = await _permission_set(session, "mgr2", {"obj_view", "obj_manage_access"})
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            bob = await _user(session, member)
            proj = await _project(session, "p")
            for uid, rid in ((alice, manager), (bob, other_mgr)):
                await _grant(
                    session,
                    subject_kind="user",
                    subject_id=uid,
                    object_type=_PROJECT,
                    object_id=proj,
                    selector_kind="ids",
                    role_id=rid,
                )
        async with db() as session:
            # Dropping `manager` still leaves bob as a manager via `other_mgr`.
            assert await would_strand_manager_by_role(session, manager) is False

    async def test_type_wide_all_manager_is_safe(self, db: DbSessionFactory) -> None:
        async with db() as session:
            manager = await _permission_set(session, "mgr", {"obj_view", "obj_manage_access"})
            other_mgr = await _permission_set(session, "mgr2", {"obj_view", "obj_manage_access"})
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            bob = await _user(session, member)
            proj = await _project(session, "p")
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
                role_id=manager,
            )
            # A type-wide manager on the project type keeps every project reachable.
            await _grant(
                session,
                subject_kind="user",
                subject_id=bob,
                object_type=_PROJECT,
                object_id=None,
                selector_kind="all",
                role_id=other_mgr,
            )
        async with db() as session:
            assert await would_strand_manager_by_role(session, manager) is False

    async def test_creator_owned_object_is_safe(self, db: DbSessionFactory) -> None:
        async with db() as session:
            manager = await _permission_set(session, "mgr", {"obj_view", "obj_manage_access"})
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            owner = await _user(session, member)
            ds = await _dataset(session, "d", user_id=owner)  # creator is a durable manager
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=ds,
                selector_kind="ids",
                role_id=manager,
            )
        async with db() as session:
            assert await would_strand_manager_by_role(session, manager) is False

    async def test_non_manager_role_strands_nothing(self, db: DbSessionFactory) -> None:
        async with db() as session:
            viewer = await _permission_set(session, "v", {"obj_view"})
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            proj = await _project(session, "p")  # creatorless, no other manager
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_PROJECT,
                object_id=proj,
                selector_kind="ids",
                role_id=viewer,
            )
        async with db() as session:
            # A view-only role confers no manage, so editing/deleting it removes no manage
            # authority — the guard must short-circuit to False, not false-positive.
            assert await would_strand_manager_by_role(session, viewer) is False


class TestTagGrants:
    """Attribute-based grants: a tag grant (selector_kind='tag') names a
    key=value and reaches every object of its type carrying that tag. Additive,
    exact-match, resolved identically by the Python and SQL paths."""

    async def test_tag_grant_reaches_only_tagged_objects_with_parity(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            viewer = await _permission_set(session, "v", {"obj_view"})
            prod = await _dataset(session, "prod-ds")
            staging = await _dataset(session, "staging-ds")
            untagged = await _dataset(session, "untagged-ds")
            await _tag(session, object_type=_DATASET, object_id=prod, key="env", value="prod")
            await _tag(session, object_type=_DATASET, object_id=staging, key="env", value="staging")
            # One tag grant: "datasets tagged env=prod".
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=viewer,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            # Reaches the prod dataset; not staging (wrong value), not untagged.
            assert await _accessible_ids(session, alice, _DATASET, enabled=True) == {prod}
            assert staging not in await _accessible_ids(session, alice, _DATASET, enabled=True)
            assert untagged not in await _accessible_ids(session, alice, _DATASET, enabled=True)
            # Parity: the SQL predicate and the materialized scope agree exactly.
            assert await _predicate_ids(
                session, alice, _DATASET, enabled=True
            ) == await _accessible_ids(session, alice, _DATASET, enabled=True)
            assert await can_access(
                session, user_id=alice, object_type=_DATASET, object_id=prod, enabled=True
            )
            assert not await can_access(
                session, user_id=alice, object_type=_DATASET, object_id=staging, enabled=True
            )

    async def test_tag_grant_matching_no_object_grants_nothing(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            viewer = await _permission_set(session, "v", {"obj_view"})
            ds = await _dataset(session, "ds")  # deliberately untagged
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=viewer,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            # Fail-closed: a tag grant whose key=value matches no object grants nothing.
            assert await _accessible_ids(session, alice, _DATASET, enabled=True) == set()
            assert ds not in await _predicate_ids(session, alice, _DATASET, enabled=True)

    async def test_removed_tag_is_inert_and_swept(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            viewer = await _permission_set(session, "v", {"obj_view"})
            ds = await _dataset(session, "ds")
            await _tag(session, object_type=_DATASET, object_id=ds, key="env", value="prod")
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=viewer,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            assert ds in await _accessible_ids(session, alice, _DATASET, enabled=True)
        # Sweeping the object's tags (the delete-path sibling) removes the match.
        async with db() as session:
            await delete_object_tags(session, _DATASET, ds)
        async with db() as session:
            assert ds not in await _accessible_ids(session, alice, _DATASET, enabled=True)
            assert await _predicate_ids(session, alice, _DATASET, enabled=True) == set()
            # The grant itself survives — it carries strings, not a link to the tag row.
            remaining = await session.scalar(
                select(models.AccessGrant.id).where(models.AccessGrant.selector_kind == "tag")
            )
            assert remaining is not None

    async def test_tag_grant_unions_with_direct_grant(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            viewer = await _permission_set(session, "v", {"obj_view"})
            direct = await _dataset(session, "direct-ds")
            tagged = await _dataset(session, "tagged-ds")
            await _tag(session, object_type=_DATASET, object_id=tagged, key="env", value="prod")
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=direct,
                selector_kind="ids",
                role_id=viewer,
            )
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=viewer,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            # Monotonic union: direct-named object and tag-matched object together.
            assert await _accessible_ids(session, alice, _DATASET, enabled=True) == {direct, tagged}
            assert await _predicate_ids(session, alice, _DATASET, enabled=True) == {direct, tagged}

    async def test_tag_grant_respects_permission_tier(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            viewer = await _permission_set(session, "v", {"obj_view"})
            ds = await _dataset(session, "ds")
            await _tag(session, object_type=_DATASET, object_id=ds, key="env", value="prod")
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=viewer,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            # A viewer-tier tag grant confers visibility, not edit.
            assert ds in await _accessible_ids(session, alice, _DATASET, True, _VIEW)
            assert ds not in await _accessible_ids(session, alice, _DATASET, True, _EDIT)
            assert await _predicate_ids(session, alice, _DATASET, True, _EDIT) == set()

    async def test_tag_grant_never_confers_manage(self, db: DbSessionFactory) -> None:
        # A tag grant scopes view/edit only. A manager-tier tag grant (which authoring
        # rejects, but which a seed could still insert) confers view and edit but *not*
        # manage — otherwise a non-admin could become an object's manager via a tag and
        # then strand it by dropping the tag. The oracle refuses manage on both paths.
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            manager = await _permission_set(
                session, "m", {"obj_view", "obj_edit", "obj_manage_access"}
            )
            ds = await _dataset(session, "ds")
            await _tag(session, object_type=_DATASET, object_id=ds, key="env", value="prod")
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=manager,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            # View and edit flow from the tag grant...
            assert ds in await _accessible_ids(session, alice, _DATASET, True, _VIEW)
            assert ds in await _accessible_ids(session, alice, _DATASET, True, _EDIT)
            # ...but manage does not, on either path.
            assert ds not in await _accessible_ids(session, alice, _DATASET, True, _MANAGE)
            assert await _predicate_ids(session, alice, _DATASET, True, _MANAGE) == set()
            assert not await can_access(
                session,
                user_id=alice,
                object_type=_DATASET,
                object_id=ds,
                enabled=True,
                permission=_MANAGE,
            )

    async def test_tag_grant_on_dataset_reaches_experiment_project(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            viewer = await _permission_set(session, "v", {"obj_view"})
            ds = await _dataset(session, "ds")
            exp_proj = await _project(session, f"Experiment-{token_hex(6)}", kind="EXPERIMENT")
            await _experiment(session, dataset_id=ds, project_id=exp_proj)
            await _tag(session, object_type=_DATASET, object_id=ds, key="env", value="prod")
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=viewer,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            # Containment: the tag grant on the dataset flows to its experiment
            # trace project through access-by-parent, on both paths.
            assert exp_proj in await _accessible_ids(session, alice, _PROJECT, enabled=True)
            assert exp_proj in await _predicate_ids(session, alice, _PROJECT, enabled=True)

    async def test_subjects_for_lists_tag_grantee(self, db: DbSessionFactory) -> None:
        async with db() as session:
            member = await _role(session, "MEMBER", {"read"})
            alice = await _user(session, member)
            viewer = await _permission_set(session, "v", {"obj_view"})
            ds = await _dataset(session, "ds")
            await _tag(session, object_type=_DATASET, object_id=ds, key="env", value="prod")
            await _grant(
                session,
                subject_kind="user",
                subject_id=alice,
                object_type=_DATASET,
                object_id=None,
                selector_kind="tag",
                role_id=viewer,
                tag_key="env",
                tag_value="prod",
            )
        async with db() as session:
            who = await subjects_for(session, _DATASET, ds)
        assert Subject(SubjectKind.USER, alice) in who

    async def test_delete_object_tags_sweeps_only_that_object(self, db: DbSessionFactory) -> None:
        async with db() as session:
            keep = await _dataset(session, "keep")
            drop = await _dataset(session, "drop")
            await _tag(session, object_type=_DATASET, object_id=keep, key="env", value="prod")
            await _tag(session, object_type=_DATASET, object_id=drop, key="env", value="prod")
        async with db() as session:
            await delete_object_tags(session, _DATASET, drop)
        async with db() as session:
            surviving = set(
                await session.scalars(
                    select(models.ResourceTag.object_id).where(
                        models.ResourceTag.object_type == _DATASET
                    )
                )
            )
        assert surviving == {keep}
