from secrets import token_bytes, token_hex

import pytest
import sqlalchemy as sa
from _pytest.monkeypatch import MonkeyPatch
from sqlalchemy import select

from phoenix.config import ENV_PHOENIX_ADMINS
from phoenix.db import models
from phoenix.db.enums import UserRole
from phoenix.db.facilitator import (
    _ensure_admins,
    _ensure_default_project_trace_retention_policy,
    _ensure_enums,
)
from phoenix.db.types.trace_retention import (
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.types import DbSessionFactory


class _MockWelcomeEmailSender:
    def __init__(self, email_sending_fails: bool = False) -> None:
        self.attempts: list[tuple[str, str]] = []
        self.email_sending_fails = email_sending_fails

    async def send_welcome_email(
        self,
        email: str,
        name: str,
    ) -> None:
        self.attempts.append((email, name))
        if self.email_sending_fails:
            raise RuntimeError("Failed to send email")


class TestEnsureStartupAdmins:
    @pytest.mark.parametrize("email_sending_fails", [False, True])
    async def test_ensure_startup_admins(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
        email_sending_fails: bool,
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
        await _ensure_enums(db)
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

        # Create mock email sender and ensure admins
        email_sender = _MockWelcomeEmailSender(email_sending_fails=email_sending_fails)
        await _ensure_admins(db, email_sender=email_sender)

        # Verify email sending behavior
        assert email_sender.attempts == [("benjamin@example.com", "Franklin, Benjamin")]

        # Verify database state
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


class TestEnsureDefaultProjectTraceRetentionPolicy:
    async def test_default_project_trace_retention_policy_insertion(
        self,
        db: DbSessionFactory,
    ) -> None:
        stmt = sa.select(models.ProjectTraceRetentionPolicy)
        async with db() as session:
            policies = list(await session.scalars(stmt))
        assert len(policies) == 0
        for _ in range(2):
            await _ensure_default_project_trace_retention_policy(db)
            async with db() as session:
                policies = list(await session.scalars(stmt))
            assert len(policies) == 1
        policy = policies[0]
        assert policy.id == 0
        assert policy.name == "Default"
        assert policy.cron_expression.root == "0 0 * * 0"
        assert policy.rule.root == MaxDaysRule(max_days=0)
        assert not bool(policy.rule)  # rule is dormant by default

        # Should be able to insert new policies without error. This could be an issue for postgres
        # if the default policy is inserted at id=1 without incrementing the serial so the next
        # insert would have id=1 and fail.
        policy = models.ProjectTraceRetentionPolicy(
            name=token_hex(8),
            cron_expression=TraceRetentionCronExpression(root="0 0 * * 0"),
            rule=TraceRetentionRule(root=MaxDaysRule(max_days=0)),
        )
        async with db() as session:
            session.add(policy)
            await session.flush()
        assert policy.id == 1
