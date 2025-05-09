# pyright: reportPrivateUsage=false
from __future__ import annotations

from asyncio import sleep
from secrets import token_bytes, token_hex
from typing import Literal, Optional, cast

import pandas as pd
import phoenix as px
import pytest
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id, format_trace_id
from phoenix.client.__generated__ import v1
from phoenix.trace import DocumentEvaluations, SpanEvaluations, TraceEvaluations
from typing_extensions import TypeAlias

from .._helpers import (
    _ADMIN,
    _MEMBER,
    _AdminSecret,
    _await_or_return,
    _get_gql_spans,
    _GetUser,
    _gql,
    _grpc_span_exporter,
    _RoleOrUser,
    _SecurityArtifact,
    _start_span,
)

# Type aliases for better readability
SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str


class TestClientForSpanAnnotations:
    """Tests for the Phoenix span annotation client.

    Checks if the client can:
    - Create and update single annotations
    - Handle multiple annotations at once
    - Work with different user roles
    - Use DataFrames for annotations
    - Work in both regular and async mode
    - Handle special cases like zero scores
    """

    # GraphQL query to retrieve span annotations for a given span ID
    query = """
    query GetSpanAnnotations($id: GlobalID!) {
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
    """

    @pytest.mark.flaky(reruns=10)
    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_add_span_annotation(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        _wait_time: float,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Tests creating and updating single annotations.

        Checks if the client can:
        - Create new annotations with all fields
        - Update existing annotations
        - Keep the same ID when updating
        - Work in both regular and async mode
        - Check user permissions
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        (span_id1, span_gid1), _ = _span_ids

        # Set up test environment with logged-in user
        u = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

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
        annotation_name = token_hex(16)
        existing_gid: Optional[str] = None

        # First iteration: Create initial annotation
        for j in range(2):
            # Generate random test data for the annotation
            score = int.from_bytes(token_bytes(4), byteorder="big")
            label = token_hex(16)
            explanation = token_hex(16)
            metadata = {token_hex(16): token_hex(16)}
            # Create the span annotation
            result = await _await_or_return(
                Client().annotations.add_span_annotation(
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
            else:
                await sleep(_wait_time)

            # Verify the annotation was created correctly by querying the GraphQL API
            res, _ = _gql(
                u,
                query=self.query,
                operation_name="GetSpanAnnotations",
                variables={"id": span_gid1},
            )

            # Create a dictionary of annotations for easy lookup
            annotations = {
                (anno["label"], anno["score"], anno["explanation"]): anno
                for anno in res["data"]["node"]["spanAnnotations"]
            }

            # Verify the annotation exists with the correct fields
            key = (label, score, explanation)
            assert key in annotations, "Created annotation should be present in span annotations"  # noqa: E501

            # Get the annotation and verify all fields match what was provided
            anno = annotations[key]
            assert anno["name"] == annotation_name, "Annotation name should match input"  # noqa: E501
            assert anno["source"] == "API", "Annotation source should be API"  # noqa: E501
            assert anno["annotatorKind"] == "LLM", "Annotation annotator_kind should be LLM"  # noqa: E501
            assert anno["metadata"] == metadata, "Annotation metadata should match input"  # noqa: E501
            if j == 0:
                existing_gid = anno["id"]
            else:
                assert (
                    anno["id"] == existing_gid
                ), "Annotation ID should remain the same after update"  # noqa: E501

    @pytest.mark.flaky(reruns=10)
    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_span_annotations(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        _wait_time: float,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Tests handling multiple annotations at once.

        Checks if the client can:
        - Create many annotations in one call
        - Update many annotations at once
        - Work with annotations across different spans
        - Keep the same IDs when updating
        - Work in both regular and async mode
        - Check user permissions
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        (span_id1, span_gid1), (span_id2, span_gid2) = _span_ids

        # Set up test environment with logged-in user
        u = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

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
        annotation_names = [token_hex(16), token_hex(16)]
        identifiers = [token_hex(16), token_hex(16)]
        existing_gids: list[Optional[str]] = [None, None]

        # Two iterations: First creates annotations, second updates them
        for i in range(2):
            # Generate new random values for each iteration
            labels = [token_hex(16), token_hex(16)]
            scores = [
                int.from_bytes(token_bytes(4), byteorder="big"),
                int.from_bytes(token_bytes(4), byteorder="big"),
            ]
            explanations = [token_hex(16), token_hex(16)]
            metadata = [{token_hex(16): token_hex(16)} for _ in range(2)]

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
                Client().annotations.log_span_annotations(
                    span_annotations=span_annotations,
                    sync=sync,
                ),
            )

            if sync:
                # Verify the batch operation returned the expected number of results
                assert result
                assert (
                    len(result) == 2
                ), "Batch operation should return results for both annotations"  # noqa: E501
            else:
                await sleep(_wait_time)

            # Verify each annotation in the batch
            for j in range(2):
                res, _ = _gql(
                    u,
                    query=self.query,
                    operation_name="GetSpanAnnotations",
                    variables={"id": span_gids[j]},
                )

                # Create a dictionary of annotations for easy lookup
                annotations = {
                    (anno["label"], anno["score"], anno["explanation"]): anno
                    for anno in res["data"]["node"]["spanAnnotations"]
                }
                key = (labels[j], scores[j], explanations[j])

                # Verify the batch annotation exists
                assert (
                    key in annotations
                ), f"Batch annotation {j+1} should be present in span annotations"  # noqa: E501

                # Verify the batch annotation fields match what was provided
                anno = annotations[key]
                assert (
                    anno["name"] == annotation_names[j]
                ), f"Batch annotation {j+1} name should match input"  # noqa: E501
                assert anno["source"] == "API", f"Batch annotation {j+1} source should be API"  # noqa: E501
                assert (
                    anno["annotatorKind"] == "CODE"
                ), f"Batch annotation {j+1} annotator_kind should be CODE"  # noqa: E501
                assert (
                    anno["metadata"] == metadata[j]
                ), f"Batch annotation {j+1} metadata should match input"  # noqa: E501
                assert (
                    anno["identifier"] == identifiers[j]
                ), f"Batch annotation {j+1} identifier should match input"  # noqa: E501

                # Verify ID persistence across updates
                if i == 0:
                    existing_gids[j] = anno["id"]
                else:
                    assert (
                        anno["id"] == existing_gids[j]
                    ), f"Batch annotation {j+1} ID should remain the same after update"  # noqa: E501

    @pytest.mark.flaky(reruns=10)
    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_span_annotations_dataframe(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        _wait_time: float,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Tests using DataFrames for annotations.

        Tests three ways to use DataFrames:
        - With span_id as a column
        - With span_id as the index
        - With a shared annotator type

        Checks if the client can:
        - Read annotations from DataFrames
        - Handle different DataFrame layouts
        - Use shared settings correctly
        - Work in both regular and async mode
        - Check user permissions
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        (span_id1, span_gid1), (span_id2, span_gid2) = _span_ids

        # Set up test environment with logged-in user
        u = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case 1: Using span_id as column
        # ============================================================================
        # This test case demonstrates standard DataFrame usage with span_id as a column
        # All fields are provided as columns in the DataFrame, using OpenTelemetry span IDs
        df1_annotation_names = [token_hex(16), token_hex(16)]
        df1_span_ids = [span_id1, span_id2]  # OpenTelemetry span IDs
        df1_annotator_kinds = ["HUMAN", "LLM"]
        df1_labels = [token_hex(16), token_hex(16)]
        df1_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df1_explanations = [token_hex(16), token_hex(16)]
        df1_metadata = [{token_hex(16): token_hex(16)} for _ in range(2)]
        df1 = pd.DataFrame(
            {
                "name": df1_annotation_names,
                "span_id": df1_span_ids,  # OpenTelemetry span IDs
                "annotator_kind": df1_annotator_kinds,
                "label": df1_labels,
                "score": df1_scores,
                "explanation": df1_explanations,
                "metadata": df1_metadata,
            }
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df1,
                sync=sync,
            ),
        )

        if sync:
            assert result
        else:
            await sleep(_wait_time)

        # Verify annotations were created correctly
        for i, span_gid in enumerate([span_gid1, span_gid2]):
            res, _ = _gql(
                u,
                query=self.query,
                operation_name="GetSpanAnnotations",
                variables={"id": span_gid},
            )

            # Create a dictionary of annotations for easy lookup
            annotations = {
                (anno["label"], anno["score"], anno["explanation"]): anno
                for anno in res["data"]["node"]["spanAnnotations"]
            }

            # Verify annotation exists with correct values
            key = (df1_labels[i], df1_scores[i], df1_explanations[i])
            assert (
                key in annotations
            ), f"DataFrame annotation {i+1} should be present in span annotations"  # noqa: E501

            anno = annotations[key]
            assert (
                anno["name"] == df1_annotation_names[i]
            ), f"DataFrame annotation {i+1} name should match input"  # noqa: E501
            assert anno["source"] == "API", f"DataFrame annotation {i+1} source should be API"  # noqa: E501
            assert (
                anno["metadata"] == df1_metadata[i]
            ), f"DataFrame annotation {i+1} metadata should match input"  # noqa: E501
            assert (
                anno["annotatorKind"] == df1_annotator_kinds[i]
            ), f"DataFrame annotation {i+1} annotator_kind should match input"  # noqa: E501

        # ============================================================================
        # Test Case 2: Using span_id as index
        # ============================================================================
        # This test case demonstrates using span_id as the DataFrame index
        # This is an alternative way to specify OpenTelemetry span IDs without a dedicated column
        df2_annotation_names = [token_hex(16), token_hex(16)]
        df2_annotator_kinds = ["HUMAN", "LLM"]
        df2_labels = [token_hex(16), token_hex(16)]
        df2_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df2_explanations = [token_hex(16), token_hex(16)]
        df2_metadata = [{token_hex(16): token_hex(16)} for _ in range(2)]
        df2 = pd.DataFrame(
            {
                "name": df2_annotation_names,
                "annotator_kind": df2_annotator_kinds,
                "label": df2_labels,
                "score": df2_scores,
                "explanation": df2_explanations,
                "metadata": df2_metadata,
            },
            index=[span_id1, span_id2],  # OpenTelemetry span IDs as index
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df2,
                sync=sync,
            ),
        )

        if sync:
            assert result
        else:
            await sleep(_wait_time)

        # Verify annotations were created correctly
        for i, span_gid in enumerate([span_gid1, span_gid2]):
            res, _ = _gql(
                u,
                query=self.query,
                operation_name="GetSpanAnnotations",
                variables={"id": span_gid},
            )

            # Create a dictionary of annotations for easy lookup
            annotations = {
                (anno["label"], anno["score"], anno["explanation"]): anno
                for anno in res["data"]["node"]["spanAnnotations"]
            }

            # Verify annotation exists with correct values
            key = (df2_labels[i], df2_scores[i], df2_explanations[i])
            assert (
                key in annotations
            ), f"DataFrame annotation {i+1} should be present in span annotations"  # noqa: E501

            anno = annotations[key]
            assert (
                anno["name"] == df2_annotation_names[i]
            ), f"DataFrame annotation {i+1} name should match input"  # noqa: E501
            assert anno["source"] == "API", f"DataFrame annotation {i+1} source should be API"  # noqa: E501
            assert (
                anno["metadata"] == df2_metadata[i]
            ), f"DataFrame annotation {i+1} metadata should match input"  # noqa: E501
            assert (
                anno["annotatorKind"] == df2_annotator_kinds[i]
            ), f"DataFrame annotation {i+1} annotator_kind should match input"  # noqa: E501

        # ============================================================================
        # Test Case 3: Using global annotator_kind
        # ============================================================================
        # This test case demonstrates using a global annotator_kind parameter
        # The DataFrame does not include an annotator_kind column, and the value is
        # provided as a parameter to the API call. Uses OpenTelemetry span IDs.
        global_annotator_kind: Literal["HUMAN"] = "HUMAN"
        df3_annotation_names = [token_hex(16), token_hex(16)]
        df3_span_ids = [span_id1, span_id2]  # OpenTelemetry span IDs
        df3_labels = [token_hex(16), token_hex(16)]
        df3_scores = [
            int.from_bytes(token_bytes(4), byteorder="big"),
            int.from_bytes(token_bytes(4), byteorder="big"),
        ]
        df3_explanations = [token_hex(16), token_hex(16)]
        df3_metadata = [{token_hex(16): token_hex(16)} for _ in range(2)]
        df3 = pd.DataFrame(
            {
                "name": df3_annotation_names,
                "span_id": df3_span_ids,  # OpenTelemetry span IDs
                "label": df3_labels,
                "score": df3_scores,
                "explanation": df3_explanations,
                "metadata": df3_metadata,
            }
        )

        # Log annotations from DataFrame with global annotator_kind
        result = await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df3,
                annotator_kind=global_annotator_kind,
                sync=sync,
            ),
        )

        if sync:
            assert result
        else:
            await sleep(_wait_time)

        # Verify annotations were created correctly
        for i, span_gid in enumerate([span_gid1, span_gid2]):
            res, _ = _gql(
                u,
                query=self.query,
                operation_name="GetSpanAnnotations",
                variables={"id": span_gid},
            )

            # Create a dictionary of annotations for easy lookup
            annotations = {
                (anno["label"], anno["score"], anno["explanation"]): anno
                for anno in res["data"]["node"]["spanAnnotations"]
            }

            # Verify annotation exists with correct values
            key = (df3_labels[i], df3_scores[i], df3_explanations[i])
            assert (
                key in annotations
            ), f"DataFrame annotation {i+1} should be present in span annotations"  # noqa: E501

            anno = annotations[key]
            assert (
                anno["name"] == df3_annotation_names[i]
            ), f"DataFrame annotation {i+1} name should match input"  # noqa: E501
            assert anno["source"] == "API", f"DataFrame annotation {i+1} source should be API"  # noqa: E501
            assert (
                anno["metadata"] == df3_metadata[i]
            ), f"DataFrame annotation {i+1} metadata should match input"  # noqa: E501
            assert (
                anno["annotatorKind"] == global_annotator_kind
            ), f"DataFrame annotation {i+1} annotator_kind should match global value"  # noqa: E501

    @pytest.mark.flaky(reruns=10)
    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_zero_score_annotation(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        _wait_time: float,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Tests handling annotations with zero scores.

        Checks if the client can:
        - Save and load zero scores correctly
        - Handle missing optional fields
        - Work in both regular and async mode
        - Check user permissions
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        (span_id1, span_gid1), _ = _span_ids

        # Set up test environment with logged-in user
        u = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score
        # ============================================================================
        # Test that a score of 0 is properly recorded and not treated as falsey
        zero_score_annotation_name = token_hex(16)

        # Create annotation with score of 0
        result = await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=zero_score_annotation_name,
                span_id=span_id1,
                annotator_kind="LLM",
                score=0,  # Explicitly test score of 0
                sync=sync,
            ),
        )

        if sync:
            assert result
        else:
            await sleep(_wait_time)

        # Verify the annotation was created correctly by querying the GraphQL API
        res, _ = _gql(
            u,
            query=self.query,
            operation_name="GetSpanAnnotations",
            variables={"id": span_gid1},
        )

        # Create a dictionary of annotations for easy lookup
        annotations = {anno["name"]: anno for anno in res["data"]["node"]["spanAnnotations"]}

        # Verify the annotation exists and has score of 0
        assert (
            zero_score_annotation_name in annotations
        ), "Annotation with score of 0 should be present in span annotations"
        assert (
            annotations[zero_score_annotation_name]["score"] == 0
        ), "Annotation score should be exactly 0"
        assert (
            annotations[zero_score_annotation_name]["label"] is None
        ), "Annotation label should be None"
        assert (
            annotations[zero_score_annotation_name]["explanation"] is None
        ), "Annotation explanation should be None"

    @pytest.mark.flaky(reruns=10)
    @pytest.mark.parametrize("sync", [True, False])  # server ingestion path
    @pytest.mark.parametrize("is_async", [True, False])  # sync/async client
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_zero_score_annotation_dataframe(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        _wait_time: float,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Tests handling zero scores in DataFrames.

        Checks if the client can:
        - Read zero scores from DataFrames
        - Handle missing optional fields
        - Work in both regular and async mode
        - Check user permissions
        """
        # ============================================================================
        # Setup
        # ============================================================================
        # Extract OTEL span ID and graphql Global ID from the fixture
        (span_id1, span_gid1), _ = _span_ids

        # Set up test environment with logged-in user
        u = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        # Import appropriate client based on test parameter
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # ============================================================================
        # Test Case: Zero Score in DataFrame
        # ============================================================================
        # Test that a score of 0 is properly recorded and not treated as falsey
        zero_score_annotation_name = token_hex(16)

        # Create DataFrame with score of 0
        # The DataFrame uses OpenTelemetry span ID to identify the span
        df = pd.DataFrame(
            {
                "name": [zero_score_annotation_name],
                "span_id": [span_id1],  # OpenTelemetry span ID
                "annotator_kind": ["LLM"],
                "score": [0],  # Explicitly test score of 0
            }
        )

        # Log annotations from DataFrame
        result = await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df,
                sync=sync,
            ),
        )

        if sync:
            assert result
        else:
            await sleep(_wait_time)

        # Verify the annotation was created correctly by querying the GraphQL API
        res, _ = _gql(
            u,
            query=self.query,
            operation_name="GetSpanAnnotations",
            variables={"id": span_gid1},
        )

        # Create a dictionary of annotations for easy lookup
        annotations = {anno["name"]: anno for anno in res["data"]["node"]["spanAnnotations"]}

        # Verify the annotation exists and has score of 0
        assert (
            zero_score_annotation_name in annotations
        ), "DataFrame annotation with score of 0 should be present in span annotations"
        assert (
            annotations[zero_score_annotation_name]["score"] == 0
        ), "DataFrame annotation score should be exactly 0"
        assert (
            annotations[zero_score_annotation_name]["label"] is None
        ), "DataFrame annotation label should be None"
        assert (
            annotations[zero_score_annotation_name]["explanation"] is None
        ), "DataFrame annotation explanation should be None"


class TestSendingAnnotationsBeforeSpan:
    """Tests sending annotations before spans exist.

    This test is consolidated to reduce flakiness and total wait
    time for the asynchronous operations.

    Checks if the client can:
    - Send annotations before spans are created
    - Link annotations to spans after creation
    - Handle multiple annotations per span
    - Process many evaluations at once
    - Keep data consistent
    """

    # GraphQL queries for retrieving annotations and evaluations
    query = """
        # Query to retrieve span annotations for a given span's global ID
        query GetSpanAnnotations($id: GlobalID!) {
            node (id: $id) {
                ... on Span {
                    spanAnnotations {  # Contains both annotations and evaluations
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

        # Query to retrieve trace annotations for a given trace's global ID
        query GetTraceAnnotations($id: GlobalID!) {
            node (id: $id) {
                ... on Trace {
                    traceAnnotations {  # Contains both annotations and evaluations
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

        # Query to retrieve document evaluations for a given span's global ID
        query GetDocumentEvaluations($id: GlobalID!) {
            node (id: $id) {
                ... on Span {
                    documentEvaluations {  # Only contains evaluations
                        documentPosition
                        name
                        label
                        score
                        explanation
                    }
                }
            }
        }

        # Query to retrieve trace's global ID from its OpenTelemetry trace ID
        query GetTraceGlobalID($traceId: ID!) {
            projects {
                edges {
                    node {
                        trace(traceId: $traceId) {
                            id  # This is the global ID
                            traceId  # This is the OpenTelemetry trace ID
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
            "retrieval.documents.0.document.id": token_hex(16),
            "retrieval.documents.1.document.id": token_hex(16),
            "retrieval.documents.2.document.id": token_hex(16),
        }
        _start_span(project_name=token_hex(16), attributes=attributes, exporter=memory).end()
        assert (spans := memory.get_finished_spans())
        return spans[0]

    def _get_span_gid(
        self,
        auth: _SecurityArtifact,
        *,
        span_id: str,
    ) -> Optional[str]:
        """Gets global ID for span from span_id."""
        for spans in _get_gql_spans(auth, "id spanId").values():
            for span in spans:
                if span["spanId"] == span_id:
                    return cast(str, span["id"])
        return None

    def _get_trace_gid(
        self,
        auth: _SecurityArtifact,
        *,
        trace_id: str,
    ) -> Optional[str]:
        """Gets global ID for trace from trace_id."""
        res, _ = _gql(
            auth,
            query=self.query,
            variables={"traceId": trace_id},
            operation_name="GetTraceGlobalID",
        )
        for project in res["data"]["projects"]["edges"]:
            if (trace := project["node"]["trace"]) and trace["traceId"] == trace_id:
                return cast(str, trace["id"])
        return None

    @pytest.mark.flaky(reruns=10)
    async def test_annotations_and_evaluations(
        self,
        _span: ReadableSpan,
        _admin_secret: _AdminSecret,
        _wait_time: float,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Tests sending annotations and evaluations before spans exist.

        Checks if the client can:
        - Send annotations before spans are created
        - Send evaluations before spans are created
        - Link data to spans after creation
        - Handle multiple annotations per span
        - Process many evaluations at once
        - Keep data consistent
        - Update existing annotations (UPSERT)
        """
        # Get IDs from the span
        assert (span_context := _span.get_span_context())  # type: ignore[no-untyped-call]
        span_id = format_span_id(span_context.span_id)
        trace_id = format_trace_id(span_context.trace_id)
        assert self._get_span_gid(_admin_secret, span_id=span_id) is None
        assert self._get_trace_gid(_admin_secret, trace_id=trace_id) is None

        # Set up the client
        monkeypatch.setenv("PHOENIX_API_KEY", _admin_secret)
        from phoenix.client import Client

        client = Client()

        # Make test data
        span_annotation_name = token_hex(16)
        span_eval_name = token_hex(16)
        trace_eval_name = token_hex(16)
        doc_eval_name = token_hex(16)

        # Set up initial test data
        span_anno_scores = [int.from_bytes(token_bytes(4), byteorder="big")]
        span_anno_labels = [token_hex(16)]
        span_anno_explanations = [token_hex(16)]
        span_anno_metadatas = [{token_hex(16): token_hex(16)}]

        span_eval_scores = [int.from_bytes(token_bytes(4), byteorder="big")]
        span_eval_labels = [token_hex(16)]
        span_eval_explanations = [token_hex(16)]

        trace_eval_scores = [int.from_bytes(token_bytes(4), byteorder="big")]
        trace_eval_labels = [token_hex(16)]
        trace_eval_explanations = [token_hex(16)]

        doc_eval_scores = [int.from_bytes(token_bytes(4), byteorder="big")]
        doc_eval_labels = [token_hex(16)]
        doc_eval_explanations = [token_hex(16)]

        # Run multiple test rounds
        num_iterations = 2
        assert num_iterations >= 2
        document_position = 1

        for _ in range(num_iterations):
            # Make new test data for this round
            span_anno_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            span_anno_labels.append(token_hex(16))
            span_anno_explanations.append(token_hex(16))
            span_anno_metadatas.append({token_hex(16): token_hex(16)})

            span_eval_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            span_eval_labels.append(token_hex(16))
            span_eval_explanations.append(token_hex(16))

            trace_eval_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            trace_eval_labels.append(token_hex(16))
            trace_eval_explanations.append(token_hex(16))

            doc_eval_scores.append(int.from_bytes(token_bytes(4), byteorder="big"))
            doc_eval_labels.append(token_hex(16))
            doc_eval_explanations.append(token_hex(16))

            # Add annotations and evaluations
            client.annotations.add_span_annotation(
                annotation_name=span_annotation_name,
                span_id=span_id,
                annotator_kind="LLM",
                label=span_anno_labels[-1],
                score=span_anno_scores[-1],
                explanation=span_anno_explanations[-1],
                metadata=span_anno_metadatas[-1],
            )

            px.Client().log_evaluations(
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
            await sleep(0.01)

        # Send the span and wait
        assert _grpc_span_exporter().export([_span]) is SpanExportResult.SUCCESS

        # Wait for the data to be processed
        await sleep(_wait_time)

        # Get the global IDs
        assert (span_gid := self._get_span_gid(_admin_secret, span_id=span_id))
        assert (trace_gid := self._get_trace_gid(_admin_secret, trace_id=trace_id))

        # Check the annotations
        span_res, _ = _gql(
            _admin_secret,
            query=self.query,
            variables={"id": span_gid},
            operation_name="GetSpanAnnotations",
        )
        span_annotations = {
            (result["label"], result["score"], result["explanation"]): result
            for result in span_res["data"]["node"]["spanAnnotations"]
        }
        span_anno_key = (span_anno_labels[-1], span_anno_scores[-1], span_anno_explanations[-1])
        assert span_anno_key in span_annotations
        anno = span_annotations[span_anno_key]
        assert anno["name"] == span_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"
        assert anno["metadata"] == span_anno_metadatas[-1]

        # Check the span evaluations
        span_ev_key = (span_eval_labels[-1], span_eval_scores[-1], span_eval_explanations[-1])
        assert span_ev_key in span_annotations
        anno = span_annotations[span_ev_key]
        assert anno["name"] == span_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"

        # Check the trace evaluations
        trace_res, _ = _gql(
            _admin_secret,
            query=self.query,
            variables={"id": trace_gid},
            operation_name="GetTraceAnnotations",
        )
        trace_annotations = {
            (result["label"], result["score"], result["explanation"]): result
            for result in trace_res["data"]["node"]["traceAnnotations"]
        }
        trace_eval_key = (trace_eval_labels[-1], trace_eval_scores[-1], trace_eval_explanations[-1])
        assert trace_eval_key in trace_annotations
        anno = trace_annotations[trace_eval_key]
        assert anno["name"] == trace_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"

        # Check the document evaluations
        doc_res, _ = _gql(
            _admin_secret,
            query=self.query,
            variables={"id": span_gid},
            operation_name="GetDocumentEvaluations",
        )
        doc_annotations = {
            (result["label"], result["score"], result["explanation"]): result
            for result in doc_res["data"]["node"]["documentEvaluations"]
        }
        doc_eval_key = (doc_eval_labels[-1], doc_eval_scores[-1], doc_eval_explanations[-1])
        assert doc_eval_key in doc_annotations
        anno = doc_annotations[doc_eval_key]
        assert anno["name"] == doc_eval_name
        assert anno["documentPosition"] == document_position

        # Test UPSERT by updating existing annotations
        # Make new test data for updates
        new_span_anno_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_span_anno_label = token_hex(16)
        new_span_anno_explanation = token_hex(16)
        new_span_anno_metadata = {token_hex(16): token_hex(16)}

        new_span_eval_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_span_eval_label = token_hex(16)
        new_span_eval_explanation = token_hex(16)

        new_trace_eval_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_trace_eval_label = token_hex(16)
        new_trace_eval_explanation = token_hex(16)

        new_doc_eval_score = int.from_bytes(token_bytes(4), byteorder="big")
        new_doc_eval_label = token_hex(16)
        new_doc_eval_explanation = token_hex(16)

        # Update annotations and evaluations
        client.annotations.add_span_annotation(
            annotation_name=span_annotation_name,
            span_id=span_id,
            annotator_kind="LLM",
            label=new_span_anno_label,
            score=new_span_anno_score,
            explanation=new_span_anno_explanation,
            metadata=new_span_anno_metadata,
        )

        px.Client().log_evaluations(
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

        # Wait for updates to be processed
        await sleep(_wait_time)

        # Check updated annotations
        span_res, _ = _gql(
            _admin_secret,
            query=self.query,
            variables={"id": span_gid},
            operation_name="GetSpanAnnotations",
        )
        span_annotations = {
            (result["label"], result["score"], result["explanation"]): result
            for result in span_res["data"]["node"]["spanAnnotations"]
        }
        new_span_anno_key = (new_span_anno_label, new_span_anno_score, new_span_anno_explanation)
        assert new_span_anno_key in span_annotations
        anno = span_annotations[new_span_anno_key]
        assert anno["name"] == span_annotation_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"
        assert anno["metadata"] == new_span_anno_metadata

        # Check updated span evaluations
        new_span_ev_key = (new_span_eval_label, new_span_eval_score, new_span_eval_explanation)
        assert new_span_ev_key in span_annotations
        anno = span_annotations[new_span_ev_key]
        assert anno["name"] == span_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"

        # Check updated trace evaluations
        trace_res, _ = _gql(
            _admin_secret,
            query=self.query,
            variables={"id": trace_gid},
            operation_name="GetTraceAnnotations",
        )
        trace_annotations = {
            (result["label"], result["score"], result["explanation"]): result
            for result in trace_res["data"]["node"]["traceAnnotations"]
        }
        new_trace_eval_key = (
            new_trace_eval_label,
            new_trace_eval_score,
            new_trace_eval_explanation,
        )
        assert new_trace_eval_key in trace_annotations
        anno = trace_annotations[new_trace_eval_key]
        assert anno["name"] == trace_eval_name
        assert anno["source"] == "API"
        assert anno["annotatorKind"] == "LLM"

        # Check updated document evaluations
        doc_res, _ = _gql(
            _admin_secret,
            query=self.query,
            variables={"id": span_gid},
            operation_name="GetDocumentEvaluations",
        )
        doc_annotations = {
            (result["label"], result["score"], result["explanation"]): result
            for result in doc_res["data"]["node"]["documentEvaluations"]
        }
        new_doc_eval_key = (new_doc_eval_label, new_doc_eval_score, new_doc_eval_explanation)
        assert new_doc_eval_key in doc_annotations
        anno = doc_annotations[new_doc_eval_key]
        assert anno["name"] == doc_eval_name
        assert anno["documentPosition"] == document_position
