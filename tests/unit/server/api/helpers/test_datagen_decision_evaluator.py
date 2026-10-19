"""Datagen creates one reusable accuracy judge and supplies structured comparison state."""

import json
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import anyio
import httpx
import pytest
from phoenix.client.resources.datasets import Dataset
from pydantic import SecretStr
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.evaluators import InputMapping
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


async def test_seed_reuses_judge_and_binding_and_repairs_drift(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    empty_dataset: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dataset_name = "px-datagen-typed-decisions"
    dataset = cast(Dataset, SimpleNamespace(id=str(GlobalID("Dataset", "1")), name=dataset_name))
    async with db() as session:
        record = await session.get(models.Dataset, 1)
        assert record is not None
        record.name = dataset_name

    writes: list[str] = []

    def forward(request: httpx.Request) -> httpx.Response:
        if request.method != "GET":
            if (
                request.url.path != "/graphql"
                or "mutation " in json.loads(request.content)["query"]
            ):
                writes.append(f"{request.method} {request.url.path}")
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

    async with db() as session:
        evaluator = await session.scalar(select(models.DecisionEvaluator))
        assert evaluator is not None
        evaluator.selected_version.model_name = "changed-model"
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
        assert evaluator.selected_version.id != original_version_id
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
