from secrets import token_bytes

from _pytest.monkeypatch import MonkeyPatch
from sqlalchemy import select

from phoenix.config import ENV_PHOENIX_ADMINS
from phoenix.db import models
from phoenix.db.enums import UserRole
from phoenix.db.facilitator import _ensure_admins, _ensure_enums
from phoenix.server.types import DbSessionFactory


class TestEnsureStartupAdmins:
    async def test_ensure_startup_admins(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
    ) -> None:
        monkeypatch.setenv(
            ENV_PHOENIX_ADMINS,
            (
                "Washington, George, Jr.=george@example.com;"
                "Franklin, Benjamin=benjamin@example.com;"
                "Jefferson, Thomas=thomas@example.com"
            ),
        )
        # Initialize the enum values in the database
        async with db() as session:
            await _ensure_enums(session)
        # Create existing users (not admins) for the test
        async with db() as session:
            # Fetch role IDs
            admin_role_id = await session.scalar(
                select(models.UserRole.id).filter_by(name=UserRole.ADMIN.value)
            )
            member_role_id = await session.scalar(
                select(models.UserRole.id).filter_by(name=UserRole.MEMBER.value)
            )
            # Create users with MEMBER role (not ADMIN)
            existing_users = {
                "george@example.com": models.User(
                    email="george@example.com",
                    username="George",
                    user_role_id=member_role_id,
                    reset_password=False,
                    password_hash=token_bytes(32),
                    password_salt=token_bytes(32),
                ),
                "thomas@example.com": models.User(
                    email="thomas@example.com",
                    username="Thomas",
                    user_role_id=member_role_id,
                    reset_password=False,
                    password_hash=token_bytes(32),
                    password_salt=token_bytes(32),
                ),
            }
            session.add_all(existing_users.values())
            await session.flush()
        async with db() as session:
            await _ensure_admins(session)
        async with db() as session:
            users = {user.email: user for user in await session.scalars(select(models.User))}
        assert len(users) == 3
        # Verify existing users were not modified
        for email, existing_user in existing_users.items():
            user = users.pop(email)
            assert user.email == existing_user.email
            assert user.username == existing_user.username
            assert user.user_role_id == existing_user.user_role_id
            assert user.reset_password == existing_user.reset_password
            assert user.password_hash == existing_user.password_hash
            assert user.password_salt == existing_user.password_salt
        # Verify new admin user was properly created
        user = users.pop("benjamin@example.com")
        assert not users, "There should be no other users in the database"
        assert user.username == "Franklin, Benjamin"
        assert user.user_role_id == admin_role_id
        assert user.reset_password
