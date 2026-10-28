"""Unit tests for embedding-model pricing extraction in sync_models."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

import pytest

_SYNC_MODELS_PATH = (
    Path(__file__).resolve().parents[4] / "scripts" / "cost_tracking" / "sync_models.py"
)


@pytest.fixture(scope="module")
def sync_models() -> Any:
    spec = importlib.util.spec_from_file_location("sync_models", _SYNC_MODELS_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_has_usable_pricing_accepts_embedding_input_only(sync_models: Any) -> None:
    assert sync_models._has_usable_pricing(
        {
            "mode": "embedding",
            "input_cost_per_token": 1e-7,
        }
    )


def test_has_usable_pricing_rejects_chat_without_output(sync_models: Any) -> None:
    assert not sync_models._has_usable_pricing(
        {
            "mode": "chat",
            "input_cost_per_token": 1e-7,
        }
    )


def test_extract_litellm_entries_includes_mistral_embeddings(sync_models: Any) -> None:
    data = {
        "mistral/mistral-embed": {
            "mode": "embedding",
            "input_cost_per_token": 1e-7,
            "litellm_provider": "mistral",
        },
        "mistral/codestral-embed": {
            "mode": "embedding",
            "input_cost_per_token": 1.5e-7,
            "cache_read_input_token_cost": 1.5e-8,
            "litellm_provider": "mistral",
        },
        # Chat without output must still be excluded.
        "mistral/incomplete-chat": {
            "mode": "chat",
            "input_cost_per_token": 1e-6,
            "litellm_provider": "mistral",
        },
    }
    entries = {entry.name: entry for entry in sync_models.extract_litellm_entries(data)}
    assert set(entries) == {"mistral/mistral-embed", "mistral/codestral-embed"}

    mistral_embed = entries["mistral/mistral-embed"]
    assert mistral_embed.provider == "mistralai"
    assert [p.token_type for p in mistral_embed.token_prices] == ["input"]
    assert mistral_embed.token_prices[0].base_rate == pytest.approx(1e-7)
    assert mistral_embed.token_prices[0].is_prompt is True

    codestral_embed = entries["mistral/codestral-embed"]
    assert {p.token_type for p in codestral_embed.token_prices} == {"input", "cache_read"}
    assert all(p.is_prompt for p in codestral_embed.token_prices)
