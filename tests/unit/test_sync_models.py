import importlib.util
from pathlib import Path
from types import ModuleType

from openinference.semconv.trace import SpanAttributes


def _load_sync_models_module() -> ModuleType:
    script_path = Path(__file__).parents[2] / ".github" / ".scripts" / "sync_models.py"
    spec = importlib.util.spec_from_file_location("sync_models", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_extract_litellm_entries_emits_threshold_based_customizations() -> None:
    sync_models = _load_sync_models_module()

    entries = sync_models.extract_litellm_entries(
        {
            "gpt-test": {
                "input_cost_per_token": 0.000001,
                "output_cost_per_token": 0.000002,
                "cache_creation_input_token_cost": 0.000003,
                "input_cost_per_token_above_200k_tokens": 0.000004,
                "output_cost_per_token_above_200k_tokens": 0.000005,
                "cache_creation_input_token_cost_above_200k_tokens": 0.000006,
                "cache_creation_input_token_cost_above_1hr_above_200k_tokens": 0.000007,
            }
        }
    )

    assert len(entries) == 1
    prices = {
        (price.token_type, price.is_prompt): price.model_dump(exclude_none=True)
        for price in entries[0].token_prices
    }

    assert prices[("input", True)]["customization"] == {
        "type": "threshold_based",
        "key": SpanAttributes.LLM_TOKEN_COUNT_PROMPT,
        "threshold": 200000.0,
        "new_rate": 0.000004,
    }
    assert prices[("output", False)]["customization"] == {
        "type": "threshold_based",
        "key": SpanAttributes.LLM_TOKEN_COUNT_PROMPT,
        "threshold": 200000.0,
        "new_rate": 0.000005,
    }
    assert prices[("cache_write", True)]["customization"] == {
        "type": "threshold_based",
        "key": SpanAttributes.LLM_TOKEN_COUNT_PROMPT,
        "threshold": 200000.0,
        "new_rate": 0.000006,
    }
