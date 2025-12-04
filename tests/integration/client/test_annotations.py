# pyright: reportPrivateUsage=false
from __future__ import annotations

from asyncio import gather, sleep
from random import choice, sample
from secrets import token_bytes, token_hex
from typing import Any, Literal, NamedTuple, Optional, Sequence, cast

import httpx
import pandas as pd
import pytest
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id, format_trace_id

import phoenix as px
from phoenix.client.__generated__ import v1
from phoenix.trace import DocumentEvaluations, SpanEvaluations, TraceEvaluations

from .._helpers import (
    _SYSTEM_USER_GID,
    _AppInfo,
    _await_or_return,
    _ExistingSpan,
    _get,
    _gql,
    _grpc_span_exporter,
    _SecurityArtifact,
    _start_span,
)

_ANNOTATOR_KINDS = ["LLM", "CODE", "HUMAN"]


class TestClientForSpanAnnotations:
    """Tests the Phoenix span annotation client functionality.

    Verifies that the client can:
    - Create and update single annotations
    - Handle multiple annotations at once
    - Work with different user roles
    - Use DataFrames for annotations
    - Work in both regular and async mode
    - Handle special cases like zero scores
    """

    # GraphQL query to retrieve span annotations for a given span ID
    query = """
    query GetSpanAnnotations($id: ID!) {
        node (id: $id) {
            ... on Span {
                spanAnnotations {
                    id
                    name
                    source
                    identifier
                    annotatorKind
                    metadata
                    label
                    score
                    explanation
                    user {
                        id
                    }
                }
            }
        }
    }
    """

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_add_span_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests creating and updating single annotations.

        Verifies that:
        - New annotations can be created with all fields
        - Existing annotations can be updated
        - Annotation IDs remain the same when updating
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span_gid1, span_id1, *_ = choice(_existing_spans)

        # Set up test environment using admin secret
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Single Annotation UPSERT Test
        # ============================================================================
        # Test UPSERT functionality by adding multiple annotations with the same name.
        # This verifies that the API correctly updates existing annotations rather
        # than creating new annotations.
        annotation_name = token_hex(8)
        existing_gid: Optional[str] = None

        # First iteration: Create initial annotation
        for j in range(2):
            # Generate random test data for the annotation
            score = int.from_bytes(token_bytes(4), byteorder="big")
            label = token_hex(8)
            explanation = token_hex(8)
            metadata = {token_hex(8): token_hex(8)}
            # Create the span annotation
            result = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.add_span_annotation(
                    annotation_name=annotation_name,
                    span_id=span_id1,
                    annotator_kind="LLM",  # Test non-default annotator_kind
                    label=label,
                    score=score,
                    explanation=explanation,
                    metadata=metadata,
                    sync=sync,
                ),
            )

            if sync:
                assert result

            # Verify the annotation was created correctly by querying the GraphQL API
            def get_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetSpanAnnotations",
                    variables={"id": str(span_gid1)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["spanAnnotations"]
                }
                return annotations.get((label, score, explanation))

            anno = await _get(
                query_fn=get_annotation,
                error_msg="Created annotation should be present in span annotations",
                no_wait=sync,
            )

            # Expected user ID for the annotation
            expected_user_id = _SYSTEM_USER_GID

            # Get the annotation and verify all fields match what was provided
            assert anno["name"] == annotation_name, "Annotation name should match input"
            assert anno["source"] == "API", "Annotation source should be API"
            assert anno["annotatorKind"] == "LLM", "Annotation annotator_kind should be LLM"
            assert anno["metadata"] == metadata, "Annotation metadata should match input"
            user = anno["user"]
            assert user is not None, "Annotation should have a user"
            assert user["id"] == expected_user_id, "Annotation user ID should match expected user"

            if j == 0:
                existing_gid = anno["id"]
            else:
                assert anno["id"] == existing_gid, (
                    "Annotation ID should remain the same after update"
                )

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_span_annotations(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling multiple annotations at once.

        Verifies that:
        - Multiple annotations can be created in one call
        - Multiple annotations can be updated at once
        - Works with annotations across different spans
        - Annotation IDs remain the same when updating
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        assert len(_existing_spans) >= 2, "At least two existing spans are required for this test"
        (span_gid1, span_id1, *_), (span_gid2, span_id2, *_) = sample(_existing_spans, 2)

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Batch Annotation Test
        # ============================================================================
        # Test batch annotation creation and updates using log_span_annotations
        # Create annotations for both spans in a single batch operation

        # Setup test data for batch operations
        span_ids = [span_id1, span_id2]
        span_gids = [span_gid1, span_gid2]
        annotation_names = [token_hex(8), token_hex(8)]
        identifiers = [token_hex(8), token_hex(8)]
        existing_gids: list[Optional[str]] = [None, None]

        # Two iterations: First creates annotations, second updates them
        for i in range(2):
            # Generate new random values for each iteration
            labels = [token_hex(8), token_hex(8)]
            scores = [
                int.from_bytes(token_bytes(4), byteorder="big"),
                int.from_bytes(token_bytes(4), byteorder="big"),
            ]
            explanations = [token_hex(8), token_hex(8)]
            metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]

            # Create annotation data for both spans
            span_annotations: list[v1.SpanAnnotationData] = [
                {
                    "name": annotation_names[i],
                    "span_id": span_ids[i],
                    "annotator_kind": "CODE",  # Test non-default annotator_kind
                    "identifier": identifiers[i],
                    "metadata": metadata[i],
                    "result": {
                        "label": labels[i],
                        "score": scores[i],
                        "explanation": explanations[i],
                    },
                }
                for i in range(len(span_ids))
            ]

            # Log the batch annotations
            result = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.log_span_annotations(
                    span_annotations=span_annotations,
                    sync=sync,
                ),
            )

            if sync:
                # Verify the batch operation returned the expected number of results
                assert result
                assert len(result) == 2, (
                    "Batch operation should return results for both annotations"
                )

            # Verify each annotation in the batch
            for j in range(2):

                def get_batch_annotation() -> Optional[dict[str, Any]]:
                    res, _ = _gql(
                        _app,
                        api_key,
                        query=self.query,
                        operation_name="GetSpanAnnotations",
                        variables={"id": str(span_gids[j])},
                    )
                    annotations = {
                        (anno["label"], anno["score"], anno["explanation"]): anno
                        for anno in res["data"]["node"]["spanAnnotations"]
                    }
                    return annotations.get((labels[j], scores[j], explanations[j]))

                anno = await _get(
                    query_fn=get_batch_annotation,
                    error_msg=f"Batch annotation {j + 1} should be present in span annotations",
                    no_wait=sync,
                )

                # Verify the batch annotation fields match what was provided
                assert anno["name"] == annotation_names[j], (
                    f"Batch annotation {j + 1} name should match input"
                )
                assert anno["source"] == "API", f"Batch annotation {j + 1} source should be API"
                assert anno["annotatorKind"] == "CODE", (
                    f"Batch annotation {j + 1} annotator_kind should be CODE"
                )
                assert anno["metadata"] == metadata[j], (
                    f"Batch annotation {j + 1} metadata should match input"
                )
                assert anno["identifier"] == identifiers[j], (
                    f"Batch annotation {j + 1} identifier should match input"
                )

                # Verify ID persistence across updates
                if i == 0:
                    existing_gids[j] = anno["id"]
                else:
                    assert anno["id"] == existing_gids[j], (
                        f"Batch annotation {j + 1} ID should remain the same after update"
                    )

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_span_annotations_dataframe(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests using DataFrames for annotations.

        Tests three ways to use DataFrames:
        1. With span_id as a column
        2. With span_id as the index
        3. With a shared annotator type

        Verifies that:
        - Annotations can be read from DataFrames
        - Different DataFrame layouts are handled correctly
        - Shared settings work properly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        assert len(_existing_spans) >= 2, "At least two existing spans are required for this test"
        (span_gid1, span_id1, *_), (span_gid2, span_id2, *_) = sample(_existing_spans, 2)

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case 1: Using span_id as column
        # ============================================================================
        # This test case demonstrates standard DataFrame usage with span_id as a column
        # All fields are provided as columns in the DataFrame
        df1_annotation_names = [token_hex(8), token_hex(8)]
        df1_span_ids = [span_id1, span_id2]
        df1_annotator_kinds = ["HUMAN", "LLM"]
        df1_labels = [token_hex(8), token_hex(8)]
        df1_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df1_explanations = [token_hex(8), token_hex(8)]
        df1_metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
        df1 = pd.DataFrame(
            {
                "name": df1_annotation_names,
                "span_id": df1_span_ids,
                "annotator_kind": df1_annotator_kinds,
                "label": df1_labels,
                "score": df1_scores,
                "explanation": df1_explanations,
                "metadata": df1_metadata,
            }
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_span_annotations_dataframe(
                dataframe=df1,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify annotations were created correctly
        for i, span_gid in enumerate([span_gid1, span_gid2]):

            def get_df_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetSpanAnnotations",
                    variables={"id": str(span_gid)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["spanAnnotations"]
                }
                return annotations.get((df1_labels[i], df1_scores[i], df1_explanations[i]))

            anno = await _get(
                query_fn=get_df_annotation,
                error_msg=f"DataFrame annotation {i + 1} should be present in span annotations",
                no_wait=sync,
            )

            # Verify annotation exists with correct values
            assert anno["name"] == df1_annotation_names[i], (
                f"DataFrame annotation {i + 1} name should match input"
            )
            assert anno["source"] == "API", f"DataFrame annotation {i + 1} source should be API"
            assert anno["metadata"] == df1_metadata[i], (
                f"DataFrame annotation {i + 1} metadata should match input"
            )
            assert anno["annotatorKind"] == df1_annotator_kinds[i], (
                f"DataFrame annotation {i + 1} annotator_kind should match input"
            )

        # ============================================================================
        # Test Case 2: Using span_id as index
        # ============================================================================
        # This test case demonstrates using span_id as the DataFrame index
        # This is an alternative way to specify span IDs without a dedicated column
        df2_annotation_names = [token_hex(8), token_hex(8)]
        df2_annotator_kinds = ["HUMAN", "LLM"]
        df2_labels = [token_hex(8), token_hex(8)]
        df2_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df2_explanations = [token_hex(8), token_hex(8)]
        df2_metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
        df2 = pd.DataFrame(
            {
                "name": df2_annotation_names,
                "annotator_kind": df2_annotator_kinds,
                "label": df2_labels,
                "score": df2_scores,
                "explanation": df2_explanations,
                "metadata": df2_metadata,
            },
            index=[span_id1, span_id2],
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_span_annotations_dataframe(
                dataframe=df2,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify annotations were created correctly
        for i, span_gid in enumerate([span_gid1, span_gid2]):

            def get_df2_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetSpanAnnotations",
                    variables={"id": str(span_gid)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["spanAnnotations"]
                }
                return annotations.get((df2_labels[i], df2_scores[i], df2_explanations[i]))

            anno = await _get(
                query_fn=get_df2_annotation,
                error_msg=f"DataFrame annotation {i + 1} should be present in span annotations",
                no_wait=sync,
            )

            # Verify annotation exists with correct values
            assert anno["name"] == df2_annotation_names[i], (
                f"DataFrame annotation {i + 1} name should match input"
            )
            assert anno["source"] == "API", f"DataFrame annotation {i + 1} source should be API"
            assert anno["metadata"] == df2_metadata[i], (
                f"DataFrame annotation {i + 1} metadata should match input"
            )
            assert anno["annotatorKind"] == df2_annotator_kinds[i], (
                f"DataFrame annotation {i + 1} annotator_kind should match input"
            )

        # ============================================================================
        # Test Case 3: Using global annotator_kind
        # ============================================================================
        # This test case demonstrates using a global annotator_kind parameter
        # The DataFrame does not include an annotator_kind column, and the value is
        # provided as a parameter to the API call.
        global_annotator_kind: Literal["HUMAN"] = "HUMAN"
        df3_annotation_names = [token_hex(8), token_hex(8)]
        df3_span_ids = [span_id1, span_id2]
        df3_labels = [token_hex(8), token_hex(8)]
        df3_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df3_explanations = [token_hex(8), token_hex(8)]
        df3_metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
        df3 = pd.DataFrame(
            {
                "name": df3_annotation_names,
                "span_id": df3_span_ids,
                "label": df3_labels,
                "score": df3_scores,
                "explanation": df3_explanations,
                "metadata": df3_metadata,
            }
        )

        # Log annotations from DataFrame with global annotator_kind
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_span_annotations_dataframe(
                dataframe=df3,
                annotator_kind=global_annotator_kind,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify annotations were created correctly
        for i, span_gid in enumerate([span_gid1, span_gid2]):

            def get_df3_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetSpanAnnotations",
                    variables={"id": str(span_gid)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["spanAnnotations"]
                }
                return annotations.get((df3_labels[i], df3_scores[i], df3_explanations[i]))

            anno = await _get(
                query_fn=get_df3_annotation,
                error_msg=f"DataFrame annotation {i + 1} should be present in span annotations",
                no_wait=sync,
            )

            # Verify annotation exists with correct values
            assert anno["name"] == df3_annotation_names[i], (
                f"DataFrame annotation {i + 1} name should match input"
            )
            assert anno["source"] == "API", f"DataFrame annotation {i + 1} source should be API"
            assert anno["metadata"] == df3_metadata[i], (
                f"DataFrame annotation {i + 1} metadata should match input"
            )
            assert anno["annotatorKind"] == global_annotator_kind, (
                f"DataFrame annotation {i + 1} annotator_kind should match global value"
            )

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_zero_score_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling annotations with zero scores.

        Verifies that:
        - Zero scores are saved and loaded correctly
        - Missing optional fields are handled properly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span_gid1, span_id1, *_ = choice(_existing_spans)

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score
        # ============================================================================
        # Test that a score of 0 is properly recorded and not treated as falsey
        zero_score_annotation_name = token_hex(8)

        # Create annotation with score of 0
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.add_span_annotation(
                annotation_name=zero_score_annotation_name,
                span_id=span_id1,
                annotator_kind="LLM",
                score=0,  # Explicitly test score of 0
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify the annotation was created correctly by querying the GraphQL API
        def get_zero_score_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetSpanAnnotations",
                variables={"id": str(span_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["spanAnnotations"]}
            return annotations.get(zero_score_annotation_name)

        anno = await _get(
            query_fn=get_zero_score_annotation,
            error_msg="Annotation with score of 0 should be present in span annotations",
            no_wait=sync,
        )

        # Verify the annotation exists and has score of 0
        assert anno["score"] == 0, "Annotation score should be exactly 0"
        assert anno["label"] is None, "Annotation label should be None"
        assert anno["explanation"] is None, "Annotation explanation should be None"
        assert anno["source"] == "API", "Annotation source should be API"
        assert anno["annotatorKind"] == "LLM", "Annotation annotator_kind should be LLM"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_zero_score_annotation_dataframe(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling zero scores in DataFrames.

        Verifies that:
        - Zero scores can be read from DataFrames
        - Missing optional fields are handled properly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span_gid1, span_id1, *_ = choice(_existing_spans)

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score in DataFrame
        # ============================================================================
        # Test that a score of 0 is properly recorded and not treated as falsey
        zero_score_annotation_name = token_hex(8)

        # Create DataFrame with score of 0
        # The DataFrame uses span ID to identify the span
        df = pd.DataFrame(
            {
                "name": [zero_score_annotation_name],
                "span_id": [span_id1],
                "annotator_kind": ["LLM"],
                "score": [0],  # Explicitly test score of 0
            }
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_span_annotations_dataframe(
                dataframe=df,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify the annotation was created correctly by querying the GraphQL API
        def get_zero_score_df_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetSpanAnnotations",
                variables={"id": str(span_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["spanAnnotations"]}
            return annotations.get(zero_score_annotation_name)

        anno = await _get(
            query_fn=get_zero_score_df_annotation,
            error_msg="DataFrame annotation with score of 0 should be present in span annotations",
            no_wait=sync,
        )

        # Verify the annotation exists and has score of 0
        assert anno["score"] == 0, "DataFrame annotation score should be exactly 0"
        assert anno["label"] is None, "DataFrame annotation label should be None"
        assert anno["explanation"] is None, "DataFrame annotation explanation should be None"
        assert anno["source"] == "API", "DataFrame annotation source should be API"
        assert anno["annotatorKind"] == "LLM", "DataFrame annotation annotator_kind should be LLM"

    async def test_burst_annotations_with_unique_identifiers(
        self,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests sending multiple span annotations in a burst with unique identifiers.

        Sends the same annotation name with different identifiers in rapid succession.
        Annotations are deduplicated by (name, identifier) tuple rather than just by name.

        Verifies that:
        - Multiple annotations with the same name but different identifiers can be sent in a burst
        - All 5 unique annotations are properly inserted
        - Each annotation maintains its unique identifier and all field values
        - Duplicate batches are correctly deduplicated
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span_gid1, span_id1, *_ = choice(_existing_spans)
        api_key = _app.admin_secret
        from phoenix.client import AsyncClient

        # ============================================================================
        # Test Case: Burst Annotations
        # ============================================================================
        annotation_name = token_hex(8)
        num_annotations = 5

        # Generate unique data for each annotation
        identifiers = [token_hex(8) for _ in range(num_annotations)]
        labels = [token_hex(8) for _ in range(num_annotations)]
        scores = [int.from_bytes(token_bytes(4), byteorder="big") for _ in range(num_annotations)]
        explanations = [token_hex(8) for _ in range(num_annotations)]
        metadata = [{token_hex(8): token_hex(8)} for _ in range(num_annotations)]

        # Create annotation data for burst sending
        span_annotations: list[v1.SpanAnnotationData] = [
            {
                "name": annotation_name,
                "span_id": span_id1,
                "annotator_kind": "CODE",
                "identifier": identifiers[i],
                "metadata": metadata[i],
                "result": {
                    "label": labels[i],
                    "score": scores[i],
                    "explanation": explanations[i],
                },
            }
            for i in range(num_annotations)
        ]

        # Send all annotations in a burst
        task = AsyncClient(base_url=_app.base_url, api_key=api_key).spans.log_span_annotations(
            span_annotations=span_annotations * 2,
            sync=False,
        )
        await gather(task, task)

        # Verify all annotations were created correctly by querying the GraphQL API
        def get_all_burst_annotations() -> Optional[dict[str, dict[str, Any]]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetSpanAnnotations",
                variables={"id": str(span_gid1)},
            )
            # Filter to only our test annotations (by name)
            test_annotations = [
                anno
                for anno in res["data"]["node"]["spanAnnotations"]
                if anno["name"] == annotation_name
            ]
            # Check if we have all expected annotations
            if len(test_annotations) == num_annotations:
                # Return indexed by identifier for easy lookup
                return {anno["identifier"]: anno for anno in test_annotations}
            return None

        annotations_by_identifier = await _get(
            query_fn=get_all_burst_annotations,
            error_msg=f"All {num_annotations} burst annotations should be present",
        )

        # Verify each annotation exists with correct values
        for i in range(num_annotations):
            assert identifiers[i] in annotations_by_identifier, (
                f"Annotation with identifier {identifiers[i]} should be present"
            )
            anno = annotations_by_identifier[identifiers[i]]
            assert anno["name"] == annotation_name, f"Annotation {i} name should match input"
            assert anno["source"] == "API", f"Annotation {i} source should be API"
            assert anno["annotatorKind"] == "CODE", f"Annotation {i} annotator_kind should be CODE"
            assert anno["metadata"] == metadata[i], f"Annotation {i} metadata should match input"
            assert anno["label"] == labels[i], f"Annotation {i} label should match input"
            assert anno["score"] == scores[i], f"Annotation {i} score should match input"
            assert anno["explanation"] == explanations[i], (
                f"Annotation {i} explanation should match input"
            )


class TestClientForSpanDocumentAnnotations:
    """Tests the Phoenix span document annotation client functionality.

    Verifies that the client can:
    - Create and update single span document annotations
    - Handle multiple span document annotations at once
    - Work with different user roles
    - Use DataFrames for span document annotations
    - Work in both regular and async mode
    - Handle special cases like zero scores
    """

    # GraphQL query to retrieve span document annotations for a given span ID
    query = """
    query GetSpanDocumentEvaluations($id: ID!) {
        node (id: $id) {
            ... on Span {
                documentEvaluations {
                    id
                    name
                    source
                    identifier
                    annotatorKind
                    metadata
                    label
                    score
                    explanation
                    documentPosition
                    user {
                        id
                    }
                }
            }
        }
    }
    """

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_add_document_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test creating and updating single span document annotations.

        Verifies UPSERT behavior, user permissions, and field persistence.
        """
        # Setup
        assert _existing_spans, "At least one span required"
        span_gid1, span_id1, *_ = choice(_existing_spans)

        # Setup authenticated user using admin secret
        api_key = _app.admin_secret

        # Setup client
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Test UPSERT functionality
        annotation_name = token_hex(8)
        document_position = 0
        existing_gid: Optional[str] = None

        # Test create then update
        for j in range(2):
            score = int.from_bytes(token_bytes(4), byteorder="big")
            label = token_hex(8)
            explanation = token_hex(8)
            metadata = {token_hex(8): token_hex(8)}

            result = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.add_document_annotation(
                    annotation_name=annotation_name,
                    span_id=span_id1,
                    document_position=document_position,
                    annotator_kind="LLM",
                    label=label,
                    score=score,
                    explanation=explanation,
                    metadata=metadata,
                    sync=sync,
                ),
            )

            if sync:
                assert result

            # Verify annotation via GraphQL
            def get_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetSpanDocumentEvaluations",
                    variables={"id": str(span_gid1)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["documentEvaluations"]
                }
                return annotations.get((label, score, explanation))

            anno = await _get(
                query_fn=get_annotation,
                error_msg="Document annotation should be present",
                no_wait=sync,
            )

            # Expected user ID for the annotation
            expected_user_id = _SYSTEM_USER_GID

            # Verify annotation fields
            assert anno["name"] == annotation_name
            assert anno["source"] == "API"
            assert anno["annotatorKind"] == "LLM"
            assert anno["metadata"] == metadata
            assert anno["documentPosition"] == document_position
            assert anno["user"]["id"] == expected_user_id

            if j == 0:
                existing_gid = anno["id"]
            else:
                assert anno["id"] == existing_gid, "ID should persist on update"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_document_annotations(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test batch span document annotation operations.

        Verifies multi-document operations, UPSERT behavior, and consistency.
        """
        # Setup
        assert len(_existing_spans) >= 2, "Two spans required"
        (span_gid1, span_id1, *_), (span_gid2, span_id2, *_) = sample(_existing_spans, 2)

        # Setup authenticated user
        api_key = _app.admin_secret

        # Setup client
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Setup batch test data
        span_ids = [span_id1, span_id2]
        span_gids = [span_gid1, span_gid2]
        annotation_names = [token_hex(8), token_hex(8)]
        identifiers = ["", ""]  # Use empty identifiers since non-empty ones are not supported
        existing_gids: list[Optional[str]] = [None, None]

        # Test create then update
        for i in range(2):
            labels = [token_hex(8), token_hex(8)]
            scores = [
                int.from_bytes(token_bytes(4), byteorder="big"),
                int.from_bytes(token_bytes(4), byteorder="big"),
            ]
            explanations = [token_hex(8), token_hex(8)]
            metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
            document_positions = [0, 0]

            # Create batch annotation data
            document_annotations: list[v1.SpanDocumentAnnotationData] = [
                {
                    "name": annotation_names[i],
                    "span_id": span_ids[i],
                    "document_position": document_positions[i],
                    "annotator_kind": "CODE",
                    "identifier": identifiers[i],
                    "metadata": metadata[i],
                    "result": {
                        "label": labels[i],
                        "score": scores[i],
                        "explanation": explanations[i],
                    },
                }
                for i in range(len(span_ids))
            ]

            # Submit batch annotations
            result = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.log_document_annotations(
                    document_annotations=document_annotations,
                    sync=sync,
                ),
            )

            if sync:
                assert result and len(result) == 2

            # Verify annotations
            for j in range(2):

                def get_batch_annotation() -> Optional[dict[str, Any]]:
                    res, _ = _gql(
                        _app,
                        api_key,
                        query=self.query,
                        operation_name="GetSpanDocumentEvaluations",
                        variables={"id": str(span_gids[j])},
                    )
                    annotations = {
                        (anno["label"], anno["score"], anno["explanation"]): anno
                        for anno in res["data"]["node"]["documentEvaluations"]
                    }
                    return annotations.get((labels[j], scores[j], explanations[j]))

                anno = await _get(
                    query_fn=get_batch_annotation,
                    error_msg=f"Batch document annotation {j + 1} should be present",
                    no_wait=sync,
                )

                # Verify annotation fields
                assert anno["name"] == annotation_names[j]
                assert anno["source"] == "API"
                assert anno["annotatorKind"] == "CODE"
                assert anno["metadata"] == metadata[j]
                assert anno["identifier"] == identifiers[j]
                assert anno["documentPosition"] == document_positions[j]

                # Verify ID persistence across updates
                if i == 0:
                    existing_gids[j] = anno["id"]
                else:
                    assert anno["id"] == existing_gids[j], "ID should persist on update"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_document_annotations_dataframe(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test DataFrame span document annotations.

        Verifies column/index layouts and global parameters.
        """
        # Setup
        assert len(_existing_spans) >= 2, "Two spans required"
        (span_gid1, span_id1, *_), (span_gid2, span_id2, *_) = sample(_existing_spans, 2)

        # Setup authenticated user
        api_key = _app.admin_secret

        # Setup client
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Test: DataFrame with columns
        df_annotation_names = [token_hex(8), token_hex(8)]
        df_span_ids = [span_id1, span_id2]
        df_annotator_kinds = ["HUMAN", "LLM"]
        df_labels = [token_hex(8), token_hex(8)]
        df_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df_explanations = [token_hex(8), token_hex(8)]
        df_metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
        document_positions = [0, 0]
        df = pd.DataFrame(
            {
                "name": df_annotation_names,
                "span_id": df_span_ids,
                "document_position": document_positions,
                "annotator_kind": df_annotator_kinds,
                "label": df_labels,
                "score": df_scores,
                "explanation": df_explanations,
                "metadata": df_metadata,
            }
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client(
                base_url=_app.base_url, api_key=api_key
            ).spans.log_document_annotations_dataframe(
                dataframe=df,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify annotations were created correctly
        for i, span_gid in enumerate([span_gid1, span_gid2]):

            def get_df_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetSpanDocumentEvaluations",
                    variables={"id": str(span_gid)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["documentEvaluations"]
                }
                return annotations.get((df_labels[i], df_scores[i], df_explanations[i]))

            anno = await _get(
                query_fn=get_df_annotation,
                error_msg=f"DataFrame document annotation {i + 1} should be present",
                no_wait=sync,
            )

            # Verify annotation exists with correct values
            assert anno["name"] == df_annotation_names[i]
            assert anno["source"] == "API"
            assert anno["metadata"] == df_metadata[i]
            assert anno["annotatorKind"] == df_annotator_kinds[i]
            assert anno["documentPosition"] == document_positions[i]

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_zero_score_document_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test zero score handling in span document annotations."""
        # Setup
        assert _existing_spans, "At least one span required"
        span_gid1, span_id1, *_ = choice(_existing_spans)

        # Setup authenticated user
        api_key = _app.admin_secret

        # Setup client
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Test zero score
        zero_score_annotation_name = token_hex(8)
        document_position = 0

        # Create annotation with score of 0
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.add_document_annotation(
                annotation_name=zero_score_annotation_name,
                span_id=span_id1,
                document_position=document_position,
                annotator_kind="LLM",
                score=0,  # Explicitly test score of 0
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify zero score annotation
        def get_zero_score_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetSpanDocumentEvaluations",
                variables={"id": str(span_gid1)},
            )
            annotations = {
                anno["name"]: anno for anno in res["data"]["node"]["documentEvaluations"]
            }
            return annotations.get(zero_score_annotation_name)

        anno = await _get(
            query_fn=get_zero_score_annotation,
            error_msg="Document annotation with score of 0 should be present",
            no_wait=sync,
        )

        # Verify the annotation exists and has score of 0
        assert anno["score"] == 0
        assert anno["label"] is None
        assert anno["explanation"] is None
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"
        assert anno["documentPosition"] == document_position

    @pytest.mark.parametrize("sync", [True, False])
    async def test_document_annotation_identifier_validation(
        self,
        sync: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test server-side identifier validation via direct HTTP requests.

        Verifies that:
        - Non-empty identifiers are rejected with HTTP 422
        """
        # Setup
        assert _existing_spans, "At least one span required"
        _, span_id1, *_ = choice(_existing_spans)

        # Setup HTTP client for direct requests
        async with httpx.AsyncClient(base_url=_app.base_url) as client:
            headers = {
                "Authorization": f"Bearer {_app.admin_secret}",
                "Content-Type": "application/json",
            }

            # Non-empty identifier should be rejected
            non_empty_request_body = {
                "data": [
                    {
                        "span_id": span_id1,
                        "document_position": 0,
                        "name": token_hex(8),
                        "annotator_kind": "HUMAN",
                        "identifier": "test_identifier",  # Non-empty identifier
                        "result": {
                            "label": "True",
                            "score": 0.95,
                            "explanation": "This should be rejected.",
                        },
                        "metadata": {},
                    }
                ]
            }

            response = await client.post(
                f"v1/document_annotations?sync={sync}", json=non_empty_request_body, headers=headers
            )
            assert response.status_code == 422, (
                "Non-empty identifier should be rejected with HTTP 422"
            )


class TestClientForTraceAnnotations:
    """Tests the Phoenix trace annotation client functionality.

    Verifies that the client can:
    - Create and update single trace annotations
    - Handle multiple trace annotations at once
    - Work with different user roles
    - Work in both regular and async mode
    - Retrieve trace annotations
    """

    # GraphQL query to retrieve trace annotations for a given trace ID
    query = """
    query GetTraceAnnotations($id: ID!) {
        node (id: $id) {
            ... on Trace {
                traceAnnotations {
                    id
                    name
                    source
                    identifier
                    annotatorKind
                    metadata
                    label
                    score
                    explanation
                    user {
                        id
                    }
                }
            }
        }
    }
    """

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_add_trace_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests creating and updating single trace annotations.

        Verifies that:
        - New trace annotations can be created with all fields
        - Existing trace annotations can be updated
        - Annotation IDs remain the same when updating
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # Setup
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        trace_id1 = span1.trace.trace_id

        # Set up test environment using admin secret
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Test UPSERT functionality by adding multiple annotations with the same name
        annotation_name = token_hex(8)

        # Create initial annotation
        score = 0.75
        label = "good"
        explanation = "Test trace annotation"
        metadata = {"test": "metadata"}

        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).traces.add_trace_annotation(
                annotation_name=annotation_name,
                trace_id=trace_id1,
                annotator_kind="HUMAN",
                label=label,
                score=score,
                explanation=explanation,
                metadata=metadata,
                sync=sync,
            ),
        )

        if sync:
            assert result is not None, "Should receive annotation ID when sync=True"
            assert result["id"], "Should have valid annotation ID"
        else:
            assert result is None, "Should not receive annotation ID when sync=False"

        # Verify annotation was created via GraphQL

        # Get trace GID from span data - use the existing trace GID from the span
        trace_gid = str(span1.trace.id)

        # Use _get() method to wait for annotation to be created and retrieved
        def get_trace_annotation() -> Optional[dict[str, Any]]:
            gql_resp, _ = _gql(
                _app, _app.admin_secret, query=self.query, variables={"id": trace_gid}
            )
            annotations: list[dict[str, Any]] = gql_resp["data"]["node"]["traceAnnotations"]

            # Filter to find the annotation we just created
            our_annotations = [anno for anno in annotations if anno["name"] == annotation_name]
            if len(our_annotations) == 1:
                return our_annotations[0]
            return None

        anno = await _get(
            query_fn=get_trace_annotation,
            error_msg=f"Should have exactly one trace annotation with name {annotation_name}",
            no_wait=sync,
        )
        assert anno["name"] == annotation_name
        assert anno["label"] == label
        assert anno["score"] == score
        assert anno["explanation"] == explanation
        assert anno["annotatorKind"] == "HUMAN"
        assert anno["metadata"] == metadata
        assert anno["source"] == "API"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_trace_annotations(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling multiple trace annotations at once.

        Verifies that:
        - Multiple trace annotations can be created in one call
        - Multiple trace annotations can be updated at once
        - Works with annotations across different traces
        - Annotation IDs remain the same when updating
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL trace IDs and graphql Global IDs from the fixture
        assert len(_existing_spans) >= 2, "At least two existing spans are required for this test"
        span1, span2, *_ = _existing_spans
        trace_id1 = span1.trace.trace_id
        trace_id2 = span2.trace.trace_id
        trace_gid1 = span1.trace.id
        trace_gid2 = span2.trace.id

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Batch Annotation Test
        # ============================================================================
        # Test batch annotation creation and updates using log_trace_annotations
        # Create annotations for both traces in a single batch operation

        # Setup test data for batch operations
        trace_ids = [trace_id1, trace_id2]
        trace_gids = [trace_gid1, trace_gid2]
        annotation_names = [token_hex(8), token_hex(8)]
        identifiers = [token_hex(8), token_hex(8)]
        existing_gids: list[Optional[str]] = [None, None]

        # Two iterations: First creates annotations, second updates them
        for i in range(2):
            # Generate new random values for each iteration
            labels = [token_hex(8), token_hex(8)]
            scores = [
                int.from_bytes(token_bytes(4), byteorder="big"),
                int.from_bytes(token_bytes(4), byteorder="big"),
            ]
            explanations = [token_hex(8), token_hex(8)]
            metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]

            # Create annotation data for both traces
            trace_annotations: list[v1.TraceAnnotationData] = [
                {
                    "name": annotation_names[i],
                    "trace_id": trace_ids[i],
                    "annotator_kind": "CODE",  # Test non-default annotator_kind
                    "identifier": identifiers[i],
                    "metadata": metadata[i],
                    "result": {
                        "label": labels[i],
                        "score": scores[i],
                        "explanation": explanations[i],
                    },
                }
                for i in range(len(trace_ids))
            ]

            # Log the batch annotations
            result = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).traces.log_trace_annotations(
                    trace_annotations=trace_annotations,
                    sync=sync,
                ),
            )

            if sync:
                # Verify the batch operation returned the expected number of results
                assert result
                assert len(result) == 2, (
                    "Batch operation should return results for both annotations"
                )

            # Verify each annotation in the batch
            for j in range(2):

                def get_batch_annotation() -> Optional[dict[str, Any]]:
                    res, _ = _gql(
                        _app,
                        api_key,
                        query=self.query,
                        operation_name="GetTraceAnnotations",
                        variables={"id": str(trace_gids[j])},
                    )
                    annotations = {
                        (anno["label"], anno["score"], anno["explanation"]): anno
                        for anno in res["data"]["node"]["traceAnnotations"]
                    }
                    return annotations.get((labels[j], scores[j], explanations[j]))

                anno = await _get(
                    query_fn=get_batch_annotation,
                    error_msg=f"Batch annotation {j + 1} should be present in trace annotations",
                    no_wait=sync,
                )

                # Verify annotation exists with correct values
                assert anno["name"] == annotation_names[j], (
                    f"Batch annotation {j + 1} name should match input"
                )
                assert anno["source"] == "API", f"Batch annotation {j + 1} source should be API"
                assert anno["annotatorKind"] == "CODE", (
                    f"Batch annotation {j + 1} annotator_kind should be CODE"
                )
                assert anno["metadata"] == metadata[j], (
                    f"Batch annotation {j + 1} metadata should match input"
                )
                assert anno["identifier"] == identifiers[j], (
                    f"Batch annotation {j + 1} identifier should match input"
                )

                # Verify ID persistence across updates
                if i == 0:
                    existing_gids[j] = anno["id"]
                else:
                    assert anno["id"] == existing_gids[j], (
                        f"Batch annotation {j + 1} ID should remain the same after update"
                    )

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_trace_annotations_dataframe(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests using DataFrames for trace annotations.

        Tests three ways to use DataFrames:
        1. With trace_id as a column
        2. With trace_id as the index
        3. With a shared annotator type

        Verifies that:
        - Trace annotations can be read from DataFrames
        - Different DataFrame layouts are handled correctly
        - Shared settings work properly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL trace IDs and graphql Global IDs from the fixture
        assert len(_existing_spans) >= 2, "At least two existing spans are required for this test"
        span1, span2, *_ = _existing_spans
        trace_id1 = span1.trace.trace_id
        trace_id2 = span2.trace.trace_id
        trace_gid1 = span1.trace.id
        trace_gid2 = span2.trace.id

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case 1: Using trace_id as column
        # ============================================================================
        # This test case demonstrates standard DataFrame usage with trace_id as a column
        # All fields are provided as columns in the DataFrame
        df1_annotation_names = [token_hex(8), token_hex(8)]
        df1_trace_ids = [trace_id1, trace_id2]
        df1_annotator_kinds = ["HUMAN", "CODE"]
        df1_labels = [token_hex(8), token_hex(8)]
        df1_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df1_explanations = [token_hex(8), token_hex(8)]
        df1_metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
        df1 = pd.DataFrame(
            {
                "name": df1_annotation_names,
                "trace_id": df1_trace_ids,
                "annotator_kind": df1_annotator_kinds,
                "label": df1_labels,
                "score": df1_scores,
                "explanation": df1_explanations,
                "metadata": df1_metadata,
            }
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).traces.log_trace_annotations_dataframe(
                dataframe=df1,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify annotations were created correctly
        for i, trace_gid in enumerate([trace_gid1, trace_gid2]):

            def get_df_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetTraceAnnotations",
                    variables={"id": str(trace_gid)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["traceAnnotations"]
                }
                return annotations.get((df1_labels[i], df1_scores[i], df1_explanations[i]))

            anno = await _get(
                query_fn=get_df_annotation,
                error_msg=f"DataFrame annotation {i + 1} should be present in trace annotations",
                no_wait=sync,
            )

            # Verify annotation exists with correct values
            assert anno["name"] == df1_annotation_names[i], (
                f"DataFrame annotation {i + 1} name should match input"
            )
            assert anno["source"] == "API", f"DataFrame annotation {i + 1} source should be API"
            assert anno["metadata"] == df1_metadata[i], (
                f"DataFrame annotation {i + 1} metadata should match input"
            )
            assert anno["annotatorKind"] == df1_annotator_kinds[i], (
                f"DataFrame annotation {i + 1} annotator_kind should match input"
            )

        # ============================================================================
        # Test Case 2: Using trace_id as index
        # ============================================================================
        # This test case demonstrates using trace_id as the DataFrame index
        # This is an alternative way to specify trace IDs without a dedicated column
        df2_annotation_names = [token_hex(8), token_hex(8)]
        df2_annotator_kinds = ["HUMAN", "CODE"]
        df2_labels = [token_hex(8), token_hex(8)]
        df2_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df2_explanations = [token_hex(8), token_hex(8)]
        df2_metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
        df2 = pd.DataFrame(
            {
                "name": df2_annotation_names,
                "annotator_kind": df2_annotator_kinds,
                "label": df2_labels,
                "score": df2_scores,
                "explanation": df2_explanations,
                "metadata": df2_metadata,
            },
            index=[trace_id1, trace_id2],
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).traces.log_trace_annotations_dataframe(
                dataframe=df2,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify annotations were created correctly
        for i, trace_gid in enumerate([trace_gid1, trace_gid2]):

            def get_df2_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetTraceAnnotations",
                    variables={"id": str(trace_gid)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["traceAnnotations"]
                }
                return annotations.get((df2_labels[i], df2_scores[i], df2_explanations[i]))

            anno = await _get(
                query_fn=get_df2_annotation,
                error_msg=f"DataFrame annotation {i + 1} should be present in trace annotations",
                no_wait=sync,
            )

            # Verify annotation exists with correct values
            assert anno["name"] == df2_annotation_names[i], (
                f"DataFrame annotation {i + 1} name should match input"
            )
            assert anno["source"] == "API", f"DataFrame annotation {i + 1} source should be API"
            assert anno["metadata"] == df2_metadata[i], (
                f"DataFrame annotation {i + 1} metadata should match input"
            )
            assert anno["annotatorKind"] == df2_annotator_kinds[i], (
                f"DataFrame annotation {i + 1} annotator_kind should match input"
            )

        # ============================================================================
        # Test Case 3: Using global annotator_kind
        # ============================================================================
        # This test case demonstrates using a global annotator_kind parameter
        # The DataFrame does not include an annotator_kind column, and the value is
        # provided as a parameter to the API call.
        global_annotator_kind: Literal["CODE"] = "CODE"
        df3_annotation_names = [token_hex(8), token_hex(8)]
        df3_trace_ids = [trace_id1, trace_id2]
        df3_labels = [token_hex(8), token_hex(8)]
        df3_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df3_explanations = [token_hex(8), token_hex(8)]
        df3_metadata = [{token_hex(8): token_hex(8)} for _ in range(2)]
        df3 = pd.DataFrame(
            {
                "name": df3_annotation_names,
                "trace_id": df3_trace_ids,
                "label": df3_labels,
                "score": df3_scores,
                "explanation": df3_explanations,
                "metadata": df3_metadata,
            }
        )

        # Log annotations from DataFrame with global annotator_kind
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).traces.log_trace_annotations_dataframe(
                dataframe=df3,
                annotator_kind=global_annotator_kind,
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify annotations were created correctly
        for i, trace_gid in enumerate([trace_gid1, trace_gid2]):

            def get_df3_annotation() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    operation_name="GetTraceAnnotations",
                    variables={"id": str(trace_gid)},
                )
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["traceAnnotations"]
                }
                return annotations.get((df3_labels[i], df3_scores[i], df3_explanations[i]))

            anno = await _get(
                query_fn=get_df3_annotation,
                error_msg=f"DataFrame annotation {i + 1} should be present in trace annotations",
                no_wait=sync,
            )

            # Verify annotation exists with correct values
            assert anno["name"] == df3_annotation_names[i], (
                f"DataFrame annotation {i + 1} name should match input"
            )
            assert anno["source"] == "API", f"DataFrame annotation {i + 1} source should be API"
            assert anno["metadata"] == df3_metadata[i], (
                f"DataFrame annotation {i + 1} metadata should match input"
            )
            assert anno["annotatorKind"] == global_annotator_kind, (
                f"DataFrame annotation {i + 1} annotator_kind should match global value"
            )

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_zero_score_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling trace annotations with zero scores.

        Verifies that:
        - Zero scores are saved and loaded correctly
        - Missing optional fields are handled properly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL trace ID and graphql Global ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        trace_gid1 = span1.trace.id
        trace_id1 = span1.trace.trace_id

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score
        # ============================================================================
        # Test that a score of 0 is properly recorded and not treated as falsey
        zero_score_annotation_name = token_hex(8)

        # Create annotation with score of 0
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).traces.add_trace_annotation(
                annotation_name=zero_score_annotation_name,
                trace_id=trace_id1,
                annotator_kind="LLM",
                score=0,  # Explicitly test score of 0
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify the annotation was created correctly by querying the GraphQL API
        def get_zero_score_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetTraceAnnotations",
                variables={"id": str(trace_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["traceAnnotations"]}
            return annotations.get(zero_score_annotation_name)

        anno = await _get(
            query_fn=get_zero_score_annotation,
            error_msg="Annotation with score of 0 should be present in trace annotations",
            no_wait=sync,
        )

        # Verify the annotation exists and has score of 0
        assert anno["score"] == 0, "Annotation score should be exactly 0"
        assert anno["label"] is None, "Annotation label should be None"
        assert anno["explanation"] is None, "Annotation explanation should be None"
        assert anno["source"] == "API", "Annotation source should be API"
        assert anno["annotatorKind"] == "LLM", "Annotation annotator_kind should be LLM"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_zero_score_annotation_dataframe(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling zero scores in trace annotation DataFrames.

        Verifies that:
        - Zero scores can be read from DataFrames
        - Zero scores are saved and loaded correctly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL trace ID and graphql Global ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        trace_gid1 = span1.trace.id
        trace_id1 = span1.trace.trace_id

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score in DataFrame
        # ============================================================================
        # Test that zero scores work correctly when provided via DataFrame
        import pandas as pd

        zero_score_annotation_name = token_hex(8)

        df = pd.DataFrame(
            {
                "name": [zero_score_annotation_name],
                "trace_id": [trace_id1],
                "annotator_kind": ["CODE"],
                "score": [0],  # Test zero score
                # Omit label and explanation to test None handling
            }
        )

        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).traces.log_trace_annotations_dataframe(
                dataframe=df, sync=sync
            ),
        )

        if sync:
            assert result

        # Verify the annotation was created correctly
        def get_zero_score_df_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetTraceAnnotations",
                variables={"id": str(trace_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["traceAnnotations"]}
            return annotations.get(zero_score_annotation_name)

        anno = await _get(
            query_fn=get_zero_score_df_annotation,
            error_msg="Zero score DataFrame annotation should be present in trace annotations",
            no_wait=sync,
        )

        # Verify the annotation exists and has score of 0
        assert anno["score"] == 0, "DataFrame annotation score should be exactly 0"
        assert anno["label"] is None, "DataFrame annotation label should be None"
        assert anno["explanation"] is None, "DataFrame annotation explanation should be None"
        assert anno["source"] == "API", "DataFrame annotation source should be API"
        assert anno["annotatorKind"] == "CODE", "DataFrame annotation annotator_kind should be CODE"

    async def test_burst_trace_annotations_with_unique_identifiers(
        self,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests sending multiple trace annotations in a burst with unique identifiers.

        Sends the same annotation name with different identifiers in rapid succession.
        Annotations are deduplicated by (name, identifier) tuple rather than just by name.

        Verifies that:
        - Multiple annotations with the same name but different identifiers can be sent in a burst
        - All 5 unique annotations are properly inserted
        - Each annotation maintains its unique identifier and all field values
        - Duplicate batches are correctly deduplicated
        """
        # Setup
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        trace_gid1 = span1.trace.id
        trace_id1 = span1.trace.trace_id
        api_key = _app.admin_secret
        from phoenix.client import AsyncClient

        # Test Case: Burst Trace Annotations
        annotation_name = token_hex(8)
        num_annotations = 5

        # Generate unique data for each annotation
        identifiers = [token_hex(8) for _ in range(num_annotations)]
        labels = [token_hex(8) for _ in range(num_annotations)]
        scores = [int.from_bytes(token_bytes(4), byteorder="big") for _ in range(num_annotations)]
        explanations = [token_hex(8) for _ in range(num_annotations)]
        metadata = [{token_hex(8): token_hex(8)} for _ in range(num_annotations)]

        # Create annotation data for burst sending
        trace_annotations: list[v1.TraceAnnotationData] = [
            {
                "name": annotation_name,
                "trace_id": trace_id1,
                "annotator_kind": "CODE",
                "identifier": identifiers[i],
                "metadata": metadata[i],
                "result": {
                    "label": labels[i],
                    "score": scores[i],
                    "explanation": explanations[i],
                },
            }
            for i in range(num_annotations)
        ]

        # Send all annotations in a burst
        task = AsyncClient(base_url=_app.base_url, api_key=api_key).traces.log_trace_annotations(
            trace_annotations=trace_annotations * 2,
            sync=False,
        )
        await gather(task, task)

        # Verify all annotations were created correctly by querying the GraphQL API
        def get_all_burst_annotations() -> Optional[dict[str, dict[str, Any]]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetTraceAnnotations",
                variables={"id": str(trace_gid1)},
            )
            # Filter to only our test annotations (by name)
            test_annotations = [
                anno
                for anno in res["data"]["node"]["traceAnnotations"]
                if anno["name"] == annotation_name
            ]
            # Check if we have all expected annotations
            if len(test_annotations) == num_annotations:
                # Return indexed by identifier for easy lookup
                return {anno["identifier"]: anno for anno in test_annotations}
            return None

        annotations_by_identifier = await _get(
            query_fn=get_all_burst_annotations,
            error_msg=f"All {num_annotations} burst trace annotations should be present",
        )

        # Verify each annotation exists with correct values
        for i in range(num_annotations):
            assert identifiers[i] in annotations_by_identifier, (
                f"Trace annotation with identifier {identifiers[i]} should be present"
            )
            anno = annotations_by_identifier[identifiers[i]]
            assert anno["name"] == annotation_name, f"Trace annotation {i} name should match input"
            assert anno["source"] == "API", f"Trace annotation {i} source should be API"
            assert anno["annotatorKind"] == "CODE", (
                f"Trace annotation {i} annotator_kind should be CODE"
            )
            assert anno["metadata"] == metadata[i], (
                f"Trace annotation {i} metadata should match input"
            )
            assert anno["label"] == labels[i], f"Trace annotation {i} label should match input"
            assert anno["score"] == scores[i], f"Trace annotation {i} score should match input"
            assert anno["explanation"] == explanations[i], (
                f"Trace annotation {i} explanation should match input"
            )


class TestClientForSessionAnnotations:
    """Tests the Phoenix session annotation client functionality.

    Verifies that the client can:
    - Create and update single session annotations
    - Handle multiple session annotations at once
    - Work with different user roles
    - Work in both regular and async mode
    """

    # GraphQL query to retrieve session annotations
    query = """
        query GetSessionAnnotations($id: ID!) {
            node(id: $id) {
                ... on ProjectSession {
                    sessionAnnotations {
                        id
                        name
                        annotatorKind
                        label
                        score
                        explanation
                        metadata
                        identifier
                        source
                        user {
                            id
                        }
                    }
                }
            }
        }
    """

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_add_session_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests creating and updating single session annotations.

        Verifies that:
        - New session annotations can be created with all fields
        - Existing session annotations can be updated
        - Annotation IDs remain the same when updating
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # Setup
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        session1 = span1.trace.session
        assert session1 is not None, "Session is required for this test"
        session_id1 = session1.session_id
        session_gid1 = session1.id

        # Set up test environment using admin secret
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Test data
        annotation_name = token_hex(8)

        # ============================================================================
        # Test Case: Create New Session Annotation
        # ============================================================================
        # Create a new session annotation with all fields
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).sessions.add_session_annotation(
                annotation_name=annotation_name,
                session_id=session_id1,
                annotator_kind="CODE",
                label="helpful",
                score=0.9,
                explanation="This session was very helpful to the user",
                metadata={"model_name": "gpt-4", "version": "2024-01"},
                identifier="test-id-123",
                sync=sync,
            ),
        )

        if sync:
            assert result
            assert isinstance(result["id"], str)

        # Verify the annotation was created correctly by querying the GraphQL API

        def get_session_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetSessionAnnotations",
                variables={"id": str(session_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["sessionAnnotations"]}
            return annotations.get(annotation_name)

        anno = await _get(
            query_fn=get_session_annotation,
            error_msg="Session annotation should be present in session annotations",
            no_wait=sync,
        )

        # Verify the annotation exists and has the expected values
        assert anno["name"] == annotation_name
        assert anno["annotatorKind"] == "CODE"
        assert anno["label"] == "helpful"
        assert anno["score"] == 0.9
        assert anno["explanation"] == "This session was very helpful to the user"
        assert anno["metadata"] == {"model_name": "gpt-4", "version": "2024-01"}
        assert anno["identifier"] == "test-id-123"
        assert anno["source"] == "API"

        # Store the annotation ID for the update test
        original_annotation_id = anno["id"]

        # ============================================================================
        # Test Case: Update Existing Session Annotation
        # ============================================================================
        # Update the annotation by sending it again with the same name, session_id, and identifier
        updated_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).sessions.add_session_annotation(
                annotation_name=annotation_name,
                session_id=session_id1,
                annotator_kind="HUMAN",  # Changed
                label="extremely_helpful",  # Changed
                score=1.0,  # Changed
                explanation="This session was extremely helpful after review",  # Changed
                metadata={"model_name": "gpt-4", "version": "2024-02", "reviewed": True},  # Changed
                identifier="test-id-123",  # Same identifier - should update
                sync=sync,
            ),
        )

        if sync:
            assert updated_result
            assert isinstance(updated_result["id"], str)

        # Verify the annotation was updated correctly
        updated_anno = await _get(
            query_fn=get_session_annotation,
            error_msg="Updated session annotation should be present in session annotations",
            no_wait=sync,
        )

        # Verify the annotation was updated (same ID, different values)
        assert updated_anno["id"] == original_annotation_id  # ID should remain the same
        assert updated_anno["name"] == annotation_name
        assert updated_anno["annotatorKind"] == "HUMAN"  # Updated
        assert updated_anno["label"] == "extremely_helpful"  # Updated
        assert updated_anno["score"] == 1.0  # Updated
        assert (
            updated_anno["explanation"] == "This session was extremely helpful after review"
        )  # Updated
        assert updated_anno["metadata"] == {
            "model_name": "gpt-4",
            "version": "2024-02",
            "reviewed": True,
        }  # Updated
        assert updated_anno["identifier"] == "test-id-123"
        assert updated_anno["source"] == "API"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_session_annotations(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling multiple session annotations at once.

        Verifies that:
        - Multiple session annotations can be created in one call
        - Multiple session annotations can be updated at once
        - Works with annotations across different sessions
        - Annotation IDs remain the same when updating
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract session IDs from the fixture
        assert len(_existing_spans) >= 2, "At least two existing spans are required for this test"
        span1, span2, *_ = _existing_spans
        assert span1.trace.session is not None, "Session is required for this test"
        assert span2.trace.session is not None, "Session is required for this test"
        session_id1 = span1.trace.session.session_id
        session_id2 = span2.trace.session.session_id

        # Ensure we have different sessions for a more robust test
        unique_sessions = {session_id1, session_id2}
        if len(unique_sessions) < 2:
            pytest.skip("Test requires at least two different sessions")

        session_ids = [session_id1, session_id2]

        # Set up test environment using admin secret
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Data Setup
        # ============================================================================
        # Create annotation data for both sessions
        annotation_names = [token_hex(8), token_hex(8)]
        labels = ["helpful", "relevant"]
        scores = [0.8, 0.9]
        explanations = ["First session annotation", "Second session annotation"]
        identifiers = ["batch-test-1", "batch-test-2"]
        metadata = [{"model": "gpt-4", "batch": 1}, {"model": "claude", "batch": 2}]

        # Create annotation data for both sessions
        session_annotations: list[v1.SessionAnnotationData] = [
            {
                "name": annotation_names[i],
                "session_id": session_ids[i],
                "annotator_kind": "CODE",  # Test non-default annotator_kind
                "identifier": identifiers[i],
                "metadata": metadata[i],
                "result": {
                    "label": labels[i],
                    "score": scores[i],
                    "explanation": explanations[i],
                },
            }
            for i in range(len(session_ids))
        ]

        # ============================================================================
        # Test Case: Create Multiple Session Annotations
        # ============================================================================
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).sessions.log_session_annotations(
                session_annotations=session_annotations, sync=sync
            ),
        )

        if sync:
            assert result
            assert len(result) == 2
            for r in result:
                assert isinstance(r["id"], str)

        # Wait for annotations to be inserted and verify them
        assert span1.trace.session is not None, "Session is required for this test"
        assert span2.trace.session is not None, "Session is required for this test"
        session_gid1 = span1.trace.session.id
        session_gid2 = span2.trace.session.id

        # Retrieve and verify first session annotation
        def get_session_annotation_1() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                variables={"id": str(session_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["sessionAnnotations"]}
            return annotations.get(annotation_names[0])

        anno1 = await _get(
            query_fn=get_session_annotation_1,
            error_msg="First session annotation should be present",
            no_wait=sync,
        )
        assert anno1["name"] == annotation_names[0]
        assert anno1["annotatorKind"] == "CODE"
        assert anno1["label"] == labels[0]
        assert anno1["score"] == scores[0]
        assert anno1["explanation"] == explanations[0]
        assert anno1["metadata"] == metadata[0]
        assert anno1["identifier"] == identifiers[0]
        assert anno1["source"] == "API"

        # Retrieve and verify second session annotation (if different session)
        if session_gid1 != session_gid2:

            def get_session_annotation_2() -> Optional[dict[str, Any]]:
                res, _ = _gql(
                    _app,
                    api_key,
                    query=self.query,
                    variables={"id": str(session_gid2)},
                )
                annotations = {
                    anno["name"]: anno for anno in res["data"]["node"]["sessionAnnotations"]
                }
                return annotations.get(annotation_names[1])

            anno2 = await _get(
                query_fn=get_session_annotation_2,
                error_msg="Second session annotation should be present",
                no_wait=sync,
            )
            assert anno2["name"] == annotation_names[1]
            assert anno2["annotatorKind"] == "CODE"
            assert anno2["label"] == labels[1]
            assert anno2["score"] == scores[1]
            assert anno2["explanation"] == explanations[1]
            assert anno2["metadata"] == metadata[1]
            assert anno2["identifier"] == identifiers[1]
            assert anno2["source"] == "API"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_log_session_annotations_dataframe(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests using DataFrames for session annotations.

        Tests three ways to use DataFrames:
        1. With session_id as a column
        2. With session_id as the index
        3. With a shared annotator type

        Verifies that:
        - DataFrames are processed correctly in chunks
        - Both individual and global parameters work
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract session IDs from fixtures (use the first two)
        assert len(_existing_spans) >= 2, "At least two existing spans are required for this test"
        span1, span2, *_ = _existing_spans
        assert span1.trace.session is not None, "Session is required for this test"
        assert span2.trace.session is not None, "Session is required for this test"
        session_id1 = span1.trace.session.session_id
        session_id2 = span2.trace.session.session_id

        # Set up test environment using admin secret
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case 1: session_id as a column
        # ============================================================================
        import pandas as pd

        df_with_session_column = pd.DataFrame(
            {
                "name": ["helpfulness", "clarity"],
                "session_id": [session_id1, session_id2],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["helpful", "clear"],
                "score": [0.8, 0.9],
                "explanation": ["Session was helpful", "Session was clear"],
                "metadata": [{"test": "case1a"}, {"test": "case1b"}],
                "identifier": ["df-test-1", "df-test-2"],
            }
        )

        result = await _await_or_return(
            Client(
                base_url=_app.base_url, api_key=api_key
            ).sessions.log_session_annotations_dataframe(
                dataframe=df_with_session_column, sync=sync
            ),
        )

        if sync:
            assert result
            assert len(result) == 2

        # ============================================================================
        # Test Case 2: session_id as index
        # ============================================================================
        df_with_session_index = pd.DataFrame(
            {
                "name": ["relevance", "accuracy"],
                "annotator_kind": ["CODE", "HUMAN"],
                "label": ["relevant", "accurate"],
                "score": [0.7, 0.95],
                "explanation": ["Session was relevant", "Session was accurate"],
                "metadata": [{"test": "case2a"}, {"test": "case2b"}],
                "identifier": ["df-index-1", "df-index-2"],
            },
            index=[session_id1, session_id2],
        )

        result = await _await_or_return(
            Client(
                base_url=_app.base_url, api_key=api_key
            ).sessions.log_session_annotations_dataframe(
                dataframe=df_with_session_index, sync=sync
            ),
        )

        if sync:
            assert result
            assert len(result) == 2

        # ============================================================================
        # Test Case 3: Global annotator_kind
        # ============================================================================
        df_global_annotator = pd.DataFrame(
            {
                "name": ["engagement", "satisfaction"],
                "session_id": [session_id1, session_id2],
                "label": ["engaged", "satisfied"],
                "score": [0.6, 0.85],
                "explanation": ["Session showed engagement", "Session was satisfying"],
                "identifier": ["global-1", "global-2"],
            }
        )

        result = await _await_or_return(
            Client(
                base_url=_app.base_url, api_key=api_key
            ).sessions.log_session_annotations_dataframe(
                dataframe=df_global_annotator,
                annotator_kind="LLM",  # Global parameter
                sync=sync,
            ),
        )

        if sync:
            assert result
            assert len(result) == 2

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_zero_score_annotation(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling session annotations with zero scores.

        Verifies that:
        - Zero scores are saved and loaded correctly
        - Missing optional fields are handled properly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract session ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        assert span1.trace.session is not None, "Session is required for this test"
        session_id1 = span1.trace.session.session_id

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score
        # ============================================================================
        # Test that a score of 0 is properly recorded and not treated as falsey
        zero_score_annotation_name = token_hex(8)

        # Create annotation with score of 0
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).sessions.add_session_annotation(
                annotation_name=zero_score_annotation_name,
                session_id=session_id1,
                annotator_kind="LLM",
                score=0,  # Explicitly test score of 0
                sync=sync,
            ),
        )

        if sync:
            assert result

        # Verify the annotation was created correctly by querying the GraphQL API
        assert span1.trace.session is not None, "Session is required for this test"
        session_gid1 = span1.trace.session.id

        def get_zero_score_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                variables={"id": str(session_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["sessionAnnotations"]}
            return annotations.get(zero_score_annotation_name)

        anno = await _get(
            query_fn=get_zero_score_annotation,
            error_msg="Annotation with score of 0 should be present in session annotations",
            no_wait=sync,
        )

        # Verify the annotation exists and has score of 0
        assert anno["score"] == 0, "Annotation score should be exactly 0"
        assert anno["label"] is None, "Annotation label should be None"
        assert anno["explanation"] is None, "Annotation explanation should be None"
        assert anno["source"] == "API", "Annotation source should be API"
        assert anno["annotatorKind"] == "LLM", "Annotation annotator_kind should be LLM"

    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    async def test_zero_score_annotation_dataframe(
        self,
        sync: bool,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests handling zero scores in session annotation DataFrames.

        Verifies that:
        - Zero scores can be read from DataFrames
        - Zero scores are saved and loaded correctly
        - Works in both regular and async mode
        - User permissions are properly checked
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract session ID from the fixture
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        assert span1.trace.session is not None, "Session is required for this test"
        session_id1 = span1.trace.session.session_id

        # Set up test environment with logged-in user
        api_key = _app.admin_secret

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score in DataFrame
        # ============================================================================
        # Test that zero scores work correctly when provided via DataFrame
        import pandas as pd

        zero_score_annotation_name = token_hex(8)

        df = pd.DataFrame(
            {
                "name": [zero_score_annotation_name],
                "session_id": [session_id1],
                "annotator_kind": ["CODE"],
                "score": [0],  # Test zero score
                # Omit label and explanation to test None handling
            }
        )

        result = await _await_or_return(
            Client(
                base_url=_app.base_url, api_key=api_key
            ).sessions.log_session_annotations_dataframe(dataframe=df, sync=sync),
        )

        if sync:
            assert result

        # Verify the annotation was created correctly
        assert span1.trace.session is not None, "Session is required for this test"
        session_gid1 = span1.trace.session.id

        def get_zero_score_df_annotation() -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                variables={"id": str(session_gid1)},
            )
            annotations = {anno["name"]: anno for anno in res["data"]["node"]["sessionAnnotations"]}
            return annotations.get(zero_score_annotation_name)

        anno = await _get(
            query_fn=get_zero_score_df_annotation,
            error_msg="Zero score DataFrame annotation should be present in session annotations",
            no_wait=sync,
        )

        # Verify the annotation exists and has score of 0
        assert anno["score"] == 0, "DataFrame annotation score should be exactly 0"
        assert anno["label"] is None, "DataFrame annotation label should be None"
        assert anno["explanation"] is None, "DataFrame annotation explanation should be None"
        assert anno["source"] == "API", "DataFrame annotation source should be API"
        assert anno["annotatorKind"] == "CODE", "DataFrame annotation annotator_kind should be CODE"

    async def test_burst_session_annotations_with_unique_identifiers(
        self,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Tests sending multiple session annotations in a burst with unique identifiers.

        Sends the same annotation name with different identifiers in rapid succession.
        Annotations are deduplicated by (name, identifier) tuple rather than just by name.

        Verifies that:
        - Multiple annotations with the same name but different identifiers can be sent in a burst
        - All 5 unique annotations are properly inserted
        - Each annotation maintains its unique identifier and all field values
        - Duplicate batches are correctly deduplicated
        """
        # Setup
        assert _existing_spans, "At least one existing span is required for this test"
        span1, *_ = _existing_spans
        assert span1.trace.session is not None, "Session is required for this test"
        session_gid1 = span1.trace.session.id
        session_id1 = span1.trace.session.session_id
        api_key = _app.admin_secret
        from phoenix.client import AsyncClient

        # Test Case: Burst Session Annotations
        annotation_name = token_hex(8)
        num_annotations = 5

        # Generate unique data for each annotation
        identifiers = [token_hex(8) for _ in range(num_annotations)]
        labels = [token_hex(8) for _ in range(num_annotations)]
        scores = [int.from_bytes(token_bytes(4), byteorder="big") for _ in range(num_annotations)]
        explanations = [token_hex(8) for _ in range(num_annotations)]
        metadata = [{token_hex(8): token_hex(8)} for _ in range(num_annotations)]

        # Create annotation data for burst sending
        session_annotations: list[v1.SessionAnnotationData] = [
            {
                "name": annotation_name,
                "session_id": session_id1,
                "annotator_kind": "CODE",
                "identifier": identifiers[i],
                "metadata": metadata[i],
                "result": {
                    "label": labels[i],
                    "score": scores[i],
                    "explanation": explanations[i],
                },
            }
            for i in range(num_annotations)
        ]

        # Send all annotations in a burst
        task = AsyncClient(
            base_url=_app.base_url, api_key=api_key
        ).sessions.log_session_annotations(
            session_annotations=session_annotations * 2,
            sync=False,
        )
        await gather(task, task)

        # Verify all annotations were created correctly by querying the GraphQL API
        def get_all_burst_annotations() -> Optional[dict[str, dict[str, Any]]]:
            res, _ = _gql(
                _app,
                api_key,
                query=self.query,
                operation_name="GetSessionAnnotations",
                variables={"id": str(session_gid1)},
            )
            # Filter to only our test annotations (by name)
            test_annotations = [
                anno
                for anno in res["data"]["node"]["sessionAnnotations"]
                if anno["name"] == annotation_name
            ]
            # Check if we have all expected annotations
            if len(test_annotations) == num_annotations:
                # Return indexed by identifier for easy lookup
                return {anno["identifier"]: anno for anno in test_annotations}
            return None

        annotations_by_identifier = await _get(
            query_fn=get_all_burst_annotations,
            error_msg=f"All {num_annotations} burst session annotations should be present",
        )

        # Verify each annotation exists with correct values
        for i in range(num_annotations):
            assert identifiers[i] in annotations_by_identifier, (
                f"Session annotation with identifier {identifiers[i]} should be present"
            )
            anno = annotations_by_identifier[identifiers[i]]
            assert anno["name"] == annotation_name, (
                f"Session annotation {i} name should match input"
            )
            assert anno["source"] == "API", f"Session annotation {i} source should be API"
            assert anno["annotatorKind"] == "CODE", (
                f"Session annotation {i} annotator_kind should be CODE"
            )
            assert anno["metadata"] == metadata[i], (
                f"Session annotation {i} metadata should match input"
            )
            assert anno["label"] == labels[i], f"Session annotation {i} label should match input"
            assert anno["score"] == scores[i], f"Session annotation {i} score should match input"
            assert anno["explanation"] == explanations[i], (
                f"Session annotation {i} explanation should match input"
            )


class TestSendingAnnotationsBeforeSpan:
    """Tests sending annotations before spans exist.

    *CAVEAT* This is a single consolidated because we want to reduce flakiness and
    total wait time for server operations that are asynchronous.

    Verifies that:
    - Annotations can be sent before spans are created
    - Annotations are properly linked to spans after creation
    - Multiple annotations per span are handled correctly
    - Many evaluations can be processed at once
    - Data remains consistent
    - Span, trace, and session annotations work correctly
    - Existing annotations can be updated (UPSERT)
    """

    # GraphQL queries for retrieving annotations and evaluations
    query = """
        query GetSpanAnnotations($id: ID!) {
            node (id: $id) {
                ... on Span {
                    spanAnnotations {
                        id
                        name
                        source
                        identifier
                        annotatorKind
                        metadata
                        label
                        score
                        explanation
                    }
                }
            }
        }

        query GetTraceAnnotations($id: ID!) {
            node (id: $id) {
                ... on Trace {
                    traceAnnotations {
                        id
                        name
                        source
                        identifier
                        annotatorKind
                        metadata
                        label
                        score
                        explanation
                    }
                }
            }
        }

        query GetSessionAnnotations($id: ID!) {
            node (id: $id) {
                ... on ProjectSession {
                    sessionAnnotations {
                        id
                        name
                        source
                        identifier
                        annotatorKind
                        metadata
                        label
                        score
                        explanation
                    }
                }
            }
        }

        query GetDocumentAnnotations($id: ID!) {
            node (id: $id) {
                ... on Span {
                    documentEvaluations {
                        id
                        name
                        source
                        identifier
                        annotatorKind
                        metadata
                        label
                        score
                        explanation
                        documentPosition
                    }
                }
            }
        }

        query GetSpanTraceGlobalID($traceId: ID!) {
            projects(first: 1000) {
                edges {
                    node {
                        trace(traceId: $traceId) {
                            id
                            traceId
                            session {
                                id
                            }
                            spans {
                                edges {
                                    node {
                                        id
                                        spanId
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    """

    @pytest.fixture
    def _span(self) -> ReadableSpan:
        """Creates test span with document retrieval attributes."""
        memory = InMemorySpanExporter()
        attributes = {
            "session.id": token_hex(8),
            "retrieval.documents.0.document.id": token_hex(8),
            "retrieval.documents.1.document.id": token_hex(8),
            "retrieval.documents.2.document.id": token_hex(8),
        }
        _start_span(project_name=token_hex(8), attributes=attributes, exporter=memory).end()
        assert (spans := memory.get_finished_spans())
        return spans[0]

    def _get_span_trace_gid(
        self,
        app: _AppInfo,
        auth: _SecurityArtifact,
        *,
        span_id: str,
        trace_id: str,
    ) -> Optional[_SpanTraceGlobalID]:
        """Gets global ID for span_id and trace_id."""
        res, _ = _gql(
            app,
            auth,
            query=self.query,
            variables={"traceId": trace_id},
            operation_name="GetSpanTraceGlobalID",
        )
        for project in res["data"]["projects"]["edges"]:
            if (trace := project["node"]["trace"]) and trace["traceId"] == trace_id:
                for edge in trace["spans"]["edges"]:
                    if edge["node"]["spanId"] == span_id:
                        return _SpanTraceGlobalID(
                            span_gid=cast(str, edge["node"]["id"]),
                            trace_gid=cast(str, trace["id"]),
                            session_gid=cast(str, trace["session"]["id"]),
                        )
        return None

    @pytest.mark.filterwarnings("ignore:.*:DeprecationWarning")
    async def test_annotations_and_evaluations(
        self,
        _span: ReadableSpan,
        _app: _AppInfo,
    ) -> None:
        """Tests sending annotations and evaluations before spans exist.

        Verifies that:
        - Span and trace annotations can be sent before spans exist
        - Evaluations can be sent before spans exist
        - Data is properly linked to spans after creation
        - Multiple annotations per span are handled
        - Many evaluations can be processed at once
        - Data remains consistent
        - Existing annotations can be updated (UPSERT)
        """
        # Get IDs from the span
        assert (span_context := _span.get_span_context())  # type: ignore[no-untyped-call]
        span_id = format_span_id(span_context.span_id)
        trace_id = format_trace_id(span_context.trace_id)
        assert (
            self._get_span_trace_gid(_app, _app.admin_secret, span_id=span_id, trace_id=trace_id)
            is None
        )
        assert (session_id := str((_span.attributes or {})["session.id"]))

        # Set up the client
        api_key = str(_app.admin_secret)
        from phoenix.client import Client

        client = Client(base_url=_app.base_url, api_key=api_key)

        # Make test data
        span_annotation_name = token_hex(8)
        trace_annotation_name = token_hex(8)
        session_annotation_name = token_hex(8)
        document_annotation_name = token_hex(8)
        span_eval_name = token_hex(8)
        trace_eval_name = token_hex(8)
        doc_eval_name = token_hex(8)
        span_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        trace_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        session_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        document_annotator_kind: Any = choice(_ANNOTATOR_KINDS)

        # Set up initial test data
        span_anno_scores: list[int] = []
        span_anno_labels: list[str] = []
        span_anno_explanations: list[str] = []
        span_anno_metadatas: list[dict[str, Any]] = []

        trace_anno_scores: list[int] = []
        trace_anno_labels: list[str] = []
        trace_anno_explanations: list[str] = []
        trace_anno_metadatas: list[dict[str, Any]] = []

        session_anno_scores: list[int] = []
        session_anno_labels: list[str] = []
        session_anno_explanations: list[str] = []
        session_anno_metadatas: list[dict[str, Any]] = []

        document_anno_scores: list[int] = []
        document_anno_labels: list[str] = []
        document_anno_explanations: list[str] = []
        document_anno_metadatas: list[dict[str, Any]] = []

        span_eval_scores: list[int] = []
        span_eval_labels: list[str] = []
        span_eval_explanations: list[str] = []

        trace_eval_scores: list[int] = []
        trace_eval_labels: list[str] = []
        trace_eval_explanations: list[str] = []

        doc_eval_scores: list[int] = []
        doc_eval_labels: list[str] = []
        doc_eval_explanations: list[str] = []

        # Run multiple test rounds
        num_iterations = 2
        assert num_iterations >= 2
        document_position = 1

        for _ in range(num_iterations):
            # Make new test data for this round
            span_anno_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            span_anno_labels.append(token_hex(8))
            span_anno_explanations.append(token_hex(8))
            span_anno_metadatas.append({token_hex(8): token_hex(8)})

            trace_anno_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            trace_anno_labels.append(token_hex(8))
            trace_anno_explanations.append(token_hex(8))
            trace_anno_metadatas.append({token_hex(8): token_hex(8)})

            session_anno_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            session_anno_labels.append(token_hex(8))
            session_anno_explanations.append(token_hex(8))
            session_anno_metadatas.append({token_hex(8): token_hex(8)})

            document_anno_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            document_anno_labels.append(token_hex(8))
            document_anno_explanations.append(token_hex(8))
            document_anno_metadatas.append({token_hex(8): token_hex(8)})

            span_eval_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            span_eval_labels.append(token_hex(8))
            span_eval_explanations.append(token_hex(8))

            trace_eval_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            trace_eval_labels.append(token_hex(8))
            trace_eval_explanations.append(token_hex(8))

            doc_eval_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            doc_eval_labels.append(token_hex(8))
            doc_eval_explanations.append(token_hex(8))

            # Add annotations and evaluations
            client.spans.add_span_annotation(
                annotation_name=span_annotation_name,
                span_id=span_id,
                annotator_kind=span_annotator_kind,
                label=span_anno_labels[-1],
                score=span_anno_scores[-1],
                explanation=span_anno_explanations[-1],
                metadata=span_anno_metadatas[-1],
                sync=False,
            )

            client.traces.add_trace_annotation(
                annotation_name=trace_annotation_name,
                trace_id=trace_id,
                annotator_kind=trace_annotator_kind,
                label=trace_anno_labels[-1],
                score=trace_anno_scores[-1],
                explanation=trace_anno_explanations[-1],
                metadata=trace_anno_metadatas[-1],
                sync=False,
            )

            client.sessions.add_session_annotation(
                annotation_name=session_annotation_name,
                session_id=session_id,
                annotator_kind=session_annotator_kind,
                label=session_anno_labels[-1],
                score=session_anno_scores[-1],
                explanation=session_anno_explanations[-1],
                metadata=session_anno_metadatas[-1],
                sync=False,
            )

            client.spans.add_document_annotation(
                annotation_name=document_annotation_name,
                span_id=span_id,
                document_position=document_position,
                annotator_kind=document_annotator_kind,
                label=document_anno_labels[-1],
                score=document_anno_scores[-1],
                explanation=document_anno_explanations[-1],
                metadata=document_anno_metadatas[-1],
                sync=False,
            )

            px.Client(endpoint=_app.base_url, api_key=api_key).log_evaluations(
                SpanEvaluations(
                    eval_name=span_eval_name,
                    dataframe=pd.DataFrame(
                        {
                            "span_id": [span_id],
                            "label": [span_eval_labels[-1]],
                            "score": [span_eval_scores[-1]],
                            "explanation": [span_eval_explanations[-1]],
                        }
                    ),
                ),
                TraceEvaluations(
                    eval_name=trace_eval_name,
                    dataframe=pd.DataFrame(
                        {
                            "trace_id": [trace_id],
                            "label": [trace_eval_labels[-1]],
                            "score": [trace_eval_scores[-1]],
                            "explanation": [trace_eval_explanations[-1]],
                        }
                    ),
                ),
                DocumentEvaluations(
                    eval_name=doc_eval_name,
                    dataframe=pd.DataFrame(
                        {
                            "span_id": [span_id],
                            "document_position": [document_position],
                            "label": [doc_eval_labels[-1]],
                            "score": [doc_eval_scores[-1]],
                            "explanation": [doc_eval_explanations[-1]],
                        }
                    ),
                ),
            )
            # Use a significant sleep duration to verify that annotations sent before
            # span ingestion are properly processed in chronological order
            await sleep(0.5)

        # Send the span and wait
        headers = {"authorization": f"Bearer {_app.admin_secret}"}
        assert (
            _grpc_span_exporter(_app, headers=headers).export([_span]) is SpanExportResult.SUCCESS
        )

        # Get the global IDs
        span_gid, trace_gid, session_gid = await _get(
            query_fn=lambda: self._get_span_trace_gid(
                _app, _app.admin_secret, span_id=span_id, trace_id=trace_id
            ),
            error_msg="Span and trace IDs should be present",
        )

        # Helper functions for querying annotations
        def get_span_anno(key: tuple[str, int, str]) -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                _app.admin_secret,
                query=self.query,
                variables={"id": str(span_gid)},
                operation_name="GetSpanAnnotations",
            )
            annos = {
                (result["label"], result["score"], result["explanation"]): result
                for result in res["data"]["node"]["spanAnnotations"]
            }
            return annos.get(key)

        def get_trace_anno(key: tuple[str, int, str]) -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                _app.admin_secret,
                query=self.query,
                variables={"id": str(trace_gid)},
                operation_name="GetTraceAnnotations",
            )
            annos = {
                (result["label"], result["score"], result["explanation"]): result
                for result in res["data"]["node"]["traceAnnotations"]
            }
            return annos.get(key)

        def get_session_anno(key: tuple[str, int, str]) -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                _app.admin_secret,
                query=self.query,
                variables={"id": str(session_gid)},
                operation_name="GetSessionAnnotations",
            )
            annos = {
                (result["label"], result["score"], result["explanation"]): result
                for result in res["data"]["node"]["sessionAnnotations"]
            }
            return annos.get(key)

        def get_document_anno(key: tuple[str, int, str]) -> Optional[dict[str, Any]]:
            res, _ = _gql(
                _app,
                _app.admin_secret,
                query=self.query,
                variables={"id": str(span_gid)},
                operation_name="GetDocumentAnnotations",
            )
            annos = {
                (result["label"], result["score"], result["explanation"]): result
                for result in res["data"]["node"]["documentEvaluations"]
            }
            return annos.get(key)

        # Check the initial annotations
        span_anno_label = span_anno_labels[-1]
        span_anno_score = span_anno_scores[-1]
        span_anno_explanation = span_anno_explanations[-1]

        anno = await _get(
            query_fn=get_span_anno,
            args=((span_anno_label, span_anno_score, span_anno_explanation),),
            error_msg="Span annotation should be present",
        )
        assert anno["name"] == span_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == span_annotator_kind
        assert anno["metadata"] == span_anno_metadatas[-1]

        # Retain the gid for the UPSERT test
        span_anno_gid = anno["id"]

        # Check the span evaluations
        span_eval_label = span_eval_labels[-1]
        span_eval_score = span_eval_scores[-1]
        span_eval_explanation = span_eval_explanations[-1]

        anno = await _get(
            query_fn=get_span_anno,
            args=((span_eval_label, span_eval_score, span_eval_explanation),),
            error_msg="Span evaluation should be present",
        )
        assert anno["name"] == span_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"  # Evaluation annotator kind is always "LLM"

        # Retain the gid for the UPSERT test
        span_eval_gid = anno["id"]

        # Check the trace annotations
        trace_anno_label = trace_anno_labels[-1]
        trace_anno_score = trace_anno_scores[-1]
        trace_anno_explanation = trace_anno_explanations[-1]

        anno = await _get(
            query_fn=get_trace_anno,
            args=((trace_anno_label, trace_anno_score, trace_anno_explanation),),
            error_msg="Trace annotation should be present",
        )
        assert anno["name"] == trace_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == trace_annotator_kind
        assert anno["metadata"] == trace_anno_metadatas[-1]

        # Retain the gid for the UPSERT test
        trace_anno_gid = anno["id"]

        # Check the session annotations
        session_anno_label = session_anno_labels[-1]
        session_anno_score = session_anno_scores[-1]
        session_anno_explanation = session_anno_explanations[-1]

        anno = await _get(
            query_fn=get_session_anno,
            args=((session_anno_label, session_anno_score, session_anno_explanation),),
            error_msg="Session annotation should be present",
        )
        assert anno["name"] == session_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == session_annotator_kind
        assert anno["metadata"] == session_anno_metadatas[-1]

        # Retain the gid for the UPSERT test
        session_anno_gid = anno["id"]

        # Check the trace evaluations
        trace_eval_label = trace_eval_labels[-1]
        trace_eval_score = trace_eval_scores[-1]
        trace_eval_explanation = trace_eval_explanations[-1]

        anno = await _get(
            query_fn=get_trace_anno,
            args=((trace_eval_label, trace_eval_score, trace_eval_explanation),),
            error_msg="Trace evaluation should be present",
        )
        assert anno["name"] == trace_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"  # Evaluation annotator kind is always "LLM"

        # Retain the gid for the UPSERT test
        trace_eval_gid = anno["id"]

        # Check the document evaluations
        doc_eval_label = doc_eval_labels[-1]
        doc_eval_score = doc_eval_scores[-1]
        doc_eval_explanation = doc_eval_explanations[-1]

        anno = await _get(
            query_fn=get_document_anno,
            args=((doc_eval_label, doc_eval_score, doc_eval_explanation),),
            error_msg="Document evaluation should be present",
        )
        assert anno["name"] == doc_eval_name
        assert anno["documentPosition"] == document_position

        # Check the document annotations
        document_anno_label = document_anno_labels[-1]
        document_anno_score = document_anno_scores[-1]
        document_anno_explanation = document_anno_explanations[-1]

        anno = await _get(
            query_fn=get_document_anno,
            args=((document_anno_label, document_anno_score, document_anno_explanation),),
            error_msg="Document annotation should be present",
        )
        assert anno["name"] == document_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == document_annotator_kind
        assert anno["metadata"] == document_anno_metadatas[-1]
        assert anno["documentPosition"] == document_position

        # Retain the gid for the UPSERT test
        document_anno_gid = anno["id"]

        # Test UPSERT by updating existing annotations
        # Make new test data for updates
        new_span_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        new_span_anno_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_span_anno_label = token_hex(8)
        new_span_anno_explanation = token_hex(8)
        new_span_anno_metadata = {token_hex(8): token_hex(8)}

        new_trace_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        new_trace_anno_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_trace_anno_label = token_hex(8)
        new_trace_anno_explanation = token_hex(8)
        new_trace_anno_metadata = {token_hex(8): token_hex(8)}

        new_session_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        new_session_anno_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_session_anno_label = token_hex(8)
        new_session_anno_explanation = token_hex(8)
        new_session_anno_metadata = {token_hex(8): token_hex(8)}

        new_document_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        new_document_anno_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_document_anno_label = token_hex(8)
        new_document_anno_explanation = token_hex(8)
        new_document_anno_metadata = {token_hex(8): token_hex(8)}

        new_span_eval_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_span_eval_label = token_hex(8)
        new_span_eval_explanation = token_hex(8)

        new_trace_eval_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_trace_eval_label = token_hex(8)
        new_trace_eval_explanation = token_hex(8)

        new_doc_eval_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_doc_eval_label = token_hex(8)
        new_doc_eval_explanation = token_hex(8)

        # Update annotations and evaluations
        client.spans.add_span_annotation(
            annotation_name=span_annotation_name,
            span_id=span_id,
            annotator_kind=new_span_annotator_kind,
            label=new_span_anno_label,
            score=new_span_anno_score,
            explanation=new_span_anno_explanation,
            metadata=new_span_anno_metadata,
            sync=False,
        )

        client.traces.add_trace_annotation(
            annotation_name=trace_annotation_name,
            trace_id=trace_id,
            annotator_kind=new_trace_annotator_kind,
            label=new_trace_anno_label,
            score=new_trace_anno_score,
            explanation=new_trace_anno_explanation,
            metadata=new_trace_anno_metadata,
            sync=False,
        )

        client.sessions.add_session_annotation(
            annotation_name=session_annotation_name,
            session_id=session_id,
            annotator_kind=new_session_annotator_kind,
            label=new_session_anno_label,
            score=new_session_anno_score,
            explanation=new_session_anno_explanation,
            metadata=new_session_anno_metadata,
            sync=False,
        )

        client.spans.add_document_annotation(
            annotation_name=document_annotation_name,
            span_id=span_id,
            document_position=document_position,
            annotator_kind=new_document_annotator_kind,
            label=new_document_anno_label,
            score=new_document_anno_score,
            explanation=new_document_anno_explanation,
            metadata=new_document_anno_metadata,
            sync=False,
        )

        px.Client(endpoint=_app.base_url, api_key=api_key).log_evaluations(
            SpanEvaluations(
                eval_name=span_eval_name,
                dataframe=pd.DataFrame(
                    {
                        "span_id": [span_id],
                        "label": [new_span_eval_label],
                        "score": [new_span_eval_score],
                        "explanation": [new_span_eval_explanation],
                    }
                ),
            ),
            TraceEvaluations(
                eval_name=trace_eval_name,
                dataframe=pd.DataFrame(
                    {
                        "trace_id": [trace_id],
                        "label": [new_trace_eval_label],
                        "score": [new_trace_eval_score],
                        "explanation": [new_trace_eval_explanation],
                    }
                ),
            ),
            DocumentEvaluations(
                eval_name=doc_eval_name,
                dataframe=pd.DataFrame(
                    {
                        "span_id": [span_id],
                        "document_position": [document_position],
                        "label": [new_doc_eval_label],
                        "score": [new_doc_eval_score],
                        "explanation": [new_doc_eval_explanation],
                    }
                ),
            ),
        )

        # Check updated annotations
        anno = await _get(
            query_fn=get_span_anno,
            args=((new_span_anno_label, new_span_anno_score, new_span_anno_explanation),),
            error_msg="Updated span annotation should be present",
        )
        assert anno["name"] == span_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == new_span_annotator_kind
        assert anno["metadata"] == new_span_anno_metadata
        assert anno["id"] == span_anno_gid

        # Old version should no longer exist
        assert get_span_anno((span_anno_label, span_anno_score, span_anno_explanation)) is None

        # Check updated span evaluations
        anno = await _get(
            query_fn=get_span_anno,
            args=((new_span_eval_label, new_span_eval_score, new_span_eval_explanation),),
            error_msg="Updated span evaluation should be present",
        )
        assert anno["name"] == span_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"  # Evaluation annotator kind is always "LLM"
        assert anno["id"] == span_eval_gid

        # Old version should no longer exist
        assert get_span_anno((span_eval_label, span_eval_score, span_eval_explanation)) is None

        # Check updated trace annotations
        anno = await _get(
            query_fn=get_trace_anno,
            args=((new_trace_anno_label, new_trace_anno_score, new_trace_anno_explanation),),
            error_msg="Updated trace annotation should be present",
        )
        assert anno["name"] == trace_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == new_trace_annotator_kind
        assert anno["metadata"] == new_trace_anno_metadata
        assert anno["id"] == trace_anno_gid

        # Old version should no longer exist
        assert get_trace_anno((trace_anno_label, trace_anno_score, trace_anno_explanation)) is None

        # Check updated session annotations
        anno = await _get(
            query_fn=get_session_anno,
            args=((new_session_anno_label, new_session_anno_score, new_session_anno_explanation),),
            error_msg="Updated session annotation should be present",
        )
        assert anno["name"] == session_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == new_session_annotator_kind
        assert anno["metadata"] == new_session_anno_metadata
        assert anno["id"] == session_anno_gid

        # Old version should no longer exist
        assert (
            get_session_anno((session_anno_label, session_anno_score, session_anno_explanation))
            is None
        )

        # Check updated document annotations
        anno = await _get(
            query_fn=get_document_anno,
            args=(
                (new_document_anno_label, new_document_anno_score, new_document_anno_explanation),
            ),
            error_msg="Updated document annotation should be present",
        )
        assert anno["name"] == document_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == new_document_annotator_kind
        assert anno["metadata"] == new_document_anno_metadata
        assert anno["documentPosition"] == document_position
        assert anno["id"] == document_anno_gid

        # Old version should no longer exist
        assert (
            get_document_anno((document_anno_label, document_anno_score, document_anno_explanation))
            is None
        )

        # Check updated trace evaluations
        anno = await _get(
            query_fn=get_trace_anno,
            args=((new_trace_eval_label, new_trace_eval_score, new_trace_eval_explanation),),
            error_msg="Updated trace evaluation should be present",
        )
        assert anno["name"] == trace_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"  # Evaluation annotator kind is always "LLM"
        assert anno["id"] == trace_eval_gid

        # Old version should no longer exist
        assert get_trace_anno((trace_eval_label, trace_eval_score, trace_eval_explanation)) is None

        # Check updated document evaluations
        anno = await _get(
            query_fn=get_document_anno,
            args=((new_doc_eval_label, new_doc_eval_score, new_doc_eval_explanation),),
            error_msg="Updated document evaluation should be present",
        )
        assert anno["name"] == doc_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"  # Evaluation annotator kind is always "LLM"
        assert anno["documentPosition"] == document_position

        # Old version should no longer exist
        assert get_document_anno((doc_eval_label, doc_eval_score, doc_eval_explanation)) is None


class _SpanTraceGlobalID(NamedTuple):
    """Helper class for storing span and trace global IDs."""

    span_gid: str
    trace_gid: str
    session_gid: str
