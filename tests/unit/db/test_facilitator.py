from pathlib import Path
from secrets import token_bytes, token_hex
from typing import Any

import pytest
import sqlalchemy as sa
from _pytest.monkeypatch import MonkeyPatch
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from phoenix.config import ENV_PHOENIX_ADMINS
from phoenix.db import models
from phoenix.db.enums import ENUM_COLUMNS
from phoenix.db.facilitator import (
    _ensure_admins,
    _ensure_default_project_trace_retention_policy,
    _ensure_enums,
    _ensure_model_costs,
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


class TestEnsureModelCosts:
    @pytest.fixture
    def _patch_manifest(
        self,
        tmp_path: Path,
        monkeypatch: MonkeyPatch,
    ) -> Path:
        """Create empty manifest file and patch the global variable."""
        import json

        manifest_file = tmp_path / "test_model_cost_manifest.json"
        manifest_file.write_text(json.dumps({"models": []}))

        # Monkey patch the global variable to point to our test file
        from phoenix.db import facilitator

        monkeypatch.setattr(facilitator, "_COST_MODEL_MANIFEST", manifest_file)
        return manifest_file

    async def _get_models(
        self,
        db: DbSessionFactory,
        is_built_in: bool,
    ) -> dict[str, models.GenerativeModel]:
        """Fetch GenerativeModels from database with token prices eagerly loaded."""
        async with db() as session:
            result = await session.scalars(
                select(models.GenerativeModel)
                .where(models.GenerativeModel.deleted_at.is_(None))
                .where(models.GenerativeModel.is_built_in.is_(is_built_in))
                .options(joinedload(models.GenerativeModel.token_prices))
            )
        return {model.name: model for model in result.unique()}

    def _extract_token_prices(self, model: models.GenerativeModel) -> dict[tuple[str, bool], float]:
        """Extract token prices as a comparable dictionary."""
        return {(tp.token_type, tp.is_prompt): tp.base_rate for tp in model.token_prices}

    async def _get_deleted_model_names(self, db: DbSessionFactory) -> set[str]:
        """Get names of soft-deleted built-in models."""
        async with db() as session:
            deleted_models = await session.scalars(
                select(models.GenerativeModel)
                .where(models.GenerativeModel.deleted_at.isnot(None))
                .where(models.GenerativeModel.is_built_in.is_(True))
            )
            return {model.name for model in deleted_models}

    def _update_manifest(self, manifest_path: Path, models: list[dict[str, Any]]) -> None:
        """Update manifest file with new data."""
        import json

        manifest_path.write_text(json.dumps({"models": models}, indent=2))

    async def test_ensure_model_costs(
        self,
        _patch_manifest: Path,
        db: DbSessionFactory,
    ) -> None:
        """
        Comprehensive test of _ensure_model_costs function covering:
        1. Empty manifest (no models created)
        2. Model creation from manifest
        3. Model updates (name_pattern, token prices)
        4. Token price additions and removals
        5. Model cleanup (soft deletion of obsolete models)
        """

        # Initialize enums first
        await _ensure_enums(db)

        # === STEP 1: Empty manifest ===
        built_in_models = await self._get_models(db, is_built_in=True)
        assert not built_in_models, "There should be no built-in models initially"
        user_defined_models = await self._get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        await _ensure_model_costs(db)
        built_in_models = await self._get_models(db, is_built_in=True)
        assert not built_in_models, "There should be no built-in models because manifest is empty"
        user_defined_models = await self._get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # === STEP 2: Create new models ===
        initial_manifest: list[dict[str, Any]] = [
            {
                "name": "test-model-1",
                "name_pattern": r"(?i)^(test-model-1)$",
                "token_prices": [
                    {
                        "base_rate": 0.000001,
                        "is_prompt": True,
                        "token_type": "input",
                    },
                    {
                        "base_rate": 0.000002,
                        "is_prompt": False,
                        "token_type": "output",
                    },
                    {
                        "base_rate": 0.0000001,
                        "is_prompt": True,
                        "token_type": "cache_write",
                    },
                    {
                        "base_rate": 0.0000005,
                        "is_prompt": True,
                        "token_type": "cache_read",
                    },
                    {
                        "base_rate": 0.000003,
                        "is_prompt": True,
                        "token_type": "audio",
                    },
                    {
                        "base_rate": 0.000003,
                        "is_prompt": False,
                        "token_type": "audio",
                    },
                ],
            },
            {
                "name": "test-model-2",
                "name_pattern": r"(?i)^(test-model-2|alt-name-2)$",
                "token_prices": [
                    {
                        "base_rate": 0.000005,
                        "is_prompt": True,
                        "token_type": "input",
                    },
                    {
                        "base_rate": 0.000010,
                        "is_prompt": False,
                        "token_type": "output",
                    },
                ],
            },
        ]
        self._update_manifest(_patch_manifest, initial_manifest)

        await _ensure_model_costs(db)
        built_in_models = await self._get_models(db, is_built_in=True)
        assert len(built_in_models) == 2, "Should have created 2 models"
        user_defined_models = await self._get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify model 1 details
        model1 = built_in_models["test-model-1"]
        assert model1.name_pattern.pattern == r"(?i)^(test-model-1)$"
        assert model1.is_built_in is True
        assert model1.deleted_at is None

        # Check token prices for model 1 (should have all types)
        actual_prices_1 = self._extract_token_prices(model1)
        expected_prices_1 = {
            ("input", True): 0.000001,
            ("output", False): 0.000002,
            ("cache_write", True): 0.0000001,
            ("cache_read", True): 0.0000005,
            ("audio", True): 0.000003,
            ("audio", False): 0.000003,  # Audio appears for both prompt and non-prompt
        }
        assert (
            actual_prices_1 == expected_prices_1
        ), f"Model 1 token prices mismatch: got {actual_prices_1}, expected {expected_prices_1}"

        # Verify model 2 details (minimal pricing)
        model2 = built_in_models["test-model-2"]
        assert model2.name_pattern.pattern == r"(?i)^(test-model-2|alt-name-2)$"

        actual_prices_2 = self._extract_token_prices(model2)
        expected_prices_2 = {
            ("input", True): 0.000005,
            ("output", False): 0.000010,
        }
        assert (
            actual_prices_2 == expected_prices_2
        ), f"Model 2 token prices mismatch: got {actual_prices_2}, expected {expected_prices_2}"

        # === STEP 3: Update existing models ===
        # Update model 1: change name_pattern and some prices
        # Update model 2: add cache prices
        # Add model 3: audio-only model
        updated_manifest: list[dict[str, Any]] = [
            {
                "name": "test-model-1",
                "name_pattern": r"(?i)^(test-model-1|new-alias)$",  # Changed name_pattern
                "token_prices": [
                    {
                        "base_rate": 0.000002,
                        "is_prompt": True,
                        "token_type": "input",
                    },  # Changed price
                    {
                        "base_rate": 0.000002,
                        "is_prompt": False,
                        "token_type": "output",
                    },  # Same price
                    {
                        "base_rate": 0.000001,
                        "is_prompt": True,
                        "token_type": "cache_read",
                    },  # Changed price
                    {
                        "base_rate": 0.000005,
                        "is_prompt": True,
                        "token_type": "audio",
                    },  # Changed price
                    {
                        "base_rate": 0.000005,
                        "is_prompt": False,
                        "token_type": "audio",
                    },  # Changed price
                    # cache_write removed
                ],
            },
            {
                "name": "test-model-2",
                "name_pattern": r"(?i)^(test-model-2|alt-name-2)$",  # Same
                "token_prices": [
                    {
                        "base_rate": 0.000005,
                        "is_prompt": True,
                        "token_type": "input",
                    },  # Same
                    {
                        "base_rate": 0.000015,
                        "is_prompt": False,
                        "token_type": "output",
                    },  # Changed
                    {
                        "base_rate": 0.000001,
                        "is_prompt": True,
                        "token_type": "cache_write",
                    },  # Added
                    {
                        "base_rate": 0.000002,
                        "is_prompt": True,
                        "token_type": "cache_read",
                    },  # Added
                ],
            },
            {
                "name": "audio-model",
                "name_pattern": r"(?i)^(audio-model)$",
                "token_prices": [
                    {
                        "base_rate": 0.000008,
                        "is_prompt": True,
                        "token_type": "audio",
                    },  # Audio-only pricing
                    {
                        "base_rate": 0.000008,
                        "is_prompt": False,
                        "token_type": "audio",
                    },
                ],
            },
        ]
        self._update_manifest(_patch_manifest, updated_manifest)

        await _ensure_model_costs(db)
        built_in_models = await self._get_models(db, is_built_in=True)
        assert len(built_in_models) == 3, "Should have 3 models after update"
        user_defined_models = await self._get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify model 1 updates
        model1_updated = built_in_models["test-model-1"]
        assert model1_updated.name_pattern.pattern == r"(?i)^(test-model-1|new-alias)$"

        actual_prices_1_updated = self._extract_token_prices(model1_updated)
        expected_prices_1_updated = {
            ("input", True): 0.000002,  # Changed
            ("output", False): 0.000002,  # Same
            ("cache_read", True): 0.000001,  # Changed
            ("audio", True): 0.000005,  # Changed
            ("audio", False): 0.000005,  # Changed
            # cache_write should be removed
        }
        assert (
            actual_prices_1_updated == expected_prices_1_updated
        ), f"Model 1 updated prices mismatch: got {actual_prices_1_updated}, expected {expected_prices_1_updated}"  # noqa: E501

        # Verify model 2 updates
        model2_updated = built_in_models["test-model-2"]
        actual_prices_2_updated = self._extract_token_prices(model2_updated)
        expected_prices_2_updated = {
            ("input", True): 0.000005,  # Same
            ("output", False): 0.000015,  # Changed
            ("cache_write", True): 0.000001,  # Added
            ("cache_read", True): 0.000002,  # Added
        }
        assert (
            actual_prices_2_updated == expected_prices_2_updated
        ), f"Model 2 updated prices mismatch: got {actual_prices_2_updated}, expected {expected_prices_2_updated}"  # noqa: E501

        # Verify new audio model
        audio_model = built_in_models["audio-model"]
        actual_prices_audio = self._extract_token_prices(audio_model)
        expected_prices_audio = {
            ("audio", True): 0.000008,
            ("audio", False): 0.000008,
        }
        assert (
            actual_prices_audio == expected_prices_audio
        ), f"Audio model prices mismatch: got {actual_prices_audio}, expected {expected_prices_audio}"  # noqa: E501

        # === STEP 4: Remove models (test soft deletion) ===
        # Keep only model 2, remove model 1 and audio model
        final_manifest: list[dict[str, Any]] = [
            {
                "name": "test-model-2",
                "name_pattern": r"(?i)^(final-model-2)$",  # Final name_pattern change
                "token_prices": [
                    {
                        "base_rate": 0.000010,
                        "is_prompt": True,
                        "token_type": "input",
                    },  # Final price change
                    {"base_rate": 0.000020, "is_prompt": False, "token_type": "output"},
                    {
                        "base_rate": 0.000030,
                        "is_prompt": True,
                        "token_type": "audio",
                    },  # Add audio pricing
                    {"base_rate": 0.000030, "is_prompt": False, "token_type": "audio"},
                    # cache prices removed
                ],
            }
        ]
        self._update_manifest(_patch_manifest, final_manifest)

        await _ensure_model_costs(db)

        # Check active built-in models
        active_models = await self._get_models(db, is_built_in=True)
        assert len(active_models) == 1, "Should have only 1 active model"
        assert "test-model-2" in active_models, "Model 2 should still be active"
        user_defined_models = await self._get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify final model 2 state
        final_model2 = active_models["test-model-2"]
        assert final_model2.name_pattern.pattern == r"(?i)^(final-model-2)$"

        actual_prices_final = self._extract_token_prices(final_model2)
        expected_prices_final = {
            ("input", True): 0.000010,
            ("output", False): 0.000020,
            ("audio", True): 0.000030,
            ("audio", False): 0.000030,
        }
        assert (
            actual_prices_final == expected_prices_final
        ), f"Final model prices mismatch: got {actual_prices_final}, expected {expected_prices_final}"  # noqa: E501

        # Verify soft deletion of removed models
        deleted_model_names = await self._get_deleted_model_names(db)
        expected_deleted = {"test-model-1", "audio-model"}
        assert (
            deleted_model_names == expected_deleted
        ), f"Wrong models deleted: got {deleted_model_names}, expected {expected_deleted}"

        # === STEP 5: Empty manifest again (cleanup all) ===
        self._update_manifest(_patch_manifest, [])
        await _ensure_model_costs(db)

        final_active_models = await self._get_models(db, is_built_in=True)
        assert not final_active_models, "All models should be soft-deleted"
        user_defined_models = await self._get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify all models are now soft-deleted
        all_deleted_names = await self._get_deleted_model_names(db)
        expected_all_deleted = {"test-model-1", "test-model-2", "audio-model"}
        assert (
            all_deleted_names == expected_all_deleted
        ), f"All models should be deleted: got {all_deleted_names}, expected {expected_all_deleted}"  # noqa: E501
