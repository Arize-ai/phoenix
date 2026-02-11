# pyright: reportCallIssue=false
"""
Integration tests for cost tracking functionality.

This module tests the end-to-end cost tracking workflow, including:
- Creating custom generative models with token prices
- Sending LLM spans with token counts
- Verifying that costs are calculated correctly

These tests are particularly useful for validating cost tracking behavior
on different platforms (e.g., Windows) where issues have been reported.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Iterator, cast

import pytest
from strawberry.relay import GlobalID

from phoenix.client import Client
from phoenix.client.__generated__ import v1

from .._helpers import (
    _AppInfo,
    _await_or_return,
    _ExistingProject,
    _gql,
    _until_spans_exist,
)


@pytest.fixture(scope="function")
def _test_project(
    _app: _AppInfo,
) -> Iterator[_ExistingProject]:
    """Create a fresh project for each test."""
    client = Client(base_url=_app.base_url, api_key=_app.admin_secret)
    project = client.projects.create(name=f"cost_test_{token_hex(8)}")
    yield _ExistingProject(id=GlobalID.from_id(project["id"]), name=project["name"])
    client.projects.delete(project_name=project["name"])


def _create_generative_model(
    app: _AppInfo,
    *,
    name: str,
    name_pattern: str,
    provider: str | None = None,
    input_cost_per_million: float = 1.0,
    output_cost_per_million: float = 1.0,
    cache_read_cost_per_million: float | None = None,
    cache_write_cost_per_million: float | None = None,
    start_time: datetime | None = None,
) -> dict[str, Any]:
    """
    Create a generative model via GraphQL mutation.

    Args:
        app: The app info for connecting to Phoenix
        name: Display name for the model
        name_pattern: Regex pattern to match model names in spans
        provider: Optional provider name (e.g., "aws", "openai")
        input_cost_per_million: Cost per million input tokens
        output_cost_per_million: Cost per million output tokens
        cache_read_cost_per_million: Cost per million cached input tokens (read from cache)
        cache_write_cost_per_million: Cost per million cached input tokens (write to cache)
        start_time: Optional start time for the model (for versioning)

    Returns:
        The created model data from GraphQL response
    """
    mutation = """
    mutation CreateModel($input: CreateModelMutationInput!) {
        createModel(input: $input) {
            model {
                id
                name
                namePattern
                provider
                startTime
                kind
                tokenPrices {
                    tokenType
                    kind
                    costPerMillionTokens
                }
            }
        }
    }
    """

    costs = [
        {
            "tokenType": "input",
            "costPerMillionTokens": input_cost_per_million,
            "kind": "PROMPT",
        },
        {
            "tokenType": "output",
            "costPerMillionTokens": output_cost_per_million,
            "kind": "COMPLETION",
        },
    ]
    if cache_read_cost_per_million is not None:
        costs.append(
            {
                "tokenType": "cache_read",
                "costPerMillionTokens": cache_read_cost_per_million,
                "kind": "PROMPT",
            }
        )
    if cache_write_cost_per_million is not None:
        costs.append(
            {
                "tokenType": "cache_write",
                "costPerMillionTokens": cache_write_cost_per_million,
                "kind": "PROMPT",
            }
        )

    variables: dict[str, Any] = {
        "input": {
            "name": name,
            "namePattern": name_pattern,
            "costs": costs,
            # Provider is required by the database (NOT NULL constraint)
            "provider": provider or "",
        }
    }
    if start_time:
        variables["input"]["startTime"] = start_time.isoformat()

    resp, _ = _gql(app, app.admin_secret, query=mutation, variables=variables)
    assert "errors" not in resp or not resp["errors"], f"GraphQL errors: {resp.get('errors')}"
    return cast(dict[str, Any], resp["data"]["createModel"]["model"])


def _delete_generative_model(app: _AppInfo, model_id: str) -> None:
    """Delete a generative model via GraphQL mutation."""
    mutation = """
    mutation DeleteModel($input: DeleteModelMutationInput!) {
        deleteModel(input: $input) {
            model {
                id
            }
        }
    }
    """
    _gql(app, app.admin_secret, query=mutation, variables={"input": {"id": model_id}})


def _get_span_cost(app: _AppInfo, span_id: str) -> dict[str, Any] | None:
    """
    Query the cost information for a span via GraphQL.

    Returns the cost summary object or None if no cost was calculated.
    The returned object has:
    - prompt: {tokens, cost}
    - completion: {tokens, cost}
    - total: {tokens, cost}
    """
    query = """
    query GetSpanCost($spanId: String!) {
        getSpanByOtelId(spanId: $spanId) {
            id
            spanId
            costSummary {
                prompt {
                    tokens
                    cost
                }
                completion {
                    tokens
                    cost
                }
                total {
                    tokens
                    cost
                }
            }
            costDetailSummaryEntries {
                tokenType
                isPrompt
                value {
                    tokens
                    cost
                }
            }
        }
    }
    """
    resp, _ = _gql(app, app.admin_secret, query=query, variables={"spanId": span_id})
    assert "errors" not in resp or not resp["errors"], f"GraphQL errors: {resp.get('errors')}"
    span = resp["data"]["getSpanByOtelId"]
    if span is None:
        return None
    return cast(dict[str, Any] | None, span.get("costSummary"))


async def _wait_for_span_cost(
    app: _AppInfo,
    span_id: str,
    timeout_seconds: float = 30,
) -> dict[str, Any] | None:
    """
    Wait for a span to have cost calculated.

    The SpanCostCalculator daemon runs every 5 seconds, so we need to wait
    for it to process the span.
    """
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    while asyncio.get_event_loop().time() < deadline:
        cost = _get_span_cost(app, span_id)
        if cost is not None:
            return cost
        await asyncio.sleep(1)
    return None


class TestCostTrackingWithCustomModels:
    """
    Test cost tracking with custom generative models.

    These tests verify the end-to-end cost tracking workflow:
    1. Create a custom generative model with token prices
    2. Send an LLM span with token counts
    3. Verify that the cost is calculated correctly
    """

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_aws_bedrock_anthropic_model_cost_tracking(
        self,
        is_async: bool,
        _test_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """
        Test cost tracking for AWS Bedrock Anthropic models with cache tokens.

        This test reproduces the user-reported issue where cost tracking shows $0
        for AWS Bedrock Anthropic Claude models with cache token details.

        The span attributes match the exact structure reported by the user:
        - llm.provider: "aws"
        - llm.model_name: "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
        - Token counts including cache_read and cache_write details
        """
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        ClientClass = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _test_project.name

        # The exact model name pattern from the user's report
        model_name = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"

        # Create a custom model with token prices matching the user's configuration
        # Using exact regex pattern as the user would configure
        # Create a custom model with token prices matching the user's configuration
        # IMPORTANT: For models that support prompt caching (like Anthropic Claude),
        # you need to define cache_read and cache_write prices in addition to input/output.
        # Otherwise, the system may use built-in model prices for cached tokens.
        model = _create_generative_model(
            _app,
            name=f"Test Claude 3.7 Sonnet ({token_hex(4)})",
            name_pattern=model_name,  # Exact match pattern
            provider="aws",
            input_cost_per_million=3.0,  # $3.00 per million input tokens
            output_cost_per_million=15.0,  # $15.00 per million output tokens
            cache_read_cost_per_million=0.30,  # $0.30 per million cache read tokens (10x cheaper)
            cache_write_cost_per_million=3.75,  # $3.75 per million cache write tokens
        )
        model_id = model["id"]

        # Wait for GenerativeModelStore daemon to refresh (runs every 5 seconds)
        # This ensures our custom model is picked up before cost calculation
        await asyncio.sleep(6)

        try:
            # Verify model was created with correct token prices (4 prices: input, output, cache_read, cache_write)
            assert len(model["tokenPrices"]) == 4, (
                f"Expected 4 token prices, got {len(model['tokenPrices'])}: {model['tokenPrices']}"
            )
            input_price = next((p for p in model["tokenPrices"] if p["tokenType"] == "input"), None)
            output_price = next(
                (p for p in model["tokenPrices"] if p["tokenType"] == "output"), None
            )
            cache_read_price = next(
                (p for p in model["tokenPrices"] if p["tokenType"] == "cache_read"), None
            )
            assert input_price is not None, "Input price not found"
            assert output_price is not None, "Output price not found"
            assert cache_read_price is not None, "Cache read price not found"
            assert input_price["costPerMillionTokens"] == 3.0
            assert output_price["costPerMillionTokens"] == 15.0
            assert cache_read_price["costPerMillionTokens"] == 0.30

            # Create an LLM span with the exact attributes from the user's report
            base_time = datetime.now(timezone.utc)
            trace_id = f"trace_cost_test_{token_hex(16)}"
            span_id = f"span_cost_test_{token_hex(8)}"

            span = cast(
                v1.Span,
                {
                    "name": "ChatCompletion",
                    "context": {
                        "trace_id": trace_id,
                        "span_id": span_id,
                    },
                    "span_kind": "LLM",
                    "start_time": base_time.isoformat(),
                    "end_time": (base_time + timedelta(seconds=2)).isoformat(),
                    "status_code": "OK",
                    "attributes": {
                        # OpenInference span kind - required for cost calculation
                        "openinference.span.kind": "LLM",
                        # LLM attributes matching user's report
                        "llm.provider": "aws",
                        "llm.model_name": model_name,
                        # Token counts matching user's report
                        "llm.token_count.total": 2618,
                        "llm.token_count.prompt": 2590,
                        "llm.token_count.completion": 28,
                        "llm.token_count.prompt_details.cache_read": 2589,
                        "llm.token_count.prompt_details.cache_write": 0,
                    },
                },
            )

            # Send the span
            result = await _await_or_return(
                ClientClass(base_url=_app.base_url, api_key=_app.admin_secret).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                    project_identifier=project_name,
                    spans=[span],
                )
            )
            assert result["total_queued"] == 1, f"Failed to queue span: {result}"

            # Wait for span to be processed
            await _until_spans_exist(_app, [span_id])

            # Wait for cost calculation (daemon runs every 5 seconds)
            cost = await _wait_for_span_cost(_app, span_id)

            # Verify cost was calculated
            assert cost is not None, (
                "Cost was not calculated for the span. "
                "This may indicate an issue with model matching or cost calculation."
            )

            # Verify the cost details
            prompt_tokens = cost["prompt"]["tokens"]
            completion_tokens = cost["completion"]["tokens"]
            total_cost = cost["total"]["cost"]

            assert prompt_tokens == 2590, f"Expected 2590 prompt tokens, got {prompt_tokens}"
            assert completion_tokens == 28, (
                f"Expected 28 completion tokens, got {completion_tokens}"
            )

            # Calculate expected cost with cache token breakdown:
            # The 2590 prompt tokens are split into:
            # - cache_read: 2589 tokens @ $0.30/M = $0.0007767
            # - input: 1 token @ $3.00/M = $0.000003
            # Output: 28 tokens @ $15.00/M = $0.00042
            # Total: ~$0.00119997
            expected_cache_read_cost = 2589 * 0.30 / 1_000_000
            expected_input_cost = 1 * 3.0 / 1_000_000  # Only 1 non-cached prompt token
            expected_output_cost = 28 * 15.0 / 1_000_000
            expected_total_cost = (
                expected_cache_read_cost + expected_input_cost + expected_output_cost
            )

            assert total_cost is not None and total_cost > 0, (
                f"Total cost should be > 0, but got {total_cost}. "
                "This reproduces the user-reported issue of seeing $0 in the UI."
            )
            # Allow for floating point precision differences
            assert abs(total_cost - expected_total_cost) < 0.0001, (
                f"Expected total cost ~{expected_total_cost:.6f}, got {total_cost:.6f}"
            )

        finally:
            # Clean up the custom model
            _delete_generative_model(_app, model_id)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_model_regex_pattern_matching(
        self,
        is_async: bool,
        _test_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """
        Test that regex patterns in model names work correctly.

        This verifies that wildcard patterns like "claude-3.*" match
        various model name variations.
        """
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        ClientClass = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _test_project.name

        # Create a model with a regex pattern that matches multiple model names
        model = _create_generative_model(
            _app,
            name=f"Claude 3 Family ({token_hex(4)})",
            name_pattern=r".*claude-3.*",  # Matches any claude-3 variant
            provider=None,  # Provider-agnostic
            input_cost_per_million=2.5,
            output_cost_per_million=10.0,
        )
        model_id = model["id"]

        # Wait for GenerativeModelStore daemon to refresh (runs every 5 seconds)
        await asyncio.sleep(6)

        try:
            # Test a model name that should match the regex pattern ".*claude-3.*"
            # This also tests that patterns like "anthropic.claude-3-..." match
            test_model_name = "anthropic.claude-3-opus-20240229-v1:0"

            base_time = datetime.now(timezone.utc)
            trace_id = f"trace_regex_test_{token_hex(16)}"
            span_id = f"span_regex_test_{token_hex(8)}"

            span = cast(
                v1.Span,
                {
                    "name": "ChatCompletion",
                    "context": {
                        "trace_id": trace_id,
                        "span_id": span_id,
                    },
                    "span_kind": "LLM",
                    "start_time": base_time.isoformat(),
                    "end_time": (base_time + timedelta(seconds=1)).isoformat(),
                    "status_code": "OK",
                    "attributes": {
                        "openinference.span.kind": "LLM",
                        "llm.model_name": test_model_name,
                        "llm.token_count.prompt": 100,
                        "llm.token_count.completion": 50,
                    },
                },
            )

            result = await _await_or_return(
                ClientClass(base_url=_app.base_url, api_key=_app.admin_secret).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                    project_identifier=project_name,
                    spans=[span],
                )
            )
            assert result["total_queued"] == 1

            await _until_spans_exist(_app, [span_id])
            cost = await _wait_for_span_cost(_app, span_id)

            assert cost is not None, (
                f"Cost not calculated for model_name='{test_model_name}'. "
                f"The regex pattern '{model['namePattern']}' should match this model."
            )
            total_cost = cost["total"]["cost"]
            assert total_cost is not None and total_cost > 0, (
                f"Cost should be > 0 for model_name='{test_model_name}', got {total_cost}"
            )

            # Verify the cost matches our custom model's prices
            # 100 prompt tokens @ $2.50/M + 50 completion tokens @ $10.00/M = $0.00075
            expected_cost = 100 * 2.5 / 1_000_000 + 50 * 10.0 / 1_000_000
            assert abs(total_cost - expected_cost) < 0.0001, (
                f"Expected cost ~{expected_cost:.6f}, got {total_cost:.6f}"
            )

        finally:
            _delete_generative_model(_app, model_id)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_model_start_time_filtering(
        self,
        is_async: bool,
        _test_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """
        Test that model start_time correctly filters which models apply to spans.

        Models with a start_time AFTER the span timestamp should NOT match.
        This verifies that the start_time filtering logic works correctly.
        """
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        ClientClass = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _test_project.name

        # Create a span with a specific timestamp
        span_time = datetime.now(timezone.utc) - timedelta(days=7)

        # Use unique pattern suffix to avoid conflicts with other tests
        unique_suffix = token_hex(8)
        model_name_to_test = f"test-model-{unique_suffix}"

        # Create a model with start_time AFTER the span timestamp
        # This model should NOT match the span
        future_model = _create_generative_model(
            _app,
            name=f"Future Model ({token_hex(4)})",
            name_pattern=f"test-model-{unique_suffix}",  # Unique pattern
            input_cost_per_million=10.0,
            output_cost_per_million=30.0,
            start_time=datetime.now(timezone.utc),  # After span_time
        )

        # Create another model with start_time BEFORE the span timestamp
        # Since the unique constraint is on (name_pattern, provider, is_built_in),
        # we need to use a slightly different pattern or provider
        past_model = _create_generative_model(
            _app,
            name=f"Past Model ({token_hex(4)})",
            name_pattern=f"test-model-{unique_suffix}",  # Same pattern
            provider="test-provider",  # Different provider to avoid unique constraint
            input_cost_per_million=5.0,
            output_cost_per_million=15.0,
            start_time=span_time - timedelta(days=30),  # Before span_time
        )

        # Wait for GenerativeModelStore daemon to refresh (runs every 5 seconds)
        await asyncio.sleep(6)

        try:
            trace_id = f"trace_start_time_test_{token_hex(16)}"
            span_id = f"span_start_time_test_{token_hex(8)}"

            span = cast(
                v1.Span,
                {
                    "name": "ChatCompletion",
                    "context": {
                        "trace_id": trace_id,
                        "span_id": span_id,
                    },
                    "span_kind": "LLM",
                    "start_time": span_time.isoformat(),
                    "end_time": (span_time + timedelta(seconds=2)).isoformat(),
                    "status_code": "OK",
                    "attributes": {
                        "openinference.span.kind": "LLM",
                        "llm.model_name": model_name_to_test,
                        "llm.token_count.prompt": 1000,
                        "llm.token_count.completion": 500,
                    },
                },
            )

            result = await _await_or_return(
                ClientClass(base_url=_app.base_url, api_key=_app.admin_secret).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                    project_identifier=project_name,
                    spans=[span],
                )
            )
            assert result["total_queued"] == 1

            await _until_spans_exist(_app, [span_id])
            cost = await _wait_for_span_cost(_app, span_id)

            assert cost is not None, "Cost should be calculated"

            # The cost should use the past_model, not the future_model
            # because future_model's start_time is after the span timestamp
            # Verify the cost calculation uses past_model's prices ($5/$15 per million)
            # not future_model's prices ($10/$30 per million)
            expected_input_cost = 1000 * 5.0 / 1_000_000
            expected_output_cost = 500 * 15.0 / 1_000_000
            expected_total = expected_input_cost + expected_output_cost

            # If the future model were used, the cost would be:
            # 1000 * 10.0 / 1_000_000 + 500 * 30.0 / 1_000_000 = 0.025
            future_model_total = 1000 * 10.0 / 1_000_000 + 500 * 30.0 / 1_000_000

            total_cost = cost["total"]["cost"]
            assert total_cost is not None, "Total cost should be calculated"

            assert abs(total_cost - expected_total) < 0.0001, (
                f"Expected cost ~{expected_total:.6f} (using past model prices), "
                f"got {total_cost:.6f}. "
                f"If future model were incorrectly used, cost would be ~{future_model_total:.6f}"
            )

        finally:
            _delete_generative_model(_app, future_model["id"])
            _delete_generative_model(_app, past_model["id"])

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_no_cost_for_non_llm_spans(
        self,
        is_async: bool,
        _test_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """
        Test that non-LLM spans (e.g., CHAIN, RETRIEVER) do not get cost calculated.

        Cost tracking should only apply to spans where:
        - openinference.span.kind == "LLM"
        - llm.model_name is non-empty
        """
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        ClientClass = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _test_project.name

        base_time = datetime.now(timezone.utc)
        trace_id = f"trace_non_llm_test_{token_hex(16)}"

        # Create spans with different span kinds
        spans_to_test = [
            # CHAIN span - should NOT get cost
            {
                "name": "Chain_Span",
                "span_id": f"span_chain_{token_hex(8)}",
                "span_kind": "CHAIN",
                "oi_span_kind": "CHAIN",
            },
            # RETRIEVER span - should NOT get cost
            {
                "name": "Retriever_Span",
                "span_id": f"span_retriever_{token_hex(8)}",
                "span_kind": "INTERNAL",
                "oi_span_kind": "RETRIEVER",
            },
            # LLM span without model_name - should NOT get cost
            {
                "name": "LLM_No_Model",
                "span_id": f"span_llm_no_model_{token_hex(8)}",
                "span_kind": "LLM",
                "oi_span_kind": "LLM",
                "model_name": "",  # Empty model name
            },
        ]

        span_objects = []
        for i, spec in enumerate(spans_to_test):
            attrs: dict[str, Any] = {
                "openinference.span.kind": spec["oi_span_kind"],
                "llm.token_count.prompt": 100,
                "llm.token_count.completion": 50,
            }
            if "model_name" in spec:
                attrs["llm.model_name"] = spec["model_name"]

            span = cast(
                v1.Span,
                {
                    "name": spec["name"],
                    "context": {
                        "trace_id": trace_id,
                        "span_id": spec["span_id"],
                    },
                    "span_kind": spec["span_kind"],
                    "start_time": (base_time + timedelta(seconds=i)).isoformat(),
                    "end_time": (base_time + timedelta(seconds=i + 1)).isoformat(),
                    "status_code": "OK",
                    "attributes": attrs,
                },
            )
            span_objects.append(span)

        result = await _await_or_return(
            ClientClass(base_url=_app.base_url, api_key=_app.admin_secret).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans=span_objects,
            )
        )
        assert result["total_queued"] == len(span_objects)

        await _until_spans_exist(_app, [spec["span_id"] for spec in spans_to_test])

        # Wait a bit for the cost calculator daemon to run
        await asyncio.sleep(10)

        # Verify none of these spans got cost calculated
        for spec in spans_to_test:
            cost = _get_span_cost(_app, spec["span_id"])
            assert cost is None, (
                f"Span '{spec['name']}' (kind={spec['oi_span_kind']}) "
                f"should NOT have cost calculated, but got: {cost}"
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_user_defined_model_takes_priority_over_builtin(
        self,
        is_async: bool,
        _test_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """
        Test that user-defined (custom) models take priority over built-in models.

        When both a built-in model and a custom model match a span's model name,
        the custom model should be used for cost calculation.
        """
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        ClientClass = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _test_project.name

        # Create a custom model for gpt-4 with different prices than built-in
        custom_model = _create_generative_model(
            _app,
            name=f"Custom GPT-4 ({token_hex(4)})",
            name_pattern=r"gpt-4",
            provider="openai",
            input_cost_per_million=100.0,  # Much higher than typical built-in
            output_cost_per_million=200.0,
        )

        # Wait for GenerativeModelStore daemon to refresh (runs every 5 seconds)
        await asyncio.sleep(6)

        try:
            base_time = datetime.now(timezone.utc)
            trace_id = f"trace_priority_test_{token_hex(16)}"
            span_id = f"span_priority_test_{token_hex(8)}"

            span = cast(
                v1.Span,
                {
                    "name": "ChatCompletion",
                    "context": {
                        "trace_id": trace_id,
                        "span_id": span_id,
                    },
                    "span_kind": "LLM",
                    "start_time": base_time.isoformat(),
                    "end_time": (base_time + timedelta(seconds=2)).isoformat(),
                    "status_code": "OK",
                    "attributes": {
                        "openinference.span.kind": "LLM",
                        "llm.provider": "openai",
                        "llm.model_name": "gpt-4",
                        "llm.token_count.prompt": 1000,
                        "llm.token_count.completion": 500,
                    },
                },
            )

            result = await _await_or_return(
                ClientClass(base_url=_app.base_url, api_key=_app.admin_secret).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                    project_identifier=project_name,
                    spans=[span],
                )
            )
            assert result["total_queued"] == 1

            await _until_spans_exist(_app, [span_id])
            cost = await _wait_for_span_cost(_app, span_id)

            assert cost is not None, "Cost should be calculated"

            # The custom model should be used, not any built-in model
            # Verify the cost uses our custom prices ($100/$200 per million tokens)
            expected_input_cost = 1000 * 100.0 / 1_000_000
            expected_output_cost = 500 * 200.0 / 1_000_000
            expected_total = expected_input_cost + expected_output_cost

            total_cost = cost["total"]["cost"]
            assert total_cost is not None, "Total cost should be calculated"

            assert abs(total_cost - expected_total) < 0.0001, (
                f"Expected cost ~{expected_total:.6f} (using custom model prices), "
                f"got {total_cost:.6f}. "
                "This suggests a built-in model was used instead of the custom model."
            )

        finally:
            _delete_generative_model(_app, custom_model["id"])
