"""Run with ``make test-sync-models``, as CI does; it lives outside tests/ beside the script."""

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from sync_models import (
    LiteLLMPricingEntry,
    ModelConfig,
    ModelCostManifest,
    ModelSource,
    TokenPrice,
    _dump_models,
    extract_litellm_entries,
    model_type_for_mode,
    next_generated_at,
    serialize_manifest,
    stamp,
    update_manifest,
)

from phoenix.db.models import GenerativeModelType
from phoenix.server.cost_tracking.manifest import compute_models_sha256, parse_manifest

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


def test_extract_litellm_entries_preserves_zero_rates() -> None:
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
            "zai/glm-4.7": {
                "input_cost_per_token": 6e-7,
                "output_cost_per_token": 2.2e-6,
                "cache_read_input_token_cost": 0,
                "output_cost_per_reasoning_token": None,
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
        "zai/glm-4.7": {
            ("input", True): 6e-7,
            ("output", False): 2.2e-6,
            ("cache_read", True): 0.0,
        },
    }


def _rates(entries: list[LiteLLMPricingEntry]) -> dict[str, dict[tuple[str, bool], float]]:
    return {
        entry.name: {(tp.token_type, tp.is_prompt): tp.base_rate for tp in entry.token_prices}
        for entry in entries
    }


def test_extract_litellm_entries_keeps_free_models() -> None:
    entries = extract_litellm_entries(
        {
            "zai/glm-4.5-flash": {
                "input_cost_per_token": 0,
                "output_cost_per_token": 0,
            },
            "together_ai/Salesforce/Llama-Rank-V1": {
                "input_cost_per_token": 1e-7,
                "output_cost_per_token": 0,
            },
        }
    )
    assert _rates(entries) == {
        "zai/glm-4.5-flash": {
            ("input", True): 0.0,
            ("output", False): 0.0,
        },
        "together_ai/Salesforce/Llama-Rank-V1": {
            ("input", True): 1e-7,
            ("output", False): 0.0,
        },
    }


def test_extract_litellm_entries_skips_zero_token_rates_with_non_token_price() -> None:
    entries = extract_litellm_entries(
        {
            "gemini-2.0-flash-exp-image-generation": {
                "input_cost_per_token": 0,
                "output_cost_per_token": 0,
                "output_cost_per_image": 0.039,
            },
            "zai/glm-4.5-flash": {
                "input_cost_per_token": 0,
                "output_cost_per_token": 0,
            },
            "gpt-image-free-text": {
                "input_cost_per_token": 5e-6,
                "output_cost_per_token": 0,
                "output_cost_per_image_token": 4e-5,
            },
        }
    )
    assert _rates(entries) == {
        "zai/glm-4.5-flash": {
            ("input", True): 0.0,
            ("output", False): 0.0,
        },
        "gpt-image-free-text": {
            ("input", True): 5e-6,
            ("output", False): 4e-5,
            ("image", False): 4e-5,
        },
    }


# Modeled on LiteLLM's model_prices_and_context_window.json.
GPT_6_LUNA: dict[str, Any] = {
    "litellm_provider": "openai",
    "mode": "chat",
    "input_cost_per_token": 1e-7,
    "input_cost_per_token_above_272k_tokens": 2e-7,
    "output_cost_per_token": 5e-7,
    "output_cost_per_token_above_272k_tokens": 1e-6,
    "cache_read_input_token_cost": 1e-8,
    "cache_read_input_token_cost_above_272k_tokens": 2e-8,
    "cache_creation_input_token_cost": 1.25e-7,
    "cache_creation_input_token_cost_above_272k_tokens": 2.5e-7,
    "input_cost_per_token_decisions": 1e-7,
    "input_cost_per_token_above_272k_tokens_decisions": 2e-7,
    "output_cost_per_token_decisions": 0.0,
    "output_cost_per_token_above_272k_tokens_decisions": 0.0,
    "cache_read_input_token_cost_decisions": 1e-8,
    "cache_read_input_token_cost_above_272k_tokens_decisions": 2e-8,
    "cache_creation_input_token_cost_decisions": 1.25e-7,
    "cache_creation_input_token_cost_above_272k_tokens_decisions": 2.5e-7,
}

LITELLM_DATA: dict[str, Any] = {
    "gpt-6-luna": GPT_6_LUNA,
    "typesafe/jev-latest": {
        "litellm_provider": "typesafe",
        "mode": "evaluation",
        "input_cost_per_token": 4.2e-8,
        "output_cost_per_token": 0.0,
    },
    "typesafe/jev-decider": {
        "litellm_provider": "typesafe",
        "mode": "decisions",
        "input_cost_per_token": 3e-8,
        "output_cost_per_token": 0.0,
    },
    "together_ai/some-embed-model": {
        "litellm_provider": "together_ai",
        "mode": "embedding",
        "input_cost_per_token": 8e-9,
        "output_cost_per_token": 0.0,
    },
}


def _tiers(entry: LiteLLMPricingEntry) -> dict[str, tuple[str, float, float] | None]:
    return {
        tp.token_type: (
            None
            if tp.customization is None
            else (tp.customization.key, tp.customization.threshold, tp.customization.new_rate)
        )
        for tp in entry.token_prices
    }


def test_extract_litellm_entries_assigns_types_by_mode() -> None:
    entries = extract_litellm_entries(LITELLM_DATA)
    by_key = {(entry.name, entry.type): entry for entry in entries}
    # The embedding model is skipped: embedding spans aren't priced yet.
    assert sorted(by_key) == [
        ("gpt-6-luna", "DECISION"),
        ("gpt-6-luna", "LLM"),
        ("typesafe/jev-decider", "DECISION"),
        ("typesafe/jev-latest", "DECISION"),
    ]

    llm = by_key["gpt-6-luna", "LLM"]
    assert (llm.provider, llm.name_pattern) == (None, "gpt-6-luna")
    assert _rates([llm])["gpt-6-luna"] == {
        ("input", True): 1e-7,
        ("output", False): 5e-7,
        ("cache_read", True): 1e-8,
        ("cache_write", True): 1.25e-7,
    }
    prompt = "llm.token_count.prompt"
    assert _tiers(llm) == {
        "input": (prompt, 272000.0, 2e-7),
        "output": (prompt, 272000.0, 1e-6),
        "cache_read": (prompt, 272000.0, 2e-8),
        "cache_write": (prompt, 272000.0, 2.5e-7),
    }

    # Built only from the _decisions fields, with tiers keyed on the decision input tokens.
    decision = by_key["gpt-6-luna", "DECISION"]
    assert (decision.provider, decision.name_pattern) == (None, "gpt-6-luna")
    assert _rates([decision])["gpt-6-luna"] == {
        ("input", True): 1e-7,
        ("output", False): 0.0,
        ("cache_read", True): 1e-8,
        ("cache_write", True): 1.25e-7,
    }
    decision_input = "decision.token_count.input"
    assert _tiers(decision) == {
        "input": (decision_input, 272000.0, 2e-7),
        "output": (decision_input, 272000.0, 0.0),
        "cache_read": (decision_input, 272000.0, 2e-8),
        "cache_write": (decision_input, 272000.0, 2.5e-7),
    }

    jev = by_key["typesafe/jev-latest", "DECISION"]
    assert (jev.provider, jev.name_pattern) == ("typesafe", "jev-latest")
    assert _rates([jev])["typesafe/jev-latest"] == {("input", True): 4.2e-8, ("output", False): 0.0}
    assert _tiers(jev) == {"input": None, "output": None}


def test_extract_litellm_entries_decision_entry_does_not_borrow_chat_rates() -> None:
    # Only the _decisions fields price the DECISION entry; without an output rate among them,
    # it has no pricing and isn't emitted.
    luna = {k: v for k, v in GPT_6_LUNA.items() if not k.startswith("output_cost_per_token_")}
    entries = extract_litellm_entries({"gpt-6-luna": luna})
    assert [(entry.name, entry.type) for entry in entries] == [("gpt-6-luna", "LLM")]


def _model_config(
    name: str,
    base_rate: float = 1e-6,
    *,
    type: GenerativeModelType | None = None,
    source: ModelSource = ModelSource.LITELLM,
) -> ModelConfig:
    return ModelConfig(
        name=name,
        name_pattern=name,
        source=source,
        type=type,
        token_prices=[TokenPrice(base_rate=base_rate, is_prompt=True, token_type="input")],
    )


def _entry(name: str, base_rate: float, type: GenerativeModelType = "LLM") -> LiteLLMPricingEntry:
    return LiteLLMPricingEntry(
        name=name,
        provider=None,
        name_pattern=name,
        token_prices=[TokenPrice(base_rate=base_rate, is_prompt=True, token_type="input")],
        type=type,
    )


def test_update_manifest_routes_entries_by_type() -> None:
    manifest = ModelCostManifest(
        generated_at=PREVIOUS,
        models=[],
        non_llm_models=[
            _model_config("manual-decision", type="DECISION", source=ModelSource.MANUAL)
        ],
    )
    updated = update_manifest(
        manifest,
        [_entry("gpt-6-luna", 1e-7), _entry("gpt-6-luna", 2e-7, type="DECISION")],
    )
    dumped = json.loads(serialize_manifest(updated))
    assert [(m["name"], m.get("type")) for m in dumped["models"]] == [("gpt-6-luna", None)]
    assert [(m["name"], m["type"]) for m in dumped["non_llm_models"]] == [
        ("gpt-6-luna", "DECISION"),
        ("manual-decision", "DECISION"),
    ]
    # The serialized manifest parses with both entries kept, each with its own price.
    parsed = parse_manifest(serialize_manifest(updated))
    assert {model.key: model.token_prices[0].base_rate for model in parsed.models} == {
        ("gpt-6-luna", "LLM"): 1e-7,
        ("gpt-6-luna", "DECISION"): 2e-7,
        ("manual-decision", "DECISION"): 1e-6,
    }

    # A DECISION entry gone upstream is removed; the same-name LLM and manual entries stay.
    updated = update_manifest(updated, [_entry("gpt-6-luna", 3e-7)])
    assert [(m.name, m.type, m.token_prices[0].base_rate) for m in updated.models] == [
        ("gpt-6-luna", None, 3e-7)
    ]
    assert [(m.name, m.type) for m in updated.non_llm_models] == [("manual-decision", "DECISION")]


def test_digest_is_unchanged_without_non_llm_models() -> None:
    manifest = _manifest(1e-6)
    assert manifest.non_llm_models == []
    llm_models = manifest.model_dump(mode="json", exclude_none=True)["models"]
    assert compute_models_sha256(_dump_models(manifest)) == compute_models_sha256(llm_models)
    # Adding a non-LLM entry changes it, so generated_at is bumped.
    manifest.non_llm_models.append(_model_config("decision-a", type="DECISION"))
    assert compute_models_sha256(_dump_models(manifest)) != compute_models_sha256(llm_models)


@pytest.mark.parametrize(
    "mode, expected",
    [
        pytest.param("decisions", "DECISION", id="decisions"),
        pytest.param("evaluation", "DECISION", id="evaluation"),
        pytest.param("embedding", "EMBEDDING", id="embedding"),
        pytest.param("chat", "LLM", id="chat"),
        pytest.param("responses", "LLM", id="responses"),
        pytest.param("completion", "LLM", id="completion"),
        pytest.param("image_generation", "LLM", id="other-mode"),
        pytest.param(None, "LLM", id="no-mode"),
        pytest.param(["chat"], "LLM", id="not-a-string"),
    ],
)
def test_model_type_for_mode(mode: Any, expected: GenerativeModelType) -> None:
    assert model_type_for_mode(mode) == expected


def test_stamp_moves_entries_edited_by_hand_into_the_list_for_their_type() -> None:
    # Servers that predate types would price a DECISION entry in models as an LLM.
    manifest = ModelCostManifest(
        generated_at=PREVIOUS,
        models=[
            _model_config("llm-a"),
            _model_config("decision-a", type="DECISION", source=ModelSource.MANUAL),
        ],
        non_llm_models=[_model_config("llm-b", type="LLM", source=ModelSource.MANUAL)],
    )
    previous = manifest.model_copy(deep=True)
    stamp(manifest, previous)
    dumped = json.loads(serialize_manifest(manifest))
    assert [(m["name"], m.get("type")) for m in dumped["models"]] == [
        ("llm-a", None),
        ("llm-b", None),
    ]
    assert [(m["name"], m["type"]) for m in dumped["non_llm_models"]] == [
        ("decision-a", "DECISION")
    ]
    assert manifest.generated_at != PREVIOUS
