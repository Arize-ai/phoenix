"""Datagen creates one reusable accuracy judge and supplies structured comparison state."""

import json
from types import SimpleNamespace
from typing import Any, Callable, cast
from unittest.mock import AsyncMock

import anyio
import httpx
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
from phoenix.experimental.datagen.evaluators import seed_dataset_decision_evaluators
from phoenix.server.api.helpers.decision_clients import (
    DecisionResponse,
    PredicateAnswer,
    TypeSafeDecisionClient,
)
from phoenix.server.api.helpers.decision_evaluator_service import build_decision_evaluator
from phoenix.server.api.helpers.decision_evaluators import freeze_decision_evaluator
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.types import DbSessionFactory

_DATASET_NAME = "px-datagen-typed-decisions"


async def _name_dataset(db: DbSessionFactory) -> Dataset:
    async with db() as session:
        record = await session.get(models.Dataset, 1)
        assert record is not None
        record.name = _DATASET_NAME
    return cast(Dataset, SimpleNamespace(id=str(GlobalID("Dataset", "1")), name=_DATASET_NAME))


def _seeder(
    httpx_client: httpx.AsyncClient,
    dataset: Dataset,
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
        response = anyio.from_thread.run(httpx_client.send, request)
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
            return seed_dataset_decision_evaluators(http, [dataset])

    return seed


async def test_seed_reuses_judge_and_binding_and_repairs_drift(
    httpx_client: httpx.AsyncClient,
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
        frozen = freeze_decision_evaluator(evaluator)
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
        json={"type": "decision", "decision_version_id": drifted_id},
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
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == 6
    async with db() as session:
        evaluator = await session.scalar(select(models.DecisionEvaluator))
        assert evaluator is not None
        assert evaluator.selected_version.id not in {
            original_version_id,
            int(GlobalID.from_id(drifted_id).node_id),
        }
        assert evaluator.selected_version.model_name == "jev-latest"
        binding = await session.get(
            models.DatasetEvaluators, int(GlobalID.from_id(first[0][1]).node_id)
        )
        assert binding is not None and binding.input_mapping == mapping
    assert await anyio.to_thread.run_sync(seed) == first
    assert len(writes) == 6


async def test_other_datasets_do_not_receive_an_accuracy_judge() -> None:
    dataset = cast(Dataset, SimpleNamespace(name="another-dataset"))
    with httpx.Client(
        base_url="http://unused/",
        transport=httpx.MockTransport(lambda request: pytest.fail("Unexpected request")),
    ) as http:
        assert seed_dataset_decision_evaluators(http, [dataset]) == []


async def test_seed_refuses_an_evaluator_of_another_type_with_the_same_name(
    httpx_client: httpx.AsyncClient,
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
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    empty_dataset: None,
) -> None:
    dataset = await _name_dataset(db)
    first = await anyio.to_thread.run_sync(_seeder(httpx_client, dataset, []))
    judge = await httpx_client.get("/v1/evaluators", params={"name": f"{_DATASET_NAME}-accuracy"})
    version_id = judge.json()["data"][0]["decision_version_id"]
    created = await httpx_client.post(
        "/v1/evaluators",
        json={"type": "decision", "name": "another-judge", "decision_version_id": version_id},
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
