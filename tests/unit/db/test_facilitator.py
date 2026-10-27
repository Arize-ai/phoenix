import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from secrets import token_bytes, token_hex
from threading import Event
from typing import Any

import pytest
import sqlalchemy as sa
from _pytest.monkeypatch import MonkeyPatch
from pydantic import SecretStr
from sqlalchemy import select
from starlette.types import ASGIApp

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    compute_password_hash,
    is_valid_password,
)
from phoenix.db import models
from phoenix.db.enums import ENUM_COLUMNS
from phoenix.db.facilitator import (
    PHOENIX_CLI_OAUTH2_CLIENT_ID,
    PHOENIX_CLI_OAUTH2_REDIRECT_URIS,
    USER_FEEDBACK_ANNOTATION_NAME,
    Facilitator,
    _ensure_admins,
    _ensure_default_project_trace_retention_policy,
    _ensure_enums,
    _ensure_model_costs,
    _ensure_oauth2_clients,
    _ensure_user_roles,
)
from phoenix.db.types.trace_retention import (
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.cost_tracking.apply_manifest import get_applied_manifest_version
from phoenix.server.cost_tracking.manifest import SUPPORTED_SCHEMA_VERSION
from phoenix.server.types import DbSessionFactory
from tests.unit.server.cost_tracking.test_apply_manifest import (
    _active_built_in_prices,
    _apply,
    _manifest,
    _manifest_date,
    _manifest_model,
)

# These tests exercise seeding from an empty database, so they opt out of the
# seeded template every other test's database comes from.
pytestmark = pytest.mark.pristine_db


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


class TestEnsureEnums:
    async def test_ensure_enums(
        self,
        db: DbSessionFactory,
    ) -> None:
        await _ensure_enums(db)
        for column in ENUM_COLUMNS:
            assert isinstance(column.type, sa.Enum)
            async with db() as session:
                actual = await session.scalars(select(column))
            assert sorted(actual) == sorted(column.type.enums)


class TestEnsureUserRoles:
    async def test_applies_initial_password_to_existing_unchanged_default_admin(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        monkeypatch.delenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", raising=False)
        await _ensure_enums(db)
        await _ensure_user_roles(db)
        await _ensure_oauth2_clients(db)

        async with db() as session:
            admin = await session.scalar(
                select(models.LocalUser).where(models.LocalUser.email == DEFAULT_ADMIN_EMAIL)
            )
            cli_client_id = await session.scalar(
                select(models.OAuth2Client.id).where(
                    models.OAuth2Client.client_id == PHOENIX_CLI_OAUTH2_CLIENT_ID
                )
            )
            assert admin is not None
            assert cli_client_id is not None
            assert admin.reset_password is True
            assert admin.password_salt is not None and admin.password_hash is not None
            assert is_valid_password(
                password=SecretStr(DEFAULT_ADMIN_PASSWORD),
                salt=admin.password_salt,
                password_hash=admin.password_hash,
            )
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
            session.add(models.PasswordResetToken(user_id=admin.id, expires_at=expires_at))
            # A session opened with the public password before the replacement.
            refresh_token = models.RefreshToken(user_id=admin.id, expires_at=expires_at)
            session.add(refresh_token)
            await session.flush()
            session.add(
                models.AccessToken(
                    user_id=admin.id,
                    expires_at=expires_at,
                    refresh_token_id=refresh_token.id,
                )
            )
            session.add(models.ApiKey(user_id=admin.id, name="existing-key"))
            # An OAuth2 grant and an unredeemed authorization code obtained the same way.
            session.add(models.OAuth2Grant(user_id=admin.id, oauth2_client_id=cli_client_id))
            session.add(
                models.OAuth2AuthorizationCode(
                    code_hash=token_hex(16),
                    user_id=admin.id,
                    oauth2_client_id=cli_client_id,
                    redirect_uri=PHOENIX_CLI_OAUTH2_REDIRECT_URIS[0],
                    code_challenge=token_hex(16),
                    code_challenge_method="S256",
                    expires_at=expires_at,
                )
            )

        monkeypatch.setenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", "upgraded-initial-secret")
        with caplog.at_level("INFO", logger="phoenix.db.facilitator"):
            await _ensure_user_roles(db)
        assert "Applied PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD" in caplog.text

        async with db() as session:
            admin = await session.scalar(
                select(models.LocalUser).where(models.LocalUser.email == DEFAULT_ADMIN_EMAIL)
            )
            reset_token = await session.scalar(select(models.PasswordResetToken))
            refresh_tokens = (await session.scalars(select(models.RefreshToken))).all()
            access_tokens = (await session.scalars(select(models.AccessToken))).all()
            api_key_names = (await session.scalars(select(models.ApiKey.name))).all()
            authorization_codes = (
                await session.scalars(select(models.OAuth2AuthorizationCode))
            ).all()
            grant_revoked_ats = (await session.scalars(select(models.OAuth2Grant.revoked_at))).all()
        assert admin is not None
        assert admin.reset_password is True
        assert admin.password_salt is not None and admin.password_hash is not None
        assert is_valid_password(
            password=SecretStr("upgraded-initial-secret"),
            salt=admin.password_salt,
            password_hash=admin.password_hash,
        )
        assert reset_token is None
        assert refresh_tokens == []
        assert access_tokens == []
        # A password reset leaves API keys in place, and so does the replacement.
        assert api_key_names == ["existing-key"]
        assert authorization_codes == []
        assert len(grant_revoked_ats) == 1 and grant_revoked_ats[0] is not None

        # Once customized, a subsequent change to PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD
        # does not overwrite the password.
        monkeypatch.setenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", "different-secret")
        await _ensure_user_roles(db)

        async with db() as session:
            admin = await session.scalar(
                select(models.LocalUser).where(models.LocalUser.email == DEFAULT_ADMIN_EMAIL)
            )
        assert admin is not None
        assert admin.password_salt is not None and admin.password_hash is not None
        assert is_valid_password(
            password=SecretStr("upgraded-initial-secret"),
            salt=admin.password_salt,
            password_hash=admin.password_hash,
        )

    @pytest.mark.parametrize("reset_password", [False, True])
    async def test_preserves_concurrent_password_change_and_reset_token(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
        reset_password: bool,
    ) -> None:
        monkeypatch.delenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", raising=False)
        await _ensure_enums(db)
        await _ensure_user_roles(db)
        monkeypatch.setenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", "bootstrap-secret")

        loop = asyncio.get_running_loop()
        verified_default_password = asyncio.Event()
        resume_bootstrap = Event()

        def verify_and_pause(*, password: SecretStr, salt: bytes, password_hash: bytes) -> bool:
            valid = is_valid_password(password=password, salt=salt, password_hash=password_hash)
            loop.call_soon_threadsafe(verified_default_password.set)
            assert resume_bootstrap.wait(timeout=10), "Bootstrap was not resumed"
            return valid

        monkeypatch.setattr("phoenix.db.facilitator.is_valid_password", verify_and_pause)
        new_salt = token_bytes(32)
        new_hash = compute_password_hash(password=SecretStr("operator-secret"), salt=new_salt)
        bootstrap = asyncio.create_task(_ensure_user_roles(db))
        try:
            async with asyncio.timeout(10):
                await verified_default_password.wait()
                async with db() as session:
                    admin = await session.scalar(
                        select(models.LocalUser).where(
                            models.LocalUser.email == DEFAULT_ADMIN_EMAIL
                        )
                    )
                    assert admin is not None
                    admin.password_salt = new_salt
                    admin.password_hash = new_hash
                    admin.reset_password = reset_password
                    reset_token = models.PasswordResetToken(
                        user_id=admin.id,
                        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
                    )
                    session.add(reset_token)
                    await session.flush()
                    reset_token_id = reset_token.id
        finally:
            resume_bootstrap.set()
            await asyncio.wait_for(bootstrap, timeout=10)

        async with db() as session:
            admin = await session.scalar(
                select(models.LocalUser).where(models.LocalUser.email == DEFAULT_ADMIN_EMAIL)
            )
            assert admin is not None
            assert admin.password_salt == new_salt
            assert admin.password_hash == new_hash
            assert admin.reset_password is reset_password
            assert await session.get(models.PasswordResetToken, reset_token_id) is not None

    async def test_does_not_overwrite_admin_after_password_reset(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
    ) -> None:
        monkeypatch.delenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", raising=False)
        await _ensure_enums(db)
        await _ensure_user_roles(db)

        async with db() as session:
            admin = await session.scalar(
                select(models.LocalUser).where(models.LocalUser.email == DEFAULT_ADMIN_EMAIL)
            )
            assert admin is not None
            admin.reset_password = False
            original_hash = admin.password_hash
            original_salt = admin.password_salt

        monkeypatch.setenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", "upgraded-initial-secret")
        await _ensure_user_roles(db)

        async with db() as session:
            admin = await session.scalar(
                select(models.LocalUser).where(models.LocalUser.email == DEFAULT_ADMIN_EMAIL)
            )
        assert admin is not None
        assert admin.reset_password is False
        assert admin.password_hash == original_hash
        assert admin.password_salt == original_salt


class TestEnsureOAuth2Clients:
    async def test_seeds_cli_with_port_agnostic_callback(
        self,
        db: DbSessionFactory,
    ) -> None:
        await _ensure_oauth2_clients(db)

        async with db() as session:
            client = await session.scalar(
                select(models.OAuth2Client).where(
                    models.OAuth2Client.client_id == PHOENIX_CLI_OAUTH2_CLIENT_ID
                )
            )

        assert client is not None
        assert client.redirect_uris == PHOENIX_CLI_OAUTH2_REDIRECT_URIS

    async def test_reconciles_existing_cli_redirect_uris(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            session.add(
                models.OAuth2Client(
                    client_id=PHOENIX_CLI_OAUTH2_CLIENT_ID,
                    name="Existing CLI",
                    redirect_uris=[],
                    grant_types=["authorization_code"],
                    token_endpoint_auth_method="none",
                    is_first_party=True,
                )
            )

        await _ensure_oauth2_clients(db)

        async with db() as session:
            client = await session.scalar(
                select(models.OAuth2Client).where(
                    models.OAuth2Client.client_id == PHOENIX_CLI_OAUTH2_CLIENT_ID
                )
            )

        assert client is not None
        assert client.name == "Existing CLI"
        assert client.grant_types == ["authorization_code"]
        assert client.redirect_uris == PHOENIX_CLI_OAUTH2_REDIRECT_URIS


class TestEnsureStartupAdmins:
    @pytest.mark.parametrize("email_sending_fails", [False, True])
    async def test_ensure_startup_admins(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
        email_sending_fails: bool,
    ) -> None:
        monkeypatch.setenv(
            "PHOENIX_ADMINS",
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
            admin_role_id = await session.scalar(select(models.UserRole.id).filter_by(name="ADMIN"))
            assert isinstance(admin_role_id, int)
            member_role_id = await session.scalar(
                select(models.UserRole.id).filter_by(name="MEMBER")
            )
            assert isinstance(member_role_id, int)
            # Create users with MEMBER role (not ADMIN)
            existing_users = {
                "george@example.com": models.LocalUser(
                    email="george@example.com",
                    username="George",
                    user_role_id=member_role_id,
                    reset_password=False,
                    password_hash=token_bytes(32),
                    password_salt=token_bytes(32),
                ),
                "thomas@example.com": models.LocalUser(
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
        assert admin_role_id is not None
        assert user.user_role_id == admin_role_id
        assert user.reset_password

    async def test_ldap_user_creation_when_basic_auth_disabled(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
    ) -> None:
        """When PHOENIX_DISABLE_BASIC_AUTH=true and LDAP is configured (no OAuth2),
        startup admins should be created as LDAP users."""
        # Configure admins and disable basic auth
        monkeypatch.setenv("PHOENIX_ADMINS", "LDAP Admin=ldap_admin@example.com")
        monkeypatch.setenv("PHOENIX_DISABLE_BASIC_AUTH", "true")

        # Configure minimal LDAP settings (required for LDAPConfig.from_env() to return non-None)
        monkeypatch.setenv("PHOENIX_LDAP_HOST", "ldap.example.com")
        monkeypatch.setenv("PHOENIX_LDAP_PORT", "389")
        monkeypatch.setenv("PHOENIX_LDAP_BIND_DN", "cn=admin,dc=example,dc=com")
        monkeypatch.setenv("PHOENIX_LDAP_BIND_PASSWORD", "secret")
        monkeypatch.setenv("PHOENIX_LDAP_USER_SEARCH_BASE_DNS", '["ou=users,dc=example,dc=com"]')
        monkeypatch.setenv("PHOENIX_LDAP_USER_SEARCH_FILTER", "(uid=%s)")
        monkeypatch.setenv(
            "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS", '[{"group_dn": "*", "role": "MEMBER"}]'
        )

        # Initialize enums and create admin
        await _ensure_enums(db)
        await _ensure_admins(db)

        # Verify LDAP user was created with correct attributes
        async with db() as session:
            user = await session.scalar(
                select(models.User).where(models.User.email == "ldap_admin@example.com")
            )
        assert user is not None
        assert user.username == "LDAP Admin"
        assert user.auth_method == "LDAP"  # LDAP users have auth_method='LDAP'
        assert user.oauth2_client_id is None  # LDAP users don't use oauth2 fields
        assert user.oauth2_user_id is None  # LDAP users don't use oauth2 fields
        assert user.ldap_unique_id is None  # NULL until first LDAP login (then set to unique_id)
        assert user.password_hash is None  # LDAP users don't have passwords
        assert user.password_salt is None

    async def test_oauth2_user_creation_when_oauth2_configured(
        self,
        db: DbSessionFactory,
        monkeypatch: MonkeyPatch,
    ) -> None:
        """When PHOENIX_DISABLE_BASIC_AUTH=true and OAuth2 is configured,
        startup admins should be created as OAuth2 users (not LDAP)."""
        # Configure admins and disable basic auth
        monkeypatch.setenv("PHOENIX_ADMINS", "OAuth2 Admin=oauth_admin@example.com")
        monkeypatch.setenv("PHOENIX_DISABLE_BASIC_AUTH", "true")

        # Configure OAuth2 (this takes priority over LDAP)
        monkeypatch.setenv("PHOENIX_OAUTH2_IDP1_CLIENT_ID", "test-client-id")
        monkeypatch.setenv("PHOENIX_OAUTH2_IDP1_CLIENT_SECRET", "test-secret")
        monkeypatch.setenv("PHOENIX_OAUTH2_IDP1_OIDC_CONFIG_URL", "https://example.com/.well-known")

        # Also configure LDAP to verify OAuth2 takes priority
        monkeypatch.setenv("PHOENIX_LDAP_HOST", "ldap.example.com")
        monkeypatch.setenv("PHOENIX_LDAP_PORT", "389")
        monkeypatch.setenv("PHOENIX_LDAP_BIND_DN", "cn=admin,dc=example,dc=com")
        monkeypatch.setenv("PHOENIX_LDAP_BIND_PASSWORD", "secret")
        monkeypatch.setenv("PHOENIX_LDAP_USER_SEARCH_BASE_DNS", '["ou=users,dc=example,dc=com"]')
        monkeypatch.setenv("PHOENIX_LDAP_USER_SEARCH_FILTER", "(uid=%s)")
        monkeypatch.setenv(
            "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS", '[{"group_dn": "*", "role": "MEMBER"}]'
        )

        # Initialize enums and create admin
        await _ensure_enums(db)
        await _ensure_admins(db)

        # Verify OAuth2 user was created (NOT LDAP)
        async with db() as session:
            user = await session.scalar(
                select(models.User).where(models.User.email == "oauth_admin@example.com")
            )
        assert user is not None
        assert user.username == "OAuth2 Admin"
        assert user.auth_method == "OAUTH2"  # Should be OAUTH2, not LDAP
        assert user.oauth2_client_id is None  # Generic OAuth2 user (no specific client)
        assert user.password_hash is None
        assert user.password_salt is None


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


def _write_manifest(path: Path, manifest_models: list[dict[str, Any]], *, day: int) -> None:
    path.write_text(
        json.dumps(
            {
                "schema_version": SUPPORTED_SCHEMA_VERSION,
                "generated_at": _manifest_date(day).isoformat(),
                "models": manifest_models,
            }
        )
    )


class TestEnsureModelCosts:
    async def test_boot_keeps_a_newer_fetched_manifest(
        self,
        tmp_path: Path,
        monkeypatch: MonkeyPatch,
        db: DbSessionFactory,
    ) -> None:
        from phoenix.db import facilitator

        bundled = tmp_path / "bundled.json"
        _write_manifest(bundled, [_manifest_model("bundled-model")], day=1)
        monkeypatch.setattr(facilitator, "_COST_MODEL_MANIFEST", bundled)
        await _ensure_enums(db)

        await _ensure_model_costs(db)
        assert await _active_built_in_prices(db) == {"bundled-model": 1e-6}

        assert await _apply(db, _manifest("bundled-model", "fetched-model", day=2, input_rate=4e-6))
        await _ensure_model_costs(db)
        assert await _active_built_in_prices(db) == {"bundled-model": 4e-6, "fetched-model": 4e-6}

        # An upgrade bundles a newer manifest, which takes over again.
        _write_manifest(bundled, [_manifest_model("bundled-model")], day=3)
        await _ensure_model_costs(db)
        assert await _active_built_in_prices(db) == {"bundled-model": 1e-6}
        async with db() as session:
            marker = await get_applied_manifest_version(session)
        assert marker is not None and marker.generated_at == _manifest_date(3)

    @pytest.mark.seeded_model_costs
    async def test_pricing_failure_is_non_fatal_while_other_steps_raise(
        self,
        tmp_path: Path,
        monkeypatch: MonkeyPatch,
        caplog: pytest.LogCaptureFixture,
        db: DbSessionFactory,
    ) -> None:
        from phoenix.db import facilitator

        broken = tmp_path / "broken.json"
        broken.write_text("not json")
        monkeypatch.setattr(facilitator, "_COST_MODEL_MANIFEST", broken)

        with caplog.at_level(logging.WARNING, logger=facilitator.__name__):
            await Facilitator(db=db)()
        assert any(
            "Failed to apply the bundled model cost manifest" in r.message for r in caplog.records
        )
        # Steps after _ensure_model_costs still ran.
        async with db() as session:
            assert (
                await session.scalar(
                    select(models.AnnotationConfig.id).where(
                        models.AnnotationConfig.name == USER_FEEDBACK_ANNOTATION_NAME
                    )
                )
                is not None
            )

        async def _fail_enums(_: DbSessionFactory) -> None:
            raise RuntimeError("db down")

        monkeypatch.setattr(facilitator, "_ensure_enums", _fail_enums)
        with pytest.raises(RuntimeError, match="db down"):
            await Facilitator(db=db)()


async def _count_built_in_models(db: DbSessionFactory) -> int:
    async with db() as session:
        count = await session.scalar(
            select(sa.func.count())
            .select_from(models.GenerativeModel)
            .where(models.GenerativeModel.is_built_in.is_(True))
        )
    return int(count or 0)


async def test_unit_test_apps_skip_model_cost_seeding(
    db: DbSessionFactory,
    asgi_app: ASGIApp,
) -> None:
    """The suite-wide stub is in force: app startup leaves the built-in model
    table empty."""
    assert await _count_built_in_models(db) == 0


@pytest.mark.seeded_model_costs
async def test_marker_seeds_model_costs_during_startup(
    db: DbSessionFactory,
    asgi_app: ASGIApp,
) -> None:
    """Opting in leaves the real step in the Facilitator, so app startup seeds
    the manifest's built-in models."""
    assert await _count_built_in_models(db) > 0


class TestEnsureBuiltinEvaluators:
    """Tests for _ensure_builtin_evaluators function."""

    async def test_ensure_builtin_evaluators_syncs_registry_to_database(
        self,
        db: DbSessionFactory,
    ) -> None:
        """
        Test that _ensure_builtin_evaluators properly syncs the in-memory
        builtin evaluator registry to the database.
        """
        from phoenix.db.facilitator import _ensure_builtin_evaluators
        from phoenix.server.evaluators.runtime.builtin import get_builtin_evaluators

        # First ensure enums exist (required for evaluator kinds)
        await _ensure_enums(db)

        # Initially, there should be no builtin evaluators in the database
        async with db() as session:
            base_evaluators = list(
                await session.scalars(
                    select(models.Evaluator).where(models.Evaluator.kind == "BUILTIN")
                )
            )
            builtin_evaluators = list(await session.scalars(select(models.BuiltinEvaluator)))
        assert len(base_evaluators) == 0, "No builtin evaluators should exist initially"
        assert len(builtin_evaluators) == 0, "No builtin evaluator records should exist initially"

        # Sync builtin evaluators
        await _ensure_builtin_evaluators(db)

        # Verify all builtin evaluators from registry are now in the database
        registry_evaluators = list(get_builtin_evaluators())
        expected_count = len(registry_evaluators)

        async with db() as session:
            base_evaluators = list(
                await session.scalars(
                    select(models.Evaluator).where(models.Evaluator.kind == "BUILTIN")
                )
            )
            builtin_evaluators = list(await session.scalars(select(models.BuiltinEvaluator)))

        assert len(base_evaluators) == expected_count, (
            f"Expected {expected_count} base evaluator records, got {len(base_evaluators)}"
        )
        assert len(builtin_evaluators) == expected_count, (
            f"Expected {expected_count} builtin evaluator records, got {len(builtin_evaluators)}"
        )

        # Verify that all registry keys are present in the database
        registry_keys = {key for key, _ in registry_evaluators}
        db_builtin_keys = {e.key for e in builtin_evaluators}

        assert registry_keys == db_builtin_keys, (
            f"Builtin evaluator keys mismatch: registry={registry_keys}, db={db_builtin_keys}"
        )

        # Verify that base evaluators and builtin evaluators have matching IDs
        db_base_ids = {e.id for e in base_evaluators}
        db_builtin_ids = {e.id for e in builtin_evaluators}
        assert db_base_ids == db_builtin_ids, (
            f"Base and builtin evaluator IDs should match: base={db_base_ids}, builtin={db_builtin_ids}"
        )

    async def test_ensure_builtin_evaluators_is_idempotent(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Test that calling _ensure_builtin_evaluators multiple times is idempotent."""
        from phoenix.db.facilitator import _ensure_builtin_evaluators
        from phoenix.server.evaluators.runtime.builtin import get_builtin_evaluators

        await _ensure_enums(db)

        # Call sync multiple times
        for _ in range(3):
            await _ensure_builtin_evaluators(db)

        # Verify count matches registry exactly
        registry_count = len(list(get_builtin_evaluators()))
        async with db() as session:
            builtin_count = await session.scalar(
                select(sa.func.count()).select_from(models.BuiltinEvaluator)
            )
        assert builtin_count == registry_count, (
            f"Expected {registry_count} builtin evaluators after multiple syncs, got {builtin_count}"
        )


class TestEnsureUserFeedbackAnnotationConfig:
    async def test_ensure_user_feedback_annotation_config_seeds_if_absent(
        self,
        db: DbSessionFactory,
    ) -> None:
        from phoenix.db.facilitator import _ensure_user_feedback_annotation_config
        from phoenix.db.types.annotation_configs import (
            CategoricalAnnotationConfig,
            OptimizationDirection,
        )

        await _ensure_user_feedback_annotation_config(db)

        async with db() as session:
            annotation_config = await session.scalar(
                select(models.AnnotationConfig).where(
                    models.AnnotationConfig.name == "user_feedback"
                )
            )

        assert annotation_config is not None
        assert isinstance(annotation_config.config, CategoricalAnnotationConfig)
        assert annotation_config.config.optimization_direction == OptimizationDirection.MAXIMIZE
        assert [(value.label, value.score) for value in annotation_config.config.values] == [
            ("positive", 1.0),
            ("negative", 0.0),
        ]

    async def test_ensure_user_feedback_annotation_config_leaves_existing_config_unchanged(
        self,
        db: DbSessionFactory,
    ) -> None:
        from phoenix.db.facilitator import _ensure_user_feedback_annotation_config
        from phoenix.db.types.annotation_configs import (
            AnnotationType,
            FreeformAnnotationConfig,
        )

        async with db() as session:
            session.add(
                models.AnnotationConfig(
                    name="user_feedback",
                    config=FreeformAnnotationConfig(type=AnnotationType.FREEFORM.value),
                )
            )

        await _ensure_user_feedback_annotation_config(db)

        async with db() as session:
            annotation_configs = list(
                await session.scalars(
                    select(models.AnnotationConfig).where(
                        models.AnnotationConfig.name == "user_feedback"
                    )
                )
            )

        assert len(annotation_configs) == 1
        assert isinstance(annotation_configs[0].config, FreeformAnnotationConfig)
