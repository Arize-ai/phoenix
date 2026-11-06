"""The URL rules for each decision client style.

The cases in ``decision_endpoint_cases.json`` beside this file are data so the settings
form, which previews the URL as it is typed, runs the same ones.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from phoenix.db.types import model_provider as mp
from phoenix.server.api.helpers.decision_clients import OllamaDecisionClient
from phoenix.server.decisions.endpoints import (
    decision_client_base_url,
    decision_endpoint_url,
    guess_decision_base_url,
    resolve_decision_base_url,
)

_CASES: dict[str, list[dict[str, Any]]] = json.loads(
    (Path(__file__).parent / "decision_endpoint_cases.json").read_text()
)


@pytest.mark.parametrize(
    "case", _CASES["endpointUrl"], ids=lambda case: f"{case['decisionSdk']}:{case['baseUrl']}"
)
def test_endpoint_url(case: dict[str, Any]) -> None:
    assert decision_endpoint_url(case["decisionSdk"], case["baseUrl"]) == case["url"]


@pytest.mark.parametrize(
    "case",
    _CASES["guessBaseUrl"],
    ids=lambda case: f"{case['decisionSdk']}:{case['chatBaseUrl']}",
)
def test_guessed_base_url(case: dict[str, Any]) -> None:
    assert guess_decision_base_url(case["decisionSdk"], case["chatBaseUrl"]) == case["baseUrl"]


@pytest.mark.parametrize("decision_sdk", ["openai", "typesafe"])
@pytest.mark.parametrize(
    "chat_base_url",
    [None, "https://api.openai.com/v1", "https://api.typesafe.ai", "http://localhost:11434/v1/"],
)
def test_a_guess_posts_where_the_chat_base_url_would(decision_sdk: Any, chat_base_url: Any) -> None:
    """The form shows the guess; a run without a decision base URL uses the chat base URL.
    Both reach the same endpoint."""
    guess = guess_decision_base_url(decision_sdk, chat_base_url)
    config = mp.OpenAICustomProviderConfig(
        openai_authentication_method=mp.AuthenticationMethodApiKey(api_key="sk"),
        openai_client_kwargs=mp.OpenAIClientKwargs(base_url=chat_base_url)
        if chat_base_url
        else None,
    )
    resolved = resolve_decision_base_url(decision_sdk, config)
    assert decision_endpoint_url(decision_sdk, resolved) == decision_endpoint_url(
        decision_sdk, guess
    )


def test_a_configured_decision_base_url_wins_over_the_chat_one() -> None:
    config = mp.OpenAICustomProviderConfig(
        openai_authentication_method=mp.AuthenticationMethodApiKey(api_key="sk"),
        openai_client_kwargs=mp.OpenAIClientKwargs(base_url="https://chat.example/v1"),
        decision_models=mp.DecisionModelsConfig(base_url="https://api.typesafe.ai"),
    )
    assert resolve_decision_base_url("typesafe", config) == "https://api.typesafe.ai"


def test_azure_guesses_its_v1_api() -> None:
    config = mp.AzureOpenAICustomProviderConfig(
        azure_openai_authentication_method=mp.AuthenticationMethodApiKey(api_key="az"),
        azure_openai_client_kwargs=mp.AzureOpenAIClientKwargs(
            azure_endpoint="https://res.openai.azure.com/"
        ),
    )
    assert (
        decision_endpoint_url("openai", resolve_decision_base_url("openai", config))
        == "https://res.openai.azure.com/openai/v1/decisions"
    )


def test_a_typesafe_provider_uses_its_own_base_url() -> None:
    """Its decision models' base URL, if one was somehow stored, is never used."""
    config = mp.TypeSafeCustomProviderConfig(
        typesafe_authentication_method=mp.AuthenticationMethodApiKey(api_key="ts"),
        typesafe_client_kwargs=mp.TypeSafeClientKwargs(base_url="https://system-one.example/v1"),
        decision_models=mp.DecisionModelsConfig(base_url="https://ignored.example"),
    )
    base_url = resolve_decision_base_url("typesafe", config)
    assert decision_endpoint_url("typesafe", base_url) == (
        "https://system-one.example/v1/systemone"
    )
    bare = mp.TypeSafeCustomProviderConfig(
        typesafe_authentication_method=mp.AuthenticationMethodApiKey(api_key="ts"),
    )
    assert resolve_decision_base_url("typesafe", bare) == mp.TYPESAFE_DEFAULT_BASE_URL


@pytest.mark.parametrize(
    ("configured", "expected"),
    [
        ("http://localhost:11434/v1", "http://localhost:11434"),
        ("http://localhost:11434/v1/", "http://localhost:11434"),
        ("http://localhost:11434", "http://localhost:11434"),
        ("http://ollama.internal:8080/v1", "http://ollama.internal:8080"),
    ],
)
def test_ollama_uses_the_system_one_rule(configured: str, expected: str) -> None:
    assert OllamaDecisionClient.resolve_base_url(configured) == expected
    assert decision_client_base_url("typesafe", configured) == expected


def test_decision_models_config_cleans_its_names() -> None:
    config = mp.DecisionModelsConfig(base_url="", model_names=(" jev-latest ", "", "jev-latest"))
    assert config.base_url is None
    assert config.model_names == ("jev-latest",)
