"""Integration tests for chatCompletionOverDataset GraphQL subscription."""

from __future__ import annotations

import asyncio
from typing import Any, cast

import httpx
import pytest

from tests.integration._helpers import _AppInfo, _parse_apollo_multipart_response

from .conftest import CustomProviders, DatasetEvaluators, _gql

# =============================================================================
# GraphQL Operations
# =============================================================================

CHAT_COMPLETION_OVER_DATASET = """
subscription ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
    chatCompletionOverDataset(input: $input) {
        __typename
        ... on TextChunk {
            content
            datasetExampleId
            repetitionNumber
        }
        ... on ChatCompletionSubscriptionExperiment {
            experiment {
                id
                name
            }
        }
        ... on ChatCompletionSubscriptionResult {
            datasetExampleId
            repetitionNumber
            span {
                id
            }
            experimentRun {
                id
            }
        }
        ... on ChatCompletionSubscriptionError {
            datasetExampleId
            repetitionNumber
            message
        }
        ... on EvaluationChunk {
            datasetExampleId
            repetitionNumber
            experimentRunEvaluation {
                id
                name
                label
                score
            }
        }
        ... on EvaluationErrorChunk {
            datasetExampleId
            repetitionNumber
            evaluatorName
            message
        }
    }
}
"""

GET_EXPERIMENT = """
query GetExperiment($id: ID!) {
    node(id: $id) {
        ... on Experiment {
            id
            name
            description
            repetitions
            runs(first: 100) {
                edges {
                    node {
                        id
                        output
                        error
                        traceId
                        trace {
                            id
                            traceId
                            numSpans
                            spans(first: 100) {
                                edges {
                                    node {
                                        id
                                        name
                                        latencyMs
                                        tokenCountPrompt
                                        tokenCountCompletion
                                        tokenCountTotal
                                    }
                                }
                            }
                        }
                        annotations {
                            edges {
                                node {
                                    id
                                    name
                                    label
                                    score
                                    explanation
                                    traceId
                                    trace {
                                        id
                                        traceId
                                        numSpans
                                        spans(first: 100) {
                                            edges {
                                                node {
                                                    id
                                                    name
                                                    tokenCountTotal
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
"""


# =============================================================================
# Helper Functions
# =============================================================================


async def _run_subscription_with_evaluators(
    client: httpx.AsyncClient,
    *,
    custom_provider_id: str,
    dataset_id: str,
    evaluators: DatasetEvaluators,
) -> str:
    """Run chatCompletionOverDataset subscription with evaluators.

    Uses the custom OpenAI provider pointing to mock server.
    Includes all 4 evaluators (one per provider type).
    """
    variables = {
        "input": {
            "messages": [
                {"role": "SYSTEM", "content": "You are a helpful assistant."},
                {"role": "USER", "content": "{{question}}"},
            ],
            "model": {
                "custom": {
                    "providerId": custom_provider_id,
                    "modelName": "gpt-4o-mini",
                }
            },
            "invocationParameters": [],
            "repetitions": 2,
            "templateFormat": "MUSTACHE",
            "datasetId": dataset_id,
            "evaluators": [
                {
                    "id": evaluators.openai,
                    "name": "openai_eval",
                    "inputMapping": {
                        "pathMapping": {
                            "input": "$.input",
                            "output": "$.output",
                            "reference": "$.reference",
                        },
                        "literalMapping": {},
                    },
                },
                {
                    "id": evaluators.anthropic,
                    "name": "anthropic_eval",
                    "inputMapping": {
                        "pathMapping": {
                            "input": "$.input",
                            "output": "$.output",
                            "reference": "$.reference",
                        },
                        "literalMapping": {},
                    },
                },
                {
                    "id": evaluators.google_genai,
                    "name": "google_eval",
                    "inputMapping": {
                        "pathMapping": {
                            "input": "$.input",
                            "output": "$.output",
                            "reference": "$.reference",
                        },
                        "literalMapping": {},
                    },
                },
                {
                    "id": evaluators.bedrock,
                    "name": "bedrock_eval",
                    "inputMapping": {
                        "pathMapping": {
                            "input": "$.input",
                            "output": "$.output",
                            "reference": "$.reference",
                        },
                        "literalMapping": {},
                    },
                },
            ],
        }
    }

    async def _execute_subscription() -> str:
        """Execute the subscription and return the experiment ID."""
        experiment_id: str | None = None
        errors_seen: list[dict[str, Any]] = []
        eval_errors_seen: list[dict[str, Any]] = []

        # Apollo multipart subscription protocol
        async with client.stream(
            "POST",
            "/graphql",
            json={"query": CHAT_COMPLETION_OVER_DATASET, "variables": variables},
            headers={
                "Accept": "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
                "Content-Type": "application/json",
            },
        ) as response:
            response.raise_for_status()

            # Parse multipart response
            async for payload in _parse_apollo_multipart_response(response):
                # Apollo multipart wraps data in a "payload" field
                inner = payload.get("payload", payload)
                # Capture any errors for debugging
                if errs := inner.get("errors"):
                    errors_seen.extend(errs)
                if data := inner.get("data"):
                    subscription_data = data.get("chatCompletionOverDataset")
                    if subscription_data:
                        typename = subscription_data.get("__typename")
                        if typename == "ChatCompletionSubscriptionExperiment":
                            experiment_id = str(subscription_data["experiment"]["id"])
                        elif typename == "EvaluationErrorChunk":
                            eval_errors_seen.append(subscription_data)

            # Log any evaluation errors for debugging
            if eval_errors_seen:
                print(f"Evaluation errors received: {eval_errors_seen}")

        if experiment_id is None:
            error_msg = "Did not receive experiment ID from subscription"
            if errors_seen:
                error_msg += f"\nGraphQL errors: {errors_seen}"
            raise AssertionError(error_msg)

        return experiment_id

    # Run subscription with a 120 second timeout
    try:
        return await asyncio.wait_for(_execute_subscription(), timeout=120.0)
    except asyncio.TimeoutError:
        raise AssertionError("Subscription timed out after 120 seconds")


async def _run_subscription_without_evaluators(
    client: httpx.AsyncClient,
    *,
    custom_provider_id: str,
    model_name: str,
    dataset_id: str,
    invocation_parameters: list[dict[str, Any]] | None = None,
) -> str:
    """Run chatCompletionOverDataset subscription without evaluators.

    Tests the primary prompt with a specific custom provider.
    Returns the experiment ID.
    """
    variables = {
        "input": {
            "messages": [
                {"role": "SYSTEM", "content": "You are a helpful assistant."},
                {"role": "USER", "content": "{{question}}"},
            ],
            "model": {
                "custom": {
                    "providerId": custom_provider_id,
                    "modelName": model_name,
                }
            },
            "invocationParameters": invocation_parameters or [],
            "repetitions": 1,
            "templateFormat": "MUSTACHE",
            "datasetId": dataset_id,
            "evaluators": [],
        }
    }

    async def _execute_subscription() -> str:
        """Execute the subscription and return the experiment ID."""
        experiment_id: str | None = None
        errors_seen: list[dict[str, Any]] = []
        completion_errors_seen: list[dict[str, Any]] = []

        # Apollo multipart subscription protocol
        async with client.stream(
            "POST",
            "/graphql",
            json={"query": CHAT_COMPLETION_OVER_DATASET, "variables": variables},
            headers={
                "Accept": "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
                "Content-Type": "application/json",
            },
        ) as response:
            response.raise_for_status()

            # Parse multipart response
            async for payload in _parse_apollo_multipart_response(response):
                # Apollo multipart wraps data in a "payload" field
                inner = payload.get("payload", payload)
                # Capture any errors for debugging
                if errs := inner.get("errors"):
                    errors_seen.extend(errs)
                if data := inner.get("data"):
                    subscription_data = data.get("chatCompletionOverDataset")
                    if subscription_data:
                        typename = subscription_data.get("__typename")
                        if typename == "ChatCompletionSubscriptionExperiment":
                            experiment_id = str(subscription_data["experiment"]["id"])
                        elif typename == "ChatCompletionSubscriptionError":
                            completion_errors_seen.append(subscription_data)

            # Log any completion errors for debugging
            if completion_errors_seen:
                print(f"Completion errors received: {completion_errors_seen}")

        if experiment_id is None:
            error_msg = "Did not receive experiment ID from subscription"
            if errors_seen:
                error_msg += f"\nGraphQL errors: {errors_seen}"
            raise AssertionError(error_msg)

        return experiment_id

    # Run subscription with a 60 second timeout (no evaluators = faster)
    try:
        return await asyncio.wait_for(_execute_subscription(), timeout=60.0)
    except asyncio.TimeoutError:
        raise AssertionError("Subscription timed out after 60 seconds")


async def _get_experiment(
    client: httpx.AsyncClient,
    experiment_id: str,
) -> dict[str, Any] | None:
    """Query experiment by ID."""
    data = await _gql(client, GET_EXPERIMENT, {"id": experiment_id})
    node = data.get("node")
    return cast(dict[str, Any], node) if node is not None else None


# =============================================================================
# Tests
# =============================================================================


class TestChatCompletionOverDataset:
    """Tests for chatCompletionOverDataset subscription with evaluators."""

    async def test_experiment_with_evaluators(
        self,
        _app: _AppInfo,
        _custom_providers: CustomProviders,
        _dataset_id: str,
        _dataset_evaluators: DatasetEvaluators,
    ) -> None:
        """Test chatCompletionOverDataset with all 4 provider evaluators.

        Uses OpenAI custom provider (pointing to mock server) for the experiment,
        and attaches evaluators using all 4 custom providers (OpenAI, Anthropic,
        Google GenAI, Bedrock).
        """
        async with httpx.AsyncClient(base_url=_app.base_url) as client:
            # Run subscription with all evaluators
            experiment_id = await _run_subscription_with_evaluators(
                client,
                custom_provider_id=_custom_providers.openai,
                dataset_id=_dataset_id,
                evaluators=_dataset_evaluators,
            )

            # Query experiment
            experiment = await _get_experiment(client, experiment_id)
            assert experiment is not None

            # Verify we have 4 runs (2 examples × 2 repetitions)
            runs = experiment["runs"]["edges"]
            assert len(runs) == 4

            # Verify each run has spans and evaluations
            for run in runs:
                run_node = run["node"]
                assert run_node["error"] is None, f"Run had error: {run_node['error']}"

                # Verify trace and spans exist
                assert run_node["traceId"] is not None, "Run should have a traceId"
                trace = run_node["trace"]
                assert trace is not None, "Run should have a trace"
                assert trace["numSpans"] >= 1, "Trace should have at least 1 span"

                spans = trace["spans"]["edges"]
                assert len(spans) >= 1, "Trace should have at least 1 span"

                # Verify span has expected fields
                for span in spans:
                    span_node = span["node"]
                    assert span_node["id"] is not None
                    assert span_node["name"] is not None
                    assert span_node["latencyMs"] is not None

                # Verify token counts sum to > 0 for spans in the trace
                total_tokens = sum((span["node"]["tokenCountTotal"] or 0) for span in spans)
                assert total_tokens > 0, (
                    f"Total token count for trace should be > 0, got {total_tokens}"
                )

                # Verify we have 4 annotations (one per evaluator)
                annotations = run_node["annotations"]["edges"]
                assert len(annotations) == 4, (
                    f"Expected 4 annotations per run, got {len(annotations)}"
                )

                # Verify we have annotations from all 4 evaluators
                annotation_names = {ann["node"]["name"] for ann in annotations}
                expected_names = {"openai_eval", "anthropic_eval", "google_eval", "bedrock_eval"}
                assert annotation_names == expected_names, (
                    f"Expected annotations {expected_names}, got {annotation_names}"
                )

                # Verify each evaluator annotation has its own trace with token counts
                for ann in annotations:
                    ann_node = ann["node"]
                    ann_name = ann_node["name"]

                    # Verify annotation has label, score, and explanation
                    assert ann_node["label"] is not None, (
                        f"Evaluator {ann_name} should have a label"
                    )
                    assert ann_node["score"] is not None, (
                        f"Evaluator {ann_name} should have a score"
                    )
                    assert ann_node["explanation"] is not None, (
                        f"Evaluator {ann_name} should have an explanation"
                    )

                    # Each evaluator should have a trace
                    assert ann_node["traceId"] is not None, (
                        f"Evaluator {ann_name} should have a traceId"
                    )
                    ann_trace = ann_node["trace"]
                    assert ann_trace is not None, f"Evaluator {ann_name} should have a trace"
                    assert ann_trace["numSpans"] >= 1, (
                        f"Evaluator {ann_name} trace should have at least 1 span"
                    )

                    # Sum token counts for all spans in the evaluator trace
                    ann_spans = ann_trace["spans"]["edges"]
                    ann_total_tokens = sum(
                        (span["node"]["tokenCountTotal"] or 0) for span in ann_spans
                    )
                    assert ann_total_tokens > 0, (
                        f"Evaluator {ann_name} trace should have token counts > 0, "
                        f"got {ann_total_tokens}"
                    )

    @pytest.mark.parametrize(
        "provider_key,model_name,invocation_params",
        [
            pytest.param("openai", "gpt-4o-mini", [], id="openai"),
            pytest.param(
                "anthropic",
                "claude-3-5-sonnet-latest",
                [{"invocationName": "max_tokens", "valueInt": 1024}],
                id="anthropic",
            ),
            pytest.param("google_genai", "gemini-2.0-flash", [], id="google_genai"),
            pytest.param("bedrock", "anthropic.claude-3-haiku-20240307-v1:0", [], id="bedrock"),
        ],
    )
    async def test_provider_without_evaluators(
        self,
        _app: _AppInfo,
        _custom_providers: CustomProviders,
        _dataset_id: str,
        provider_key: str,
        model_name: str,
        invocation_params: list[dict[str, Any]],
    ) -> None:
        """Test chatCompletionOverDataset with a provider on primary prompt.

        Tests the custom provider for the primary prompt without any evaluators.
        This exercises the text generation path for the provider.
        """
        # Look up provider ID from the fixture
        provider_id = getattr(_custom_providers, provider_key)

        async with httpx.AsyncClient(base_url=_app.base_url) as client:
            # Run subscription without evaluators
            experiment_id = await _run_subscription_without_evaluators(
                client,
                custom_provider_id=provider_id,
                model_name=model_name,
                dataset_id=_dataset_id,
                invocation_parameters=invocation_params,
            )

            # Query experiment
            experiment = await _get_experiment(client, experiment_id)
            assert experiment is not None, "Experiment should exist"

            # Verify we have 2 runs (2 examples × 1 repetition)
            runs = experiment["runs"]["edges"]
            assert len(runs) == 2, f"Expected 2 runs, got {len(runs)}"

            # Verify each run completed successfully
            for run in runs:
                run_node = run["node"]
                assert run_node["error"] is None, f"Run had error: {run_node['error']}"

                # Verify output is not empty (echo response)
                assert run_node["output"] is not None, "Run should have output"

                # Verify trace and spans exist
                assert run_node["traceId"] is not None, "Run should have a traceId"
                trace = run_node["trace"]
                assert trace is not None, "Run should have a trace"
                assert trace["numSpans"] >= 1, "Trace should have at least 1 span"

                spans = trace["spans"]["edges"]
                assert len(spans) >= 1, "Trace should have at least 1 span"

                # Verify span has expected fields
                for span in spans:
                    span_node = span["node"]
                    assert span_node["id"] is not None, "Span should have id"
                    assert span_node["name"] is not None, "Span should have name"
                    assert span_node["latencyMs"] is not None, "Span should have latencyMs"

                # Verify token counts sum to > 0 for spans in the trace
                total_tokens = sum((span["node"]["tokenCountTotal"] or 0) for span in spans)
                assert total_tokens > 0, f"Total token count should be > 0, got {total_tokens}"

                # Verify no annotations (since no evaluators)
                annotations = run_node["annotations"]["edges"]
                assert len(annotations) == 0, f"Expected 0 annotations, got {len(annotations)}"
