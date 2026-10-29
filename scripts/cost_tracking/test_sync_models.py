"""Run with ``make test-sync-models``, as CI does; it lives outside tests/ beside the script."""

from datetime import datetime, timedelta, timezone

from sync_models import (
    LiteLLMPricingEntry,
    ModelConfig,
    ModelCostManifest,
    ModelSource,
    TokenPrice,
    _dump_models,
    extract_litellm_entries,
    next_generated_at,
    serialize_manifest,
    update_manifest,
)

from phoenix.server.cost_tracking.manifest import compute_models_sha256

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
    manifest.models_sha256 = compute_models_sha256(_dump_models(manifest))
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


def test_generated_at_advances_when_now_is_not_later() -> None:
    previous = _manifest(1e-6)
    changed = _manifest(2e-6)
    assert next_generated_at(previous, changed, now=PREVIOUS) == PREVIOUS + timedelta(seconds=1)
    earlier = PREVIOUS - timedelta(seconds=30)
    assert next_generated_at(previous, changed, now=earlier) == PREVIOUS + timedelta(seconds=1)


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


def test_extract_litellm_entries_preserves_zero_input_rate() -> None:
    entries = extract_litellm_entries(
        {
            "perplexity/sonar-small-online": {
                "input_cost_per_token": 0,
                "output_cost_per_token": 2.8e-7,
            },
            "zai/glm-5": {
                "input_cost_per_token": 1e-6,
                "output_cost_per_token": 3.2e-6,
                "cache_read_input_token_cost": 2e-7,
                "cache_creation_input_token_cost": 0,
            },
        }
    )
    by_name = {
        entry.name: {(tp.token_type, tp.is_prompt): tp.base_rate for tp in entry.token_prices}
        for entry in entries
    }
    assert by_name == {
        "perplexity/sonar-small-online": {
            ("input", True): 0.0,
            ("output", False): 2.8e-7,
        },
        "zai/glm-5": {
            ("input", True): 1e-6,
            ("output", False): 3.2e-6,
            ("cache_read", True): 2e-7,
            ("cache_write", True): 0.0,
        },
    }
