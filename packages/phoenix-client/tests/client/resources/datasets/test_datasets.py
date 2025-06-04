import gzip
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.datasets import (
    Dataset,
    DatasetKeys,
    DatasetUploadError,
    _get_csv_column_headers,
    _infer_keys,
    _is_all_dict,
    _is_valid_dataset_example,
    _parse_datetime,
    _prepare_csv,
    _prepare_dataframe_as_json,
)


class TestDataset:
    @pytest.fixture
    def dataset_info(self):
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
    def examples_data(self):
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

    def test_properties(self, dataset_info, examples_data):
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

    def test_sequence_operations(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)

        assert len(dataset) == 2
        assert dataset[0]["id"] == "ex1"
        assert dataset[1]["id"] == "ex2"

        examples = list(dataset)
        assert len(examples) == 2
        assert all(isinstance(ex, dict) for ex in examples)

    def test_to_dataframe(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)
        df = dataset.to_dataframe()

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2
        assert list(df.columns) == ["input", "output", "metadata"]
        assert df.index.name == "example_id"
        assert list(df.index) == ["ex1", "ex2"]

    def test_to_dataframe_no_pandas(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)

        with patch("builtins.__import__", side_effect=ImportError("No pandas")):
            with pytest.raises(ImportError, match="pandas is required"):
                dataset.to_dataframe()

    def test_repr(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)
        repr_str = repr(dataset)
        assert "Dataset(" in repr_str
        assert "id='dataset123'" in repr_str
        assert "name='Test Dataset'" in repr_str


class TestDatasetKeys:
    def test_valid_keys(self):
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d", "e"]),
        )
        assert keys.input == frozenset(["a", "b"])
        assert keys.output == frozenset(["c"])
        assert keys.metadata == frozenset(["d", "e"])
        assert set(keys) == {"a", "b", "c", "d", "e"}

    def test_overlapping_keys_validation(self):
        with pytest.raises(ValueError, match="Input and output keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a", "b"]),
                output_keys=frozenset(["b", "c"]),
                metadata_keys=frozenset(["d"]),
            )

    def test_check_differences(self):
        keys = DatasetKeys(
            input_keys=frozenset(["a"]),
            output_keys=frozenset(["b"]),
            metadata_keys=frozenset(["c"]),
        )

        keys.check_differences(frozenset(["a", "b", "c", "d"]))

        with pytest.raises(ValueError, match="Keys not found"):
            keys.check_differences(frozenset(["a", "b"]))


class TestHelperFunctions:
    def test_parse_datetime(self):
        dt = _parse_datetime("2024-01-15T10:30:00")
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30

    def test_is_all_dict(self):
        assert _is_all_dict([{"a": 1}, {"b": 2}])
        assert not _is_all_dict([{"a": 1}, "not a dict"])
        assert _is_all_dict([])

    def test_is_valid_dataset_example(self):
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

    def test_get_csv_column_headers(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col2,col3\nval1,val2,val3\n")

        headers = _get_csv_column_headers(csv_file)
        assert headers == ("col1", "col2", "col3")

    def test_get_csv_column_headers_errors(self, tmp_path):
        empty_file = tmp_path / "empty.csv"
        empty_file.write_text("")

        with pytest.raises(ValueError, match="CSV file has no data rows"):
            _get_csv_column_headers(empty_file)

        with pytest.raises(FileNotFoundError):
            _get_csv_column_headers(Path("/non/existent/file.csv"))

    def test_infer_keys(self, tmp_path):
        df = pd.DataFrame(
            {"input1": [1, 2], "input2": [3, 4], "response": [5, 6], "metadata1": [7, 8]}
        )

        input_keys, output_keys, metadata_keys = _infer_keys(df)

        assert input_keys == ("input1", "input2")
        assert output_keys == ("response",)
        assert metadata_keys == ("metadata1",)

        csv_file = tmp_path / "test.csv"
        csv_file.write_text("feature1,feature2,output,extra\nval1,val2,val3,val4\n")

        input_keys, output_keys, metadata_keys = _infer_keys(csv_file)

        assert input_keys == ("feature1", "feature2")
        assert output_keys == ("output",)
        assert metadata_keys == ("extra",)

    def test_prepare_csv(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_content = "input1,input2,output\nval1,val2,val3\n"
        csv_file.write_text(csv_content)

        keys = DatasetKeys(
            input_keys=frozenset(["input1", "input2"]),
            output_keys=frozenset(["output"]),
            metadata_keys=frozenset(),
        )

        name, file_obj, content_type, headers = _prepare_csv(csv_file, keys)

        assert name == "test.csv"
        assert content_type == "text/csv"
        assert headers == {"Content-Encoding": "gzip"}

        file_obj.seek(0)
        decompressed = gzip.decompress(file_obj.read()).decode()
        assert decompressed == csv_content

    def test_prepare_csv_validation(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col1,col2\nval1,val2,val3\n")

        keys = DatasetKeys(
            input_keys=frozenset(["col1"]),
            output_keys=frozenset(),
            metadata_keys=frozenset(),
        )

        with pytest.raises(ValueError, match="Duplicate column headers"):
            _prepare_csv(csv_file, keys)

    def test_prepare_dataframe_as_json(self):
        df = pd.DataFrame({"input": ["a", "b"], "output": ["x", "y"], "metadata": ["m1", "m2"]})

        keys = DatasetKeys(
            input_keys=frozenset(["input"]),
            output_keys=frozenset(["output"]),
            metadata_keys=frozenset(["metadata"]),
        )

        name, file_obj, content_type, headers = _prepare_dataframe_as_json(df, keys)

        assert name == "dataframe.csv"
        assert content_type == "text/csv"
        assert headers == {"Content-Encoding": "gzip"}

        file_obj.seek(0)
        decompressed = gzip.decompress(file_obj.read()).decode()
        assert "input,output,metadata" in decompressed  # CSV header
        assert "a,x,m1" in decompressed
        assert "b,y,m2" in decompressed

    def test_prepare_dataframe_validation(self):
        df = pd.DataFrame()
        keys = DatasetKeys(
            input_keys=frozenset(),
            output_keys=frozenset(),
            metadata_keys=frozenset(),
        )

        with pytest.raises(ValueError, match="DataFrame has no data"):
            _prepare_dataframe_as_json(df, keys)


class TestDatasetUploadError:
    def test_error_message(self):
        error = DatasetUploadError("Upload failed")
        assert str(error) == "Upload failed"
