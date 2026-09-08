# pyright: reportPrivateUsage=false

import pandas as pd
import pytest

from phoenix.client.utils.annotation_helpers import (
    _DOCUMENT_ID_CONFIG,
    _SPAN_ID_CONFIG,
    _chunk_annotations_dataframe,
    _chunk_document_annotations_dataframe,
    _chunk_span_annotations_dataframe,
    _create_document_annotation,
    _create_span_annotation,
    _validate_document_annotations_dataframe,
    _validate_span_annotations_dataframe,
    _validate_trace_annotations_dataframe,
)


class TestAnnotationDataFrameValidation:
    """Test suite for annotation DataFrame validation across different ID configurations."""

    def test_basic_validation_errors(self) -> None:
        """Test fundamental validation failures that apply to all annotation types."""
        # Empty DataFrame
        with pytest.raises(ValueError, match="DataFrame cannot be empty"):
            _validate_span_annotations_dataframe(dataframe=pd.DataFrame())

        # Non-pandas input
        with pytest.raises(TypeError, match="Expected pandas DataFrame"):
            _validate_span_annotations_dataframe(dataframe="not a dataframe")  # type: ignore[arg-type] # pyright: ignore[reportArgumentType]

        # Missing required columns (no ID columns)
        df = pd.DataFrame({"label": ["positive"]})
        with pytest.raises(
            ValueError, match="DataFrame must have.*column, index level, or a string-based index"
        ):
            _validate_span_annotations_dataframe(dataframe=df)

    def test_annotation_column_conflicts(self) -> None:
        """Test validation of conflicting annotation columns."""
        # Both name and annotation_name present
        df = pd.DataFrame(
            {
                "name": ["sentiment"],
                "annotation_name": ["sentiment"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "label": ["positive"],
            }
        )
        with pytest.raises(
            ValueError, match="DataFrame cannot have both 'name' and 'annotation_name' columns"
        ):
            _validate_span_annotations_dataframe(dataframe=df)

    def test_id_column_scenarios(self) -> None:
        """Test critical ID column scenarios: missing, fallback, conflicts."""
        # Missing span_id (should use fallback)
        df = pd.DataFrame(
            {
                "name": ["sentiment"],
                "annotator_kind": ["HUMAN"],
                "context.span_id": ["id1"],
                "label": ["positive"],
            }
        )
        _validate_span_annotations_dataframe(dataframe=df)  # Should pass with fallback

        # Both primary and fallback present (conflict)
        df_conflict = pd.DataFrame(
            {
                "name": ["sentiment"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "context.span_id": ["id2"],
                "label": ["positive"],
            }
        )
        with pytest.raises(
            ValueError, match="DataFrame cannot have both primary and fallback ID columns"
        ):
            _validate_span_annotations_dataframe(dataframe=df_conflict)

    def test_span_document_validation(self) -> None:
        """Test span document specific validation with multiple ID columns."""
        # Valid span document DataFrame
        df = pd.DataFrame(
            {
                "name": ["relevance"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["span1"],
                "document_position": [0],
                "label": ["relevant"],
            }
        )
        _validate_document_annotations_dataframe(dataframe=df)  # Should pass

        # Missing span_id (should fail - ALL ID columns required for multi-ID configs)
        df_missing_span = pd.DataFrame(
            {
                "name": ["relevance"],
                "annotator_kind": ["HUMAN"],
                "document_position": [0],
                "label": ["relevant"],
            }
        )
        with pytest.raises(ValueError, match="DataFrame must have ALL required ID columns"):
            _validate_document_annotations_dataframe(dataframe=df_missing_span)

        # Missing document_position (should also fail)
        df_missing_doc = pd.DataFrame(
            {
                "name": ["relevance"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["span1"],
                "label": ["relevant"],
            }
        )
        with pytest.raises(ValueError, match="DataFrame must have ALL required ID columns"):
            _validate_document_annotations_dataframe(dataframe=df_missing_doc)

    def test_global_parameter_validation(self) -> None:
        """Test validation when fields are required vs optional in DataFrame."""
        df_with_fields = pd.DataFrame(
            {
                "span_id": ["id1"],
                "name": ["sentiment"],
                "annotator_kind": ["HUMAN"],
                "label": ["positive"],
            }
        )
        df_without_fields = pd.DataFrame({"span_id": ["id1"], "label": ["positive"]})

        # Fields not required - should pass even without name/kind columns
        _validate_span_annotations_dataframe(dataframe=df_without_fields)

        # Fields required - should fail without name/kind columns
        with pytest.raises(
            ValueError,
            match="DataFrame must contain either 'name' or 'annotation_name' column when annotation_name_required=True",
        ):
            _validate_span_annotations_dataframe(
                dataframe=df_without_fields, annotation_name_required=True
            )

        # Fields required - should pass with name/kind columns
        _validate_span_annotations_dataframe(
            dataframe=df_with_fields, annotation_name_required=True, annotator_kind_required=True
        )

    def test_index_based_id_validation(self) -> None:
        """Test validation for ID columns provided via index instead of columns."""
        # Single ID in named index should pass
        df_single_index = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "label": ["positive"],
            },
            index=pd.Index(["span1"], name="span_id"),
        )
        _validate_span_annotations_dataframe(dataframe=df_single_index)  # Should pass

        # Multi-ID in MultiIndex should pass
        multi_index = pd.MultiIndex.from_tuples(  # pyright: ignore[reportUnknownMemberType]
            [("span1", 0)], names=["span_id", "document_position"]
        )
        df_multi_index = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "label": ["positive"],
            },
            index=multi_index,
        )
        _validate_document_annotations_dataframe(dataframe=df_multi_index)  # Should pass

        # Missing ID level in MultiIndex should fail
        incomplete_multi_index = pd.MultiIndex.from_tuples(  # pyright: ignore[reportUnknownMemberType]
            [("span1", "extra")],
            names=["span_id", "extra_level"],  # Missing document_position
        )
        df_incomplete_index = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "label": ["positive"],
            },
            index=incomplete_multi_index,
        )
        with pytest.raises(ValueError, match="DataFrame must have ALL required ID columns"):
            _validate_document_annotations_dataframe(dataframe=df_incomplete_index)


class TestAnnotationDataFrameChunking:
    """Test suite for annotation DataFrame chunking across different ID configurations."""

    def test_single_vs_multiple_chunks(self) -> None:
        """Test chunking behavior with different DataFrame sizes."""
        # Single row -> single chunk
        df_small = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "label": ["positive"],
            }
        )
        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df_small,
                id_config=_SPAN_ID_CONFIG,
                annotation_factory=_create_span_annotation,
            )
        )
        assert len(chunks) == 1
        assert len(chunks[0]) == 1

        # 5 rows with chunk_size=2 -> 3 chunks (2, 2, 1)
        df_multi = pd.DataFrame(
            {
                "name": [f"test{i}" for i in range(5)],
                "annotator_kind": ["HUMAN"] * 5,
                "span_id": [f"id{i}" for i in range(5)],
                "label": [f"label{i}" for i in range(5)],
            }
        )
        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df_multi,
                chunk_size=2,
                id_config=_SPAN_ID_CONFIG,
                annotation_factory=_create_span_annotation,
            )
        )
        assert len(chunks) == 3
        assert [len(chunk) for chunk in chunks] == [2, 2, 1]

    def test_global_parameters(self) -> None:
        """Test chunking with global annotation name and annotator kind."""
        df = pd.DataFrame({"span_id": ["id1", "id2"], "label": ["positive", "negative"]})
        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                annotation_name="sentiment",
                annotator_kind="HUMAN",
                id_config=_SPAN_ID_CONFIG,
                annotation_factory=_create_span_annotation,
            )
        )

        # Verify global parameters are applied
        annotation = chunks[0][0]
        assert annotation["name"] == "sentiment"
        assert annotation["annotator_kind"] == "HUMAN"

    def test_multi_id_extraction(self) -> None:
        """Test extraction of multiple ID parameters (span_id + document_position)."""
        df = pd.DataFrame(
            {
                "name": ["relevance"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["span1"],
                "document_position": [0],  # Critical: test that 0 is handled correctly
                "label": ["relevant"],
            }
        )
        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                id_config=_DOCUMENT_ID_CONFIG,
                annotation_factory=_create_document_annotation,
            )
        )

        annotation = chunks[0][0]
        assert annotation["span_id"] == "span1"
        assert annotation["document_position"] == 0  # Ensure 0 is preserved

    def test_type_conversion(self) -> None:
        """Test proper type conversion for different ID column types."""
        df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["span1"],
                "document_position": ["2"],  # String that should convert to int
                "label": ["test"],
            }
        )
        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                id_config=_DOCUMENT_ID_CONFIG,
                annotation_factory=_create_document_annotation,
            )
        )

        annotation = chunks[0][0]
        assert annotation["span_id"] == "span1"
        assert annotation["document_position"] == 2
        assert isinstance(annotation["document_position"], int)

    def test_fallback_column_usage(self) -> None:
        """Test that fallback columns are used when primary columns are missing."""
        df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "context.span_id": ["span1"],  # Using fallback column
                "label": ["positive"],
            }
        )
        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                id_config=_SPAN_ID_CONFIG,
                annotation_factory=_create_span_annotation,
            )
        )

        annotation = chunks[0][0]
        assert annotation["span_id"] == "span1"

    def test_index_fallback(self) -> None:
        """Test using DataFrame index when no ID columns are available."""
        df = pd.DataFrame(
            {"name": ["test"], "annotator_kind": ["HUMAN"], "label": ["positive"]}, index=["span1"]
        )

        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                id_config=_SPAN_ID_CONFIG,
                annotation_factory=_create_span_annotation,
            )
        )

        annotation = chunks[0][0]
        assert annotation["span_id"] == "span1"

    def test_named_index_for_single_id(self) -> None:
        """Test using a named index for single ID column extraction."""
        # Create DataFrame with named index matching the ID column name
        df = pd.DataFrame(
            {"name": ["test"], "annotator_kind": ["HUMAN"], "label": ["positive"]},
            index=pd.Index(["span1"], name="span_id"),
        )

        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                id_config=_SPAN_ID_CONFIG,
                annotation_factory=_create_span_annotation,
            )
        )

        annotation = chunks[0][0]
        assert annotation["span_id"] == "span1"

    def test_multiindex_for_document_annotations(self) -> None:
        """Test using MultiIndex for document annotations with both span_id and document_position."""
        # Create DataFrame with MultiIndex containing both required ID columns
        multi_index = pd.MultiIndex.from_tuples(  # pyright: ignore[reportUnknownMemberType]
            [("span1", 0), ("span1", 1), ("span2", 0)], names=["span_id", "document_position"]
        )
        df = pd.DataFrame(
            {
                "name": ["relevance", "accuracy", "completeness"],
                "annotator_kind": ["HUMAN", "LLM", "CODE"],
                "label": ["relevant", "accurate", "complete"],
            },
            index=multi_index,
        )

        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                id_config=_DOCUMENT_ID_CONFIG,
                annotation_factory=_create_document_annotation,
            )
        )

        # Check all three annotations were created correctly
        assert len(chunks) == 1  # All fit in one chunk
        annotations = chunks[0]
        assert len(annotations) == 3

        # First annotation
        assert annotations[0]["span_id"] == "span1"
        assert annotations[0]["document_position"] == 0
        assert annotations[0]["name"] == "relevance"

        # Second annotation
        assert annotations[1]["span_id"] == "span1"
        assert annotations[1]["document_position"] == 1
        assert annotations[1]["name"] == "accuracy"

        # Third annotation
        assert annotations[2]["span_id"] == "span2"
        assert annotations[2]["document_position"] == 0
        assert annotations[2]["name"] == "completeness"

    def test_multiindex_validation_for_document_annotations(self) -> None:
        """Test validation passes for MultiIndex with document annotation ID columns."""
        # Create DataFrame with MultiIndex containing both required ID columns
        multi_index = pd.MultiIndex.from_tuples(  # pyright: ignore[reportUnknownMemberType]
            [("span1", 0), ("span2", 1)], names=["span_id", "document_position"]
        )
        df = pd.DataFrame(
            {
                "name": ["relevance", "accuracy"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["relevant", "accurate"],
            },
            index=multi_index,
        )

        # This should pass validation
        _validate_document_annotations_dataframe(dataframe=df)

    def test_partial_index_partial_columns_error(self) -> None:
        """Test that having some ID columns in index and others in columns raises an error."""
        # Create DataFrame with span_id in index but document_position in column
        df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "document_position": [0],  # This is in a column
                "label": ["positive"],
            },
            index=pd.Index(["span1"], name="span_id"),  # This is in the index
        )

        # This should fail - mixing index and columns for multi-ID config
        with pytest.raises(
            ValueError,
            match="For multi-ID configurations, all ID columns must be in the same location",
        ):
            _validate_document_annotations_dataframe(dataframe=df)

    def test_multiindex_wrong_names_error(self) -> None:
        """Test that MultiIndex with wrong level names fails validation."""
        # Create MultiIndex with incorrect names
        multi_index = pd.MultiIndex.from_tuples(  # pyright: ignore[reportUnknownMemberType]
            [("span1", 0)],
            names=["wrong_name", "document_position"],  # span_id is named incorrectly
        )
        df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "label": ["positive"],
            },
            index=multi_index,
        )

        # This should fail validation
        with pytest.raises(ValueError, match="DataFrame must have ALL required ID columns"):
            _validate_document_annotations_dataframe(dataframe=df)

    def test_multiindex_incomplete_id_columns_error(self) -> None:
        """Test that MultiIndex missing required ID columns fails validation."""
        # Create MultiIndex with only one of the required columns
        multi_index = pd.MultiIndex.from_tuples(  # pyright: ignore[reportUnknownMemberType]
            [("span1", "extra_data")],
            names=["span_id", "extra_column"],  # Missing document_position
        )
        df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "label": ["positive"],
            },
            index=multi_index,
        )

        # This should fail validation
        with pytest.raises(ValueError, match="DataFrame must have ALL required ID columns"):
            _validate_document_annotations_dataframe(dataframe=df)

    def test_mixed_index_column_types(self) -> None:
        """Test proper type conversion when extracting from MultiIndex."""
        # Create MultiIndex with string document_position that should convert to int
        multi_index = pd.MultiIndex.from_tuples(  # pyright: ignore[reportUnknownMemberType]
            [("span1", "2"), ("span2", "0")],  # document_position as string
            names=["span_id", "document_position"],
        )
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "negative"],
            },
            index=multi_index,
        )

        chunks = list(
            _chunk_annotations_dataframe(
                dataframe=df,
                id_config=_DOCUMENT_ID_CONFIG,
                annotation_factory=_create_document_annotation,
            )
        )

        annotations = chunks[0]
        # Check type conversion worked
        assert annotations[0]["document_position"] == 2
        assert isinstance(annotations[0]["document_position"], int)
        assert annotations[1]["document_position"] == 0
        assert isinstance(annotations[1]["document_position"], int)

    def test_annotation_type_differences(self) -> None:
        """Test differences between span, trace, and span-document annotations."""
        # Span annotation
        span_df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["span1"],
                "label": ["positive"],
            }
        )
        span_chunks = list(
            _chunk_annotations_dataframe(
                dataframe=span_df,
                id_config=_SPAN_ID_CONFIG,
                annotation_factory=_create_span_annotation,
            )
        )
        assert span_chunks[0][0]["span_id"] == "span1"

        # Span document annotation
        doc_df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["span1"],
                "document_position": [1],
                "label": ["positive"],
            }
        )
        doc_chunks = list(
            _chunk_annotations_dataframe(
                dataframe=doc_df,
                id_config=_DOCUMENT_ID_CONFIG,
                annotation_factory=_create_document_annotation,
            )
        )
        annotation = doc_chunks[0][0]
        assert annotation["span_id"] == "span1"
        assert annotation["document_position"] == 1

    def test_error_handling(self) -> None:
        """Test critical error scenarios and edge cases."""
        # Invalid score type conversion
        df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "score": ["not_a_number"],
            }
        )
        with pytest.raises(
            ValueError, match="Score value 'not_a_number' cannot be converted to float"
        ):
            list(
                _chunk_annotations_dataframe(
                    dataframe=df,
                    id_config=_SPAN_ID_CONFIG,
                    annotation_factory=_create_span_annotation,
                )
            )

        # Missing required ID column in multi-ID config should fail during chunking
        df_missing_span = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["HUMAN"],
                "document_position": [0],  # Missing span_id
                "label": ["positive"],
            }
        )
        with pytest.raises(ValueError, match="Row 0: Missing required ID columns"):
            list(
                _chunk_annotations_dataframe(
                    dataframe=df_missing_span,
                    id_config=_DOCUMENT_ID_CONFIG,
                    annotation_factory=_create_document_annotation,
                )
            )

    def test_invalid_annotator_kinds(self) -> None:
        """Test validation of annotator_kind values."""
        # Invalid annotator_kind in DataFrame
        df = pd.DataFrame(
            {
                "name": ["test"],
                "annotator_kind": ["INVALID_KIND"],
                "span_id": ["id1"],
                "label": ["positive"],
            }
        )
        with pytest.raises(ValueError, match="Invalid annotator_kind values.*INVALID_KIND"):
            _validate_span_annotations_dataframe(dataframe=df)

    def test_edge_case_values(self) -> None:
        """Test handling of edge case values that could cause issues."""
        # Empty strings and whitespace handling
        df_whitespace = pd.DataFrame(
            {
                "name": [" "],  # Whitespace-only name
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "label": ["positive"],
            }
        )
        with pytest.raises(ValueError, match="name values must be non-empty strings"):
            _validate_span_annotations_dataframe(
                dataframe=df_whitespace, annotation_name_required=True
            )

        # None values in name column
        df_none = pd.DataFrame(
            {
                "name": [None],
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "label": ["positive"],
            }
        )
        with pytest.raises(ValueError, match="name values cannot be None"):
            _validate_span_annotations_dataframe(dataframe=df_none, annotation_name_required=True)


class TestAnnotationCreation:
    """Test suite for direct annotation creation functions."""

    def test_span_annotation_creation(self) -> None:
        """Test creating span annotations with different parameter combinations."""
        # Minimal required parameters
        basic_annotation = _create_span_annotation(
            span_id="span1", annotation_name="sentiment", label="positive"
        )
        assert basic_annotation["span_id"] == "span1"
        assert basic_annotation["name"] == "sentiment"
        assert basic_annotation["annotator_kind"] == "HUMAN"  # default
        assert basic_annotation.get("result", {}).get("label") == "positive"

        # Full parameters with all optional fields
        full_annotation = _create_span_annotation(
            span_id="span2",
            annotation_name="quality",
            annotator_kind="LLM",
            label="high_quality",
            score=0.95,
            explanation="Well structured response",
            metadata={"model": "gpt-4", "version": "1.0"},
            identifier="eval_run_1",
        )
        assert full_annotation["span_id"] == "span2"
        assert full_annotation["name"] == "quality"
        assert full_annotation["annotator_kind"] == "LLM"
        result = full_annotation.get("result", {})
        assert result.get("label") == "high_quality"
        assert result.get("score") == 0.95
        assert result.get("explanation") == "Well structured response"
        metadata = full_annotation.get("metadata", {})
        assert metadata.get("model") == "gpt-4"
        assert full_annotation.get("identifier") == "eval_run_1"

    def test_document_annotation_creation(self) -> None:
        """Test creating document annotations with position handling."""
        # Basic document annotation
        doc_annotation = _create_document_annotation(
            span_id="span1", document_position=0, annotation_name="relevance", label="relevant"
        )
        assert doc_annotation["span_id"] == "span1"
        assert doc_annotation["document_position"] == 0
        assert doc_annotation["name"] == "relevance"

        # Document annotation with all fields
        full_doc_annotation = _create_document_annotation(
            span_id="span2",
            document_position=2,
            annotation_name="accuracy",
            annotator_kind="CODE",
            label="accurate",
            score=0.88,
            explanation="Contains factual information",
            metadata={"source": "fact_checker"},
        )
        assert full_doc_annotation["document_position"] == 2
        result = full_doc_annotation.get("result", {})
        assert result.get("label") == "accurate"

    def test_identifier_edge_cases(self) -> None:
        """Test identifier handling edge cases."""
        # Empty string identifier should be stripped and not included
        annotation = _create_span_annotation(
            span_id="span1", annotation_name="test", identifier="", label="test"
        )
        assert annotation.get("identifier") is None

        # Whitespace-only identifier should be stripped and not included
        annotation = _create_span_annotation(
            span_id="span1", annotation_name="test", identifier="   ", label="test"
        )
        assert annotation.get("identifier") is None

        # Valid identifier with whitespace should be stripped but included
        annotation = _create_span_annotation(
            span_id="span1", annotation_name="test", identifier="  valid_id  ", label="test"
        )
        assert annotation.get("identifier") == "valid_id"


class TestPublicWrapperFunctions:
    """Test suite for the public wrapper functions users will call directly."""

    def test_trace_validation(self) -> None:
        """Test trace annotation validation for critical differences from span validation."""
        # Valid trace DataFrame
        df = pd.DataFrame(
            {
                "name": ["sentiment"],
                "annotator_kind": ["HUMAN"],
                "trace_id": ["trace1"],
                "label": ["positive"],
            }
        )
        _validate_trace_annotations_dataframe(dataframe=df)  # Should pass

        # Missing trace_id should fail
        df_missing = pd.DataFrame({"name": ["sentiment"], "label": ["positive"]})
        with pytest.raises(ValueError, match="DataFrame must have.*trace_id"):
            _validate_trace_annotations_dataframe(dataframe=df_missing)

    def test_public_chunking_functions(self) -> None:
        """Test public chunking functions work correctly."""
        # Test span chunking wrapper
        span_df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "span_id": ["span1", "span2"],
                "label": ["pos", "neg"],
            }
        )
        span_chunks = list(
            _chunk_span_annotations_dataframe(dataframe=span_df, annotator_kind="LLM", chunk_size=1)
        )
        assert len(span_chunks) == 2
        assert span_chunks[0][0]["annotator_kind"] == "LLM"

        # Test document chunking wrapper
        doc_df = pd.DataFrame(
            {
                "name": ["relevance"],
                "span_id": ["span1"],
                "document_position": [0],
                "score": [0.9],
            }
        )
        doc_chunks = list(
            _chunk_document_annotations_dataframe(
                dataframe=doc_df, annotation_name="relevance_global", annotator_kind="CODE"
            )
        )
        assert len(doc_chunks) == 1
        # Global name should override DataFrame name
        assert doc_chunks[0][0]["name"] == "relevance_global"
        assert doc_chunks[0][0]["annotator_kind"] == "CODE"

    def test_whitespace_handling_consistency(self) -> None:
        """Test that all string fields consistently strip whitespace."""
        df = pd.DataFrame(
            {
                "name": ["  sentiment  "],  # Leading/trailing whitespace
                "span_id": ["span1"],
                "label": ["  positive  "],  # Leading/trailing whitespace
                "explanation": ["  good response  "],  # Leading/trailing whitespace
            }
        )

        chunks = list(_chunk_span_annotations_dataframe(dataframe=df, annotator_kind="HUMAN"))

        annotation = chunks[0][0]

        # New consistent behavior - all string fields are stripped
        # annotation_name/name: NOW stripped (removes whitespace)
        assert annotation["name"] == "sentiment"

        # label: NOW stripped (removes whitespace)
        result = annotation.get("result", {})
        assert result.get("label") == "positive"

        # explanation: IS stripped (removes whitespace)
        assert result.get("explanation") == "good response"

        # Test identifier stripping behavior
        annotation_with_id = _create_span_annotation(
            span_id="span1", annotation_name="test", identifier="  whitespace_id  ", label="test"
        )
        # identifier: IS stripped (removes whitespace)
        assert annotation_with_id.get("identifier") == "whitespace_id"

    def test_span_id_whitespace_handling(self) -> None:
        """Test that span_id values are NOW stripped (new consistent behavior)."""
        # Direct creation function - span_id now stripped
        annotation = _create_span_annotation(
            span_id="  span_with_whitespace  ", annotation_name="test", label="test"
        )
        # span_id: NOW stripped (removes whitespace)
        assert annotation["span_id"] == "span_with_whitespace"

        # DataFrame chunking - span_id extracted and stripped
        df = pd.DataFrame(
            {
                "name": ["test"],
                "span_id": ["  span_from_df  "],  # Leading/trailing whitespace
                "label": ["positive"],
            }
        )

        chunks = list(_chunk_span_annotations_dataframe(dataframe=df, annotator_kind="HUMAN"))

        annotation = chunks[0][0]
        # span_id: NOW stripped (removes whitespace from DataFrame)
        assert annotation["span_id"] == "span_from_df"
