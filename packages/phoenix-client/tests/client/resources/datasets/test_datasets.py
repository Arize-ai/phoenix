import gzip
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Any
from unittest.mock import Mock, mock_open, patch

import pandas as pd
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.datasets import (
    Dataset,
    DatasetKeys,
    DatasetUploadError,
    _get_csv_column_headers,  # pyright: ignore[reportPrivateUsage]
    _infer_keys,  # pyright: ignore[reportPrivateUsage]
    _is_all_dict,  # pyright: ignore[reportPrivateUsage]
    _is_valid_dataset_example,  # pyright: ignore[reportPrivateUsage]
    _parse_datetime,  # pyright: ignore[reportPrivateUsage]
    _prepare_csv,  # pyright: ignore[reportPrivateUsage]
    _prepare_dataframe_as_csv,  # pyright: ignore[reportPrivateUsage]
)


class TestDataset:
    @pytest.fixture
    def dataset_info(self) -> v1.DatasetWithExampleCount:
        return v1.DatasetWithExampleCount(
            id="dataset123",
            name="Test Dataset",
            description="A test dataset",
            metadata={"key": "value"},
            created_at="2024-01-15T10:00:00",
            updated_at="2024-01-15T11:00:00",
            example_count=2,
        )

    @pytest.fixture
    def examples_data(self) -> v1.ListDatasetExamplesData:
        return v1.ListDatasetExamplesData(
            dataset_id="dataset123",
            version_id="version456",
            examples=[
                v1.DatasetExample(
                    id="ex1",
                    input={"text": "hello"},
                    output={"response": "hi"},
                    metadata={"source": "test"},
                    updated_at="2024-01-15T10:00:00",
                ),
                v1.DatasetExample(
                    id="ex2",
                    input={"text": "world"},
                    output={"response": "earth"},
                    metadata={"source": "test"},
                    updated_at="2024-01-15T10:00:00",
                ),
            ],
        )

    def test_properties(self, dataset_info: Any, examples_data: Any) -> None:
        dataset = Dataset(dataset_info, examples_data)

        assert dataset.id == "dataset123"
        assert dataset.name == "Test Dataset"
        assert dataset.description == "A test dataset"
        assert dataset.version_id == "version456"
        assert len(dataset.examples) == 2
        assert dataset.metadata == {"key": "value"}
        assert dataset.example_count == 2
        assert isinstance(dataset.created_at, datetime)
        assert isinstance(dataset.updated_at, datetime)

    def test_sequence_operations(self, dataset_info: Any, examples_data: Any) -> None:
        dataset = Dataset(dataset_info, examples_data)

        assert len(dataset) == 2
        assert dataset[0]["id"] == "ex1"
        assert dataset[1]["id"] == "ex2"

        examples = list(dataset)
        assert len(examples) == 2
        assert all(isinstance(ex, dict) for ex in examples)

    def test_to_dataframe(self, dataset_info: Any, examples_data: Any) -> None:
        dataset = Dataset(dataset_info, examples_data)
        df = dataset.to_dataframe()

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2
        assert list(df.columns) == ["input", "output", "metadata"]
        assert df.index.name == "example_id"  # pyright: ignore[reportUnknownMemberType]
        assert list(df.index) == ["ex1", "ex2"]  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]

    def test_to_dataframe_no_pandas(self, dataset_info: Any, examples_data: Any) -> None:
        dataset = Dataset(dataset_info, examples_data)

        with patch("builtins.__import__", side_effect=ImportError("No pandas")):
            with pytest.raises(ImportError, match="pandas is required"):
                dataset.to_dataframe()

    def test_repr(self, dataset_info: Any, examples_data: Any) -> None:
        dataset = Dataset(dataset_info, examples_data)
        repr_str = repr(dataset)
        assert "Dataset(" in repr_str
        assert "id='dataset123'" in repr_str
        assert "name='Test Dataset'" in repr_str


class TestDatasetKeys:
    def test_valid_keys(self) -> None:
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d", "e"]),
        )
        assert keys.input == frozenset(["a", "b"])
        assert keys.output == frozenset(["c"])
        assert keys.metadata == frozenset(["d", "e"])
        assert set(keys) == {"a", "b", "c", "d", "e"}

    def test_overlapping_keys_validation(self) -> None:
        with pytest.raises(ValueError, match="Input and output keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a", "b"]),
                output_keys=frozenset(["b", "c"]),
                metadata_keys=frozenset(["d"]),
            )

    def test_check_differences(self) -> None:
        keys = DatasetKeys(
            input_keys=frozenset(["a"]),
            output_keys=frozenset(["b"]),
            metadata_keys=frozenset(["c"]),
        )

        keys.check_differences(frozenset(["a", "b", "c", "d"]))

        with pytest.raises(ValueError, match="Keys not found"):
            keys.check_differences(frozenset(["a", "b"]))


class TestHelperFunctions:
    def test_parse_datetime(self) -> None:
        dt = _parse_datetime("2024-01-15T10:30:00")
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30

    def test_is_all_dict(self) -> None:
        assert _is_all_dict([{"a": 1}, {"b": 2}])
        assert not _is_all_dict([{"a": 1}, "not a dict"])
        assert _is_all_dict([])

    def test_is_valid_dataset_example(self) -> None:
        valid_example = v1.DatasetExample(
            id="ex1",
            input={"text": "hello"},
            output={"response": "hi"},
            metadata={"source": "test"},
            updated_at="2024-01-15T10:00:00",
        )
        assert _is_valid_dataset_example(valid_example)
        assert not _is_valid_dataset_example({"incomplete": "dict"})
        assert not _is_valid_dataset_example("not a dict")

    def test_get_csv_column_headers(self) -> None:
        csv_content = "col1,col2,col3\nval1,val2,val3\n"

        mock_path = Mock(spec=Path)
        mock_path.resolve.return_value = mock_path
        mock_path.is_file.return_value = True

        with patch("builtins.open", mock_open(read_data=csv_content)):
            headers = _get_csv_column_headers(mock_path)
            assert headers == ("col1", "col2", "col3")

    def test_get_csv_column_headers_errors(self) -> None:
        # Test empty file
        mock_path = Mock(spec=Path)
        mock_path.resolve.return_value = mock_path
        mock_path.is_file.return_value = True

        with patch("builtins.open", mock_open(read_data="")):
            with pytest.raises(ValueError, match="CSV file has no data rows"):
                _get_csv_column_headers(mock_path)

        # Test file not found
        mock_path.is_file.return_value = False
        with pytest.raises(FileNotFoundError):
            _get_csv_column_headers(mock_path)

    def test_infer_keys(self) -> None:
        # Test with DataFrame
        df = pd.DataFrame(
            {"input1": [1, 2], "input2": [3, 4], "response": [5, 6], "metadata1": [7, 8]}
        )

        input_keys, output_keys, metadata_keys = _infer_keys(df)

        assert input_keys == ("input1", "input2")
        assert output_keys == ("response",)
        assert metadata_keys == ("metadata1",)

        # Test with mocked CSV file by patching _get_csv_column_headers
        expected_headers = ("feature1", "feature2", "output", "extra")

        with patch(
            "phoenix.client.resources.datasets._get_csv_column_headers",
            return_value=expected_headers,
        ):
            input_keys, output_keys, metadata_keys = _infer_keys("/fake/path.csv")

            assert input_keys == ("feature1", "feature2")
            assert output_keys == ("output",)
            assert metadata_keys == ("extra",)

    def test_prepare_csv(self) -> None:
        csv_content = "input1,input2,output\nval1,val2,val3\n"
        mock_path = Mock(spec=Path)
        mock_path.resolve.return_value = mock_path
        mock_path.is_file.return_value = True
        mock_path.name = "test.csv"

        keys = DatasetKeys(
            input_keys=frozenset(["input1", "input2"]),
            output_keys=frozenset(["output"]),
            metadata_keys=frozenset(),
        )

        # Mock both text and binary file operations
        with patch("builtins.open", mock_open(read_data=csv_content)) as mock_file:
            # Configure mock to return bytes when opened in binary mode
            mock_file.return_value.read.return_value = csv_content.encode()

            name, file_obj, content_type, headers = _prepare_csv(mock_path, keys)

            assert name == "test.csv"
            assert content_type == "text/csv"
            assert headers == {"Content-Encoding": "gzip"}

            file_obj.seek(0)
            decompressed = gzip.decompress(file_obj.read()).decode()
            assert decompressed == csv_content

    def test_prepare_csv_validation(self) -> None:
        csv_content = "col1,col1,col2\nval1,val2,val3\n"
        mock_path = Mock(spec=Path)
        mock_path.resolve.return_value = mock_path
        mock_path.is_file.return_value = True

        keys = DatasetKeys(
            input_keys=frozenset(["col1"]),
            output_keys=frozenset(),
            metadata_keys=frozenset(),
        )

        with patch("builtins.open", mock_open(read_data=csv_content)):
            with pytest.raises(ValueError, match="Duplicate column headers"):
                _prepare_csv(mock_path, keys)

    def test_prepare_dataframe_as_json(self) -> None:
        df = pd.DataFrame({"input": ["a", "b"], "output": ["x", "y"], "metadata": ["m1", "m2"]})

        keys = DatasetKeys(
            input_keys=frozenset(["input"]),
            output_keys=frozenset(["output"]),
            metadata_keys=frozenset(["metadata"]),
        )

        name, file_obj, content_type, headers = _prepare_dataframe_as_csv(df, keys)

        assert name == "dataframe.csv"
        assert content_type == "text/csv"
        assert headers == {"Content-Encoding": "gzip"}

        file_obj.seek(0)
        decompressed = gzip.decompress(file_obj.read()).decode()
        assert "input,output,metadata" in decompressed  # CSV header
        assert "a,x,m1" in decompressed
        assert "b,y,m2" in decompressed

    def test_prepare_dataframe_validation(self) -> None:
        df = pd.DataFrame()
        keys = DatasetKeys(
            input_keys=frozenset(),
            output_keys=frozenset(),
            metadata_keys=frozenset(),
        )

        with pytest.raises(ValueError, match="DataFrame has no data"):
            _prepare_dataframe_as_csv(df, keys)


class TestDatasetUploadError:
    def test_error_message(self) -> None:
        error = DatasetUploadError("Upload failed")
        assert str(error) == "Upload failed"


class TestCSVProcessing:
    def test_csv_parsing_with_various_formats(self) -> None:
        # Test basic CSV
        basic_csv = "input,output,metadata\nhello,hi,test\nworld,earth,demo"
        df_basic = pd.read_csv(StringIO(basic_csv))  # pyright: ignore[reportUnknownMemberType]
        input_keys, output_keys, metadata_keys = _infer_keys(df_basic)
        assert input_keys == ("input",)
        assert output_keys == ("output",)
        assert metadata_keys == ("metadata",)

        # Test CSV with quoted fields containing commas
        quoted_csv = (
            'question,answer,notes\n"What is 2+2?","4","simple math"\n"What is the capital of '
            'France?","Paris","geography, Europe"'
        )
        df_quoted = pd.read_csv(StringIO(quoted_csv))  # pyright: ignore[reportUnknownMemberType]
        input_keys, output_keys, metadata_keys = _infer_keys(df_quoted)
        assert input_keys == ("question",)
        assert output_keys == ("answer",)
        assert metadata_keys == ("notes",)
        # Verify quoted field was parsed correctly
        assert df_quoted.iloc[1]["notes"] == "geography, Europe"  # pyright: ignore[reportGeneralTypeIssues]

        # Test CSV with response column detection
        response_csv = (
            "feature1,feature2,response,extra\nval1,val2,resp1,meta1\nval3,val4,resp2,meta2"
        )
        df_response = pd.read_csv(StringIO(response_csv))  # pyright: ignore[reportUnknownMemberType]
        input_keys, output_keys, metadata_keys = _infer_keys(df_response)
        assert input_keys == ("feature1", "feature2")
        assert output_keys == ("response",)
        assert metadata_keys == ("extra",)

    def test_csv_key_inference_patterns(self) -> None:
        """Test different patterns for output column detection."""
        test_cases = [
            ("input1,input2,output", ("input1", "input2"), ("output",), ()),
            ("feat1,feat2,answer", ("feat1", "feat2"), ("answer",), ()),
            ("x,y,response,meta", ("x", "y"), ("response",), ("meta",)),
            ("a,outputs,b", ("a",), ("outputs",), ("b",)),
            ("col1,col2", ("col1", "col2"), (), ()),  # No output column
        ]

        for csv_header, expected_input, expected_output, expected_metadata in test_cases:
            csv_content = (
                csv_header + "\nval1,val2" + (",val3" if csv_header.count(",") == 2 else "")
            )
            df = pd.read_csv(StringIO(csv_content))  # pyright: ignore[reportUnknownMemberType]
            input_keys, output_keys, metadata_keys = _infer_keys(df)
            assert input_keys == expected_input, f"Failed for {csv_header}"
            assert output_keys == expected_output, f"Failed for {csv_header}"
            assert metadata_keys == expected_metadata, f"Failed for {csv_header}"

    def test_dataframe_to_csv_preparation(self) -> None:
        # Create a DataFrame with complex data
        df = pd.DataFrame(
            {
                "input_text": ["What is AI?", "Define ML"],
                "input_context": ["technology", "computer science"],
                "output_answer": ["Artificial Intelligence", "Machine Learning"],
                "metadata_source": ["wiki", "textbook"],
            }
        )

        keys = DatasetKeys(
            input_keys=frozenset(["input_text", "input_context"]),
            output_keys=frozenset(["output_answer"]),
            metadata_keys=frozenset(["metadata_source"]),
        )

        name, file_obj, content_type, headers = _prepare_dataframe_as_csv(df, keys)

        assert name == "dataframe.csv"
        assert content_type == "text/csv"
        assert headers == {"Content-Encoding": "gzip"}

        file_obj.seek(0)
        decompressed = gzip.decompress(file_obj.read()).decode()

        generated_df = pd.read_csv(StringIO(decompressed))  # pyright: ignore[reportUnknownMemberType]

        # Verify structure - columns should be sorted alphabetically within each group
        # (input keys sorted, output keys sorted, metadata keys sorted)
        expected_columns = [
            "input_context",
            "input_text",
            "output_answer",
            "metadata_source",
        ]
        assert list(generated_df.columns) == expected_columns
        assert len(generated_df) == 2

        assert generated_df.iloc[0]["input_text"] == "What is AI?"  # pyright: ignore[reportGeneralTypeIssues]
        assert generated_df.iloc[1]["output_answer"] == "Machine Learning"  # pyright: ignore[reportGeneralTypeIssues]

    def test_csv_validation_edge_cases(self) -> None:
        """Test validation of problematic CSV scenarios."""
        df_with_duplicate_cols = pd.DataFrame([[1, 2, 3]], columns=["col1", "col1", "col2"])
        assert list(df_with_duplicate_cols.columns) == ["col1", "col1", "col2"]

        keys = DatasetKeys(
            input_keys=frozenset(["col1"]),
            output_keys=frozenset(["col2"]),
            metadata_keys=frozenset(),
        )

        with pytest.raises(ValueError, match="Duplicate column names in DataFrame"):
            _prepare_dataframe_as_csv(df_with_duplicate_cols, keys)

        df = pd.DataFrame({"col1": [1], "col2": [2]})
        keys_with_missing = DatasetKeys(
            input_keys=frozenset(["col1", "missing_col"]),
            output_keys=frozenset(["col2"]),
            metadata_keys=frozenset(),
        )

        with pytest.raises(ValueError, match="Keys not found"):
            keys_with_missing.check_differences(frozenset(df.columns))
