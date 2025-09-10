# pyright: reportPrivateUsage=false
from __future__ import annotations

from asyncio import sleep
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
from strawberry.relay import GlobalID
from typing_extensions import assert_never

import phoenix as px
from phoenix.client.__generated__ import v1
from phoenix.trace import DocumentEvaluations, SpanEvaluations, TraceEvaluations

from .._helpers import (
    _ADMIN,
    _MEMBER,
    _AppInfo,
    _await_or_return,
    _ExistingSpan,
    _get,
    _GetUser,
    _gql,
    _grpc_span_exporter,
    _RoleOrUser,
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
    @pytest.mark.parametrize(
        "role_or_user, api_key_kind",
        [
            (_MEMBER, "User"),
            (_ADMIN, "User"),
            (_ADMIN, "System"),
        ],
    )
    async def test_add_span_annotation(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        api_key_kind: Literal["User", "System"],
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
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

        # Set up test environment with logged-in user
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app, api_key_kind))

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
                    u,
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
            expected_user_id: str
            if api_key_kind == "User":
                expected_user_id = u.gid
            elif api_key_kind == "System":
                system_user_gid = str(GlobalID(type_name="User", node_id=str(1)))
                expected_user_id = system_user_gid
            else:
                assert_never(api_key_kind)

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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_span_annotations(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
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
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app))

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
                        u,
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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_span_annotations_dataframe(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
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
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app))

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
                    u,
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
                    u,
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
                    u,
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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_zero_score_annotation(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
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
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app))

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
                u,
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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_zero_score_annotation_dataframe(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
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
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app))

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
                u,
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
    @pytest.mark.parametrize(
        "role_or_user, api_key_kind",
        [
            (_MEMBER, "User"),
            (_ADMIN, "User"),
            (_ADMIN, "System"),
        ],
    )
    async def test_add_document_annotation(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        api_key_kind: Literal["User", "System"],
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test creating and updating single span document annotations.

        Verifies UPSERT behavior, user permissions, and field persistence.
        """
        # Setup
        assert _existing_spans, "At least one span required"
        span_gid1, span_id1, *_ = choice(_existing_spans)

        # Setup authenticated user
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app, api_key_kind))

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
                    u,
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
            expected_user_id: str
            if api_key_kind == "User":
                expected_user_id = u.gid
            elif api_key_kind == "System":
                system_user_gid = str(GlobalID(type_name="User", node_id=str(1)))
                expected_user_id = system_user_gid
            else:
                assert_never(api_key_kind)

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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_document_annotations(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test batch span document annotation operations.

        Verifies multi-document operations, UPSERT behavior, and consistency.
        """
        # Setup
        assert len(_existing_spans) >= 2, "Two spans required"
        (span_gid1, span_id1, *_), (span_gid2, span_id2, *_) = sample(_existing_spans, 2)

        # Setup authenticated user
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app))

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
                        u,
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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_document_annotations_dataframe(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test DataFrame span document annotations.

        Verifies column/index layouts and global parameters.
        """
        # Setup
        assert len(_existing_spans) >= 2, "Two spans required"
        (span_gid1, span_id1, *_), (span_gid2, span_id2, *_) = sample(_existing_spans, 2)

        # Setup authenticated user
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app))

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
                    u,
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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_zero_score_document_annotation(
        self,
        sync: bool,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test zero score handling in span document annotations."""
        # Setup
        assert _existing_spans, "At least one span required"
        span_gid1, span_id1, *_ = choice(_existing_spans)

        # Setup authenticated user
        u = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(u.create_api_key(_app))

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
                u,
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

        # Set up the client
        api_key = str(_app.admin_secret)
        from phoenix.client import Client

        client = Client(base_url=_app.base_url, api_key=api_key)

        # Make test data
        span_annotation_name = token_hex(8)
        document_annotation_name = token_hex(8)
        span_eval_name = token_hex(8)
        trace_eval_name = token_hex(8)
        doc_eval_name = token_hex(8)
        span_annotator_kind: Any = choice(_ANNOTATOR_KINDS)
        document_annotator_kind: Any = choice(_ANNOTATOR_KINDS)

        # Set up initial test data
        span_anno_scores: list[int] = []
        span_anno_labels: list[str] = []
        span_anno_explanations: list[str] = []
        span_anno_metadatas: list[dict[str, Any]] = []

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
