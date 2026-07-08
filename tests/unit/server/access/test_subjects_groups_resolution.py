from secrets import token_bytes, token_hex

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.access import (
    Permission,
    Subject,
    SubjectKind,
    permissions_for_user_id,
    subjects_for_user,
    sync_user_groups,
)
from phoenix.server.types import DbSessionFactory


async def _role(session: AsyncSession, name: str, permissions: set[str]) -> int:
    role = models.UserRole(name=name)
    session.add(role)
    await session.flush()
    for permission in permissions:
        session.add(models.RolePermission(user_role_id=role.id, permission=permission))
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


class TestSyncUserGroups:
    async def test_creates_groups_and_memberships(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_id = await _user(session, await _role(session, "MEMBER", {"read"}))
            await sync_user_groups(
                session,
                user_id=user_id,
                provider="oauth2:acme",
                group_keys=["engineering", "all-staff"],
            )
        async with db() as session:
            groups = {
                g.group_key: g.provider for g in await session.scalars(select(models.UserGroup))
            }
            memberships = (await session.scalars(select(models.UserGroupMembership.user_id))).all()
        assert groups == {"engineering": "oauth2:acme", "all-staff": "oauth2:acme"}
        assert memberships == [user_id, user_id]

    async def test_reconciles_added_and_removed(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_id = await _user(session, await _role(session, "MEMBER", {"read"}))
            await sync_user_groups(session, user_id=user_id, provider="ldap", group_keys=["a", "b"])
        async with db() as session:
            # User left "b", joined "c".
            await sync_user_groups(session, user_id=user_id, provider="ldap", group_keys=["a", "c"])
        async with db() as session:
            keys = {
                g.group_key
                for g in await session.scalars(
                    select(models.UserGroup)
                    .join(models.UserGroupMembership)
                    .where(models.UserGroupMembership.user_id == user_id)
                )
            }
        assert keys == {"a", "c"}

    async def test_provider_isolation(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_id = await _user(session, await _role(session, "MEMBER", {"read"}))
            await sync_user_groups(
                session, user_id=user_id, provider="oauth2:acme", group_keys=["x"]
            )
            await sync_user_groups(session, user_id=user_id, provider="ldap", group_keys=["y"])
        async with db() as session:
            # Re-syncing one provider must not disturb memberships from another.
            await sync_user_groups(session, user_id=user_id, provider="oauth2:acme", group_keys=[])
        async with db() as session:
            keys = {
                g.group_key
                for g in await session.scalars(
                    select(models.UserGroup)
                    .join(models.UserGroupMembership)
                    .where(models.UserGroupMembership.user_id == user_id)
                )
            }
        assert keys == {"y"}


class TestSubjectsForUser:
    async def test_includes_user_and_groups(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_id = await _user(session, await _role(session, "MEMBER", {"read"}))
            await sync_user_groups(
                session, user_id=user_id, provider="ldap", group_keys=["g1", "g2"]
            )
        async with db() as session:
            subjects = await subjects_for_user(session, user_id)
        assert Subject(SubjectKind.USER, user_id) in subjects
        group_subjects = [s for s in subjects if s.kind is SubjectKind.GROUP]
        assert len(group_subjects) == 2


class TestPermissionsForUserId:
    async def test_resolves_role_bundle(self, db: DbSessionFactory) -> None:
        async with db() as session:
            role_id = await _role(session, "MEMBER", {"read", "write"})
            user_id = await _user(session, role_id)
        async with db() as session:
            perms = await permissions_for_user_id(session, user_id)
        assert perms == {Permission.READ, Permission.WRITE}

    async def test_permission_edit_takes_effect(self, db: DbSessionFactory) -> None:
        async with db() as session:
            role_id = await _role(session, "MEMBER", {"read", "write"})
            user_id = await _user(session, role_id)
        async with db() as session:
            # An admin removes write from the role.
            await session.execute(
                delete(models.RolePermission).where(
                    models.RolePermission.user_role_id == role_id,
                    models.RolePermission.permission == "write",
                )
            )
        async with db() as session:
            perms = await permissions_for_user_id(session, user_id)
        # Resolved live: the edit is visible without reissuing the user's token.
        assert perms == {Permission.READ}

    async def test_deleted_user_holds_nothing(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_id = await _user(session, await _role(session, "MEMBER", {"read"}))
            await session.execute(delete(models.User).where(models.User.id == user_id))
        async with db() as session:
            perms = await permissions_for_user_id(session, user_id)
        assert perms == frozenset()

    async def test_unknown_permission_string_is_ignored(self, db: DbSessionFactory) -> None:
        async with db() as session:
            role_id = await _role(session, "MEMBER", {"read"})
            session.add(models.RolePermission(user_role_id=role_id, permission="teleport"))
            await session.flush()
            user_id = await _user(session, role_id)
        async with db() as session:
            perms = await permissions_for_user_id(session, user_id)
        # A permission this server doesn't know grants nothing here (fails closed).
        assert perms == {Permission.READ}


class TestObjectPermissionsForGrantRole:
    async def _role(self, session: AsyncSession, name: str, perms: set[str]) -> int:
        role = models.PermissionSet(name=name, is_built_in=False)
        session.add(role)
        await session.flush()
        for perm in perms:
            session.add(models.PermissionSetItem(permission_set_id=role.id, permission=perm))
        await session.flush()
        return role.id

    async def test_none_role_is_view_only(self, db: DbSessionFactory) -> None:
        from phoenix.server.access import object_permissions_for_grant_role

        async with db() as session:
            perms = await object_permissions_for_grant_role(session, None)
        assert perms == {Permission.OBJ_VIEW}

    async def test_resolves_role_permissions(self, db: DbSessionFactory) -> None:
        from phoenix.server.access import object_permissions_for_grant_role

        async with db() as session:
            role_id = await self._role(session, "Editor", {"obj_view", "obj_edit"})
        async with db() as session:
            perms = await object_permissions_for_grant_role(session, role_id)
        assert perms == {Permission.OBJ_VIEW, Permission.OBJ_EDIT}

    async def test_replacing_permissions_has_no_unique_conflict(self, db: DbSessionFactory) -> None:
        # The pattern the patch mutation relies on: delete-then-add lets a role keep
        # a permission it already had without tripping the unique constraint.

        async with db() as session:
            role_id = await self._role(session, "R", {"obj_view", "obj_edit"})
        async with db() as session:
            await session.execute(
                delete(models.PermissionSetItem).where(
                    models.PermissionSetItem.permission_set_id == role_id
                )
            )
            await session.flush()
            session.add_all(
                models.PermissionSetItem(permission_set_id=role_id, permission=p)
                for p in ("obj_view", "obj_manage_access")
            )
            await session.flush()
        async with db() as session:
            from phoenix.server.access import object_permissions_for_grant_role

            perms = await object_permissions_for_grant_role(session, role_id)
        assert perms == {Permission.OBJ_VIEW, Permission.OBJ_MANAGE_ACCESS}
