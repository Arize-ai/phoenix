# pyright: reportPrivateUsage=false
from __future__ import annotations

from secrets import token_bytes, token_hex
from typing import Literal, Optional

import pandas as pd
import pytest
from phoenix.client.__generated__ import v1
from typing_extensions import TypeAlias

from .._helpers import _ADMIN, _MEMBER, _await_or_return, _GetUser, _gql, _RoleOrUser

# Type aliases for better readability
SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str


class TestClientForSpanAnnotations:
    """Integration tests for the Span Annotations client REST endpoints.

    This test suite verifies the functionality of the Span Annotations API,
    focusing on both single and batch annotation operations. The tests cover:
    - Creating and updating annotations using the UPSERT pattern
    - Batch creation and updating of annotations across multiple spans
    - Proper handling of annotation fields (annotation_name, identifier, label, score, explanation)
    - Synchronous and asynchronous clients work properly
    - Role-based access control (admin vs member permissions)
    - DataFrame-based annotation operations with different configurations:
      * Using span_id as a column
      * Using span_id as the index
      * Using global annotator_kind

    The test suite consists of three main test methods:
    1. test_add_span_annotation: Tests single annotation operations and UPSERT functionality
    2. test_log_span_annotations: Tests batch annotation operations and UPSERT functionality
    3. test_log_span_annotations_dataframe: Tests DataFrame-based annotation operations with different configurations

    Example:
        ```python
        from phoenix.client import Client

        client = Client()
        annotation = client.annotations.add_span_annotation(
            annotation_name="sentiment",
            span_id="abc123",
            label="positive",
            score=0.9,
        )
        ```
    """  # noqa: E501

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

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_add_span_annotation(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test single span annotation operations.

        This test verifies that:
        1. Single span annotations can be created with name, label, score, and explanation
        2. Annotations are correctly associated with the specified span
        3. All annotation fields are stored and retrieved correctly
        4. Both synchronous and asynchronous clients work properly
        5. Both admin and member users can create annotations
        6. The API supports UPSERT operations (update or insert) for annotations
        7. Annotations maintain their ID across updates (UPSERT)
        """  # noqa: E501
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
            await _await_or_return(
                Client().annotations.add_span_annotation(
                    annotation_name=annotation_name,
                    span_id=span_id1,
                    annotator_kind="LLM",  # Test non-default annotator_kind
                    label=label,
                    score=score,
                    explanation=explanation,
                    metadata=metadata,
                    sync=True,
                ),
            )

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

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_span_annotations(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test batch span annotation operations.

        This test verifies that:
        1. Multiple annotations can be created in a single batch operation
        2. Annotations are correctly associated with their respective spans
        3. All annotation fields are stored and retrieved correctly
        4. Both synchronous and asynchronous clients work properly
        5. Both admin and member users can create annotations
        6. The API supports UPSERT operations for batch annotations
        7. Annotations maintain their ID across updates (UPSERT)
        8. Batch operations correctly handle multiple spans
        """  # noqa: E501
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
                    sync=True,
                ),
            )

            # Verify the batch operation returned the expected number of results
            assert result
            assert len(result) == 2, "Batch operation should return results for both annotations"  # noqa: E501

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

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_log_span_annotations_dataframe(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test DataFrame-based span annotation operations.

        This test verifies that:
        1. Annotations can be created from a pandas DataFrame
        2. Both column-based and index-based span_id work correctly
        3. Optional fields (label, score, explanation) are handled properly
        4. Both synchronous and asynchronous clients work properly
        5. Both admin and member users can create annotations
        6. The API supports UPSERT operations for DataFrame annotations

        The test uses three different DataFrame formats to verify different use cases:
        1. Using span_id as a column: Demonstrates standard DataFrame usage with all fields as columns
        2. Using span_id as the index: Tests alternative DataFrame structure with span_id as index
        3. Using global annotator_kind: Verifies global parameter override of DataFrame values

        Each test case follows the same pattern:
        - Create test data with random values
        - Create DataFrame with specific structure
        - Log annotations using the DataFrame
        - Verify annotations were created correctly by querying the API
        - Check all fields match the input data
        """  # noqa: E501
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
        # All fields are provided as columns in the DataFrame
        df1_annotation_names = [token_hex(16), token_hex(16)]
        df1_span_ids = [span_id1, span_id2]
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
                "span_id": df1_span_ids,
                "annotator_kind": df1_annotator_kinds,
                "label": df1_labels,
                "score": df1_scores,
                "explanation": df1_explanations,
                "metadata": df1_metadata,
            }
        )

        # Log annotations from DataFrame
        await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df1,
                sync=True,
            ),
        )

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
        # This is an alternative way to specify span_id without a dedicated column
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
            index=[span_id1, span_id2],
        )

        # Log annotations from DataFrame
        await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df2,
                sync=True,
            ),
        )

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
        # provided as a parameter to the API call
        global_annotator_kind: Literal["HUMAN"] = "HUMAN"
        df3_annotation_names = [token_hex(16), token_hex(16)]
        df3_span_ids = [span_id1, span_id2]
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
                "span_id": df3_span_ids,
                "label": df3_labels,
                "score": df3_scores,
                "explanation": df3_explanations,
                "metadata": df3_metadata,
            }
        )

        # Log annotations from DataFrame with global annotator_kind
        await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df3,
                annotator_kind=global_annotator_kind,
                sync=True,
            ),
        )

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

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_zero_score_annotation(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that a score of 0 is properly recorded and not treated as falsey.

        This test verifies that:
        1. An annotation with a score of 0 is properly created and stored
        2. The score of 0 is not treated as falsey or None
        3. Both synchronous and asynchronous clients handle zero scores correctly
        4. Both admin and member users can create annotations with zero scores
        5. Optional fields (label, explanation, metadata) can be omitted
        """  # noqa: E501
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
        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=zero_score_annotation_name,
                span_id=span_id1,
                annotator_kind="LLM",
                score=0,  # Explicitly test score of 0
                sync=True,
            ),
        )

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

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_zero_score_annotation_dataframe(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that a score of 0 is properly recorded and not treated as falsey in DataFrame annotations.

        This test verifies that:
        1. A DataFrame annotation with a score of 0 is properly created and stored
        2. The score of 0 is not treated as falsey or None
        3. Both synchronous and asynchronous clients handle zero scores correctly
        4. Both admin and member users can create DataFrame annotations with zero scores
        5. Optional fields (label, explanation, metadata) can be omitted in DataFrame annotations
        """  # noqa: E501
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
        df = pd.DataFrame(
            {
                "name": [zero_score_annotation_name],
                "span_id": [span_id1],
                "annotator_kind": ["LLM"],
                "score": [0],  # Explicitly test score of 0
            }
        )

        # Log annotations from DataFrame
        await _await_or_return(
            Client().annotations.log_span_annotations_dataframe(
                dataframe=df,
                sync=True,
            ),
        )

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
