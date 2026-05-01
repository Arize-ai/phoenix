# type: ignore
"""Tests for ``OpenAIAdapter._system_role()``.

Covers issue #12703 — the substring-based policy mis-routed several current
OpenAI model families.  The new policy is:

- ``gpt-*`` → ``"system"``
- ``o1-mini`` / ``o1-preview`` → ``"user"``
- other ``o\\d*`` reasoning models → ``"developer"``
- anything else (unknown / empty / None) → ``"developer"``
"""

from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.openai.adapter import OpenAIAdapter


def _make_adapter(model: str) -> OpenAIAdapter:
    """Build an ``OpenAIAdapter`` with only the bits ``_system_role`` needs."""
    client = MagicMock()
    client.__module__ = "openai"
    client.__class__.__name__ = "OpenAI"
    client.model = model
    client.chat.completions.create = MagicMock()
    return OpenAIAdapter(client=client, model=model)


@pytest.mark.parametrize(
    "model",
    [
        "gpt-4",
        "gpt-4o",
        "gpt-4.1",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
    ],
)
def test_gpt_models_use_system(model: str) -> None:
    adapter = _make_adapter(model)
    assert adapter._system_role() == "system"


@pytest.mark.parametrize(
    "model",
    [
        "o1",
        "o3",
        "o3-mini",
        "o4-mini",
    ],
)
def test_reasoning_models_use_developer(model: str) -> None:
    adapter = _make_adapter(model)
    assert adapter._system_role() == "developer"


@pytest.mark.parametrize("model", ["o1-mini", "o1-preview"])
def test_legacy_o1_reasoning_models_use_user(model: str) -> None:
    adapter = _make_adapter(model)
    assert adapter._system_role() == "user"


def test_azure_prefix_stripped_for_reasoning_model() -> None:
    adapter = _make_adapter("azure/o3-mini")
    assert adapter._system_role() == "developer"


def test_azure_prefix_stripped_for_gpt_model() -> None:
    adapter = _make_adapter("azure/gpt-4o")
    assert adapter._system_role() == "system"


def test_empty_model_defaults_to_developer() -> None:
    adapter = _make_adapter("")
    # Sanity-check the fixture: ``_make_adapter("")`` sets ``client.model = ""``,
    # so ``OpenAIAdapter.model_name`` resolves to ``""`` and ``_system_role``
    # exercises its empty-string fallback.
    assert adapter.model_name == ""
    assert adapter._system_role() == "developer"


def test_unknown_model_defaults_to_developer() -> None:
    adapter = _make_adapter("claude-3-opus")
    assert adapter._system_role() == "developer"


def test_fallback_model_name_defaults_to_developer() -> None:
    """When the client exposes no ``model`` attr, ``model_name`` falls back to
    ``"openai-model"`` — which doesn't match ``gpt-*`` or ``o\\d`` and so still
    routes to ``"developer"``."""
    client = MagicMock(spec=["chat", "__module__", "__class__"])
    client.__module__ = "openai"
    client.__class__.__name__ = "OpenAI"
    client.chat.completions.create = MagicMock()
    adapter = OpenAIAdapter(client=client, model="")
    assert adapter.model_name == "openai-model"
    assert adapter._system_role() == "developer"
