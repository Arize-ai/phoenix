import gzip
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch

import httpx
import pandas as pd
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.datasets import (
    AsyncDatasets,
    Dataset,
    DatasetKeys,
    Datasets,
    DatasetUploadError,
    _get_csv_column_headers,
    _infer_keys,
    _is_all_dict,
    _parse_datetime,
    _prepare_csv,
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

    def test_init(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)
        assert dataset._dataset_info == dataset_info
        assert dataset._examples_data == examples_data

    def test_properties(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)

        assert dataset.id == "dataset123"
        assert dataset.name == "Test Dataset"
        assert dataset.description == "A test dataset"
        assert dataset.version_id == "version456"
        assert len(dataset.examples) == 2
        assert dataset.metadata == {"key": "value"}
        assert dataset.example_count == 2

    def test_datetime_properties(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)

        assert isinstance(dataset.created_at, datetime)
        assert dataset.created_at.year == 2024
        assert dataset.created_at.month == 1
        assert dataset.created_at.day == 15
        assert dataset.created_at.hour == 10

        assert isinstance(dataset.updated_at, datetime)
        assert dataset.updated_at.hour == 11

    def test_properties_missing_fields(self, examples_data):
        minimal_info = v1.Dataset(
            id="dataset123",
            name="Test Dataset",
            description=None,
            metadata={},
            created_at="2024-01-15T10:00:00",
            updated_at="2024-01-15T10:00:00",
        )
        dataset = Dataset(minimal_info, examples_data)

        assert dataset.description is None
        assert dataset.created_at is not None
        assert dataset.updated_at is not None
        assert dataset.metadata == {}

    def test_example_count_fallback(self, dataset_info, examples_data):
        dataset_info_no_count = v1.Dataset(
            id=dataset_info["id"],
            name=dataset_info["name"],
            description=dataset_info["description"],
            metadata=dataset_info["metadata"],
            created_at=dataset_info["created_at"],
            updated_at=dataset_info["updated_at"],
        )
        dataset = Dataset(dataset_info_no_count, examples_data)

        assert dataset.example_count == 2

    def test_len(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)
        assert len(dataset) == 2

    def test_iter(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)
        examples = list(dataset)
        assert len(examples) == 2
        assert examples[0]["id"] == "ex1"
        assert examples[1]["id"] == "ex2"

    def test_getitem(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)
        assert dataset[0]["id"] == "ex1"
        assert dataset[1]["id"] == "ex2"

    def test_repr(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)
        repr_str = repr(dataset)
        assert "Dataset(" in repr_str
        assert "id='dataset123'" in repr_str
        assert "name='Test Dataset'" in repr_str
        assert "version_id='version456'" in repr_str
        assert "examples=2" in repr_str

    def test_to_dataframe(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)

        import pandas as pd

        df = dataset.to_dataframe()

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2

        assert list(df.columns) == ["input", "output", "metadata"]

        assert df.index.name == "example_id"
        assert list(df.index) == ["ex1", "ex2"]

        assert df.loc["ex1", "input"] == {"text": "hello"}
        assert df.loc["ex1", "output"] == {"response": "hi"}
        assert df.loc["ex1", "metadata"] == {"source": "test"}

        assert df.loc["ex2", "input"] == {"text": "world"}
        assert df.loc["ex2", "output"] == {"response": "earth"}
        assert df.loc["ex2", "metadata"] == {"source": "test"}

    def test_to_dataframe_empty(self, dataset_info):
        empty_examples_data = v1.ListDatasetExamplesData(
            dataset_id="dataset123", version_id="version456", examples=[]
        )
        dataset = Dataset(dataset_info, empty_examples_data)

        import pandas as pd

        df = dataset.to_dataframe()

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0
        assert list(df.columns) == ["input", "output", "metadata"]
        assert df.index.name == "example_id"

    def test_to_dataframe_no_pandas(self, dataset_info, examples_data):
        dataset = Dataset(dataset_info, examples_data)

        def mock_import(name, *args, **kwargs):
            if name == "pandas":
                raise ImportError("No module named 'pandas'")
            return __import__(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            with pytest.raises(ImportError, match="pandas is required to use to_dataframe"):
                dataset.to_dataframe()

    def test_to_dataframe_varied_keys(self, dataset_info):
        varied_examples_data = v1.ListDatasetExamplesData(
            dataset_id="dataset123",
            version_id="version456",
            examples=[
                v1.DatasetExample(
                    id="ex1",
                    input={"question": "What is 2+2?", "context": "math"},
                    output={"answer": "4", "confidence": 0.9},
                    metadata={"category": "arithmetic"},
                    updated_at="2024-01-15T10:00:00",
                ),
                v1.DatasetExample(
                    id="ex2",
                    input={"question": "What is the capital of France?"},
                    output={"answer": "Paris"},
                    metadata={"category": "geography", "difficulty": "easy"},
                    updated_at="2024-01-15T11:00:00",
                ),
            ],
        )
        dataset = Dataset(dataset_info, varied_examples_data)


        df = dataset.to_dataframe()

        assert list(df.columns) == ["input", "output", "metadata"]
        assert df.index.name == "example_id"

        assert df.loc["ex1", "input"] == {"question": "What is 2+2?", "context": "math"}
        assert df.loc["ex1", "output"] == {"answer": "4", "confidence": 0.9}
        assert df.loc["ex1", "metadata"] == {"category": "arithmetic"}

        assert df.loc["ex2", "input"] == {"question": "What is the capital of France?"}
        assert df.loc["ex2", "output"] == {"answer": "Paris"}
        assert df.loc["ex2", "metadata"] == {"category": "geography", "difficulty": "easy"}


class TestDatasetKeys:
    def test_init_valid_keys(self):
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d", "e"]),
        )
        assert keys.input == frozenset(["a", "b"])
        assert keys.output == frozenset(["c"])
        assert keys.metadata == frozenset(["d", "e"])

    def test_init_overlapping_input_output(self):
        with pytest.raises(ValueError, match="Input and output keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a", "b"]),
                output_keys=frozenset(["b", "c"]),
                metadata_keys=frozenset(["d"]),
            )

    def test_init_overlapping_input_metadata(self):
        with pytest.raises(ValueError, match="Input and metadata keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a", "b"]),
                output_keys=frozenset(["c"]),
                metadata_keys=frozenset(["a", "d"]),
            )

    def test_init_overlapping_output_metadata(self):
        with pytest.raises(ValueError, match="Output and metadata keys overlap"):
            DatasetKeys(
                input_keys=frozenset(["a"]),
                output_keys=frozenset(["b", "c"]),
                metadata_keys=frozenset(["c", "d"]),
            )

    def test_check_differences_all_present(self):
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d"]),
        )
        keys.check_differences(frozenset(["a", "b", "c", "d", "e"]))

    def test_check_differences_missing_keys(self):
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d"]),
        )
        with pytest.raises(ValueError, match="Keys not found in available columns"):
            keys.check_differences(frozenset(["a", "c"]))

    def test_iter(self):
        keys = DatasetKeys(
            input_keys=frozenset(["a", "b"]),
            output_keys=frozenset(["c"]),
            metadata_keys=frozenset(["d"]),
        )
        assert set(keys) == {"a", "b", "c", "d"}


class TestHelperFunctions:
    def test_parse_datetime(self):
        dt_str = "2024-01-15T10:30:00"
        dt = _parse_datetime(dt_str)
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30

    def test_is_all_dict_true(self):
        assert _is_all_dict([{"a": 1}, {"b": 2}, {}])

    def test_is_all_dict_false(self):
        assert not _is_all_dict([{"a": 1}, "not a dict", {"b": 2}])
        assert not _is_all_dict([{"a": 1}, None, {"b": 2}])
        assert not _is_all_dict([{"a": 1}, 123, {"b": 2}])

    def test_is_all_dict_empty(self):
        assert _is_all_dict([])

    def test_get_csv_column_headers_valid(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col2,col3\nval1,val2,val3\n")

        headers = _get_csv_column_headers(csv_file)
        assert headers == ("col1", "col2", "col3")

    def test_get_csv_column_headers_empty_file(self, tmp_path):
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("")

        with pytest.raises(ValueError, match="CSV file has no data rows"):
            _get_csv_column_headers(csv_file)

    def test_get_csv_column_headers_only_headers(self, tmp_path):
        csv_file = tmp_path / "headers_only.csv"
        csv_file.write_text("col1,col2,col3\n")

        with pytest.raises(ValueError, match="CSV file has no data rows"):
            _get_csv_column_headers(csv_file)

    def test_get_csv_column_headers_file_not_found(self):
        with pytest.raises(FileNotFoundError, match="File does not exist"):
            _get_csv_column_headers(Path("/non/existent/file.csv"))

    def test_infer_keys_with_response_column(self):
        df = pd.DataFrame(
            {"input1": [1, 2], "input2": [3, 4], "response": [5, 6], "metadata1": [7, 8]}
        )

        input_keys, output_keys, metadata_keys = _infer_keys(df)

        assert input_keys == ("input1", "input2")
        assert output_keys == ("response",)
        assert metadata_keys == ("metadata1",)

    def test_infer_keys_with_output_column(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("feature1,feature2,output,extra\nval1,val2,val3,val4\n")

        input_keys, output_keys, metadata_keys = _infer_keys(csv_file)

        assert input_keys == ("feature1", "feature2")
        assert output_keys == ("output",)
        assert metadata_keys == ("extra",)

    def test_infer_keys_with_answer_column(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("q1,q2,answer\nval1,val2,val3\n")

        input_keys, output_keys, metadata_keys = _infer_keys(csv_file)

        assert input_keys == ("q1", "q2")
        assert output_keys == ("answer",)
        assert metadata_keys == ()

    def test_infer_keys_no_output_column(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("col1,col2,col3\nval1,val2,val3\n")

        input_keys, output_keys, metadata_keys = _infer_keys(csv_file)

        assert input_keys == ("col1", "col2", "col3")
        assert output_keys == ()
        assert metadata_keys == ()

    def test_prepare_csv_valid(self, tmp_path):
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

        file_obj.seek(0)
        decompressed = gzip.decompress(file_obj.read()).decode()
        assert decompressed == csv_content

    def test_prepare_csv_duplicate_headers(self, tmp_path):
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
        pass


class TestDatasets:
    @pytest.fixture
    def mock_client(self):
        return Mock(spec=httpx.Client)

    @pytest.fixture
    def datasets(self, mock_client):
        return Datasets(mock_client)

    def test_get_dataset_by_id(self, datasets, mock_client):
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

        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        dataset = datasets.get_dataset(dataset_id="dataset123")

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

        assert isinstance(dataset, Dataset)
        assert dataset.id == "dataset123"
        assert dataset.name == "Test Dataset"
        assert dataset.version_id == "version456"
        assert len(dataset.examples) == 1

    def test_get_dataset_by_name(self, datasets, mock_client):
        name_lookup_response = Mock()
        name_lookup_response.json.return_value = {
            "data": [{"id": "dataset123", "name": "Test Dataset"}]
        }
        name_lookup_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "v1", "examples": []}

        mock_client.get.side_effect = [
            name_lookup_response,
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        dataset = datasets.get_dataset(dataset_name="Test Dataset")

        mock_client.get.assert_any_call(
            url="v1/datasets",
            params={"name": "Test Dataset"},
            headers={"accept": "application/json"},
            timeout=5,
        )

        assert isinstance(dataset, Dataset)
        assert dataset.name == "Test Dataset"

    def test_get_dataset_with_dataset_object(self, datasets, mock_client):
        existing_dataset = Mock(spec=Dataset)
        existing_dataset.id = "dataset123"
        existing_dataset.name = "Test Dataset"

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "v1", "examples": []}

        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        datasets.get_dataset(dataset=existing_dataset)

        mock_client.get.assert_any_call(
            url="v1/datasets/dataset123", headers={"accept": "application/json"}, timeout=5
        )

    def test_get_dataset_no_identifier(self, datasets):
        with pytest.raises(
            ValueError, match="Dataset id, name, or dataset object must be provided"
        ):
            datasets.get_dataset()

    def test_get_dataset_versions_with_dataset_object(self, datasets, mock_client):
        dataset_obj = Mock(spec=Dataset)
        dataset_obj.id = "dataset123"
        dataset_obj.name = "Test Dataset"

        versions_data = [
            {
                "version_id": "v1",
                "description": "Version 1",
                "metadata": {},
                "created_at": "2024-01-15T10:00:00",
            }
        ]

        mock_response = Mock()
        mock_response.json.return_value = {"data": versions_data}
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        result = datasets.get_dataset_versions(dataset=dataset_obj)

        mock_client.get.assert_called_once_with(
            url="v1/datasets/dataset123/versions",
            params={"limit": 100},
            headers={"accept": "application/json"},
            timeout=5,
        )

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["version_id"] == "v1"
        assert isinstance(result[0]["created_at"], datetime)

    def test_get_dataset_versions_with_name(self, datasets, mock_client):
        name_lookup_response = Mock()
        name_lookup_response.json.return_value = {
            "data": [{"id": "dataset123", "name": "Test Dataset"}]
        }
        name_lookup_response.raise_for_status.return_value = None

        versions_data = [{"version_id": "v1", "created_at": "2024-01-15T10:00:00"}]
        versions_response = Mock()
        versions_response.json.return_value = {"data": versions_data}
        versions_response.raise_for_status.return_value = None

        mock_client.get.side_effect = [name_lookup_response, versions_response]

        result = datasets.get_dataset_versions(dataset_name="Test Dataset")

        assert mock_client.get.call_count == 2
        mock_client.get.assert_any_call(
            url="v1/datasets",
            params={"name": "Test Dataset"},
            headers={"accept": "application/json"},
            timeout=5,
        )

        assert isinstance(result, list)
        assert len(result) == 1

    def test_get_dataset_versions(self, datasets, mock_client):
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

        result = datasets.get_dataset_versions(dataset_id="dataset123")

        mock_client.get.assert_called_once_with(
            url="v1/datasets/dataset123/versions",
            params={"limit": 100},
            headers={"accept": "application/json"},
            timeout=5,
        )

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["version_id"] == "v1"
        assert result[1]["version_id"] == "v2"
        assert all(isinstance(v["created_at"], datetime) for v in result)

    def test_get_dataset_versions_empty(self, datasets, mock_client):
        mock_response = Mock()
        mock_response.json.return_value = {"data": []}
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        result = datasets.get_dataset_versions(dataset_id="dataset123")

        assert result == []

    def test_create_dataset_json(self, datasets, mock_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version456", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        inputs = [{"text": "hello"}, {"text": "world"}]
        outputs = [{"response": "hi"}, {"response": "earth"}]

        dataset = datasets.create_dataset(
            dataset_name="Test Dataset",
            inputs=inputs,
            outputs=outputs,
            dataset_description="Test description",
        )

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

        assert isinstance(dataset, Dataset)
        assert dataset.id == "dataset123"
        assert dataset.name == "Test Dataset"

    def test_create_dataset_csv(self, datasets, mock_client, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("input_col,output_col\nval1,result1\nval2,result2\n")

        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version456", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        dataset = datasets.create_dataset(
            dataset_name="Test Dataset",
            csv_file_path=csv_file,
            input_keys=["input_col"],
            output_keys=["output_col"],
        )

        assert mock_client.post.call_count == 1
        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["url"] == "v1/datasets/upload"
        assert call_kwargs["params"] == {"sync": True}
        assert "file" in call_kwargs["files"]
        assert call_kwargs["data"]["name"] == "Test Dataset"
        assert set(call_kwargs["data"]["input_keys[]"]) == {"input_col"}
        assert set(call_kwargs["data"]["output_keys[]"]) == {"output_col"}

        assert isinstance(dataset, Dataset)

    def test_create_dataset_invalid_params(self, datasets):
        with pytest.raises(ValueError, match="Please provide either dataframe or csv_file_path"):
            datasets.create_dataset(dataset_name="Test", dataframe=Mock(), csv_file_path="test.csv")

        with pytest.raises(ValueError, match="Please provide only one of"):
            datasets.create_dataset(
                dataset_name="Test", csv_file_path="test.csv", inputs=[{"a": 1}]
            )

    def test_add_examples_to_dataset_with_name(self, datasets, mock_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version789", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        inputs = [{"text": "new"}]

        dataset = datasets.add_examples_to_dataset(dataset_name="Test Dataset", inputs=inputs)

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "append"
        assert call_kwargs["json"]["name"] == "Test Dataset"

        assert isinstance(dataset, Dataset)

    def test_add_examples_to_dataset_with_object(self, datasets, mock_client):
        existing_dataset = Mock(spec=Dataset)
        existing_dataset.id = "dataset123"
        existing_dataset.name = "Test Dataset"

        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version789", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        inputs = [{"text": "new"}]

        dataset = datasets.add_examples_to_dataset(dataset=existing_dataset, inputs=inputs)

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["name"] == "Test Dataset"

        assert isinstance(dataset, Dataset)

    def test_method_chaining_workflow(self, datasets, mock_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version456", "examples": []}

        versions_data = [{"version_id": "v1", "created_at": "2024-01-15T10:00:00"}]
        versions_response = Mock()
        versions_response.json.return_value = {"data": versions_data}
        versions_response.raise_for_status.return_value = None

        upload_response2 = Mock()
        upload_response2.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response2.raise_for_status.return_value = None

        updated_examples_data = {
            "dataset_id": "dataset123",
            "version_id": "version789",
            "examples": [],
        }

        mock_client.post.side_effect = [upload_response, upload_response2]
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
            versions_response,
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": updated_examples_data}, raise_for_status=lambda: None),
        ]

        dataset = datasets.create_dataset(
            dataset_name="Test Dataset", inputs=[{"text": "hello"}], outputs=[{"response": "hi"}]
        )

        versions = datasets.get_dataset_versions(dataset=dataset)

        updated_dataset = datasets.add_examples_to_dataset(
            dataset=dataset, inputs=[{"text": "world"}], outputs=[{"response": "earth"}]
        )

        assert isinstance(dataset, Dataset)
        assert isinstance(versions, list)
        assert len(versions) == 1
        assert isinstance(updated_dataset, Dataset)

        assert mock_client.get.call_count == 5

    def test_get_dataset_id_by_name_found(self, datasets, mock_client):
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
        mock_response = Mock()
        mock_response.json.return_value = {"data": []}
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        with pytest.raises(ValueError, match="Dataset not found"):
            datasets._get_dataset_id_by_name(dataset_name="Nonexistent")

    def test_get_dataset_id_by_name_multiple_found(self, datasets, mock_client):
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [{"id": "dataset1", "name": "Test"}, {"id": "dataset2", "name": "Test"}]
        }
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response

        with pytest.raises(ValueError, match="Multiple datasets found"):
            datasets._get_dataset_id_by_name(dataset_name="Test")

    def test_upload_json_dataset_validation(self, datasets, mock_client):
        with pytest.raises(ValueError, match="inputs must be non-empty"):
            datasets._upload_json_dataset(dataset_name="Test", inputs=[])

        with pytest.raises(ValueError, match="inputs must contain only dictionaries"):
            datasets._upload_json_dataset(dataset_name="Test", inputs=["not", "dicts"])

        with pytest.raises(ValueError, match="outputs must have same length as inputs"):
            datasets._upload_json_dataset(
                dataset_name="Test",
                inputs=[{"a": 1}, {"b": 2}],
                outputs=[{"c": 3}],
            )

        with pytest.raises(ValueError, match="outputs must contain only dictionaries"):
            datasets._upload_json_dataset(
                dataset_name="Test", inputs=[{"a": 1}], outputs=["not dict"]
            )

    def test_process_dataset_upload_response_error(self, datasets, mock_client):
        error_response = Mock(spec=httpx.Response)
        error_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Bad Request", request=Mock(), response=error_response
        )
        error_response.json.return_value = {"detail": "Invalid dataset name"}

        with pytest.raises(DatasetUploadError, match="Dataset upload failed: Invalid dataset name"):
            datasets._process_dataset_upload_response(error_response)

    def test_add_examples_to_dataset_with_single_example(self, datasets, mock_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version789", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        example = v1.DatasetExample(
            id="ex1",
            input={"text": "hello"},
            output={"response": "hi"},
            metadata={"source": "test"},
            updated_at="2024-01-15T10:00:00",
        )

        dataset = datasets.add_examples_to_dataset(dataset_name="Test Dataset", examples=example)

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "append"
        assert call_kwargs["json"]["inputs"] == [{"text": "hello"}]
        assert call_kwargs["json"]["outputs"] == [{"response": "hi"}]
        assert call_kwargs["json"]["metadata"] == [{"source": "test"}]
        assert isinstance(dataset, Dataset)

    def test_add_examples_to_dataset_with_multiple_examples(self, datasets, mock_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version789", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        examples = [
            v1.DatasetExample(
                id="ex1",
                input={"text": "hello"},
                output={"response": "hi"},
                metadata={"source": "test1"},
                updated_at="2024-01-15T10:00:00",
            ),
            v1.DatasetExample(
                id="ex2",
                input={"text": "world"},
                output={"response": "earth"},
                metadata={"source": "test2"},
                updated_at="2024-01-15T10:00:00",
            ),
        ]

        dataset = datasets.add_examples_to_dataset(dataset_name="Test Dataset", examples=examples)

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "append"
        assert call_kwargs["json"]["inputs"] == [{"text": "hello"}, {"text": "world"}]
        assert call_kwargs["json"]["outputs"] == [{"response": "hi"}, {"response": "earth"}]
        assert call_kwargs["json"]["metadata"] == [{"source": "test1"}, {"source": "test2"}]
        assert isinstance(dataset, Dataset)

    def test_create_dataset_with_single_example(self, datasets, mock_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version456", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        example = v1.DatasetExample(
            id="ex1",
            input={"text": "hello"},
            output={"response": "hi"},
            metadata={"source": "test"},
            updated_at="2024-01-15T10:00:00",
        )

        dataset = datasets.create_dataset(dataset_name="Test Dataset", examples=example)

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "create"
        assert call_kwargs["json"]["inputs"] == [{"text": "hello"}]
        assert call_kwargs["json"]["outputs"] == [{"response": "hi"}]
        assert call_kwargs["json"]["metadata"] == [{"source": "test"}]
        assert isinstance(dataset, Dataset)

    def test_create_dataset_with_multiple_examples(self, datasets, mock_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version456", "examples": []}

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": examples_data}, raise_for_status=lambda: None),
        ]

        examples = [
            v1.DatasetExample(
                id="ex1",
                input={"text": "hello"},
                output={"response": "hi"},
                metadata={"source": "test1"},
                updated_at="2024-01-15T10:00:00",
            ),
            v1.DatasetExample(
                id="ex2",
                input={"text": "world"},
                output={"response": "earth"},
                metadata={"source": "test2"},
                updated_at="2024-01-15T10:00:00",
            ),
        ]

        dataset = datasets.create_dataset(dataset_name="Test Dataset", examples=examples)

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "create"
        assert call_kwargs["json"]["inputs"] == [{"text": "hello"}, {"text": "world"}]
        assert call_kwargs["json"]["outputs"] == [{"response": "hi"}, {"response": "earth"}]
        assert call_kwargs["json"]["metadata"] == [{"source": "test1"}, {"source": "test2"}]
        assert isinstance(dataset, Dataset)

    def test_add_examples_to_dataset_validation_multiple_sources(self, datasets):
        example = v1.DatasetExample(
            id="ex1",
            input={"text": "hello"},
            output={"response": "hi"},
            metadata={"source": "test"},
            updated_at="2024-01-15T10:00:00",
        )

        with pytest.raises(ValueError, match="Please provide only one of: examples, tabular data"):
            datasets.add_examples_to_dataset(
                dataset_name="Test", examples=example, inputs=[{"text": "hello"}]
            )

        with pytest.raises(ValueError, match="Please provide only one of: examples, tabular data"):
            datasets.add_examples_to_dataset(
                dataset_name="Test", examples=example, csv_file_path="test.csv"
            )

    def test_create_dataset_validation_multiple_sources(self, datasets):
        example = v1.DatasetExample(
            id="ex1",
            input={"text": "hello"},
            output={"response": "hi"},
            metadata={"source": "test"},
            updated_at="2024-01-15T10:00:00",
        )

        with pytest.raises(ValueError, match="Please provide only one of: examples, tabular data"):
            datasets.create_dataset(
                dataset_name="Test", examples=example, inputs=[{"text": "hello"}]
            )

        with pytest.raises(ValueError, match="Please provide only one of: examples, tabular data"):
            datasets.create_dataset(dataset_name="Test", examples=example, csv_file_path="test.csv")

    def test_chaining_examples_from_dataset_to_dataset(self, datasets, mock_client):
        source_dataset_info = {
            "id": "source123",
            "name": "Source Dataset",
            "description": "Source dataset",
            "metadata": {},
            "created_at": "2024-01-15T10:00:00",
            "updated_at": "2024-01-15T10:00:00",
            "example_count": 2,
        }

        source_examples_data = {
            "dataset_id": "source123",
            "version_id": "source_v1",
            "examples": [
                {
                    "id": "ex1",
                    "input": {"text": "hello world"},
                    "output": {"response": "greetings"},
                    "metadata": {"category": "greeting"},
                    "updated_at": "2024-01-15T10:00:00",
                },
                {
                    "id": "ex2",
                    "input": {"text": "goodbye"},
                    "output": {"response": "farewell"},
                    "metadata": {"category": "farewell"},
                    "updated_at": "2024-01-15T10:00:00",
                },
            ],
        }

        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "target456", "version_id": "target_v1"}
        }
        upload_response.raise_for_status.return_value = None

        target_dataset_info = {"id": "target456", "name": "Target Dataset"}
        target_examples_data = {
            "dataset_id": "target456",
            "version_id": "target_v1",
            "examples": [],
        }

        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": source_dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": source_examples_data}, raise_for_status=lambda: None),
        ]
        mock_client.post.return_value = upload_response
        mock_client.get.side_effect.extend(
            [
                Mock(json=lambda: {"data": target_dataset_info}, raise_for_status=lambda: None),
                Mock(json=lambda: {"data": target_examples_data}, raise_for_status=lambda: None),
            ]
        )

        source_dataset = datasets.get_dataset(dataset_name="Source Dataset")

        first_example = source_dataset[0]

        target_dataset = datasets.add_examples_to_dataset(
            dataset_name="Target Dataset", examples=first_example
        )

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "append"
        assert call_kwargs["json"]["name"] == "Target Dataset"
        assert call_kwargs["json"]["inputs"] == [{"text": "hello world"}]
        assert call_kwargs["json"]["outputs"] == [{"response": "greetings"}]
        assert call_kwargs["json"]["metadata"] == [{"category": "greeting"}]

        assert isinstance(source_dataset, Dataset)
        assert isinstance(target_dataset, Dataset)
        assert len(source_dataset) == 2
        assert source_dataset[0]["input"]["text"] == "hello world"

    def test_chaining_multiple_examples_from_dataset_to_dataset(self, datasets, mock_client):
        source_dataset_info = {
            "id": "source123",
            "name": "Source Dataset",
            "description": "Source dataset",
            "metadata": {},
            "created_at": "2024-01-15T10:00:00",
            "updated_at": "2024-01-15T10:00:00",
            "example_count": 3,
        }

        source_examples_data = {
            "dataset_id": "source123",
            "version_id": "source_v1",
            "examples": [
                {
                    "id": "ex1",
                    "input": {"text": "first"},
                    "output": {"response": "1st"},
                    "metadata": {"order": 1},
                    "updated_at": "2024-01-15T10:00:00",
                },
                {
                    "id": "ex2",
                    "input": {"text": "second"},
                    "output": {"response": "2nd"},
                    "metadata": {"order": 2},
                    "updated_at": "2024-01-15T10:00:00",
                },
                {
                    "id": "ex3",
                    "input": {"text": "third"},
                    "output": {"response": "3rd"},
                    "metadata": {"order": 3},
                    "updated_at": "2024-01-15T10:00:00",
                },
            ],
        }

        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "target456", "version_id": "target_v1"}
        }
        upload_response.raise_for_status.return_value = None

        target_dataset_info = {"id": "target456", "name": "Target Dataset"}
        target_examples_data = {
            "dataset_id": "target456",
            "version_id": "target_v1",
            "examples": [],
        }

        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": source_dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": source_examples_data}, raise_for_status=lambda: None),
        ]
        mock_client.post.return_value = upload_response
        mock_client.get.side_effect.extend(
            [
                Mock(json=lambda: {"data": target_dataset_info}, raise_for_status=lambda: None),
                Mock(json=lambda: {"data": target_examples_data}, raise_for_status=lambda: None),
            ]
        )

        source_dataset = datasets.get_dataset(dataset_name="Source Dataset")

        first_two_examples = source_dataset.examples[:2]

        target_dataset = datasets.add_examples_to_dataset(
            dataset_name="Target Dataset", examples=first_two_examples
        )

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["json"]["action"] == "append"
        assert call_kwargs["json"]["inputs"] == [{"text": "first"}, {"text": "second"}]
        assert call_kwargs["json"]["outputs"] == [{"response": "1st"}, {"response": "2nd"}]
        assert call_kwargs["json"]["metadata"] == [{"order": 1}, {"order": 2}]

        assert isinstance(source_dataset, Dataset)
        assert isinstance(target_dataset, Dataset)
        assert len(source_dataset) == 3

    def test_add_examples_from_dataframe_dictionaries(self, datasets, mock_client):
        source_dataset_info = {
            "id": "source123",
            "name": "Source Dataset",
            "example_count": 2,
        }

        source_examples_data = {
            "dataset_id": "source123",
            "version_id": "source_v1",
            "examples": [
                {
                    "id": "ex1",
                    "input": {"question": "What is 2+2?", "context": "math"},
                    "output": {"answer": "4", "confidence": 0.9},
                    "metadata": {"category": "arithmetic"},
                    "updated_at": "2024-01-15T10:00:00",
                },
                {
                    "id": "ex2",
                    "input": {"question": "Capital of France?"},
                    "output": {"answer": "Paris"},
                    "metadata": {"category": "geography"},
                    "updated_at": "2024-01-15T10:30:00",
                },
            ],
        }

        name_lookup_response = Mock()
        name_lookup_response.json.return_value = {
            "data": [{"id": "source123", "name": "Source Dataset"}]
        }
        name_lookup_response.raise_for_status.return_value = None

        mock_client.get.side_effect = [
            name_lookup_response,
            Mock(json=lambda: {"data": source_dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": source_examples_data}, raise_for_status=lambda: None),
        ]

        source_dataset = datasets.get_dataset(dataset_name="Source Dataset")

        df = source_dataset.to_dataframe()

        inputs = df["input"].tolist()
        outputs = df["output"].tolist()
        metadata = df["metadata"].tolist()

        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "target456", "version_id": "target_v1"}
        }
        upload_response.raise_for_status.return_value = None

        target_dataset_info = {"id": "target456", "name": "Target Dataset"}
        target_examples_data = {
            "dataset_id": "target456",
            "version_id": "target_v1",
            "examples": [],
        }

        mock_client.post.return_value = upload_response
        mock_client.get.side_effect = [
            Mock(json=lambda: {"data": target_dataset_info}, raise_for_status=lambda: None),
            Mock(json=lambda: {"data": target_examples_data}, raise_for_status=lambda: None),
        ]

        target_dataset = datasets.add_examples_to_dataset(
            dataset_name="Target Dataset", inputs=inputs, outputs=outputs, metadata=metadata
        )

        call_kwargs = mock_client.post.call_args.kwargs
        assert call_kwargs["url"] == "v1/datasets/upload"
        assert call_kwargs["json"]["action"] == "append"
        assert call_kwargs["json"]["name"] == "Target Dataset"
        assert call_kwargs["json"]["inputs"] == inputs
        assert call_kwargs["json"]["outputs"] == outputs
        assert call_kwargs["json"]["metadata"] == metadata

        assert isinstance(target_dataset, Dataset)


class TestAsyncDatasets:
    @pytest.fixture
    def mock_async_client(self):
        return Mock(spec=httpx.AsyncClient)

    @pytest.fixture
    def async_datasets(self, mock_async_client):
        return AsyncDatasets(mock_async_client)

    @pytest.mark.asyncio
    async def test_get_dataset_async(self, async_datasets, mock_async_client):
        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "v1", "examples": []}

        dataset_response = Mock()
        dataset_response.json.return_value = {"data": dataset_info}
        dataset_response.raise_for_status.return_value = None

        examples_response = Mock()
        examples_response.json.return_value = {"data": examples_data}
        examples_response.raise_for_status.return_value = None

        async def async_get(*args, **kwargs):
            if "examples" in kwargs.get("url", ""):
                return examples_response
            return dataset_response

        mock_async_client.get.side_effect = async_get

        dataset = await async_datasets.get_dataset(dataset_id="dataset123")

        assert isinstance(dataset, Dataset)
        assert dataset.id == "dataset123"
        assert dataset.name == "Test Dataset"

    @pytest.mark.asyncio
    async def test_create_dataset_async(self, async_datasets, mock_async_client):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version456"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version456", "examples": []}

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

        dataset = await async_datasets.create_dataset(
            dataset_name="Test Dataset", inputs=[{"text": "hello"}]
        )

        assert isinstance(dataset, Dataset)
        assert dataset.id == "dataset123"
        assert dataset.name == "Test Dataset"

    @pytest.mark.asyncio
    async def test_add_examples_with_dataset_object_async(self, async_datasets, mock_async_client):
        existing_dataset = Mock(spec=Dataset)
        existing_dataset.id = "dataset123"
        existing_dataset.name = "Test Dataset"

        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version789", "examples": []}

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

        dataset = await async_datasets.add_examples_to_dataset(
            dataset=existing_dataset, inputs=[{"text": "new data"}]
        )

        assert isinstance(dataset, Dataset)
        assert dataset.id == "dataset123"

    @pytest.mark.asyncio
    async def test_add_examples_with_examples_parameter_async(
        self, async_datasets, mock_async_client
    ):
        upload_response = Mock()
        upload_response.json.return_value = {
            "data": {"dataset_id": "dataset123", "version_id": "version789"}
        }
        upload_response.raise_for_status.return_value = None

        dataset_info = {"id": "dataset123", "name": "Test Dataset"}
        examples_data = {"dataset_id": "dataset123", "version_id": "version789", "examples": []}

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

        example = v1.DatasetExample(
            id="ex1",
            input={"text": "hello"},
            output={"response": "hi"},
            metadata={"source": "test"},
            updated_at="2024-01-15T10:00:00",
        )

        dataset = await async_datasets.add_examples_to_dataset(
            dataset_name="Test Dataset", examples=example
        )

        assert isinstance(dataset, Dataset)
        assert dataset.id == "dataset123"


class TestDatasetUploadError:
    def test_exception_message(self):
        error = DatasetUploadError("Upload failed")
        assert str(error) == "Upload failed"
