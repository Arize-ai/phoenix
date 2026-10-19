import json
from typing import Any, Awaitable, Callable

import httpx
import httpx2
import pytest
import respx
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.decisions import ObjectState
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
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
      ... on EvaluationChunk {
        evaluatorName
        error
        experimentRunEvaluation { name label score }
      }
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
                        "questionsPath": "questions",
                        "questionsFormat": "SYSTEM_ONE",
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
        (result["experimentRun"]["output"] for result in results), key=lambda o: list(o)
    )
    # The answers by question name, the shape of the dataset's reference answers.
    assert outputs == [
        {"decision": {"type": "predicate", "probability": 0.9}},
        {
            "team": {
                "type": "choice",
                "choice": "billing",
                "confidence": 0.8,
                "probabilities": {"billing": 0.8, "technical": 0.2},
            }
        },
    ]
    # The structured state went out unchanged, not wrapped and not rendered as text.
    sent_states = [json.loads(call.request.content)["state"] for call in route.calls]
    assert {"ticket": "I was charged twice.", "plan": "pro"} in sent_states

    # The playground reopens the experiment from its task config.
    config = await gql_client.execute(
        """query ($id: ID!) {
          node(id: $id) {
            ... on Experiment {
              job {
                taskConfig {
                  __typename
                  ... on DecisionTaskConfig {
                    modelProvider modelName inputValuesPath questionsPath questionsFormat
                    inputs { name }
                    state { __typename ... on DecisionInputState { input } }
                    questions { __typename }
                  }
                }
              }
            }
          }
        }""",
        variables={"id": experiment["experimentId"]},
    )
    assert config.data and not config.errors, config.errors
    assert config.data["node"]["job"]["taskConfig"] == {
        "__typename": "DecisionTaskConfig",
        "modelProvider": "OLLAMA",
        "modelName": "tev1:0.8b-mxfp8",
        "inputValuesPath": "input",
        "questionsPath": "questions",
        "questionsFormat": "SYSTEM_ONE",
        "inputs": [{"name": "state"}],
        "state": {"__typename": "DecisionInputState", "input": "state"},
        "questions": [],
    }

    experiment_id = int(GlobalID.from_id(experiment["experimentId"]).node_id)
    async with db() as session:
        task = await session.get(models.ExperimentDecisionTask, experiment_id)
        assert task is not None
        assert (task.model_provider.value, task.model_name) == ("OLLAMA", "tev1:0.8b-mxfp8")
        assert (task.config.input_values_path, task.config.questions_path) == (
            "input",
            "questions",
        )
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
    # The state is in the input, not the metadata, so no example has it.
    variables = run_input(benchmark_dataset, inputValuesPath="metadata")
    with respx.mock:
        route = respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=answers_for)
        with pytest.raises(Exception, match="2 of 2 examples can't make a decision request"):
            await collect(gql_client, variables)
    assert route.call_count == 0
    async with db() as session:
        assert await session.scalar(select(func.count(models.Experiment.id))) == 0


async def test_a_run_records_the_saved_version_it_was_copied_from(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    benchmark_dataset: list[dict[str, Any]],
) -> None:
    """As a prompt task records its prompt version: the definition sent is what runs."""
    async with db() as session:
        decision = models.Decision(name=Identifier("triage"), metadata_={})
        version = models.DecisionVersion(
            decision=decision,
            schema_version=1,
            inputs=[],
            state=ObjectState(type="object"),
            questions=[],
            model_provider=ModelProvider.OLLAMA,
            model_name="tev1:0.8b-mxfp8",
            metadata_={},
        )
        session.add(version)
        await session.flush()
        version_id = str(GlobalID("DecisionVersion", str(version.id)))

    with respx.mock:
        respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=answers_for)
        payloads = await collect(
            gql_client, run_input(benchmark_dataset, decisionVersionId=version_id)
        )
    config = await gql_client.execute(
        """query ($id: ID!) {
          node(id: $id) {
            ... on Experiment {
              job { taskConfig { ... on DecisionTaskConfig { decisionVersion { id } } } }
            }
          }
        }""",
        variables={"id": payloads[0]["experimentId"]},
    )
    assert config.data and not config.errors, config.errors
    assert config.data["node"]["job"]["taskConfig"] == {"decisionVersion": {"id": version_id}}

    missing = str(GlobalID("DecisionVersion", "999"))
    with respx.mock:
        respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=answers_for)
        with pytest.raises(Exception, match="Decision version not found"):
            await collect(gql_client, run_input(benchmark_dataset, decisionVersionId=missing))


async def test_the_runner_retries_a_rate_limited_request(
    gql_client: AsyncGraphQLClient,
    benchmark_dataset: list[dict[str, Any]],
) -> None:
    """The SDK's own retries are off, so the runner's backoff is the only retrying."""
    responses = iter([httpx.Response(429, json={"error": "slow down"})] + [None] * 10)

    def rate_limit_once(request: httpx.Request) -> httpx.Response:
        return next(responses) or answers_for(request)

    with respx.mock:
        route = respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=rate_limit_once)
        payloads = await collect(gql_client, run_input(benchmark_dataset))
    results = [p for p in payloads if p["__typename"] == "ChatCompletionSubscriptionResult"]
    assert len(results) == 2
    assert all(result["experimentRun"]["error"] is None for result in results)
    assert route.call_count == 3


async def test_dataset_evaluators_judge_decision_runs_as_they_judge_prompt_runs(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    benchmark_dataset: list[dict[str, Any]],
    assign_exact_match_builtin_evaluator_to_dataset: Callable[
        ..., Awaitable[models.DatasetEvaluators]
    ],
) -> None:
    """An evaluator reads a decision run's answers as `output` and the example's output
    as `reference`, the same context a prompt run gives it."""
    ((ids,),) = (benchmark_dataset,)
    dataset_evaluator = await assign_exact_match_builtin_evaluator_to_dataset(
        ids["dataset_id"],
        input_mapping=InputMapping(
            literal_mapping={},
            path_mapping={
                "actual": "$.output.team.choice",
                "expected": "$.reference.team.label",
            },
        ),
    )
    evaluator = {
        "id": str(GlobalID("DatasetEvaluator", str(dataset_evaluator.id))),
        "name": "exact-match",
        "inputMapping": {"literalMapping": {}, "pathMapping": {}},
    }
    with respx.mock:
        respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=answers_for)
        payloads = await collect(gql_client, run_input(benchmark_dataset, evaluators=[evaluator]))
    chunks = [p for p in payloads if p["__typename"] == "EvaluationChunk"]
    # The team example matches its reference; the other has no team question to judge.
    judged = [
        chunk["experimentRunEvaluation"] for chunk in chunks if chunk["experimentRunEvaluation"]
    ]
    assert [(e["name"], e["label"], e["score"]) for e in judged] == [("exact-match", "true", 1.0)]
    assert len(chunks) == 2
    async with db() as session:
        linked = await session.scalar(
            select(func.count(models.ExperimentDatasetEvaluator.experiment_id))
        )
        assert linked == 1


def prompt_task(template_text: str) -> dict[str, Any]:
    return {
        "prompt": {
            "promptVersion": {
                "templateFormat": "F_STRING",
                "template": {
                    "messages": [{"role": "USER", "content": [{"text": {"text": template_text}}]}]
                },
                "modelProvider": "OPENAI",
                "modelName": "gpt-4",
                "invocationParameters": {"openai": {}},
                "tools": None,
            }
        }
    }


async def test_a_prompt_and_a_decision_share_a_run_as_two_experiments(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    benchmark_dataset: list[dict[str, Any]],
    openai_api_key: str,
) -> None:
    variables = run_input(benchmark_dataset)
    # A template variable no example has: the prompt's runs fail while formatting, so the
    # prompt experiment runs to completion without a model call.
    variables["input"]["tasks"].insert(0, prompt_task("Where is {country}?"))
    with respx.mock:
        route = respx.post(OLLAMA_SYSTEM_ONE).mock(side_effect=answers_for)
        payloads = await collect(gql_client, variables)

    experiments = [p for p in payloads if p["__typename"] == "ChatCompletionSubscriptionExperiment"]
    # In task order: the prompt first, then the decision.
    assert [e["experiment"]["name"] for e in experiments] == [
        "playground-experiment",
        "playground-experiment decision:tev1:0.8b-mxfp8",
    ]
    prompt_id, decision_id = (e["experimentId"] for e in experiments)
    assert prompt_id != decision_id
    by_experiment: dict[str, list[str]] = {prompt_id: [], decision_id: []}
    for payload in payloads:
        if payload["experimentId"] in by_experiment and payload["__typename"] != (
            "ChatCompletionSubscriptionExperiment"
        ):
            by_experiment[payload["experimentId"]].append(payload["__typename"])
    assert by_experiment[prompt_id] == ["ChatCompletionSubscriptionError"] * 2
    assert by_experiment[decision_id] == ["ChatCompletionSubscriptionResult"] * 2
    assert route.call_count == 2
    async with db() as session:
        assert await session.scalar(select(func.count(models.ExperimentPromptTask.id))) == 1
        assert await session.scalar(select(func.count(models.ExperimentDecisionTask.id))) == 1


async def test_a_decision_cannot_share_a_run_with_an_evaluator(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    benchmark_dataset: list[dict[str, Any]],
) -> None:
    variables = run_input(benchmark_dataset)
    variables["input"]["tasks"].append(
        {
            "evaluator": {
                "evaluator": {"builtInEvaluatorId": str(GlobalID("BuiltInEvaluator", "1"))},
                "inputMapping": {"literalMapping": {}, "pathMapping": {}},
            }
        }
    )
    with pytest.raises(Exception, match="Tasks must all be tested tasks"):
        await collect(gql_client, variables)
    async with db() as session:
        assert await session.scalar(select(func.count(models.Experiment.id))) == 0
