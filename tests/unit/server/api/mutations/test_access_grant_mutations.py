from secrets import token_bytes, token_hex
from typing import Any, cast

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.schema import CheckConstraint, Table
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.access import (
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROJECT,
    OBJECT_TYPE_PROMPT,
    Permission,
)
from phoenix.server.api.exceptions import Conflict, NotFound
from phoenix.server.api.mutations.access_grant_mutations import (
    AccessGrantObjectInput,
    AccessGrantSubjectInput,
    _assert_revoke_keeps_a_manager,
    _resolve_object_rowid,
    _resolve_permission_set_id,
    _resolve_subject_rowid,
)
from phoenix.server.api.types.AccessSubjectKind import AccessSubjectKind
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_USER = AccessSubjectKind.USER.value


async def _permission_set(session: AsyncSession, permission: Permission) -> models.PermissionSet:
    permission_set = models.PermissionSet(name=f"set-{token_hex(4)}", is_built_in=False)
    session.add(permission_set)
    await session.flush()
    session.add(
        models.PermissionSetItem(permission_set_id=permission_set.id, permission=permission.value)
    )
    await session.flush()
    return permission_set


def _grant(
    *,
    subject_id: int,
    role_id: int,
    object_type: str,
    object_id: int,
    selector_kind: str = "ids",
) -> models.AccessGrant:
    return models.AccessGrant(
        subject_kind=_USER,
        subject_id=subject_id,
        role_id=role_id,
        object_type=object_type,
        object_id=object_id if selector_kind == "ids" else None,
        selector_kind=selector_kind,
        effect="allow",
    )


class TestResolveSubjectRowid:
    async def test_accepts_existing_user_and_group(self, db: DbSessionFactory) -> None:
        async with db() as session:
            role = models.UserRole(name=f"r{token_hex(2)}")
            session.add(role)
            await session.flush()
            user = models.LocalUser(
                user_role_id=role.id,
                username=token_hex(8),
                email=f"{token_hex(8)}@x.test",
                reset_password=False,
                password_salt=token_bytes(32),
                password_hash=token_bytes(32),
            )
            group = models.UserGroup(
                provider="test",
                group_key=f"team-{token_hex(4)}",
                display_name="Team",
            )
            session.add_all([user, group])
            await session.flush()

            assert await _resolve_subject_rowid(
                session,
                AccessGrantSubjectInput(user_id=GlobalID("User", str(user.id))),
            ) == (AccessSubjectKind.USER, user.id)
            assert await _resolve_subject_rowid(
                session,
                AccessGrantSubjectInput(user_group_id=GlobalID("UserGroup", str(group.id))),
            ) == (AccessSubjectKind.GROUP, group.id)
            assert await _resolve_subject_rowid(
                session,
                AccessGrantSubjectInput(is_everyone=True),
            ) == (AccessSubjectKind.EVERYONE, None)

    async def test_rejects_missing_subject(self, db: DbSessionFactory) -> None:
        async with db() as session:
            with pytest.raises(NotFound, match="Unknown user"):
                await _resolve_subject_rowid(
                    session,
                    AccessGrantSubjectInput(user_id=GlobalID("User", "999999")),
                )
            with pytest.raises(NotFound, match="Unknown group"):
                await _resolve_subject_rowid(
                    session,
                    AccessGrantSubjectInput(user_group_id=GlobalID("UserGroup", "999999")),
                )


class TestResolveObjectRowid:
    async def test_accepts_existing_project_dataset_and_prompt(self, db: DbSessionFactory) -> None:
        async with db() as session:
            project = models.Project(name=f"project-{token_hex(4)}")
            dataset = models.Dataset(name=f"dataset-{token_hex(4)}")
            prompt = models.Prompt(name=Identifier(f"prompt-{token_hex(4)}"))
            session.add_all([project, dataset, prompt])
            await session.flush()

            assert await _resolve_object_rowid(
                session,
                AccessGrantObjectInput(dataset_id=GlobalID("Dataset", str(dataset.id))),
            ) == (OBJECT_TYPE_DATASET, dataset.id)
            assert await _resolve_object_rowid(
                session,
                AccessGrantObjectInput(project_id=GlobalID("Project", str(project.id))),
            ) == (OBJECT_TYPE_PROJECT, project.id)
            assert await _resolve_object_rowid(
                session,
                AccessGrantObjectInput(prompt_id=GlobalID("Prompt", str(prompt.id))),
            ) == (OBJECT_TYPE_PROMPT, prompt.id)

    async def test_rejects_missing_object(self, db: DbSessionFactory) -> None:
        async with db() as session:
            with pytest.raises(NotFound, match="Unknown dataset"):
                await _resolve_object_rowid(
                    session,
                    AccessGrantObjectInput(dataset_id=GlobalID("Dataset", "999999")),
                )
            with pytest.raises(NotFound, match="Unknown project"):
                await _resolve_object_rowid(
                    session,
                    AccessGrantObjectInput(project_id=GlobalID("Project", "999999")),
                )
            with pytest.raises(NotFound, match="Unknown prompt"):
                await _resolve_object_rowid(
                    session,
                    AccessGrantObjectInput(prompt_id=GlobalID("Prompt", "999999")),
                )


class TestResolvePermissionSetId:
    async def test_accepts_existing_permission_set_global_id(self, db: DbSessionFactory) -> None:
        async with db() as session:
            role = models.PermissionSet(name=f"Role-{token_hex(4)}", is_built_in=False)
            session.add(role)
            await session.flush()

            assert (
                await _resolve_permission_set_id(
                    session,
                    GlobalID("PermissionSet", str(role.id)),
                )
                == role.id
            )

    async def test_rejects_missing_permission_set_global_id(self, db: DbSessionFactory) -> None:
        async with db() as session:
            with pytest.raises(NotFound, match="Unknown permission set"):
                await _resolve_permission_set_id(
                    session,
                    GlobalID("PermissionSet", "999999"),
                )


class TestWildcardTypeConstraint:
    """A wildcard object_type ('*') is only coherent with the type-wide 'all' selector.
    Object identity is the (type, id) pair, so an id-scoped '*' grant would alias every
    row sharing that id across tables. The mutation API never writes such a row; the DB
    check constraint is the backstop for hand-seeded / migrated rows."""

    def test_constraint_is_declared_on_the_table(self) -> None:
        # Enforcement is a platform guarantee once the CHECK is declared; asserting the
        # declaration (rather than round-tripping a bad INSERT) keeps this deterministic
        # across the sqlean/aiosqlite driver, whose failed-statement cursor re-raises on
        # close. The positive round-trips below confirm the condition does not over-reject.
        table = cast(Table, models.AccessGrant.__table__)
        constraint = next(
            (
                c
                for c in table.constraints
                if "wildcard_type_requires_all_selector" in (getattr(c, "name", None) or "")
            ),
            None,
        )
        assert constraint is not None
        assert isinstance(constraint, CheckConstraint)
        condition = str(constraint.sqltext)
        assert "object_type" in condition and "selector_kind" in condition

    async def test_allows_wildcard_type_with_all_selector(self, db: DbSessionFactory) -> None:
        async with db() as session:
            session.add(
                models.AccessGrant(
                    subject_kind=_USER,
                    subject_id=1,
                    object_type="*",
                    object_id=None,
                    selector_kind="all",
                    effect="allow",
                )
            )
            await session.flush()  # does not raise

    async def test_allows_concrete_type_with_ids_selector(self, db: DbSessionFactory) -> None:
        async with db() as session:
            session.add(
                models.AccessGrant(
                    subject_kind=_USER,
                    subject_id=1,
                    object_type=OBJECT_TYPE_PROJECT,
                    object_id=5,
                    selector_kind="ids",
                    effect="allow",
                )
            )
            await session.flush()  # does not raise


class TestRevokeKeepsAManager:
    """Revoking the last manager of an object with no owner would strand it (reachable only
    by admins). The guard refuses that, the way a system refuses to delete its last admin."""

    async def test_blocks_stranding_a_project(self, db: DbSessionFactory) -> None:
        # A project has no creator; if its sole manager's grant is revoked, no non-admin
        # could ever restore access — so the revoke is refused.
        async with db() as session:
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            session.add(
                _grant(
                    subject_id=1, role_id=manager.id, object_type=OBJECT_TYPE_PROJECT, object_id=100
                )
            )
            await session.flush()
            with pytest.raises(Conflict, match="last manager"):
                await _assert_revoke_keeps_a_manager(
                    session, OBJECT_TYPE_PROJECT, 100, AccessSubjectKind.USER, 1
                )

    async def test_allows_when_another_id_manager_remains(self, db: DbSessionFactory) -> None:
        async with db() as session:
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            session.add_all(
                [
                    _grant(
                        subject_id=1,
                        role_id=manager.id,
                        object_type=OBJECT_TYPE_PROJECT,
                        object_id=100,
                    ),
                    _grant(
                        subject_id=2,
                        role_id=manager.id,
                        object_type=OBJECT_TYPE_PROJECT,
                        object_id=100,
                    ),
                ]
            )
            await session.flush()
            # A second manager remains, so revoking the first does not strand the object.
            await _assert_revoke_keeps_a_manager(
                session, OBJECT_TYPE_PROJECT, 100, AccessSubjectKind.USER, 1
            )

    async def test_allows_when_type_wide_all_manager_remains(self, db: DbSessionFactory) -> None:
        async with db() as session:
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            session.add_all(
                [
                    _grant(
                        subject_id=1,
                        role_id=manager.id,
                        object_type=OBJECT_TYPE_PROJECT,
                        object_id=100,
                    ),
                    _grant(
                        subject_id=2,
                        role_id=manager.id,
                        object_type=OBJECT_TYPE_PROJECT,
                        object_id=100,
                        selector_kind="all",
                    ),
                ]
            )
            await session.flush()
            # A type-wide "all" manager still reaches the object.
            await _assert_revoke_keeps_a_manager(
                session, OBJECT_TYPE_PROJECT, 100, AccessSubjectKind.USER, 1
            )

    async def test_allows_revoking_a_non_manager_grant(self, db: DbSessionFactory) -> None:
        # Revoking a viewer grant cannot reduce the manager count, so it is never blocked —
        # even when it is the object's only grant.
        async with db() as session:
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
            session.add(
                _grant(
                    subject_id=1, role_id=viewer.id, object_type=OBJECT_TYPE_PROJECT, object_id=100
                )
            )
            await session.flush()
            await _assert_revoke_keeps_a_manager(
                session, OBJECT_TYPE_PROJECT, 100, AccessSubjectKind.USER, 1
            )

    async def test_allows_when_object_has_a_creator(self, db: DbSessionFactory) -> None:
        # A dataset with a live creator has a permanent, non-revocable manager, so revoking
        # its sole manager grant does not strand it.
        async with db() as session:
            role = models.UserRole(name=f"r{token_hex(2)}")
            session.add(role)
            await session.flush()
            user = models.LocalUser(
                user_role_id=role.id,
                username=token_hex(8),
                email=f"{token_hex(8)}@x.test",
                reset_password=False,
                password_salt=token_bytes(32),
                password_hash=token_bytes(32),
            )
            session.add(user)
            await session.flush()
            dataset = models.Dataset(name=f"dataset-{token_hex(4)}", user_id=user.id)
            session.add(dataset)
            await session.flush()
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            session.add(
                _grant(
                    subject_id=user.id,
                    role_id=manager.id,
                    object_type=OBJECT_TYPE_DATASET,
                    object_id=dataset.id,
                )
            )
            await session.flush()
            await _assert_revoke_keeps_a_manager(
                session, OBJECT_TYPE_DATASET, dataset.id, AccessSubjectKind.USER, user.id
            )

    async def test_blocks_stranding_a_dataset_whose_creator_was_deprovisioned(
        self, db: DbSessionFactory
    ) -> None:
        # A dataset whose creator was deleted has user_id NULL (ON DELETE SET NULL), so it
        # is ownerless like a project — its last manager must not be revoked.
        async with db() as session:
            dataset = models.Dataset(name=f"dataset-{token_hex(4)}", user_id=None)
            session.add(dataset)
            await session.flush()
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            session.add(
                _grant(
                    subject_id=1,
                    role_id=manager.id,
                    object_type=OBJECT_TYPE_DATASET,
                    object_id=dataset.id,
                )
            )
            await session.flush()
            with pytest.raises(Conflict, match="last manager"):
                await _assert_revoke_keeps_a_manager(
                    session, OBJECT_TYPE_DATASET, dataset.id, AccessSubjectKind.USER, 1
                )


class TestDowngradePreservesManager:
    """grant_access re-grants a subject in place, so downgrading the sole manager of an
    ownerless object strips its last manager just as a revoke would — the same guard
    applies via new_role_id (the role the grant is changing to)."""

    async def test_blocks_downgrading_the_last_manager(self, db: DbSessionFactory) -> None:
        async with db() as session:
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
            session.add(
                _grant(
                    subject_id=1, role_id=manager.id, object_type=OBJECT_TYPE_PROJECT, object_id=100
                )
            )
            await session.flush()
            # Downgrading the sole manager to viewer would strand the ownerless project.
            with pytest.raises(Conflict, match="last manager"):
                await _assert_revoke_keeps_a_manager(
                    session,
                    OBJECT_TYPE_PROJECT,
                    100,
                    AccessSubjectKind.USER,
                    1,
                    new_role_id=viewer.id,
                )

    async def test_allows_downgrade_that_stays_a_manager(self, db: DbSessionFactory) -> None:
        async with db() as session:
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            manager_2 = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            session.add(
                _grant(
                    subject_id=1, role_id=manager.id, object_type=OBJECT_TYPE_PROJECT, object_id=100
                )
            )
            await session.flush()
            # The new role still confers manage, so this is not a downgrade — no strand.
            await _assert_revoke_keeps_a_manager(
                session,
                OBJECT_TYPE_PROJECT,
                100,
                AccessSubjectKind.USER,
                1,
                new_role_id=manager_2.id,
            )

    async def test_allows_downgrade_when_another_manager_remains(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
            session.add_all(
                [
                    _grant(
                        subject_id=1,
                        role_id=manager.id,
                        object_type=OBJECT_TYPE_PROJECT,
                        object_id=100,
                    ),
                    _grant(
                        subject_id=2,
                        role_id=manager.id,
                        object_type=OBJECT_TYPE_PROJECT,
                        object_id=100,
                    ),
                ]
            )
            await session.flush()
            # A second id-manager remains, so downgrading the first is allowed.
            await _assert_revoke_keeps_a_manager(
                session,
                OBJECT_TYPE_PROJECT,
                100,
                AccessSubjectKind.USER,
                1,
                new_role_id=viewer.id,
            )


class TestTagManagerNotCountedAsSurvivor:
    """A tag manager grant reaches the object, but its reach is object-manager-mutable
    (any manager can drop the object's tag), so it is deliberately not counted as a
    surviving manager — the guard stays strictly fail-safe against non-admin stranding."""

    async def test_tag_manager_does_not_rescue_the_last_id_manager(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            # Sole id-manager on an ownerless project...
            session.add(
                _grant(
                    subject_id=1, role_id=manager.id, object_type=OBJECT_TYPE_PROJECT, object_id=100
                )
            )
            # ...plus a tag manager grant that also confers manage on projects.
            session.add(
                models.AccessGrant(
                    subject_kind=_USER,
                    subject_id=2,
                    role_id=manager.id,
                    object_type=OBJECT_TYPE_PROJECT,
                    object_id=None,
                    selector_kind="tag",
                    tag_key="env",
                    tag_value="prod",
                    effect="allow",
                )
            )
            await session.flush()
            # The tag grant is not durable, so the revoke is still refused.
            with pytest.raises(Conflict, match="last manager"):
                await _assert_revoke_keeps_a_manager(
                    session, OBJECT_TYPE_PROJECT, 100, AccessSubjectKind.USER, 1
                )


async def _project(session: AsyncSession, name: str) -> int:
    project = models.Project(name=name, kind="TELEMETRY")
    session.add(project)
    await session.flush()
    return project.id


async def _local_user(session: AsyncSession) -> int:
    role = models.UserRole(name=f"r{token_hex(2)}")
    session.add(role)
    await session.flush()
    user = models.LocalUser(
        user_role_id=role.id,
        username=token_hex(8),
        email=f"{token_hex(8)}@x.test",
        reset_password=False,
        password_salt=token_bytes(32),
        password_hash=token_bytes(32),
    )
    session.add(user)
    await session.flush()
    return user.id


class TestResourceTagMutations:
    """End-to-end coverage of setResourceTag / removeResourceTag through the schema.
    Auth is off in unit tests, so the OBJ_MANAGE_ACCESS gate is exercised in the
    integration suite; these lock the data effects and idempotency."""

    _SET = """
      mutation($input: ResourceTagInput!) {
        setResourceTag(input: $input) { query { __typename } }
      }
    """
    _REMOVE = """
      mutation($input: ResourceTagInput!) {
        removeResourceTag(input: $input) { query { __typename } }
      }
    """

    async def _tags(self, db: DbSessionFactory, project_id: int) -> list[tuple[str, str]]:
        async with db() as session:
            rows = await session.execute(
                select(models.ResourceTag.key, models.ResourceTag.value).where(
                    models.ResourceTag.object_type == OBJECT_TYPE_PROJECT,
                    models.ResourceTag.object_id == project_id,
                )
            )
        return [(k, v) for k, v in rows]

    async def test_set_tags_the_object(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            pid = await _project(session, "p")
        obj = {"projectId": str(GlobalID("Project", str(pid)))}
        response = await gql_client.execute(
            query=self._SET, variables={"input": {"object": obj, "key": "env", "value": "prod"}}
        )
        assert not response.errors
        assert await self._tags(db, pid) == [("env", "prod")]

    async def test_set_is_idempotent_and_updates_value(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            pid = await _project(session, "p")
        obj = {"projectId": str(GlobalID("Project", str(pid)))}
        for value in ("prod", "staging"):
            response = await gql_client.execute(
                query=self._SET, variables={"input": {"object": obj, "key": "env", "value": value}}
            )
            assert not response.errors
        # One row per (object, key) — the second set overwrote the value.
        assert await self._tags(db, pid) == [("env", "staging")]

    async def test_remove_deletes_the_tag(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            pid = await _project(session, "p")
        obj = {"projectId": str(GlobalID("Project", str(pid)))}
        await gql_client.execute(
            query=self._SET, variables={"input": {"object": obj, "key": "env", "value": "prod"}}
        )
        response = await gql_client.execute(
            query=self._REMOVE, variables={"input": {"object": obj, "key": "env"}}
        )
        assert not response.errors
        assert await self._tags(db, pid) == []


class TestTagAccessGrantMutations:
    """End-to-end coverage of grantTagAccess / revokeTagAccess through the schema."""

    _GRANT = """
      mutation($input: TagAccessGrantInput!) {
        grantTagAccess(input: $input) { query { __typename } }
      }
    """
    _REVOKE = """
      mutation($input: TagAccessGrantInput!) {
        revokeTagAccess(input: $input) { query { __typename } }
      }
    """

    async def _tag_grants(
        self, db: DbSessionFactory, subject_id: int
    ) -> list[tuple[str, str, str]]:
        async with db() as session:
            rows = await session.execute(
                select(
                    models.AccessGrant.object_type,
                    models.AccessGrant.tag_key,
                    models.AccessGrant.tag_value,
                ).where(
                    models.AccessGrant.subject_kind == _USER,
                    models.AccessGrant.subject_id == subject_id,
                    models.AccessGrant.selector_kind == "tag",
                )
            )
        return [(t, k, v) for t, k, v in rows]

    def _input(self, subject_id: int, role_gid: str) -> dict[str, Any]:
        return {
            "subject": {"userId": str(GlobalID("User", str(subject_id)))},
            "objectType": "DATASET",
            "tagKey": "env",
            "tagValue": "prod",
            "permissionSetId": role_gid,
        }

    async def test_grant_creates_a_type_scoped_tag_grant(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            uid = await _local_user(session)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
        role_gid = str(GlobalID("PermissionSet", str(viewer.id)))
        response = await gql_client.execute(
            query=self._GRANT, variables={"input": self._input(uid, role_gid)}
        )
        assert not response.errors
        assert await self._tag_grants(db, uid) == [(OBJECT_TYPE_DATASET, "env", "prod")]

    async def test_grant_is_idempotent(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            uid = await _local_user(session)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
        role_gid = str(GlobalID("PermissionSet", str(viewer.id)))
        for _ in range(2):
            response = await gql_client.execute(
                query=self._GRANT, variables={"input": self._input(uid, role_gid)}
            )
            assert not response.errors
        assert await self._tag_grants(db, uid) == [(OBJECT_TYPE_DATASET, "env", "prod")]

    async def test_revoke_deletes_the_tag_grant(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            uid = await _local_user(session)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
        role_gid = str(GlobalID("PermissionSet", str(viewer.id)))
        await gql_client.execute(query=self._GRANT, variables={"input": self._input(uid, role_gid)})
        response = await gql_client.execute(
            query=self._REVOKE, variables={"input": self._input(uid, role_gid)}
        )
        assert not response.errors
        assert await self._tag_grants(db, uid) == []

    async def test_grant_rejects_a_manage_conferring_permission_set(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        # A tag grant may confer view/edit, never manage — a manage-conferring tag grant
        # would give a non-admin a one-step strand path (drop the tag). Authoring is refused.
        async with db() as session:
            uid = await _local_user(session)
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
        role_gid = str(GlobalID("PermissionSet", str(manager.id)))
        response = await gql_client.execute(
            query=self._GRANT, variables={"input": self._input(uid, role_gid)}
        )
        assert response.errors is not None
        assert "manage-access" in str(response.errors)
        # Nothing was written.
        assert await self._tag_grants(db, uid) == []


class TestResourceTagsQuery:
    """The resourceTags query — the read-back for setResourceTag / removeResourceTag."""

    _QUERY = """
      query($objectType: AccessObjectType!, $objectId: ID!) {
        resourceTags(objectType: $objectType, objectId: $objectId) { key value }
      }
    """

    async def test_lists_an_objects_tags_sorted_by_key(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            pid = await _project(session, "p")
            # Insert out of key order to prove the query sorts.
            session.add_all(
                [
                    models.ResourceTag(
                        object_type=OBJECT_TYPE_PROJECT, object_id=pid, key="tier", value="gold"
                    ),
                    models.ResourceTag(
                        object_type=OBJECT_TYPE_PROJECT, object_id=pid, key="env", value="prod"
                    ),
                ]
            )
            await session.flush()
        response = await gql_client.execute(
            query=self._QUERY,
            variables={"objectType": "PROJECT", "objectId": str(GlobalID("Project", str(pid)))},
        )
        assert not response.errors
        assert response.data is not None
        assert response.data["resourceTags"] == [
            {"key": "env", "value": "prod"},
            {"key": "tier", "value": "gold"},
        ]

    async def test_empty_when_object_has_no_tags(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            pid = await _project(session, "p")
        response = await gql_client.execute(
            query=self._QUERY,
            variables={"objectType": "PROJECT", "objectId": str(GlobalID("Project", str(pid)))},
        )
        assert not response.errors
        assert response.data is not None
        assert response.data["resourceTags"] == []

    async def test_unknown_object_is_rejected(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            pid = await _project(session, "p")
        response = await gql_client.execute(
            query=self._QUERY,
            # A well-formed Project id that names no row.
            variables={
                "objectType": "PROJECT",
                "objectId": str(GlobalID("Project", str(pid + 10_000))),
            },
        )
        assert response.errors is not None
        assert "Unknown Project" in str(response.errors)


class TestTagGrantsQuery:
    """The tagGrants query — the read-back for grantTagAccess / revokeTagAccess."""

    _QUERY = """
      query($objectType: AccessObjectType) {
        tagGrants(objectType: $objectType) {
          subjectKind subjectId subjectName objectType tagKey tagValue roleName
        }
      }
    """

    async def test_lists_tag_grants_with_subject_and_role(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            uid = await _local_user(session)
            email = await session.scalar(select(models.User.email).where(models.User.id == uid))
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
            session.add(
                models.AccessGrant(
                    subject_kind=_USER,
                    subject_id=uid,
                    role_id=viewer.id,
                    object_type=OBJECT_TYPE_DATASET,
                    object_id=None,
                    selector_kind="tag",
                    tag_key="env",
                    tag_value="prod",
                    effect="allow",
                )
            )
            await session.flush()
        response = await gql_client.execute(query=self._QUERY, variables={"objectType": None})
        assert not response.errors
        assert response.data is not None
        # subjectName resolves the subject to a display name (here, the user's email).
        assert response.data["tagGrants"] == [
            {
                "subjectKind": "USER",
                "subjectId": str(GlobalID("User", str(uid))),
                "subjectName": email,
                "objectType": "DATASET",
                "tagKey": "env",
                "tagValue": "prod",
                "roleName": viewer.name,
            }
        ]

    async def test_object_type_filter_excludes_other_types(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            uid = await _local_user(session)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
            session.add_all(
                [
                    models.AccessGrant(
                        subject_kind=_USER,
                        subject_id=uid,
                        role_id=viewer.id,
                        object_type=OBJECT_TYPE_DATASET,
                        object_id=None,
                        selector_kind="tag",
                        tag_key="env",
                        tag_value="prod",
                        effect="allow",
                    ),
                    models.AccessGrant(
                        subject_kind=_USER,
                        subject_id=uid,
                        role_id=viewer.id,
                        object_type=OBJECT_TYPE_PROJECT,
                        object_id=None,
                        selector_kind="tag",
                        tag_key="env",
                        tag_value="prod",
                        effect="allow",
                    ),
                ]
            )
            await session.flush()
        response = await gql_client.execute(query=self._QUERY, variables={"objectType": "PROJECT"})
        assert not response.errors
        assert response.data is not None
        assert [g["objectType"] for g in response.data["tagGrants"]] == ["PROJECT"]

    async def test_ordinary_id_grants_are_not_listed(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        # tagGrants must show tag-selector grants only; an ordinary id grant carries no
        # tag_key/tag_value and belongs to access_grants, not here.
        async with db() as session:
            pid = await _project(session, "p")
            uid = await _local_user(session)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
            session.add(
                _grant(
                    subject_id=uid,
                    role_id=viewer.id,
                    object_type=OBJECT_TYPE_PROJECT,
                    object_id=pid,
                )
            )
            await session.flush()
        response = await gql_client.execute(query=self._QUERY, variables={"objectType": None})
        assert not response.errors
        assert response.data is not None
        assert response.data["tagGrants"] == []


class TestGrantAccessDowngradeEndToEnd:
    """The last-manager guard must fire through the schema, not just at the helper."""

    _GRANT = """
      mutation($input: AccessGrantInput!) {
        grantAccess(input: $input) { query { __typename } }
      }
    """

    async def test_downgrading_the_last_manager_is_rejected(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            pid = await _project(session, "p")
            uid = await _local_user(session)
            manager = await _permission_set(session, Permission.OBJ_MANAGE_ACCESS)
            viewer = await _permission_set(session, Permission.OBJ_VIEW)
            # Seed the subject as the project's sole manager.
            session.add(
                _grant(
                    subject_id=uid,
                    role_id=manager.id,
                    object_type=OBJECT_TYPE_PROJECT,
                    object_id=pid,
                )
            )
            await session.flush()
        variables = {
            "input": {
                "subject": {"userId": str(GlobalID("User", str(uid)))},
                "object": {"projectId": str(GlobalID("Project", str(pid)))},
                "permissionSetId": str(GlobalID("PermissionSet", str(viewer.id))),
            }
        }
        response = await gql_client.execute(query=self._GRANT, variables=variables)
        assert response.errors is not None
        assert "last manager" in str(response.errors)
        # The grant was not downgraded — it remains a manager.
        async with db() as session:
            role_id = await session.scalar(
                select(models.AccessGrant.role_id).where(
                    models.AccessGrant.subject_id == uid,
                    models.AccessGrant.object_type == OBJECT_TYPE_PROJECT,
                    models.AccessGrant.object_id == pid,
                )
            )
        assert role_id == manager.id
