import json
from typing import Any

import httpx
import httpx2
import pytest
import respx
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

OLLAMA_SYSTEM_ONE = "http://localhost:11434/v1/systemone"

QUERY = """
  subscription ($input: ExperimentsOverDatasetInput!) {
    experimentsOverDataset(input: $input) {
      __typename
      experimentId
      datasetExampleId
      ... on ChatCompletionSubscriptionExperiment { experiment { id name } }
      ... on ChatCompletionSubscriptionResult { experimentRun { id output error } }
      ... on ChatCompletionSubscriptionError { message }
    }
  }
"""

# Shaped like datagen's benchmarks: each example carries its state and its questions.
EXAMPLES: list[dict[str, Any]] = [
    {
        "input": {
            "state": "The Nile is the longest river in Africa.",
            "questions": {"decision": {"type": "noul", "instructions": "Is this about rivers?"}},
        },
        "output": {"decision": {"type": "noul", "label": "true", "noul": 1.0}},
    },
    {
        "input": {
            "state": {"ticket": "I was charged twice.", "plan": "pro"},
            "questions": {
                "team": {
                    "type": "choice",
                    "instructions": "Which team?",
                    "criteria": {"billing": "Payments", "technical": None},
                }
            },
        },
        "output": {"team": {"type": "choice", "label": "billing"}},
    },
]


@pytest.fixture(autouse=True)
def _route_sdk_http_through_respx(monkeypatch: pytest.MonkeyPatch) -> None:
    """Bridge httpx2 SDK transport to httpx so respx observes real SDK requests."""

    async def handle_request(
        transport: httpx2.AsyncHTTPTransport, request: httpx2.Request
    ) -> httpx2.Response:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                request.method,
                str(request.url),
                headers=dict(request.headers),
                content=await request.aread(),
            )
        return httpx2.Response(
            response.status_code, headers=dict(response.headers), content=response.content
        )

    monkeypatch.setattr(httpx2.AsyncHTTPTransport, "handle_async_request", handle_request)


@pytest.fixture(autouse=True)
def _ollama(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")


@pytest.fixture
async def benchmark_dataset(db: DbSessionFactory) -> list[dict[str, Any]]:
    async with db() as session:
        dataset = models.Dataset(name="benchmark", metadata_={})
        session.add(dataset)
        await session.flush()
        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(version)
        await session.flush()
        for example in EXAMPLES:
            row = models.DatasetExample(dataset_id=dataset.id)
            session.add(row)
            await session.flush()
            session.add(
                models.DatasetExampleRevision(
                    dataset_example_id=row.id,
                    dataset_version_id=version.id,
                    input=example["input"],
                    output=example["output"],
                    metadata_={},
                    revision_kind="CREATE",
                )
            )
        return [{"dataset_id": dataset.id, "version_id": version.id}]


def answers_for(request: httpx.Request) -> httpx.Response:
    """Answer every question the request asks, the way System One does."""
    body = json.loads(request.content)
    answers: dict[str, Any] = {}
    for name, question in body["questions"].items():
        if question["type"] == "noul":
            answers[name] = {"type": "noul", "noul": 0.9}
        else:
            answers[name] = {
                "type": "choice",
                "choice": "billing",
                "confidence": 0.8,
                "probabilities": {"billing": 0.8, "technical": 0.2},
            }
    return httpx.Response(
        200,
        json={
            "model": body["model"],
            "answers": answers,
            "usage": {"input_tokens": 12, "output_tokens": 1},
        },
    )


def run_input(target: list[dict[str, Any]], **task: Any) -> dict[str, Any]:
    (ids,) = target
    return {
        "input": {
            "datasetId": str(GlobalID("Dataset", str(ids["dataset_id"]))),
            "datasetVersionId": str(GlobalID("DatasetVersion", str(ids["version_id"]))),
            "repetitions": 1,
            "tasks": [
                {
                    "decision": {
                        "connection": {"builtIn": {"providerKey": "OLLAMA"}},
                        "modelName": "tev1:0.8b-mxfp8",
                        "inputs": [{"name": "state"}],
                        "state": {"input": "state"},
                        "inputMapping": {
                            "literalMapping": {},
                            "pathMapping": {"state": "input.state"},
                        },
                        "questions": {
                            "example": {"path": "input.questions", "format": "SYSTEM_ONE"}
                        },
                        "references": {
                            "labelPath": "reference.{question}.label",
                            "annotatorKind": "LLM",
                        },
                        **task,
                    }
                }
            ],
        }
    }


async def collect(gql_client: AsyncGraphQLClient, variables: dict[str, Any]) -> list[Any]:
    return [
        payload["experimentsOverDataset"]
        async for payload in gql_client.subscription(query=QUERY, variables=variables)
    ]


async def test_a_benchmark_runs_as_a_decision_experiment(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    benchmark_dataset: list[dict[str, Any]],
) -> None:
    with respx.mock:
        route = respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=answers_for)
        payloads = await collect(gql_client, run_input(benchmark_dataset))

    experiment = payloads[0]
    assert experiment["__typename"] == "ChatCompletionSubscriptionExperiment"
    assert experiment["experiment"]["name"] == "playground-experiment decision:tev1:0.8b-mxfp8"
    results = [p for p in payloads if p["__typename"] == "ChatCompletionSubscriptionResult"]
    assert len(results) == 2
    outputs = sorted(
        (result["experimentRun"]["output"] for result in results), key=lambda o: list(o["answers"])
    )
    assert outputs == [
        {
            "model": "tev1:0.8b-mxfp8",
            "answers": {"decision": {"type": "predicate", "probability": 0.9}},
        },
        {
            "model": "tev1:0.8b-mxfp8",
            "answers": {
                "team": {
                    "type": "choice",
                    "choice": "billing",
                    "confidence": 0.8,
                    "probabilities": {"billing": 0.8, "technical": 0.2},
                }
            },
        },
    ]
    # The structured state went out unchanged, not wrapped and not rendered as text.
    sent_states = [json.loads(call.request.content)["state"] for call in route.calls]
    assert {"ticket": "I was charged twice.", "plan": "pro"} in sent_states

    experiment_id = int(GlobalID.from_id(experiment["experimentId"]).node_id)
    async with db() as session:
        task = await session.get(models.ExperimentDecisionTask, experiment_id)
        assert task is not None
        assert (task.model_provider.value, task.model_name) == ("OLLAMA", "tev1:0.8b-mxfp8")
        assert task.config.references is not None
        assert task.config.references.annotator_kind == "LLM"
        db_experiment = await session.get(models.Experiment, experiment_id)
        assert db_experiment is not None
        decision_spans = await session.scalar(
            select(func.count(models.Span.id))
            .join(models.Trace)
            .join(models.Project)
            .where(models.Project.name == db_experiment.project_name)
            .where(models.Span.span_kind == "DECISION")
        )
        assert decision_spans == 2


async def test_examples_that_cannot_be_asked_stop_the_run_before_it_starts(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    benchmark_dataset: list[dict[str, Any]],
) -> None:
    variables = run_input(
        benchmark_dataset,
        inputMapping={"literalMapping": {}, "pathMapping": {"state": "input.passage"}},
    )
    with respx.mock:
        route = respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=answers_for)
        with pytest.raises(Exception, match="2 of 2 examples can't make a decision request"):
            await collect(gql_client, variables)
    assert route.call_count == 0
    async with db() as session:
        assert await session.scalar(select(func.count(models.Experiment.id))) == 0


async def test_the_runner_retries_a_rate_limited_request(
    gql_client: AsyncGraphQLClient,
    benchmark_dataset: list[dict[str, Any]],
) -> None:
    """The SDK's own retries are off, so the runner's backoff is the only retrying."""
    responses = iter(
        [httpx.Response(429, json={"error": "slow down"})] + [None] * 10  # type: ignore[list-item]
    )

    def rate_limit_once(request: httpx.Request) -> httpx.Response:
        return next(responses) or answers_for(request)

    with respx.mock:
        route = respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=rate_limit_once)
        payloads = await collect(gql_client, run_input(benchmark_dataset))
    results = [p for p in payloads if p["__typename"] == "ChatCompletionSubscriptionResult"]
    assert len(results) == 2
    assert all(result["experimentRun"]["error"] is None for result in results)
    assert route.call_count == 3
