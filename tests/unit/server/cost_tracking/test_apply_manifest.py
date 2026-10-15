import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from phoenix.db import models
from phoenix.db.facilitator import _ensure_enums
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.types.token_price_customization import ThresholdBasedTokenPriceCustomization
from phoenix.server.cost_tracking.apply_manifest import (
    MANIFEST_VERSION_SETTING_KEY,
    apply_manifest_if_newer,
    get_applied_manifest_version,
)
from phoenix.server.cost_tracking.manifest import (
    SUPPORTED_SCHEMA_VERSION,
    ModelCostManifest,
    parse_manifest,
)
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.types import DbSessionFactory

# These tests count the built-in models, so they start from an empty database.
pytestmark = pytest.mark.pristine_db


def _manifest_date(day: int) -> datetime:
    return datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=day)


def _manifest_of(manifest_models: list[Any], *, day: int) -> ModelCostManifest:
    """Parses a manifest of the given raw model entries, generated on the given day."""
    return parse_manifest(
        json.dumps(
            {
                "schema_version": SUPPORTED_SCHEMA_VERSION,
                "generated_at": _manifest_date(day).isoformat(),
                "models": manifest_models,
            }
        )
    )


async def _get_models(
    db: DbSessionFactory,
    is_built_in: bool,
) -> dict[str, models.GenerativeModel]:
    """Fetch active GenerativeModels from database with token prices eagerly loaded."""
    async with db() as session:
        result = await session.scalars(
            select(models.GenerativeModel)
            .where(models.GenerativeModel.deleted_at.is_(None))
            .where(models.GenerativeModel.is_built_in.is_(is_built_in))
            .options(joinedload(models.GenerativeModel.token_prices))
        )
    return {model.name: model for model in result.unique()}


def _extract_token_prices(model: models.GenerativeModel) -> dict[tuple[str, bool], float]:
    """Extract token prices as a comparable dictionary."""
    return {(tp.token_type, tp.is_prompt): tp.base_rate for tp in model.token_prices}


async def _get_deleted_model_names(db: DbSessionFactory) -> set[str]:
    """Get names of soft-deleted built-in models."""
    async with db() as session:
        deleted_models = await session.scalars(
            select(models.GenerativeModel)
            .where(models.GenerativeModel.deleted_at.isnot(None))
            .where(models.GenerativeModel.is_built_in.is_(True))
        )
        return {model.name for model in deleted_models}


def _manifest_model(name: str, input_rate: float = 1e-6) -> dict[str, Any]:
    return {
        "name": name,
        "name_pattern": f"(?i)^({name})$",
        "token_prices": [
            {"base_rate": input_rate, "is_prompt": True, "token_type": "input"},
            {"base_rate": 2 * input_rate, "is_prompt": False, "token_type": "output"},
        ],
    }


def _manifest(
    *names: str,
    day: int,
    input_rate: float = 1e-6,
    schema_version: int = SUPPORTED_SCHEMA_VERSION,
) -> ModelCostManifest:
    manifest = _manifest_of([_manifest_model(name, input_rate) for name in names], day=day)
    # parse_manifest only accepts the supported version; set others directly.
    return manifest.model_copy(update={"schema_version": schema_version})


async def _apply(
    db: DbSessionFactory,
    manifest: ModelCostManifest,
    source: Any = "remote",
) -> bool:
    async with db() as session:
        return await apply_manifest_if_newer(
            session, manifest, dialect=db.dialect, source=source, url="file:///test.json"
        )


async def _active_built_in_prices(db: DbSessionFactory) -> dict[str, float]:
    """Maps each active built-in model's name to its input rate."""
    return {
        name: next(tp.base_rate for tp in model.token_prices if tp.token_type == "input")
        for name, model in (await _get_models(db, is_built_in=True)).items()
    }


async def _built_in_updated_at(db: DbSessionFactory) -> dict[str, datetime]:
    async with db() as session:
        result = await session.execute(
            select(models.GenerativeModel.name, models.GenerativeModel.updated_at).where(
                models.GenerativeModel.is_built_in.is_(True)
            )
        )
        return {name: updated_at for name, updated_at in result}


async def _add_span_cost(db: DbSessionFactory, model_name: str) -> int:
    """Adds a span cost referencing the active built-in model and returns the model's id."""
    async with db() as session:
        model_id = await session.scalar(
            select(models.GenerativeModel.id)
            .where(models.GenerativeModel.name == model_name)
            .where(models.GenerativeModel.deleted_at.is_(None))
        )
        assert model_id is not None
        project = models.Project(name=token_hex(8))
        session.add(project)
        await session.flush()
        now = datetime.now(timezone.utc)
        trace = models.Trace(
            trace_id=token_hex(16), project_rowid=project.id, start_time=now, end_time=now
        )
        session.add(trace)
        await session.flush()
        span = models.Span(
            trace_rowid=trace.id,
            span_id=token_hex(8),
            parent_id=None,
            name=token_hex(8),
            span_kind="LLM",
            start_time=now,
            end_time=now,
            attributes={},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span)
        await session.flush()
        session.add(
            models.SpanCost(
                span_rowid=span.id,
                trace_rowid=trace.id,
                span_start_time=now,
                model_id=model_id,
            )
        )
    return model_id


class TestApplyManifestSync:
    async def test_syncs_models_and_token_prices(
        self,
        db: DbSessionFactory,
    ) -> None:
        """
        Comprehensive test of syncing built-in models with successive manifests, covering:
        1. Empty manifest (no models created)
        2. Model creation from manifest
        3. Model updates (name_pattern, token prices)
        4. Token price additions and removals
        5. Model cleanup (soft deletion of obsolete models)
        """

        # Initialize enums first
        await _ensure_enums(db)

        # === STEP 1: Empty manifest ===
        built_in_models = await _get_models(db, is_built_in=True)
        assert not built_in_models, "There should be no built-in models initially"
        user_defined_models = await _get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        await _apply(db, _manifest_of([], day=1))
        built_in_models = await _get_models(db, is_built_in=True)
        assert not built_in_models, "There should be no built-in models because manifest is empty"
        user_defined_models = await _get_models(db, is_built_in=False)
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
        await _apply(db, _manifest_of(initial_manifest, day=2))
        built_in_models = await _get_models(db, is_built_in=True)
        assert len(built_in_models) == 2, "Should have created 2 models"
        user_defined_models = await _get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify model 1 details
        model1 = built_in_models["test-model-1"]
        assert model1.name_pattern.pattern == r"(?i)^(test-model-1)$"
        assert model1.is_built_in is True
        assert model1.deleted_at is None

        # Check token prices for model 1 (should have all types)
        actual_prices_1 = _extract_token_prices(model1)
        expected_prices_1 = {
            ("input", True): 0.000001,
            ("output", False): 0.000002,
            ("cache_write", True): 0.0000001,
            ("cache_read", True): 0.0000005,
            ("audio", True): 0.000003,
            ("audio", False): 0.000003,  # Audio appears for both prompt and non-prompt
        }
        assert actual_prices_1 == expected_prices_1, (
            f"Model 1 token prices mismatch: got {actual_prices_1}, expected {expected_prices_1}"
        )

        # Verify model 2 details (minimal pricing)
        model2 = built_in_models["test-model-2"]
        assert model2.name_pattern.pattern == r"(?i)^(test-model-2|alt-name-2)$"
        model2_initial_updated_at = model2.updated_at

        actual_prices_2 = _extract_token_prices(model2)
        expected_prices_2 = {
            ("input", True): 0.000005,
            ("output", False): 0.000010,
        }
        assert actual_prices_2 == expected_prices_2, (
            f"Model 2 token prices mismatch: got {actual_prices_2}, expected {expected_prices_2}"
        )

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
        await _apply(db, _manifest_of(updated_manifest, day=3))
        built_in_models = await _get_models(db, is_built_in=True)
        assert len(built_in_models) == 3, "Should have 3 models after update"
        user_defined_models = await _get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify model 1 updates
        model1_updated = built_in_models["test-model-1"]
        assert model1_updated.name_pattern.pattern == r"(?i)^(test-model-1|new-alias)$"

        actual_prices_1_updated = _extract_token_prices(model1_updated)
        expected_prices_1_updated = {
            ("input", True): 0.000002,  # Changed
            ("output", False): 0.000002,  # Same
            ("cache_read", True): 0.000001,  # Changed
            ("audio", True): 0.000005,  # Changed
            ("audio", False): 0.000005,  # Changed
            # cache_write should be removed
        }
        assert actual_prices_1_updated == expected_prices_1_updated, (
            f"Model 1 updated prices mismatch: got {actual_prices_1_updated}, expected {expected_prices_1_updated}"
        )

        # Verify model 2 updates
        model2_updated = built_in_models["test-model-2"]
        assert model2_updated.updated_at > model2_initial_updated_at
        actual_prices_2_updated = _extract_token_prices(model2_updated)
        expected_prices_2_updated = {
            ("input", True): 0.000005,  # Same
            ("output", False): 0.000015,  # Changed
            ("cache_write", True): 0.000001,  # Added
            ("cache_read", True): 0.000002,  # Added
        }
        assert actual_prices_2_updated == expected_prices_2_updated, (
            f"Model 2 updated prices mismatch: got {actual_prices_2_updated}, expected {expected_prices_2_updated}"
        )

        # Verify new audio model
        audio_model = built_in_models["audio-model"]
        actual_prices_audio = _extract_token_prices(audio_model)
        expected_prices_audio = {
            ("audio", True): 0.000008,
            ("audio", False): 0.000008,
        }
        assert actual_prices_audio == expected_prices_audio, (
            f"Audio model prices mismatch: got {actual_prices_audio}, expected {expected_prices_audio}"
        )

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
        await _apply(db, _manifest_of(final_manifest, day=4))

        # Check active built-in models
        active_models = await _get_models(db, is_built_in=True)
        assert len(active_models) == 1, "Should have only 1 active model"
        assert "test-model-2" in active_models, "Model 2 should still be active"
        user_defined_models = await _get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify final model 2 state
        final_model2 = active_models["test-model-2"]
        assert final_model2.name_pattern.pattern == r"(?i)^(final-model-2)$"

        actual_prices_final = _extract_token_prices(final_model2)
        expected_prices_final = {
            ("input", True): 0.000010,
            ("output", False): 0.000020,
            ("audio", True): 0.000030,
            ("audio", False): 0.000030,
        }
        assert actual_prices_final == expected_prices_final, (
            f"Final model prices mismatch: got {actual_prices_final}, expected {expected_prices_final}"
        )

        # Verify soft deletion of removed models
        deleted_model_names = await _get_deleted_model_names(db)
        expected_deleted = {"test-model-1", "audio-model"}
        assert deleted_model_names == expected_deleted, (
            f"Wrong models deleted: got {deleted_model_names}, expected {expected_deleted}"
        )

        # === STEP 5: Empty manifest again (cleanup all) ===
        await _apply(db, _manifest_of([], day=5))

        final_active_models = await _get_models(db, is_built_in=True)
        assert not final_active_models, "All models should be soft-deleted"
        user_defined_models = await _get_models(db, is_built_in=False)
        assert not user_defined_models, "No user-defined models should exist"

        # Verify all models are now soft-deleted
        all_deleted_names = await _get_deleted_model_names(db)
        expected_all_deleted = {"test-model-1", "test-model-2", "audio-model"}
        assert all_deleted_names == expected_all_deleted, (
            f"All models should be deleted: got {all_deleted_names}, expected {expected_all_deleted}"
        )

    async def test_syncs_token_price_customizations_from_manifest(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Tier-rate customizations in the manifest must land in the database,
        propagate on change, and clear when removed upstream."""
        await _ensure_enums(db)

        customization = {
            "type": "threshold_based",
            "key": "llm.token_count.prompt",
            "threshold": 200000.0,
            "new_rate": 0.000006,
        }
        manifest: list[dict[str, Any]] = [
            {
                "name": "tiered-model",
                "name_pattern": r"(?i)^(tiered-model)$",
                "token_prices": [
                    {
                        "base_rate": 0.000003,
                        "is_prompt": True,
                        "token_type": "input",
                        "customization": customization,
                    },
                    {
                        "base_rate": 0.000015,
                        "is_prompt": False,
                        "token_type": "output",
                    },
                ],
            }
        ]
        await _apply(db, _manifest_of(manifest, day=1))

        async def _get_input_price(db: DbSessionFactory) -> models.TokenPrice:
            model = (await _get_models(db, is_built_in=True))["tiered-model"]
            return next(tp for tp in model.token_prices if tp.token_type == "input")

        input_price = await _get_input_price(db)
        assert isinstance(input_price.customization, ThresholdBasedTokenPriceCustomization)
        assert input_price.customization.model_dump() == customization
        model = (await _get_models(db, is_built_in=True))["tiered-model"]
        output_price = next(tp for tp in model.token_prices if tp.token_type == "output")
        assert output_price.customization is None

        # A changed tier rate propagates on re-sync.
        manifest[0]["token_prices"][0]["customization"] = {
            **customization,
            "new_rate": 0.000012,
        }
        await _apply(db, _manifest_of(manifest, day=2))
        input_price = await _get_input_price(db)
        assert isinstance(input_price.customization, ThresholdBasedTokenPriceCustomization)
        assert input_price.customization.new_rate == 0.000012

        # Removing the customization upstream clears the stored one.
        del manifest[0]["token_prices"][0]["customization"]
        await _apply(db, _manifest_of(manifest, day=3))
        input_price = await _get_input_price(db)
        assert input_price.customization is None


class TestApplyManifestIfNewer:
    async def test_newer_manifest_is_applied_and_recorded(self, db: DbSessionFactory) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("model-a", day=1))
        assert await _active_built_in_prices(db) == {"model-a": 1e-6}

        async with db() as session:
            marker = await get_applied_manifest_version(session)
        assert marker is not None
        assert marker.schema_version == SUPPORTED_SCHEMA_VERSION
        assert marker.generated_at == _manifest_date(1)
        assert marker.source == "remote"
        assert marker.url == "file:///test.json"

        assert await _apply(db, _manifest("model-a", "model-b", day=2, input_rate=3e-6))
        assert await _active_built_in_prices(db) == {"model-a": 3e-6, "model-b": 3e-6}

    @pytest.mark.parametrize("day", [1, 0], ids=["same-date", "older"])
    async def test_manifest_not_newer_is_not_applied(
        self,
        db: DbSessionFactory,
        day: int,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("model-a", day=1))
        with caplog.at_level(logging.WARNING, logger="phoenix.server.cost_tracking.apply_manifest"):
            assert not await _apply(db, _manifest("model-b", day=day, input_rate=5e-6))
        assert "newer than this Phoenix supports" not in caplog.text
        assert await _active_built_in_prices(db) == {"model-a": 1e-6}
        async with db() as session:
            marker = await get_applied_manifest_version(session)
        assert marker is not None and marker.generated_at == _manifest_date(1)

    async def test_newer_schema_is_applied_even_if_older(self, db: DbSessionFactory) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("model-a", day=5))
        newer_schema = _manifest("model-b", day=1, schema_version=SUPPORTED_SCHEMA_VERSION + 1)
        assert await _apply(db, newer_schema)
        assert await _active_built_in_prices(db) == {"model-b": 1e-6}

    async def test_older_schema_is_not_applied_even_if_newer(
        self,
        db: DbSessionFactory,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        await _ensure_enums(db)
        newer_schema = _manifest("model-a", day=1, schema_version=SUPPORTED_SCHEMA_VERSION + 1)
        assert await _apply(db, newer_schema)
        with caplog.at_level(logging.WARNING, logger="phoenix.server.cost_tracking.apply_manifest"):
            assert not await _apply(db, _manifest("model-b", day=5))
        assert await _active_built_in_prices(db) == {"model-a": 1e-6}
        assert f"schema {SUPPORTED_SCHEMA_VERSION + 1}, newer than" in caplog.text

    @pytest.mark.parametrize(
        "value",
        [
            pytest.param({"bad": 1}, id="wrong-shape"),
            pytest.param(
                {
                    "schema_version": SUPPORTED_SCHEMA_VERSION,
                    "generated_at": "2026-01-05T00:00:00",
                    "source": "remote",
                    "applied_at": "2026-01-05T00:00:00",
                },
                id="naive-datetimes",
            ),
        ],
    )
    async def test_invalid_marker_is_treated_as_missing(
        self,
        db: DbSessionFactory,
        value: dict[str, Any],
    ) -> None:
        await _ensure_enums(db)
        async with db() as session:
            session.add(models.SystemSetting(key=MANIFEST_VERSION_SETTING_KEY, value=value))
        assert await _apply(db, _manifest("model-a", day=1))
        assert await _active_built_in_prices(db) == {"model-a": 1e-6}

    async def test_model_with_span_costs_is_not_soft_deleted(self, db: DbSessionFactory) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("used-model", "unused-model", day=1))
        await _add_span_cost(db, "used-model")
        assert await _apply(db, _manifest(day=2))
        assert await _active_built_in_prices(db) == {"used-model": 1e-6}

    async def test_renamed_model_with_span_costs_replaces_its_old_row(
        self,
        db: DbSessionFactory,
    ) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("old-name", day=1))
        old_id = await _add_span_cost(db, "old-name")
        renamed = _manifest("old-name", day=2).models[0].model_copy(update={"name": "new-name"})
        manifest = _manifest(day=2).model_copy(update={"models": [renamed]})
        assert await _apply(db, manifest)
        assert await _active_built_in_prices(db) == {"new-name": 1e-6}
        async with db() as session:
            old_model = await session.get(models.GenerativeModel, old_id)
            assert old_model is not None and old_model.deleted_at is not None
            assert await session.scalar(select(models.SpanCost.model_id)) == old_id

    async def test_model_with_invalid_entry_is_left_as_is(self, db: DbSessionFactory) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("model-a", "model-b", day=1))
        invalid = _manifest_model("model-a", input_rate=3e-6)
        invalid["token_prices"][0]["base_rate"] = -1
        manifest = _manifest_of([invalid, _manifest_model("model-b", input_rate=3e-6)], day=2)
        assert manifest.skipped_model_names == {"model-a"}
        assert await _apply(db, manifest)
        assert await _active_built_in_prices(db) == {"model-a": 1e-6, "model-b": 3e-6}
        async with db() as session:
            marker = await get_applied_manifest_version(session)
        assert marker is not None and marker.generated_at == _manifest_date(2)

    async def test_unchanged_manifest_does_not_touch_models(self, db: DbSessionFactory) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("model-a", "model-b", day=1))
        updated_at = await _built_in_updated_at(db)
        assert await _apply(db, _manifest("model-a", "model-b", day=2))
        assert await _built_in_updated_at(db) == updated_at

    async def test_marker_loads_into_system_settings_without_warnings(
        self,
        db: DbSessionFactory,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        await _ensure_enums(db)
        assert await _apply(db, _manifest("model-a", day=1))
        with caplog.at_level(logging.WARNING):
            await SystemSettings(db=db).bootstrap()
        assert not [r for r in caplog.records if r.levelno >= logging.WARNING]

    async def test_concurrent_applies_apply_once(self, db: DbSessionFactory) -> None:
        if db.dialect is not SupportedSQLDialect.POSTGRESQL:
            pytest.skip("SQLite allows one writer at a time")
        await _ensure_enums(db)
        manifest = _manifest("model-a", "model-b", day=1)
        results = await asyncio.gather(*(_apply(db, manifest) for _ in range(4)))
        assert sorted(results) == [False, False, False, True]
        assert await _active_built_in_prices(db) == {"model-a": 1e-6, "model-b": 1e-6}
