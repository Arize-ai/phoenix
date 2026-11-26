"""Seed datagen's custom providers and decision judges."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterator
from urllib.parse import quote

import httpx

from phoenix.experimental.datagen.datasets import DatasetError
from phoenix.experimental.datagen.decisions import (
    TYPED_DECISIONS_DATASET_NAME,
    _graphql,
    seed_decision,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from phoenix.client.resources.datasets import Dataset

_EVALUATOR_NAME = f"{TYPED_DECISIONS_DATASET_NAME}-accuracy"
_INPUT_MAPPING = {
    "literal_mapping": {},
    "path_mapping": {"reference": "reference", "output": "output"},
}

CUSTOM_PROVIDERS: dict[str, dict[str, Any]] = {
    "px-datagen-openai": {
        "provider": "openai",
        "sdk": "OPENAI",
        "description": "Datagen-owned OpenAI custom provider.",
        "models": {"chat": {}, "decision": {}},
        "clientConfig": {
            "openai": {
                "openaiAuthenticationMethod": {"apiKey": "fake"},
            }
        },
    },
    "px-datagen-anthropic": {
        "provider": "anthropic",
        "sdk": "ANTHROPIC",
        "description": "Datagen-owned Anthropic custom provider.",
        "models": {"chat": {}},
        "clientConfig": {
            "anthropic": {
                "anthropicAuthenticationMethod": {"apiKey": "fake"},
            }
        },
    },
    "px-datagen-google": {
        "provider": "google",
        "sdk": "GOOGLE_GENAI",
        "description": "Datagen-owned Google GenAI custom provider.",
        "models": {"chat": {}},
        "clientConfig": {
            "googleGenai": {
                "googleGenaiAuthenticationMethod": {"apiKey": "fake"},
            }
        },
    },
    "px-datagen-typesafe": {
        "provider": "typesafe",
        "sdk": "TYPESAFE",
        "description": "Datagen-owned TypeSafe custom provider.",
        "models": {"decision": {}},
        "clientConfig": {
            "typesafe": {
                "typesafeAuthenticationMethod": {"apiKey": "fake"},
            }
        },
    },
}

_FIND_CUSTOM_PROVIDERS = """
query DatagenCustomProviders($after: String) {
  generativeModelCustomProviders(first: 100, after: $after) {
    edges { node { id name sdk modelTypes } }
    pageInfo { hasNextPage endCursor }
  }
}
"""
_CREATE_CUSTOM_PROVIDER = """
mutation DatagenCreateCustomProvider($input: CreateGenerativeModelCustomProviderMutationInput!) {
  createGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""
_PATCH_CUSTOM_PROVIDER = """
mutation DatagenPatchCustomProvider($input: PatchGenerativeModelCustomProviderMutationInput!) {
  patchGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""

ONLINE_JUDGE_NAME = "px-datagen-addresses-request"
ONLINE_JUDGE_PROJECT_NAME = "support-chatbot"
ONLINE_JUDGE_BINDINGS: dict[str, dict[str, Any]] = {
    "addresses-request-span": {
        "evaluation_target": "SPAN",
        "filter_condition": "span_kind == 'LLM'",
        "sampling_rate": 0.2,
        "input_mapping": {
            "literal_mapping": {},
            "path_mapping": {"request": "input.messages[-1]", "response": "output.messages"},
        },
    },
    "addresses-request-trace": {
        "evaluation_target": "TRACE",
        "filter_condition": "",
        "sampling_rate": 1.0,
        "evaluation_delay_seconds": 60,
        "input_mapping": {
            "literal_mapping": {},
            "path_mapping": {
                "request": "metadata.attributes.llm.input_messages[-1].message",
                "response": "metadata.attributes.llm.output_messages[0].message",
            },
        },
    },
    "addresses-request-session": {
        "evaluation_target": "SESSION",
        "filter_condition": "",
        "sampling_rate": 1.0,
        "evaluation_delay_seconds": 60,
        "input_mapping": {
            "literal_mapping": {},
            "path_mapping": {"request": "input", "response": "output"},
        },
    },
}


# Settings users tune while testing online evals. Seeding sets them on a new binding and
# leaves them alone afterward, as it does `enabled`.
_USER_TUNED_BINDING_SETTINGS = frozenset(
    {"filter_condition", "sampling_rate", "evaluation_delay_seconds"}
)


def _list(http: httpx.Client, path: str, **filters: str) -> Iterator[dict[str, Any]]:
    cursor = None
    while True:
        params = dict(filters)
        if cursor is not None:
            params["cursor"] = cursor
        response = http.get(path, params=params)
        response.raise_for_status()
        page = response.json()
        yield from page["data"]
        cursor = page.get("next_cursor")
        if cursor is None:
            return


def _custom_providers_by_name(http: httpx.Client) -> dict[str, dict[str, Any]]:
    providers: dict[str, dict[str, Any]] = {}
    after = None
    while True:
        connection = _graphql(http, _FIND_CUSTOM_PROVIDERS, {"after": after})[
            "generativeModelCustomProviders"
        ]
        for edge in connection["edges"]:
            provider: dict[str, Any] = edge["node"]
            providers[provider["name"]] = provider
        if not connection["pageInfo"]["hasNextPage"]:
            return providers
        after = connection["pageInfo"]["endCursor"]


def seed_custom_providers(http: httpx.Client) -> list[tuple[str, str]]:
    """Seed one custom provider per supported mock SDK, with fake credentials and no base URL.

    Existing providers with the same name and SDK are left untouched so that a base URL or
    credential configured in the UI or by an agent survives restarts.
    """
    existing = _custom_providers_by_name(http)
    results = []
    for name, spec in CUSTOM_PROVIDERS.items():
        saved = existing.get(name)
        if saved is None:
            created = _graphql(
                http,
                _CREATE_CUSTOM_PROVIDER,
                {
                    "input": {
                        "name": name,
                        "description": spec["description"],
                        "provider": spec["provider"],
                        "models": spec["models"],
                        "clientConfig": spec["clientConfig"],
                    }
                },
            )["createGenerativeModelCustomProvider"]["provider"]
            provider_id = str(created["id"])
        elif saved["sdk"] != spec["sdk"]:
            raise DatasetError(f"{name}: a custom provider with another SDK already exists")
        else:
            provider_id = str(saved["id"])
            expected_model_types = {key.upper() for key in spec["models"]}
            if not expected_model_types.issubset(saved.get("modelTypes", ())):
                _graphql(
                    http,
                    _PATCH_CUSTOM_PROVIDER,
                    {"input": {"id": provider_id, "models": spec["models"]}},
                )
        results.append((name, provider_id))
    return results


def _seed_decision_evaluator(http: httpx.Client, name: str, version_id: str) -> str:
    """Create the named decision evaluator, or move it onto ``version_id``."""
    evaluator = next(
        (value for value in _list(http, "v1/evaluators", name=name) if value["name"] == name),
        None,
    )
    selector = {"selector": {"type": "version", "decision_version_id": version_id}}
    if evaluator is None:
        response = http.post(
            "v1/evaluators", json={"type": "decision", "name": name, "decision": selector}
        )
        response.raise_for_status()
        evaluator = response.json()["data"]
    elif evaluator["type"] != "decision":
        raise DatasetError(f"{name}: an evaluator of another type already exists")
    elif evaluator["decision"]["resolved_decision_version_id"] != version_id:
        response = http.patch(
            f"v1/evaluators/{quote(evaluator['id'], safe='')}",
            json={"type": "decision", "decision": selector},
        )
        response.raise_for_status()
    return str(evaluator["id"])


def seed_dataset_decision_evaluators(
    http: httpx.Client, datasets: Sequence[Dataset]
) -> list[tuple[str, str]]:
    """Attach the accuracy judge once, repairing its version or mapping when changed.

    Seeding saves definitions and bindings without invoking a model or requiring its key.
    Only the combined Typed Decisions dataset receives this evaluator.
    """
    results = []
    for dataset in datasets:
        if dataset.name != TYPED_DECISIONS_DATASET_NAME:
            continue
        version_id = seed_decision(
            http,
            name=_EVALUATOR_NAME,
            metadata={"datagen": True, "dataset_name": dataset.name},
            version={
                "templateFormat": "MUSTACHE",
                "state": {"json": {"reference": "{{reference}}", "output": "{{output}}"}},
                "questions": [
                    {
                        "predicate": {
                            "name": "accuracy",
                            "instructions": "is the output accurate",
                            "criteria": None,
                        }
                    }
                ],
                "modelProvider": "TYPESAFE",
                "modelName": "jev-latest",
                "customProviderId": None,
                "description": "Datagen-owned accuracy judge for Typed Decisions experiments.",
                "metadata": {"datagen": True, "dataset_name": dataset.name},
            },
        )
        evaluator_id = _seed_decision_evaluator(http, _EVALUATOR_NAME, version_id)
        path = f"v1/datasets/{quote(dataset.id, safe='')}/evaluators"
        binding = next((value for value in _list(http, path) if value["name"] == "accuracy"), None)
        if binding is None:
            response = http.post(
                path,
                json={
                    "name": "accuracy",
                    "evaluator_id": evaluator_id,
                    "input_mapping": _INPUT_MAPPING,
                },
            )
            response.raise_for_status()
            binding = response.json()["data"]
        elif binding["evaluator_id"] != evaluator_id:
            raise DatasetError(f"{dataset.name}: accuracy is already bound to another evaluator")
        elif binding["input_mapping"] != _INPUT_MAPPING:
            response = http.patch(
                f"v1/dataset_evaluators/{quote(binding['id'], safe='')}",
                json={"input_mapping": _INPUT_MAPPING},
            )
            response.raise_for_status()
        results.append((f"{dataset.name}/accuracy", binding["id"]))
    return results


def seed_online_decision_judge(
    http: httpx.Client, *, model_provider: str = "TYPESAFE", model_name: str = "jev-latest"
) -> list[tuple[str, str]]:
    """Bind one response judge to the support chatbot's LLM spans, traces, and sessions.

    Bindings are created disabled so seeding never queues a model call. A re-run leaves
    their enabled state, filter, sampling rate, and evaluation delay alone, keeps the
    judge's model choice, and repairs the judge's questions and the bindings' input mapping.
    """
    metadata = {"datagen": True, "project_name": ONLINE_JUDGE_PROJECT_NAME}
    version_id = seed_decision(
        http,
        name=ONLINE_JUDGE_NAME,
        metadata=metadata,
        version={
            "templateFormat": "MUSTACHE",
            "state": {"json": {"request": "{{request}}", "response": "{{response}}"}},
            "questions": [
                {
                    "predicate": {
                        "name": "addresses_request",
                        "instructions": "does the assistant's response address the user's request",
                        "criteria": None,
                    }
                }
            ],
            "modelProvider": model_provider,
            "modelName": model_name,
            "customProviderId": None,
            "description": "Datagen-owned judge of support chatbot responses for online evals.",
            "metadata": metadata,
        },
    )
    evaluator_id = _seed_decision_evaluator(http, ONLINE_JUDGE_NAME, version_id)
    project = quote(ONLINE_JUDGE_PROJECT_NAME, safe="")
    response = http.get(f"v1/projects/{project}")
    if response.status_code == 404:
        http.post("v1/projects", json={"name": ONLINE_JUDGE_PROJECT_NAME}).raise_for_status()
    else:
        response.raise_for_status()
    path = f"v1/projects/{project}/evaluators"
    bindings = {value["name"]: value for value in _list(http, path)}
    results = []
    for name, settings in ONLINE_JUDGE_BINDINGS.items():
        binding = bindings.get(name)
        if binding is None:
            response = http.post(
                path,
                json={"name": name, "evaluator_id": evaluator_id, "enabled": False, **settings},
            )
            response.raise_for_status()
            binding = response.json()["data"]
        elif binding["evaluator_id"] != evaluator_id:
            raise DatasetError(f"{ONLINE_JUDGE_PROJECT_NAME}: {name} is bound to another evaluator")
        elif binding["evaluation_target"] != settings["evaluation_target"]:
            raise DatasetError(f"{ONLINE_JUDGE_PROJECT_NAME}: {name} evaluates another target")
        elif drift := {
            key: value
            for key, value in settings.items()
            if key != "evaluation_target"
            and key not in _USER_TUNED_BINDING_SETTINGS
            and binding[key] != value
        }:
            response = http.patch(
                f"v1/project_evaluators/{quote(binding['id'], safe='')}", json=drift
            )
            response.raise_for_status()
        results.append((f"{ONLINE_JUDGE_PROJECT_NAME}/{name}", binding["id"]))
    return results
