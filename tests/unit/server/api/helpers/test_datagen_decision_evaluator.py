"""Datagen creates one reusable accuracy judge and supplies structured comparison state."""

import json
from types import SimpleNamespace
from typing import Any, Callable, cast
from unittest.mock import AsyncMock

import anyio
import httpx
import httpx2
import pytest
from phoenix.client.resources.datasets import Dataset
from pydantic import SecretStr
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.experimental.datagen.datasets import DatasetError
from phoenix.experimental.datagen.evaluators import (
    CUSTOM_PROVIDERS,
    ONLINE_JUDGE_BINDINGS,
    ONLINE_JUDGE_NAME,
    ONLINE_JUDGE_PROJECT_NAME,
    seed_custom_providers,
    seed_dataset_decision_evaluators,
    seed_online_decision_judge,
)
from phoenix.server.api.helpers.decision_clients import (
    DecisionResponse,
    PredicateAnswer,
    TypeSafeDecisionClient,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.evaluators.resolution import build_decision_evaluator
from phoenix.server.evaluators.snapshots import capture_decision_evaluator_definition
from phoenix.server.redaction import Redactor
from phoenix.server.types import DbSessionFactory

_DATASET_NAME = "px-datagen-typed-decisions"


async def _name_dataset(db: DbSessionFactory) -> Dataset:
    async with db() as session:
        record = await session.get(models.Dataset, 1)
        assert record is not None
        record.name = _DATASET_NAME
    return cast(Dataset, SimpleNamespace(id=str(GlobalID("Dataset", "1")), name=_DATASET_NAME))


def _forwarding_seeder(
    httpx_client: httpx2.AsyncClient,
    run: Callable[[httpx.Client], list[tuple[str, str]]],
    writes: list[str],
    versions: list[dict[str, Any]] | None = None,
) -> Callable[[], list[tuple[str, str]]]:
    def forward(request: httpx.Request) -> httpx.Response:
        if request.method != "GET":
            if request.url.path != "/graphql":
                writes.append(f"{request.method} {request.url.path}")
            else:
                body = json.loads(request.content)
                if "mutation " in body["query"]:
                    writes.append(f"{request.method} {request.url.path}")
                    if versions is not None:
                        versions.append(body["variables"]["input"]["version"])
        response = anyio.from_thread.run(
            httpx_client.send,
            httpx2.Request(
                request.method, str(request.url), headers=request.headers, content=request.content
            ),
        )
        return httpx.Response(
            response.status_code,
            headers={
                key: value
                for key, value in response.headers.items()
                if key not in {"content-encoding", "content-length"}
            },
            content=response.content,
        )

    def seed() -> list[tuple[str, str]]:
        with httpx.Client(base_url="http://test/", transport=httpx.MockTransport(forward)) as http:
            return run(http)

    return seed


def _seeder(
    httpx_client: httpx2.AsyncClient,
    dataset: Dataset,
    writes: list[str],
    versions: list[dict[str, Any]] | None = None,
) -> Callable[[], list[tuple[str, str]]]:
    return _forwarding_seeder(
        httpx_client,
        lambda http: seed_dataset_decision_evaluators(http, [dataset]),
        writes,
        versions,
    )


async def test_seed_reuses_judge_and_binding_and_repairs_drift(
    httpx_client: httpx2.AsyncClient,
    db: DbSessionFactory,
    empty_dataset: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dataset_name = _DATASET_NAME
    dataset = await _name_dataset(db)
    writes: list[str] = []
    versions: list[dict[str, Any]] = []
    seed = _seeder(httpx_client, dataset, writes, versions)

    first = await anyio.to_thread.run_sync(seed)
    assert len(first) == 1 and first[0][0] == f"{dataset_name}/accuracy"
    assert len(writes) == 3
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == 3

    async with db() as session:
        evaluator = await session.scalar(select(models.DecisionEvaluator))
        assert evaluator is not None
        original_version_id = evaluator.selected_version.id
        assert evaluator.name.root == f"{dataset_name}-accuracy"
        assert evaluator.selected_version.model_name == "jev-latest"
        binding = await session.get(
            models.DatasetEvaluators, int(GlobalID.from_id(first[0][1]).node_id)
        )
        assert binding is not None
        assert binding.name.root == "accuracy"
        assert binding.input_mapping.path_mapping == {"reference": "reference", "output": "output"}
        frozen = capture_decision_evaluator_definition(evaluator)
        judge = await build_decision_evaluator(
            frozen,
            session=session,
            decrypt=lambda value: value,
            credentials=[
                GenerativeCredentialInput(env_var_name="TYPESAFE_API_KEY", value=SecretStr("test"))
            ],
        )
        mapping = binding.input_mapping

    invoke = AsyncMock(
        return_value=DecisionResponse(
            model="jev-resolved",
            answers={"accuracy": PredicateAnswer(probability=0.9)},
            input_tokens=1,
            output_tokens=1,
        )
    )
    monkeypatch.setattr(TypeSafeDecisionClient, "invoke", invoke)
    reference = {"route": "billing", "flag": True}
    output = {"route": "billing", "flag": True}
    results = await judge.evaluate(
        context={"reference": reference, "output": output, "input": {"ignored": True}},
        input_mapping=mapping,
        name="accuracy",
        output_configs=list(judge.output_configs),
    )
    request = invoke.call_args.args[0]
    assert request.state == {"reference": reference, "output": output}
    assert isinstance(judge.client, TypeSafeDecisionClient)
    assert judge.client._build_request(request)["questions"] == {
        "accuracy": {"type": "noul", "instructions": "is the output accurate"},
    }
    assert results[0]["name"] == "accuracy" and results[0]["score"] == 0.9
    assert invoke.await_count == 1

    # A user publishes a newer decision version with another model and moves the judge onto it.
    async with db() as session:
        evaluator = await session.scalar(select(models.DecisionEvaluator))
        assert evaluator is not None
        decision_id = evaluator.selected_version.decision_id
        evaluator_gid = str(GlobalID("DecisionEvaluator", str(evaluator.id)))
    created = await httpx_client.post(
        "/graphql",
        json={
            "query": "mutation($input: CreateDecisionVersionInput!)"
            " { createDecisionVersion(input: $input) { version { id } } }",
            "variables": {
                "input": {
                    "decisionId": str(GlobalID("Decision", str(decision_id))),
                    "version": {**versions[0], "modelName": "changed-model"},
                }
            },
        },
    )
    assert created.status_code == 200 and "errors" not in created.json()
    drifted_id = created.json()["data"]["createDecisionVersion"]["version"]["id"]
    moved = await httpx_client.patch(
        f"/v1/evaluators/{evaluator_gid}",
        json={
            "type": "decision",
            "decision": {"selector": {"type": "version", "decision_version_id": drifted_id}},
        },
    )
    assert moved.status_code == 200
    async with db() as session:
        evaluator = await session.scalar(select(models.DecisionEvaluator))
        assert evaluator is not None
        assert evaluator.selected_version.model_name == "changed-model"
        binding = await session.get(
            models.DatasetEvaluators, int(GlobalID.from_id(first[0][1]).node_id)
        )
        assert binding is not None
        binding.input_mapping = InputMapping(
            literal_mapping={"reference": {}}, path_mapping={"output": "output"}
        )
    # Re-seeding keeps the user's model and version, and repairs only the input mapping.
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == 4
    async with db() as session:
        evaluator = await session.scalar(select(models.DecisionEvaluator))
        assert evaluator is not None
        assert evaluator.selected_version.id == int(GlobalID.from_id(drifted_id).node_id)
        assert evaluator.selected_version.id != original_version_id
        assert evaluator.selected_version.model_name == "changed-model"
        binding = await session.get(
            models.DatasetEvaluators, int(GlobalID.from_id(first[0][1]).node_id)
        )
        assert binding is not None and binding.input_mapping == mapping
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == 4


async def test_seed_online_judge_binds_each_grain_disabled_once(
    httpx_client: httpx2.AsyncClient,
    db: DbSessionFactory,
) -> None:
    writes: list[str] = []
    seed = _forwarding_seeder(httpx_client, seed_online_decision_judge, writes)

    first = await anyio.to_thread.run_sync(seed)
    assert [name for name, _ in first] == [
        f"{ONLINE_JUDGE_PROJECT_NAME}/{name}" for name in ONLINE_JUDGE_BINDINGS
    ]
    assert len(writes) == 6
    async with db() as session:
        evaluator = await session.scalar(select(models.DecisionEvaluator))
        assert evaluator is not None
        assert evaluator.name.root == ONLINE_JUDGE_NAME
        assert evaluator.selected_version.model_provider.value == "TYPESAFE"
        assert evaluator.selected_version.model_name == "jev-latest"
        bindings = (
            await session.scalars(
                select(models.ProjectEvaluator)
                .join(models.Project, models.ProjectEvaluator.project_id == models.Project.id)
                .where(models.Project.name == ONLINE_JUDGE_PROJECT_NAME)
            )
        ).all()
        assert {
            binding.name.root: (
                binding.evaluator_id,
                binding.evaluation_target,
                binding.input_mapping.path_mapping if binding.input_mapping else None,
                binding.enabled,
            )
            for binding in bindings
        } == {
            name: (
                evaluator.id,
                settings["evaluation_target"],
                settings["input_mapping"]["path_mapping"],
                False,
            )
            for name, settings in ONLINE_JUDGE_BINDINGS.items()
        }
        for binding in bindings:
            binding.enabled = True
            binding.sampling_rate = 0.05
            binding.filter_condition = "latency_ms > 100"
            if binding.evaluation_target != "SPAN":
                binding.evaluation_delay_seconds = 120
        drifted = next(binding for binding in bindings if binding.evaluation_target == "SPAN")
        drifted.input_mapping = InputMapping(literal_mapping={}, path_mapping={"request": "input"})

    # Re-seeding repairs the input mapping and leaves the settings a user tunes alone.
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == 7
    async with db() as session:
        bindings = (await session.scalars(select(models.ProjectEvaluator))).all()
        assert all(
            (
                binding.enabled,
                binding.sampling_rate,
                binding.evaluation_delay_seconds,
                binding.filter_condition,
            )
            == (True, 0.05, 0 if binding.evaluation_target == "SPAN" else 120, "latency_ms > 100")
            for binding in bindings
        )
        assert {
            binding.name.root: binding.input_mapping.path_mapping if binding.input_mapping else None
            for binding in bindings
        } == {
            name: settings["input_mapping"]["path_mapping"]
            for name, settings in ONLINE_JUDGE_BINDINGS.items()
        }


async def test_other_datasets_do_not_receive_an_accuracy_judge() -> None:
    dataset = cast(Dataset, SimpleNamespace(name="another-dataset"))
    with httpx.Client(
        base_url="http://unused/",
        transport=httpx.MockTransport(lambda request: pytest.fail("Unexpected request")),
    ) as http:
        assert seed_dataset_decision_evaluators(http, [dataset]) == []


async def test_seed_refuses_an_evaluator_of_another_type_with_the_same_name(
    httpx_client: httpx2.AsyncClient,
    db: DbSessionFactory,
    empty_dataset: None,
    sandbox_config: models.SandboxConfig,
) -> None:
    dataset = await _name_dataset(db)
    async with db() as session:
        session.add(
            models.CodeEvaluator(
                name=Identifier.model_validate(f"{_DATASET_NAME}-accuracy"),
                description=None,
                metadata_={},
                language=sandbox_config.language,
                sandbox_config_id=sandbox_config.id,
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    ContinuousOutputConfig(
                        type="CONTINUOUS",
                        name="score",
                        optimization_direction=OptimizationDirection.MAXIMIZE,
                    )
                ],
                versions=[models.CodeEvaluatorVersion(source_code="def evaluate(output): ...")],
            )
        )
    seed = _seeder(httpx_client, dataset, [])
    with pytest.raises(DatasetError, match="an evaluator of another type already exists"):
        await anyio.to_thread.run_sync(seed)
    async with db() as session:
        assert await session.scalar(select(models.DecisionEvaluator)) is None


async def test_seed_refuses_an_accuracy_binding_to_another_evaluator(
    httpx_client: httpx2.AsyncClient,
    db: DbSessionFactory,
    empty_dataset: None,
) -> None:
    dataset = await _name_dataset(db)
    first = await anyio.to_thread.run_sync(_seeder(httpx_client, dataset, []))
    judge = await httpx_client.get("/v1/evaluators", params={"name": f"{_DATASET_NAME}-accuracy"})
    version_id = judge.json()["data"][0]["decision"]["resolved_decision_version_id"]
    created = await httpx_client.post(
        "/v1/evaluators",
        json={
            "type": "decision",
            "name": "another-judge",
            "decision": {"selector": {"type": "version", "decision_version_id": version_id}},
        },
    )
    assert created.status_code == 201
    other_id = int(GlobalID.from_id(created.json()["data"]["id"]).node_id)
    async with db() as session:
        binding = await session.get(
            models.DatasetEvaluators, int(GlobalID.from_id(first[0][1]).node_id)
        )
        assert binding is not None
        binding.evaluator_id = other_id
    seed = _seeder(httpx_client, dataset, [])
    with pytest.raises(DatasetError, match="accuracy is already bound to another evaluator"):
        await anyio.to_thread.run_sync(seed)


async def test_seed_custom_providers_creates_each_once_with_blank_url_and_preserves_edits(
    httpx_client: httpx2.AsyncClient,
    db: DbSessionFactory,
    redactor: Redactor,
) -> None:
    writes: list[str] = []
    seed = _forwarding_seeder(httpx_client, seed_custom_providers, writes)

    first = await anyio.to_thread.run_sync(seed)
    assert [name for name, _ in first] == list(CUSTOM_PROVIDERS)
    assert len(writes) == len(CUSTOM_PROVIDERS)
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == len(CUSTOM_PROVIDERS)

    query = await httpx_client.post(
        "/graphql",
        json={
            "query": """
            {
              generativeModelCustomProviders(first: 10) {
                edges {
                  node {
                    id
                    name
                    provider
                    sdk
                    config {
                      __typename
                      ... on OpenAICustomProviderConfig {
                        openaiAuthenticationMethod { apiKey }
                        openaiClientKwargs { baseUrl }
                      }
                      ... on AnthropicCustomProviderConfig {
                        anthropicAuthenticationMethod { apiKey }
                        anthropicClientKwargs { baseUrl }
                      }
                      ... on GoogleGenAICustomProviderConfig {
                        googleGenaiAuthenticationMethod { apiKey }
                        googleGenaiClientKwargs { httpOptions { baseUrl } }
                      }
                      ... on TypeSafeCustomProviderConfig {
                        typesafeAuthenticationMethod { apiKey }
                        typesafeClientKwargs { baseUrl }
                      }
                    }
                  }
                }
              }
            }
            """
        },
    )
    assert query.status_code == 200 and "errors" not in query.json()
    nodes = {
        edge["node"]["name"]: edge["node"]
        for edge in query.json()["data"]["generativeModelCustomProviders"]["edges"]
    }
    assert set(nodes) == set(CUSTOM_PROVIDERS)
    assert nodes["px-datagen-openai"]["provider"] == "openai"
    assert nodes["px-datagen-openai"]["sdk"] == "OPENAI"
    assert (
        redactor.unredact(
            nodes["px-datagen-openai"]["config"]["openaiAuthenticationMethod"]["apiKey"]
        )
        == "fake"
    )
    assert nodes["px-datagen-openai"]["config"]["openaiClientKwargs"] is None
    assert nodes["px-datagen-anthropic"]["provider"] == "anthropic"
    assert nodes["px-datagen-anthropic"]["sdk"] == "ANTHROPIC"
    assert (
        redactor.unredact(
            nodes["px-datagen-anthropic"]["config"]["anthropicAuthenticationMethod"]["apiKey"]
        )
        == "fake"
    )
    assert nodes["px-datagen-anthropic"]["config"]["anthropicClientKwargs"] is None
    assert nodes["px-datagen-google"]["provider"] == "google"
    assert nodes["px-datagen-google"]["sdk"] == "GOOGLE_GENAI"
    assert (
        redactor.unredact(
            nodes["px-datagen-google"]["config"]["googleGenaiAuthenticationMethod"]["apiKey"]
        )
        == "fake"
    )
    assert nodes["px-datagen-google"]["config"]["googleGenaiClientKwargs"] is None
    assert nodes["px-datagen-typesafe"]["provider"] == "typesafe"
    assert nodes["px-datagen-typesafe"]["sdk"] == "TYPESAFE"
    assert (
        redactor.unredact(
            nodes["px-datagen-typesafe"]["config"]["typesafeAuthenticationMethod"]["apiKey"]
        )
        == "fake"
    )
    assert nodes["px-datagen-typesafe"]["config"]["typesafeClientKwargs"] is None

    # Adding a base URL on a seeded provider is preserved across re-seeding.
    patched = await httpx_client.post(
        "/graphql",
        json={
            "query": """
            mutation($input: PatchGenerativeModelCustomProviderMutationInput!) {
              patchGenerativeModelCustomProvider(input: $input) { provider { id } }
            }
            """,
            "variables": {
                "input": {
                    "id": nodes["px-datagen-typesafe"]["id"],
                    "clientConfig": {
                        "typesafe": {
                            "typesafeAuthenticationMethod": {"apiKey": "fake"},
                            "typesafeClientKwargs": {"baseUrl": "http://mock-llm:57593"},
                        }
                    },
                }
            },
        },
    )
    assert patched.status_code == 200 and "errors" not in patched.json()
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == len(CUSTOM_PROVIDERS)

    rechecked = await httpx_client.post(
        "/graphql",
        json={
            "query": """
            query($id: ID!) {
              node(id: $id) {
                ... on GenerativeModelCustomProvider {
                  config {
                    ... on TypeSafeCustomProviderConfig {
                      typesafeClientKwargs { baseUrl }
                    }
                  }
                }
              }
            }
            """,
            "variables": {"id": nodes["px-datagen-typesafe"]["id"]},
        },
    )
    assert (
        rechecked.json()["data"]["node"]["config"]["typesafeClientKwargs"]["baseUrl"]
        == "http://mock-llm:57593"
    )
