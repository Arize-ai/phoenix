"""Unit tests for phoenix.client.resources.datasets module."""

import gzip
from pathlib import Path
from unittest.mock import Mock, patch

import httpx
import pandas as pd
import pytest

from phoenix.client.resources.datasets import (
    AsyncDatasets,
    DatasetKeys,
    Datasets,
    DatasetUploadError,
    _get_csv_column_headers,
    _infer_keys,
    _is_all_dict,
    _parse_datetime,
    _prepare_csv,
)


class TestDatasetKeys:
    """Test DatasetKeys validation class."""

    def test_init_valid_keys(self):
        """Test creating DatasetKeys with valid non-overlapping keys."""
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d", "e"]),
        )
        assert keys.input == frozenset(["a", "b"])
        assert keys.output == frozenset(["c"])
        assert keys.metadata == frozenset(["d", "e"])

    def test_init_overlapping_input_output(self):
        """Test that overlapping input/output keys raise ValueError."""
        with pytest.raises(ValueError, match="Input and output keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a", "b"]),
                output_keys=frozenset(["b", "c"]),
                metadata_keys=frozenset(["d"]),
            )

    def test_init_overlapping_input_metadata(self):
        """Test that overlapping input/metadata keys raise ValueError."""
        with pytest.raises(ValueError, match="Input and metadata keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a", "b"]),
                output_keys=frozenset(["c"]),
                metadata_keys=frozenset(["a", "d"]),
            )

    def test_init_overlapping_output_metadata(self):
        """Test that overlapping output/metadata keys raise ValueError."""
        with pytest.raises(ValueError, match="Output and metadata keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a"]),
                output_keys=frozenset(["b", "c"]),
                metadata_keys=frozenset(["c", "d"]),
            )

    def test_check_differences_all_present(self):
        """Test check_differences when all keys are present."""
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d"]),
        )
        # Should not raise
        keys.check_differences(frozenset(["a", "b", "c", "d", "e"]))

    def test_check_differences_missing_keys(self):
        """Test check_differences when keys are missing."""
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d"]),
        )
        with pytest.raises(ValueError, match="Keys not found in available columns"):
            keys.check_differences(frozenset(["a", "c"]))

    def test_iter(self):
        """Test iterating over all keys."""
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d"]),
        )
        assert set(keys) == {"a", "b", "c", "d"}


class TestHelperFunctions:
    """Test helper functions."""

    def test_parse_datetime(self):
        """Test ISO datetime parsing."""
        dt_str = "2024-01-15T10:30:00"
        dt = _parse_datetime(dt_str)
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30

    def test_is_all_dict_true(self):
        """Test _is_all_dict with all dictionaries."""
        assert _is_all_dict([{"a": 1}, {"b": 2}, {}])

    def test_is_all_dict_false(self):
        """Test _is_all_dict with non-dictionaries."""
        assert not _is_all_dict([{"a": 1}, "not a dict", {"b": 2}])
        assert not _is_all_dict([{"a": 1}, None, {"b": 2}])
        assert not _is_all_dict([{"a": 1}, 123, {"b": 2}])

    def test_is_all_dict_empty(self):
        """Test _is_all_dict with empty list."""
        assert _is_all_dict([])

    def test_get_csv_column_headers_valid(self, tmp_path):
        """Test extracting headers from valid CSV."""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col2,col3\nval1,val2,val3\n")

        headers = _get_csv_column_headers(csv_file)
        assert headers == ("col1", "col2", "col3")

    def test_get_csv_column_headers_empty_file(self, tmp_path):
        """Test extracting headers from empty CSV."""
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("")

        with pytest.raises(ValueError, match="CSV file has no data rows"):
            _get_csv_column_headers(csv_file)

    def test_get_csv_column_headers_only_headers(self, tmp_path):
        """Test extracting headers from CSV with only headers."""
        csv_file = tmp_path / "headers_only.csv"
        csv_file.write_text("col1,col2,col3\n")

        with pytest.raises(ValueError, match="CSV file has no data rows"):
            _get_csv_column_headers(csv_file)

    def test_get_csv_column_headers_file_not_found(self):
        """Test extracting headers from non-existent file."""
        with pytest.raises(FileNotFoundError, match="File does not exist"):
            _get_csv_column_headers(Path("/non/existent/file.csv"))

    def test_infer_keys_with_response_column(self):
        """Test key inference with response column."""
        # Test with DataFrame - use real pandas since it's available in test environment
        df = pd.DataFrame(
            {"input1": [1, 2], "input2": [3, 4], "response": [5, 6], "metadata1": [7, 8]}
        )

        input_keys, output_keys, metadata_keys = _infer_keys(df)

        assert input_keys == ("input1", "input2")
        assert output_keys == ("response",)
        assert metadata_keys == ("metadata1",)

    def test_infer_keys_with_output_column(self, tmp_path):
        """Test key inference with output column."""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("feature1,feature2,output,extra\nval1,val2,val3,val4\n")

        input_keys, output_keys, metadata_keys = _infer_keys(csv_file)

        assert input_keys == ("feature1", "feature2")
        assert output_keys == ("output",)
        assert metadata_keys == ("extra",)

    def test_infer_keys_with_answer_column(self, tmp_path):
        """Test key inference with answer column."""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("q1,q2,answer\nval1,val2,val3\n")

        input_keys, output_keys, metadata_keys = _infer_keys(csv_file)

        assert input_keys == ("q1", "q2")
        assert output_keys == ("answer",)
        assert metadata_keys == ()

    def test_infer_keys_no_output_column(self, tmp_path):
        """Test key inference without output column."""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col2,col3\nval1,val2,val3\n")

        input_keys, output_keys, metadata_keys = _infer_keys(csv_file)

        assert input_keys == ("col1", "col2", "col3")
        assert output_keys == ()
        assert metadata_keys == ()

    def test_prepare_csv_valid(self, tmp_path):
        """Test preparing CSV file for upload."""
        csv_file = tmp_path / "test.csv"
        csv_content = "input1,input2,output,metadata1\nval1,val2,val3,val4\n"
        csv_file.write_text(csv_content)

        keys = DatasetKeys(
            input_keys=frozenset(["input1", "input2"]),
            output_keys=frozenset(["output"]),
            metadata_keys=frozenset(["metadata1"]),
        )

        name, file_obj, content_type, headers = _prepare_csv(csv_file, keys)

        assert name == "test.csv"
        assert content_type == "text/csv"
        assert headers == {"Content-Encoding": "gzip"}

        # Verify content is gzipped
        file_obj.seek(0)
        decompressed = gzip.decompress(file_obj.read()).decode()
        assert decompressed == csv_content

    def test_prepare_csv_duplicate_headers(self, tmp_path):
        """Test preparing CSV with duplicate headers."""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col1,col2\nval1,val2,val3\n")

        keys = DatasetKeys(
            input_keys=frozenset(["col1", "col2"]),
            output_keys=frozenset(),
            metadata_keys=frozenset(),
        )

        with pytest.raises(ValueError, match="Duplicate column headers in CSV"):
            _prepare_csv(csv_file, keys)

    def test_prepare_csv_missing_keys(self, tmp_path):
        """Test preparing CSV with missing keys."""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col2\nval1,val2\n")

        keys = DatasetKeys(
            input_keys=frozenset(["col1", "col3"]),  # col3 doesn't exist
            output_keys=frozenset(),
            metadata_keys=frozenset(),
        )

        with pytest.raises(ValueError, match="Keys not found in available columns"):
            _prepare_csv(csv_file, keys)

    @pytest.mark.skipif(True, reason="Requires pandas - would be tested in integration tests")
    def test_prepare_dataframe_as_json(self):
        """Test preparing DataFrame for upload as JSON."""
        # This would require pandas, so we skip in unit tests
        pass


class TestDatasets:
    """Test Datasets client class."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock httpx client."""
        return Mock(spec=httpx.Client)

    @pytest.fixture
    def datasets(self, mock_client):
        """Create Datasets instance with mock client."""
        return Datasets(mock_client)

    def test_get_dataset_by_id(self, datasets, mock_client):
        """Test getting dataset by ID."""
        # Mock responses
        dataset_info = {
            "id": "dataset123",
            "name": "Test Dataset",
            "description": "A test dataset",
            "metadata": {"key": "value"},
            "created_at": "2024-01-15T10:00:00",
            "updated_at": "2024-01-15T10:00:00",
            "example_count": 5,
        }

        examples_data = {
            "dataset_id": "dataset123",
            "version_id": "version456",
            "examples": [
                {
                    "id": "ex1",
                    "input": {"text": "hello"},
                    "output": {"response": "hi"},
                    "metadata": {"source": "test"},
                    "updated_at": "2024-01-15T10:00:00",
                }
            ],
        }

        # Setup mock responses
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        # Call method
        dataset, examples = datasets.get_dataset(dataset_id="dataset123")

        # Verify calls
        assert mock_client.get.call_count == 2
        mock_client.get.assert_any_call(
            url="v1/datasets/dataset123", headers={"accept": "application/json"}, timeout=5
        )
        mock_client.get.assert_any_call(
            url="v1/datasets/dataset123/examples",
            params=None,
            headers={"accept": "application/json"},
            timeout=5,
        )

        # Verify response
        assert dataset == dataset_info
        assert examples == examples_data

    def test_get_dataset_by_name(self, datasets, mock_client):
        """Test getting dataset by name."""
        # Mock name lookup response
        name_lookup_response = Mock()
        name_lookup_response.json.return_value = {
            "data": [{"id": "dataset123", "name": "Test Dataset"}]
        }
        name_lookup_response.raise_for_status.return_value = None

        # Mock dataset responses
        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "examples": []}

        mock_client.get.side_effect = [
            name_lookup_response,
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        # Call method
        dataset, examples = datasets.get_dataset(dataset_name="Test Dataset")

        # Verify name lookup was called
        mock_client.get.assert_any_call(
            url="v1/datasets",
            params={"name": "Test Dataset"},
            headers={"accept": "application/json"},
            timeout=5,
        )

    def test_get_dataset_no_id_or_name(self, datasets):
        """Test get_dataset raises when neither ID nor name provided."""
        with pytest.raises(ValueError, match="Dataset id or name must be provided"):
            datasets.get_dataset()

    def test_get_dataset_versions_dataframe(self, datasets, mock_client):
        """Test getting dataset versions as DataFrame."""
        # Mock response
        versions_data = [
            {
                "version_id": "v1",
                "description": "Version 1",
                "metadata": {},
                "created_at": "2024-01-15T10:00:00",
            },
            {
                "version_id": "v2",
                "description": "Version 2",
                "metadata": {},
                "created_at": "2024-01-16T10:00:00",
            },
        ]

        mock_response = Mock()
        mock_response.json.return_value = {"data": versions_data}
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        # Call method - pandas is available in test environment
        result = datasets.get_dataset_versions_dataframe(dataset_id="dataset123")

        # Verify call
        mock_client.get.assert_called_once_with(
            url="v1/datasets/dataset123/versions",
            params={"limit": 100},
            headers={"accept": "application/json"},
            timeout=5,
        )

        # Verify we got a DataFrame back
        assert hasattr(result, "index")  # Basic DataFrame check
        assert len(result) == 2  # Should have 2 records

    def test_get_dataset_versions_dataframe_no_pandas(self, datasets, mock_client):
        """Test get_dataset_versions_dataframe raises when pandas not installed."""

        # Mock the import to raise ImportError
        def mock_import(name, *args, **kwargs):
            if name == "pandas":
                raise ImportError("No module named 'pandas'")
            # Fall back to the real import for other modules
            return __import__(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            with pytest.raises(ImportError, match="pandas is required"):
                datasets.get_dataset_versions_dataframe(dataset_id="dataset123")

    def test_create_dataset_json(self, datasets, mock_client):
        """Test creating dataset with JSON data."""
        # Mock upload response
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        # Mock get dataset response
        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        # Call method
        inputs = [{"text": "hello"}, {"text": "world"}]
        outputs = [{"response": "hi"}, {"response": "earth"}]

        dataset, examples = datasets.create_dataset(
            dataset_name="Test Dataset",
            inputs=inputs,
            outputs=outputs,
            dataset_description="Test description",
        )

        # Verify upload call
        mock_client.post.assert_called_once_with(
            url="v1/datasets/upload",
            json={
                "action": "create",
                "name": "Test Dataset",
                "inputs": inputs,
                "outputs": outputs,
                "metadata": [{}, {}],
                "description": "Test description",
            },
            params={"sync": True},
            headers={"accept": "application/json"},
            timeout=5,
        )

    def test_create_dataset_csv(self, datasets, mock_client, tmp_path):
        """Test creating dataset with CSV file."""
        # Create test CSV
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("input_col,output_col\nval1,result1\nval2,result2\n")

        # Mock responses
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        # Call method
        dataset, examples = datasets.create_dataset(
            dataset_name="Test Dataset",
            csv_file_path=csv_file,
            input_keys=["input_col"],
            output_keys=["output_col"],
        )

        # Verify upload call
        assert mock_client.post.call_count == 1
        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["url"] == "v1/datasets/upload"
        assert call_kwargs["params"] == {"sync": True}
        assert "file" in call_kwargs["files"]
        assert call_kwargs["data"]["name"] == "Test Dataset"
        assert set(call_kwargs["data"]["input_keys[]"]) == {"input_col"}
        assert set(call_kwargs["data"]["output_keys[]"]) == {"output_col"}

    def test_create_dataset_invalid_params(self, datasets):
        """Test create_dataset with invalid parameter combinations."""
        # Both dataframe and csv_file_path
        with pytest.raises(ValueError, match="Please provide either dataframe or csv_file_path"):
            datasets.create_dataset(dataset_name="Test", dataframe=Mock(), csv_file_path="test.csv")

        # Both tabular and JSON data
        with pytest.raises(ValueError, match="Please provide either tabular data"):
            datasets.create_dataset(
                dataset_name="Test", csv_file_path="test.csv", inputs=[{"a": 1}]
            )

    def test_add_examples_to_dataset(self, datasets, mock_client):
        """Test adding examples to existing dataset."""
        # Mock responses
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        # Call method
        inputs = [{"text": "new"}]

        dataset, examples = datasets.add_examples_to_dataset(
            dataset_name="Test Dataset", inputs=inputs
        )

        # Verify append action
        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "append"
        assert call_kwargs["json"]["name"] == "Test Dataset"

    def test_get_dataset_id_by_name_found(self, datasets, mock_client):
        """Test _get_dataset_id_by_name when dataset is found."""
        mock_response = Mock()
        mock_response.json.return_value = {"data": [{"id": "dataset123", "name": "Test Dataset"}]}
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        dataset_id = datasets._get_dataset_id_by_name(dataset_name="Test Dataset")

        assert dataset_id == "dataset123"
        mock_client.get.assert_called_once_with(
            url="v1/datasets",
            params={"name": "Test Dataset"},
            headers={"accept": "application/json"},
            timeout=5,
        )

    def test_get_dataset_id_by_name_not_found(self, datasets, mock_client):
        """Test _get_dataset_id_by_name when dataset not found."""
        mock_response = Mock()
        mock_response.json.return_value = {"data": []}
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        with pytest.raises(ValueError, match="Dataset not found"):
            datasets._get_dataset_id_by_name(dataset_name="Nonexistent")

    def test_get_dataset_id_by_name_multiple_found(self, datasets, mock_client):
        """Test _get_dataset_id_by_name when multiple datasets found."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [{"id": "dataset1", "name": "Test"}, {"id": "dataset2", "name": "Test"}]
        }
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        with pytest.raises(ValueError, match="Multiple datasets found"):
            datasets._get_dataset_id_by_name(dataset_name="Test")

    def test_upload_json_dataset_validation(self, datasets, mock_client):
        """Test _upload_json_dataset validation."""
        # Empty inputs
        with pytest.raises(ValueError, match="inputs must be non-empty"):
            datasets._upload_json_dataset(dataset_name="Test", inputs=[])

        # Non-dict inputs
        with pytest.raises(ValueError, match="inputs must contain only dictionaries"):
            datasets._upload_json_dataset(dataset_name="Test", inputs=["not", "dicts"])

        # Length mismatch
        with pytest.raises(ValueError, match="outputs must have same length as inputs"):
            datasets._upload_json_dataset(
                dataset_name="Test",
                inputs=[{"a": 1}, {"b": 2}],
                outputs=[{"c": 3}],  # Only 1 output for 2 inputs
            )

        # Non-dict outputs
        with pytest.raises(ValueError, match="outputs must contain only dictionaries"):
            datasets._upload_json_dataset(
                dataset_name="Test", inputs=[{"a": 1}], outputs=["not dict"]
            )

    def test_process_dataset_upload_response_error(self, datasets, mock_client):
        """Test _process_dataset_upload_response with error response."""
        error_response = Mock(spec=httpx.Response)
        error_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Bad Request", request=Mock(), response=error_response
        )
        error_response.json.return_value = {"detail": "Invalid dataset name"}

        with pytest.raises(DatasetUploadError, match="Dataset upload failed: Invalid dataset name"):
            datasets._process_dataset_upload_response(error_response)


class TestAsyncDatasets:
    """Test AsyncDatasets client class."""

    @pytest.fixture
    def mock_async_client(self):
        """Create a mock async httpx client."""
        return Mock(spec=httpx.AsyncClient)

    @pytest.fixture
    def async_datasets(self, mock_async_client):
        """Create AsyncDatasets instance with mock client."""
        return AsyncDatasets(mock_async_client)

    @pytest.mark.asyncio
    async def test_get_dataset_async(self, async_datasets, mock_async_client):
        """Test async get_dataset."""
        # Mock responses
        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "examples": []}

        # Create async mock responses
        dataset_response = Mock()
        dataset_response.json.return_value = {"data": dataset_info}
        dataset_response.raise_for_status.return_value = None

        examples_response = Mock()
        examples_response.json.return_value = {"data": examples_data}
        examples_response.raise_for_status.return_value = None

        # Configure async mock
        async def async_get(*args, **kwargs):
            if "examples" in kwargs.get("url", ""):
                return examples_response
            return dataset_response

        mock_async_client.get.side_effect = async_get

        # Call method
        dataset, examples = await async_datasets.get_dataset(dataset_id="dataset123")

        # Verify response
        assert dataset == dataset_info
        assert examples == examples_data

    @pytest.mark.asyncio
    async def test_create_dataset_async(self, async_datasets, mock_async_client):
        """Test async create_dataset."""
        # Mock upload response
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        # Mock get responses
        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "examples": []}

        async def async_post(*args, **kwargs):
            return upload_response

        async def async_get(*args, **kwargs):
            if "examples" in kwargs.get("url", ""):
                response = Mock()
                response.json.return_value = {"data": examples_data}
                response.raise_for_status.return_value = None
                return response
            response = Mock()
            response.json.return_value = {"data": dataset_info}
            response.raise_for_status.return_value = None
            return response

        mock_async_client.post.side_effect = async_post
        mock_async_client.get.side_effect = async_get

        # Call method
        dataset, examples = await async_datasets.create_dataset(
            dataset_name="Test Dataset", inputs=[{"text": "hello"}]
        )

        # Verify response
        assert dataset == dataset_info
        assert examples == examples_data


class TestDatasetUploadError:
    """Test custom exception class."""

    def test_exception_message(self):
        """Test DatasetUploadError with message."""
        error = DatasetUploadError("Upload failed")
        assert str(error) == "Upload failed"
