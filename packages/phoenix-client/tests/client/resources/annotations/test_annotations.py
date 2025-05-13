# pyright: reportPrivateUsage=false

import pandas as pd
import pytest

from phoenix.client.resources.annotations import _chunk_dataframe, _validate_dataframe


class TestDataFrameValidation:
    """Test suite for the _validate_dataframe helper function."""

    def test_empty(self) -> None:
        """Test validation of empty DataFrame."""
        df = pd.DataFrame()
        with pytest.raises(ValueError, match="DataFrame cannot be empty"):
            _validate_dataframe(dataframe=df)

    def test_not_pandas(self) -> None:
        """Test validation with non-pandas input."""
        with pytest.raises(TypeError, match="Expected pandas DataFrame"):
            _validate_dataframe(dataframe="not a dataframe")  # type: ignore[arg-type] # pyright: ignore[reportArgumentType]

    def test_missing_required_columns(self) -> None:
        """Test validation with missing required columns."""
        df = pd.DataFrame({"label": ["positive"]})
        with pytest.raises(
            ValueError, match="DataFrame must contain either 'name' or 'annotation_name' column"
        ):
            _validate_dataframe(dataframe=df)

    def test_both_name_columns(self) -> None:
        """Test validation when both name and annotation_name columns are present."""
        df = pd.DataFrame(
            {"name": ["sentiment"], "annotation_name": ["sentiment"], "annotator_kind": ["HUMAN"]}
        )
        with pytest.raises(
            ValueError, match="DataFrame cannot have both 'name' and 'annotation_name' columns"
        ):
            _validate_dataframe(dataframe=df)

    def test_invalid_annotator_kind(self) -> None:
        """Test validation of invalid annotator_kind values."""
        df = pd.DataFrame(
            {
                "name": ["sentiment"],
                "annotator_kind": ["INVALID"],
                "span_id": ["span1"],
            }
        )
        with pytest.raises(ValueError, match="Invalid annotator_kind values found in DataFrame"):
            _validate_dataframe(dataframe=df)

    def test_valid_with_name(self) -> None:
        """Test validation with valid DataFrame using name column."""
        df = pd.DataFrame(
            {"name": ["sentiment"], "annotator_kind": ["HUMAN"], "span_id": ["span1"]}
        )
        _validate_dataframe(dataframe=df)  # Should not raise

    def test_valid_with_annotation_name(self) -> None:
        """Test validation with valid DataFrame using annotation_name column."""
        df = pd.DataFrame(
            {"annotation_name": ["sentiment"], "annotator_kind": ["HUMAN"], "span_id": ["span1"]}
        )
        _validate_dataframe(dataframe=df)  # Should not raise

    def test_valid_with_global_name(self) -> None:
        """Test validation with valid DataFrame and global annotation_name."""
        df = pd.DataFrame({"annotator_kind": ["HUMAN"], "span_id": ["span1"]})
        _validate_dataframe(dataframe=df, annotation_name="sentiment")  # Should not raise

    def test_valid_with_global_annotator_kind(self) -> None:
        """Test validation with valid DataFrame and global annotator_kind."""
        df = pd.DataFrame({"name": ["sentiment"], "span_id": ["span1"]})
        _validate_dataframe(dataframe=df, annotator_kind="HUMAN")  # Should not raise

    def test_invalid_global_annotator_kind(self) -> None:
        """Test validation with invalid global annotator_kind."""
        df = pd.DataFrame({"name": ["sentiment"], "span_id": ["span1"]})
        with pytest.raises(ValueError, match="Invalid annotator_kind value"):
            _validate_dataframe(
                dataframe=df,
                annotator_kind="INVALID",  # type: ignore
            )

    def test_invalid_global_name(self) -> None:
        """Test validation with invalid global annotation_name."""
        df = pd.DataFrame({"annotator_kind": ["HUMAN"], "span_id": ["span1"]})
        with pytest.raises(ValueError, match="Annotation name cannot be empty or whitespace"):
            _validate_dataframe(dataframe=df, annotation_name="")  # Empty string

    def test_missing_span_id(self) -> None:
        """Test validation with missing span_id."""
        df = pd.DataFrame({"name": ["sentiment"], "annotator_kind": ["HUMAN"]})
        with pytest.raises(
            ValueError,
            match="DataFrame must have either a 'span_id' or 'context.span_id' column, or a string-based index",  # noqa: E501
        ):
            _validate_dataframe(dataframe=df)

    def test_both_span_id_columns(self) -> None:
        """Test validation when both span_id and context.span_id columns are present."""
        df = pd.DataFrame(
            {
                "name": ["sentiment"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["span1"],
                "context.span_id": ["span1"],
            }
        )
        with pytest.raises(
            ValueError, match="DataFrame cannot have both 'span_id' and 'context.span_id' columns"
        ):
            _validate_dataframe(dataframe=df)

    def test_valid_with_context_span_id(self) -> None:
        """Test validation with valid DataFrame using context.span_id column."""
        df = pd.DataFrame(
            {
                "name": ["sentiment"],
                "annotator_kind": ["HUMAN"],
                "context.span_id": ["span1"],
            }
        )
        _validate_dataframe(dataframe=df)  # Should not raise

    def test_invalid_context_span_id_values(self) -> None:
        """Test validation with invalid context.span_id values."""
        df = pd.DataFrame(
            {
                "name": ["sentiment", "sentiment"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "context.span_id": ["", "  "],  # Empty strings
            }
        )
        with pytest.raises(ValueError, match="context.span_id values must be non-empty strings"):
            _validate_dataframe(dataframe=df)

    def test_none_context_span_id_values(self) -> None:
        """Test validation with None values in context.span_id column."""
        df = pd.DataFrame(
            {
                "name": ["sentiment", "sentiment"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "context.span_id": [None, "valid_id"],  # None value
            }
        )
        with pytest.raises(ValueError, match="context.span_id values cannot be None"):
            _validate_dataframe(dataframe=df)

    def test_non_string_context_span_id(self) -> None:
        """Test validation with non-string values in context.span_id column."""
        df = pd.DataFrame(
            {
                "name": ["sentiment", "sentiment"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "context.span_id": [123, "valid_id"],  # Non-string value
            }
        )
        with pytest.raises(ValueError, match="context.span_id values must be strings"):
            _validate_dataframe(dataframe=df)

    def test_valid_with_index(self) -> None:
        """Test validation with valid DataFrame using index as span_id."""
        df = pd.DataFrame({"name": ["sentiment"], "annotator_kind": ["HUMAN"]}, index=["span1"])
        _validate_dataframe(dataframe=df)  # Should not raise

    def test_invalid_name_values(self) -> None:
        """Test validation with invalid name values."""
        df = pd.DataFrame(
            {
                "name": ["", "  "],  # Empty strings
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["span1", "span2"],
            }
        )
        with pytest.raises(ValueError, match="name values must be non-empty strings"):
            _validate_dataframe(dataframe=df)

    def test_invalid_annotation_name_values(self) -> None:
        """Test validation with invalid annotation_name values."""
        df = pd.DataFrame(
            {
                "annotation_name": ["", "  "],  # Empty strings
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["span1", "span2"],
            }
        )
        with pytest.raises(ValueError, match="annotation_name values must be non-empty strings"):
            _validate_dataframe(dataframe=df)

    def test_invalid_span_id_values(self) -> None:
        """Test validation with invalid span_id values."""
        df = pd.DataFrame(
            {
                "name": ["sentiment", "sentiment"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["", "  "],  # Empty strings
            }
        )
        with pytest.raises(ValueError, match="span_id values must be non-empty strings"):
            _validate_dataframe(dataframe=df)

    def test_invalid_index_values(self) -> None:
        """Test validation with invalid index values when using index as span_id."""
        df = pd.DataFrame(
            {
                "name": ["sentiment", "sentiment"],
                "annotator_kind": ["HUMAN", "HUMAN"],
            },
            index=["", "  "],  # Empty strings
        )
        with pytest.raises(
            ValueError, match="Index values must be non-empty strings when used as span_id"
        ):
            _validate_dataframe(dataframe=df)

    def test_mixed_valid_invalid_values(self) -> None:
        """Test validation with mixed valid and invalid values in columns."""
        df = pd.DataFrame(
            {
                "name": ["valid", ""],  # Mixed valid/invalid
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["valid_id", "  "],  # Mixed valid/invalid
            }
        )
        with pytest.raises(ValueError, match="name values must be non-empty strings"):
            _validate_dataframe(dataframe=df)

    def test_non_string_span_id(self) -> None:
        """Test validation with non-string values in span_id column."""
        df = pd.DataFrame(
            {
                "name": ["sentiment", "sentiment"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": [123, "valid_id"],  # Non-string value
            }
        )
        with pytest.raises(ValueError, match="span_id values must be strings"):
            _validate_dataframe(dataframe=df)

    def test_whitespace_only_index(self) -> None:
        """Test validation with whitespace-only values in index."""
        df = pd.DataFrame(
            {
                "name": ["sentiment", "sentiment"],
                "annotator_kind": ["HUMAN", "HUMAN"],
            },
            index=["  ", "\t"],  # Whitespace-only values
        )
        with pytest.raises(
            ValueError, match="Index values must be non-empty strings when used as span_id"
        ):
            _validate_dataframe(dataframe=df)


class TestChunkDataFrame:
    """Test suite for the _chunk_dataframe helper function."""

    def test_empty_dataframe(self) -> None:
        """Test chunking an empty DataFrame."""
        df = pd.DataFrame()
        with pytest.raises(ValueError, match="DataFrame cannot be empty"):
            list(_chunk_dataframe(dataframe=df))

    def test_single_row(self) -> None:
        """Test chunking a DataFrame with a single row."""
        df = pd.DataFrame(
            {
                "name": ["test1"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "label": ["label1"],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 1
        assert len(chunks[0]) == 1

    def test_default_chunk_size(self) -> None:
        """Test that the default chunk size is used when not specified."""
        # Create a DataFrame with 101 rows to test default chunk size of 100
        df = pd.DataFrame(
            {
                "name": [f"test{i}" for i in range(101)],
                "annotator_kind": ["HUMAN"] * 101,
                "span_id": [f"id{i}" for i in range(101)],
                "label": [f"label{i}" for i in range(101)],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 2
        assert len(chunks[0]) == 100  # First chunk should be full
        assert len(chunks[1]) == 1  # Second chunk should have remaining row

    def test_exact_chunk_size(self) -> None:
        """Test chunking a DataFrame that is exactly the chunk size."""
        # Create a DataFrame with 100 rows (exactly the default chunk size)
        df = pd.DataFrame(
            {
                "name": [f"test{i}" for i in range(100)],
                "annotator_kind": ["HUMAN"] * 100,
                "span_id": [f"id{i}" for i in range(100)],
                "label": [f"label{i}" for i in range(100)],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 1
        assert len(chunks[0]) == 100

    def test_custom_chunk_size(self) -> None:
        """Test chunking with a custom chunk size."""
        # Create a DataFrame with 10 rows and use chunk size of 3
        df = pd.DataFrame(
            {
                "name": [f"test{i}" for i in range(10)],
                "annotator_kind": ["HUMAN"] * 10,
                "span_id": [f"id{i}" for i in range(10)],
                "label": [f"label{i}" for i in range(10)],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df, chunk_size=3))
        assert len(chunks) == 4  # 3 full chunks + 1 partial chunk
        assert len(chunks[0]) == 3
        assert len(chunks[1]) == 3
        assert len(chunks[2]) == 3
        assert len(chunks[3]) == 1

    def test_global_annotation_name(self) -> None:
        """Test chunking with global annotation_name."""
        df = pd.DataFrame(
            {
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["id1", "id2"],
                "label": ["label1", "label2"],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df, annotation_name="global_name"))
        assert len(chunks) == 1
        assert all(anno["name"] == "global_name" for anno in chunks[0])

    def test_global_annotator_kind(self) -> None:
        """Test chunking with global annotator_kind."""
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "span_id": ["id1", "id2"],
                "label": ["label1", "label2"],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df, annotator_kind="HUMAN"))
        assert len(chunks) == 1
        assert all(anno["annotator_kind"] == "HUMAN" for anno in chunks[0])

    def test_optional_fields(self) -> None:
        """Test chunking with optional fields (label, score, explanation)."""
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["id1", "id2"],
                "label": ["label1", "label2"],
                "score": [0.5, 0.8],
                "explanation": ["expl1", "expl2"],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 1
        assert chunks[0][0]["result"]["label"] == "label1"  # pyright: ignore[reportTypedDictNotRequiredAccess]
        assert chunks[0][0]["result"]["score"] == 0.5  # pyright: ignore[reportTypedDictNotRequiredAccess]
        assert chunks[0][0]["result"]["explanation"] == "expl1"  # pyright: ignore[reportTypedDictNotRequiredAccess]

    def test_index_as_span_id(self) -> None:
        """Test chunking when using index as span_id."""
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "label": ["label1", "label2"],
            },
            index=["id1", "id2"],
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 1
        assert chunks[0][0]["span_id"] == "id1"
        assert chunks[0][1]["span_id"] == "id2"

    def test_metadata(self) -> None:
        """Test chunking with metadata field."""
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["id1", "id2"],
                "label": ["label1", "label2"],
                "metadata": [{"key1": "value1"}, {"key2": "value2"}],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 1
        assert chunks[0][0]["metadata"] == {"key1": "value1"}  # pyright: ignore[reportTypedDictNotRequiredAccess]
        assert chunks[0][1]["metadata"] == {"key2": "value2"}  # pyright: ignore[reportTypedDictNotRequiredAccess]

    def test_identifier(self) -> None:
        """Test chunking with identifier field."""
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["id1", "id2"],
                "label": ["label1", "label2"],
                "identifier": ["id1", "id2"],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 1
        assert chunks[0][0]["identifier"] == "id1"  # pyright: ignore[reportTypedDictNotRequiredAccess]
        assert chunks[0][1]["identifier"] == "id2"  # pyright: ignore[reportTypedDictNotRequiredAccess]

    def test_invalid_score_type(self) -> None:
        """Test chunking with invalid score type."""
        df = pd.DataFrame(
            {
                "name": ["test1"],
                "annotator_kind": ["HUMAN"],
                "span_id": ["id1"],
                "label": ["label1"],
                "score": ["not_a_number"],
            }
        )
        with pytest.raises(
            ValueError,
            match="Error processing row 0: Score value 'not_a_number' cannot be converted to float",
        ):
            list(_chunk_dataframe(dataframe=df))

    def test_chunk_with_context_span_id(self) -> None:
        """Test chunking with context.span_id column."""
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "context.span_id": ["id1", "id2"],
                "label": ["label1", "label2"],
            }
        )
        chunks = list(_chunk_dataframe(dataframe=df))
        assert len(chunks) == 1
        assert chunks[0][0]["span_id"] == "id1"
        assert chunks[0][1]["span_id"] == "id2"

    def test_chunk_with_both_span_id_columns(self) -> None:
        """Test chunking with both span_id and context.span_id columns."""
        df = pd.DataFrame(
            {
                "name": ["test1", "test2"],
                "annotator_kind": ["HUMAN", "HUMAN"],
                "span_id": ["id1", "id2"],
                "context.span_id": ["id1", "id2"],
                "label": ["label1", "label2"],
            }
        )
        with pytest.raises(
            ValueError, match="DataFrame cannot have both 'span_id' and 'context.span_id' columns"
        ):
            list(_chunk_dataframe(dataframe=df))
