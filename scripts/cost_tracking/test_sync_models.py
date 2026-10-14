"""Run with ``uv run pytest scripts/cost_tracking``; it lives outside tests/ beside the script."""

from datetime import datetime, timezone

from sync_models import (
    LiteLLMPricingEntry,
    ModelConfig,
    ModelCostManifest,
    ModelSource,
    TokenPrice,
    extract_litellm_entries,
    next_generated_at,
    serialize_manifest,
    update_manifest,
)

PREVIOUS = datetime(2026, 10, 1, tzinfo=timezone.utc)
NOW = datetime(2026, 10, 14, 12, 30, 15, 123456, tzinfo=timezone.utc)


def _manifest(base_rate: float, generated_at: datetime | None = PREVIOUS) -> ModelCostManifest:
    return ModelCostManifest(
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


def test_serialized_header_comes_before_models() -> None:
    text = serialize_manifest(_manifest(1e-6))
    assert text.startswith(
        '{\n  "schema_version": 1,\n  "generated_at": "2026-10-01T00:00:00Z",\n  "models": ['
    )


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
