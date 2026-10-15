"""Run with ``uv run pytest scripts/cost_tracking``; it lives outside tests/ beside the script."""

import hashlib
import json
from datetime import datetime, timezone

from sync_models import (
    SCHEMA_VERSION,
    LiteLLMPricingEntry,
    ModelConfig,
    ModelCostManifest,
    ModelSource,
    TokenPrice,
    extract_litellm_entries,
    models_sha256,
    next_generated_at,
    serialize_manifest,
    update_manifest,
)

from phoenix.server.cost_tracking.manifest import SUPPORTED_SCHEMA_VERSION

PREVIOUS = datetime(2026, 10, 1, tzinfo=timezone.utc)
NOW = datetime(2026, 10, 14, 12, 30, 15, 123456, tzinfo=timezone.utc)


def _manifest(base_rate: float, generated_at: datetime | None = PREVIOUS) -> ModelCostManifest:
    manifest = ModelCostManifest(
        generated_at=generated_at,
        models=[
            ModelConfig(
                name="gpt-test",
                name_pattern="gpt-test",
                source=ModelSource.LITELLM,
                token_prices=[TokenPrice(base_rate=base_rate, is_prompt=True, token_type="input")],
            )
        ],
    )
    manifest.models_sha256 = models_sha256(manifest)
    return manifest


def _sync(manifest: ModelCostManifest, base_rate: float) -> ModelCostManifest:
    previous = manifest.model_copy(deep=True)
    entry = LiteLLMPricingEntry(
        name="gpt-test",
        provider=None,
        name_pattern="gpt-test",
        token_prices=[TokenPrice(base_rate=base_rate, is_prompt=True, token_type="input")],
    )
    updated = update_manifest(manifest, [entry])
    updated.generated_at = next_generated_at(previous, updated, now=NOW)
    return updated


def test_generated_at_is_unchanged_when_models_are_unchanged() -> None:
    before = _manifest(1e-6)
    before_text = serialize_manifest(before)
    after = _sync(ModelCostManifest.model_validate_json(before_text), 1e-6)
    assert after.generated_at == PREVIOUS
    assert serialize_manifest(after) == before_text


def test_generated_at_is_bumped_when_models_changed() -> None:
    after = _sync(_manifest(1e-6), 2e-6)
    assert after.generated_at == NOW.replace(microsecond=0)


def test_generated_at_is_set_when_missing() -> None:
    after = _sync(_manifest(1e-6, generated_at=None), 1e-6)
    assert after.generated_at == NOW.replace(microsecond=0)


def test_generated_at_is_bumped_when_models_were_edited_by_hand() -> None:
    manifest = _manifest(1e-6)
    manifest.models[0].token_prices[0].base_rate = 2e-6
    after = _sync(manifest, 2e-6)
    assert after.generated_at == NOW.replace(microsecond=0)


def test_serialized_header_comes_before_models() -> None:
    manifest = _manifest(1e-6)
    text = serialize_manifest(manifest)
    assert text.startswith(
        '{\n  "schema_version": 1,\n  "generated_at": "2026-10-01T00:00:00Z",\n'
        f'  "models_sha256": "{manifest.models_sha256}",\n  "models": ['
    )


def test_models_sha256_matches_the_manifest_test() -> None:
    # tests/unit/server/cost_tracking/test_model_cost_manifest.py hashes the file's JSON.
    data = json.loads(serialize_manifest(_manifest(1e-6)))
    canonical = json.dumps(data["models"], sort_keys=True, separators=(",", ":"))
    assert data["models_sha256"] == hashlib.sha256(canonical.encode()).hexdigest()


def test_typesafe_evaluation_models_are_priced_by_input_only() -> None:
    entries = extract_litellm_entries(
        {
            "typesafe/jev-latest": {
                "input_cost_per_token": 4.2e-08,
                "litellm_provider": "typesafe",
                "mode": "evaluation",
                "output_cost_per_token": 0.0,
            },
            # Chat models still need an output rate.
            "together_ai/some-chat-model": {
                "input_cost_per_token": 4.2e-08,
                "litellm_provider": "together_ai",
                "mode": "chat",
                "output_cost_per_token": 0.0,
            },
        }
    )
    assert [(e.name, e.provider, e.name_pattern) for e in entries] == [
        ("typesafe/jev-latest", "typesafe", "jev-latest")
    ]
    assert entries[0].token_prices == [
        TokenPrice(base_rate=4.2e-08, is_prompt=True, token_type="input")
    ]


def test_writes_the_schema_version_servers_support() -> None:
    assert SCHEMA_VERSION == SUPPORTED_SCHEMA_VERSION
