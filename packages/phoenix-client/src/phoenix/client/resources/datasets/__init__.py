import csv
import gzip
import logging
import re
from collections import Counter
from collections.abc import Iterable, Mapping
from copy import deepcopy
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import (
    TYPE_CHECKING,
    Any,
    BinaryIO,
    Iterator,
    Literal,
    Optional,
    Sequence,
    TypedDict,
    Union,
)
from urllib.parse import quote

import httpx
from typing_extensions import Required, TypeGuard

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1
from phoenix.client.utils.id_handling import is_node_id

logger = logging.getLogger(__name__)

DatasetExample = v1.DatasetExample


class _InputDatasetExample(TypedDict, total=False):
    """
    This type is created manually since we do not have compiled request types
    for the POST /v1/datasets/upload route.

    https://github.com/Arize-ai/phoenix/blob/19e69091543b9c0f4051b9e561fa53d4f39d0fa4/src/phoenix/server/api/routers/v1/datasets.py#L354
    """

    input: Required[Mapping[str, Any]]
    output: Required[Mapping[str, Any]]
    metadata: Mapping[str, Any]
    span_id: Optional[str]
    splits: Optional[Union[str, list[str]]]


DEFAULT_TIMEOUT_IN_SECONDS = 5


def _is_input_dataset_example(obj: Any) -> TypeGuard[_InputDatasetExample]:
    """
    Checks if an object is a valid _InputDatasetExample.
    """
    if not isinstance(obj, dict):
        return False

    keys = set(obj.keys())  # pyright: ignore[reportUnknownArgumentType, reportUnknownVariableType]
    required_keys = {"input", "output"}
    return required_keys.issubset(keys)  # pyright: ignore[reportUnknownArgumentType]


def _is_iterable_of_input_dataset_examples(obj: Any) -> TypeGuard[Iterable[_InputDatasetExample]]:
    """
    Checks if an object is an iterable of _InputDatasetExample objects.
    """
    return isinstance(obj, Iterable) and all(_is_input_dataset_example(example) for example in obj)  # pyright: ignore[reportUnknownVariableType]


class Dataset:
    """A dataset with its examples and version information.

    Attributes:
        id (str): The dataset ID.
        name (str): The dataset name.
        description (Optional[str]): The dataset description.
        version_id (str): The current version ID.
        examples (list[DatasetExample]): List of examples in this version.
        metadata (dict[str, Any]): Additional dataset metadata.
        created_at (datetime): When the dataset was created.
        updated_at (datetime): When the dataset was last updated.
        example_count (int): Number of examples in this version.
        split_names (list[str]): List of dataset split names.
    """

    def __init__(
        self,
        dataset_info: Union[v1.Dataset, v1.DatasetWithExampleCount],
        examples_data: v1.ListDatasetExamplesData,
    ):
        self._dataset_info = dataset_info
        self._examples_data = examples_data

    @property
    def id(self) -> str:
        """The dataset ID."""
        return self._dataset_info["id"]

    @property
    def name(self) -> str:
        """The dataset name."""
        return self._dataset_info["name"]

    @property
    def description(self) -> Optional[str]:
        """The dataset description."""
        return self._dataset_info.get("description")

    @property
    def version_id(self) -> str:
        """The current version ID."""
        return self._examples_data["version_id"]

    @property
    def _filtered_split_names(self) -> list[str]:
        """The dataset split names."""
        return list(self._examples_data.get("filtered_splits", []))

    @property
    def examples(self) -> list[DatasetExample]:
        """List of examples in this version."""
        return list(self._examples_data["examples"])

    @property
    def metadata(self) -> dict[str, Any]:
        """Additional dataset metadata."""
        return dict(self._dataset_info.get("metadata", {}))

    @property
    def created_at(self) -> Optional[datetime]:
        """When the dataset was created."""
        if created_at := self._dataset_info.get("created_at"):
            return _parse_datetime(created_at)
        return None

    @property
    def updated_at(self) -> Optional[datetime]:
        """When the dataset was last updated."""
        if updated_at := self._dataset_info.get("updated_at"):
            return _parse_datetime(updated_at)
        return None

    @property
    def example_count(self) -> int:
        """Number of examples in this version."""
        return len(self.examples)

    def __repr__(self) -> str:
        return (
            f"Dataset(id={self.id!r}, name={self.name!r}, "
            f"version_id={self.version_id!r}, examples={self.example_count})"
        )

    def __len__(self) -> int:
        """Number of examples in this dataset version."""
        return len(self.examples)

    def __iter__(self) -> Iterator[DatasetExample]:
        """Iterate over examples."""
        return iter(self.examples)

    def __getitem__(self, index: int) -> DatasetExample:
        """Get example by index."""
        return self.examples[index]

    def to_dataframe(self) -> "pd.DataFrame":
        """
        Convert the dataset examples to a pandas DataFrame.

        Returns:
            A pandas DataFrame with the following columns:
            - input: Dictionary containing the input data
            - output: Dictionary containing the output data
            - metadata: Dictionary containing the metadata

            The DataFrame is indexed by example_id.

        Raises:
            ImportError: If pandas is not installed.

        Example::

            dataset = client.datasets.get_dataset(dataset="my-dataset")
            df = dataset.to_dataframe()
            print(df.columns)
            # Index(['input', 'output', 'metadata'], dtype='object')
            print(df.index.name)
            # example_id
        """
        try:
            import pandas as pd
        except ImportError:
            raise ImportError(
                "pandas is required to use to_dataframe(). Install it with 'pip install pandas'"
            )

        if not self.examples:
            return pd.DataFrame(columns=["input", "output", "metadata"]).set_index(  # pyright: ignore[reportUnknownMemberType]
                pd.Index([], name="example_id")
            )

        records = [
            {
                "example_id": example["id"],
                "input": deepcopy(example["input"]),
                "output": deepcopy(example["output"]),
                "metadata": deepcopy(example["metadata"]),
            }
            for example in self.examples
        ]

        return pd.DataFrame.from_records(records).set_index("example_id")  # pyright: ignore[reportUnknownMemberType]

    def to_dict(self) -> dict[str, Any]:
        """
        Convert the dataset to a JSON-serializable dictionary.

        Example::

            dataset = client.datasets.get_dataset(dataset="my-dataset")
            json_data = dataset.to_dict()
            restored = Dataset.from_dict(json_data)
        """
        result: dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "metadata": deepcopy(self.metadata),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # Additional fields from DatasetWithExampleCount and ListDatasetExamplesData
            "example_count": self.example_count,
            "version_id": self.version_id,
            "examples": deepcopy(self.examples),
        }

        # Include filtered_splits if present (optional field for backwards compatibility)
        if self._filtered_split_names:
            result["filtered_splits"] = self._filtered_split_names

        return result

    @classmethod
    def from_dict(cls, json_data: dict[str, Any]) -> "Dataset":
        """
        Create a Dataset instance from a JSON-serializable dictionary.

        Args:
            json_data: Dictionary containing dataset information, typically from to_dict()

        Returns:
            A Dataset instance with the provided data

        Raises:
            ValueError: If required fields are missing from json_data
            KeyError: If json_data is missing required keys

        Example::

            json_data = dataset.to_dict()
            restored = Dataset.from_dict(json_data)
            assert restored.id == dataset.id
        """
        required_fields = {"id", "name", "version_id", "examples"}
        if not all(field in json_data for field in required_fields):
            missing = required_fields - set(json_data.keys())
            raise ValueError(f"Missing required fields in json_data: {missing}")

        dataset_info = {
            "id": json_data["id"],
            "name": json_data["name"],
        }

        if json_data.get("description") is not None:
            dataset_info["description"] = json_data["description"]

        if json_data.get("metadata"):
            dataset_info["metadata"] = deepcopy(json_data["metadata"])

        if json_data.get("created_at"):
            dataset_info["created_at"] = json_data["created_at"]

        if json_data.get("updated_at"):
            dataset_info["updated_at"] = json_data["updated_at"]

        if json_data.get("example_count") is not None:
            dataset_info["example_count"] = json_data["example_count"]

        examples_data: dict[str, Any] = {
            "version_id": json_data["version_id"],
            "examples": deepcopy(json_data["examples"]),
        }

        # Handle optional split_ids for backwards compatibility
        if "filtered_splits" in json_data:
            examples_data["filtered_splits"] = json_data["filtered_splits"]

        return cls(dataset_info, examples_data)  # type: ignore[arg-type]


# Type alias for flexible dataset identification
DatasetIdentifier = Union[
    str,  # dataset_id or dataset_name
    Dataset,  # Rich dataset object
    dict[str, Any],  # Dataset info dict from API
]


class DatasetKeys:
    """
    Validates dataset key specifications.
    """

    def __init__(
        self,
        input_keys: frozenset[str],
        output_keys: frozenset[str],
        metadata_keys: frozenset[str],
        split_keys: frozenset[str] = frozenset(),
        span_id_key: Optional[str] = None,
    ):
        self.input = input_keys
        self.output = output_keys
        self.metadata = metadata_keys
        self.split = split_keys
        self.span_id = span_id_key

        if self.input & self.output:
            raise ValueError(f"Input and output keys overlap: {self.input & self.output}")
        if self.input & self.metadata:
            raise ValueError(f"Input and metadata keys overlap: {self.input & self.metadata}")
        if self.output & self.metadata:
            raise ValueError(f"Output and metadata keys overlap: {self.output & self.metadata}")
        if self.input & self.split:
            raise ValueError(f"Input and split keys overlap: {self.input & self.split}")
        if self.output & self.split:
            raise ValueError(f"Output and split keys overlap: {self.output & self.split}")
        if self.metadata & self.split:
            raise ValueError(f"Metadata and split keys overlap: {self.metadata & self.split}")

        # Validate span_id_key doesn't overlap with other keys
        if self.span_id:
            span_id_set = frozenset([self.span_id])
            if self.input & span_id_set:
                raise ValueError(f"span_id_key '{self.span_id}' overlaps with input keys")
            if self.output & span_id_set:
                raise ValueError(f"span_id_key '{self.span_id}' overlaps with output keys")
            if self.metadata & span_id_set:
                raise ValueError(f"span_id_key '{self.span_id}' overlaps with metadata keys")
            if self.split & span_id_set:
                raise ValueError(f"span_id_key '{self.span_id}' overlaps with split keys")

    def check_differences(self, available_keys: frozenset[str]) -> None:
        """Check that all specified keys exist in available keys."""
        all_keys = self.input | self.output | self.metadata | self.split
        if self.span_id:
            all_keys = all_keys | frozenset([self.span_id])
        if diff := all_keys - available_keys:
            raise ValueError(f"Keys not found in available columns: {diff}")

    def __iter__(self) -> "Iterator[str]":
        """Allow iteration over all keys."""
        all_keys = self.input | self.output | self.metadata | self.split
        if self.span_id:
            all_keys = all_keys | frozenset([self.span_id])
        return iter(all_keys)


def _parse_datetime(datetime_str: str) -> datetime:
    """Convert ISO datetime string to datetime object."""
    return datetime.fromisoformat(datetime_str)


class Datasets:
    """
    Client for managing dataset resources in Phoenix.

    This class provides methods for listing, retrieving, creating, and updating datasets.
    Datasets are collections of input/output examples used for training, evaluation,
    and experimentation.

    Key Methods:
        - list(): Get all datasets with automatic pagination
        - get_dataset(): Retrieve a specific dataset with examples
        - create_dataset(): Create new datasets from various sources
        - add_examples_to_dataset(): Add examples to existing datasets

    Examples:
        Basic usage::

            from phoenix.client import Client
            client = Client()

            # Get a dataset
            dataset = client.datasets.get_dataset(dataset="my-dataset")
            print(f"Dataset {dataset.name} has {len(dataset)} examples")

        Listing datasets::

            # Get all datasets (automatically handles pagination)
            all_datasets = client.datasets.list()
            print(f"Found {len(all_datasets)} total datasets")

            # Get limited number of datasets
            limited_datasets = client.datasets.list(limit=10)
            print(f"Found {len(limited_datasets)} datasets (limited to 10)")

        Creating and updating datasets::

            # Create a new dataset
            dataset = client.datasets.create_dataset(
                name="qa-dataset",
                inputs=[
                    {"question": "What is 2+2?"},
                    {"question": "What's the capital of France?"},
                ],
                outputs=[{"answer": "4"}, {"answer": "Paris"}]
            )

            # Add more examples later
            updated = client.datasets.add_examples_to_dataset(
                dataset="qa-dataset",
                inputs=[{"question": "Who wrote Hamlet?"}],
                outputs=[{"answer": "Shakespeare"}]
            )

        Working with DataFrames::

            import pandas as pd

            # Convert dataset to DataFrame
            df = dataset.to_dataframe()
            print(df.columns)  # Index(['input', 'output', 'metadata'], dtype='object')

            # Create dataset from DataFrame
            df = pd.DataFrame({
                "prompt": ["Hello", "Hi there"],
                "response": ["Hi!", "Hello!"],
                "score": [0.9, 0.95]
            })
            dataset = client.datasets.create_dataset(
                name="greetings",
                dataframe=df,
                input_keys=["prompt"],
                output_keys=["response"],
                metadata_keys=["score"]
            )
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def _resolve_dataset_id_and_name(
        self,
        dataset: DatasetIdentifier,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Resolve dataset ID and name from various input forms.

        Returns:
            Tuple of (dataset_id, dataset_name), where either or both may be None
        """
        if isinstance(dataset, Dataset):
            return dataset.id, dataset.name
        elif isinstance(dataset, str):
            if is_node_id(dataset, "Dataset"):
                return dataset, None
            else:
                return None, dataset
        elif isinstance(dataset, dict):  # pyright: ignore[reportUnnecessaryIsInstance]
            return dataset.get("id"), dataset.get("name")
        else:
            raise ValueError(
                "Dataset must be a dataset ID string, name string, Dataset object, or dict"
            )

    def get_dataset(
        self,
        *,
        dataset: DatasetIdentifier,
        version_id: Optional[str] = None,
        splits: Optional[Sequence[str]] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Retrieve a specific dataset with its examples.

        Gets the dataset for a specific version, or the latest version if no
        version is specified. Returns the complete dataset including metadata
        and all examples.

        Args:
            dataset (DatasetIdentifier): Dataset identifier - can be a dataset
                ID string, name string, Dataset object, or dict with 'id'/'name' fields.
            version_id (Optional[str]): Specific version ID of the dataset. If
                None, returns the latest version.
            splits (Optional[list[str]]): List of dataset split names to filter by.
                If provided, only returns examples that belong to the specified splits.
            timeout (Optional[int]): Request timeout in seconds (default: 5).

        Returns:
            Dataset: Dataset object containing complete dataset metadata and all
                examples. The dataset can be iterated over, converted to DataFrame,
                or accessed by index.

        Raises:
            ValueError: If dataset identifier format is invalid or dataset not found.
            httpx.HTTPStatusError: If the API request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            # Get dataset by name
            dataset = client.datasets.get_dataset(dataset="my-dataset")
            print(f"Dataset {dataset.name} has {len(dataset)} examples")

            # Get specific version
            versioned = client.datasets.get_dataset(
                dataset="my-dataset", version_id="version-123"
            )

            # Get dataset filtered by splits
            train_data = client.datasets.get_dataset(
                dataset="my-dataset", splits=["train", "validation"]
            )
        """
        resolved_id, resolved_name = self._resolve_dataset_id_and_name(dataset, timeout=timeout)

        if resolved_id:
            dataset_id = resolved_id
        elif resolved_name:
            dataset_id = self._get_dataset_id_by_name(dataset_name=resolved_name, timeout=timeout)
        else:
            # This shouldn't happen with current resolution logic, but just in case
            raise ValueError("Could not determine dataset ID or name from input")

        dataset_response = self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}",
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        dataset_response.raise_for_status()
        dataset_info = dataset_response.json()["data"]

        params: dict[str, Union[str, Sequence[str]]] = (
            {"version_id": version_id} if version_id else {}
        )
        if splits and len(splits) > 0:
            params["split"] = splits
        examples_response = self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}/examples",  # ?version_id=...&split=...&split=...
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        examples_response.raise_for_status()
        examples_data = examples_response.json()["data"]

        return Dataset(dataset_info, examples_data)

    def get_dataset_versions(
        self,
        *,
        dataset: DatasetIdentifier,
        limit: Optional[int] = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.DatasetVersion]:
        """
        Get dataset versions as a list of dictionaries.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict with 'id'/'name' fields.
            limit: Maximum number of versions to return, starting from the most recent version
            timeout: Optional request timeout in seconds.

        Returns:
            List of dictionaries containing version information, including:
                - version_id: The version ID
                - created_at: When the version was created (as datetime object)
                - description: Version description (if any)
                - metadata: Version metadata (if any)

        Raises:
            ValueError: If dataset format is invalid.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        resolved_id, resolved_name = self._resolve_dataset_id_and_name(dataset, timeout=timeout)

        if resolved_id:
            dataset_id = resolved_id
        elif resolved_name:
            dataset_id = self._get_dataset_id_by_name(dataset_name=resolved_name, timeout=timeout)
        else:
            raise ValueError("Could not determine dataset ID or name from input")

        response = self._client.get(
            url=f"v1/datasets/{dataset_id}/versions",
            params={"limit": limit},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        records = response.json()["data"]
        if not records:
            return []

        for record in records:
            if "created_at" in record:
                record["created_at"] = _parse_datetime(record["created_at"])

        return records  # type: ignore[no-any-return]

    def _paginate(
        self,
        *,
        limit: Optional[int] = 100,
        cursor: Optional[str] = None,
        timeout: Optional[float] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.ListDatasetsResponseBody:
        """
        Internal method to paginate through available datasets with cursor-based pagination.

        This is a private method used internally by the list() method to handle pagination.
        Users should use the list() method instead of calling this directly.

        Args:
            limit: Maximum number of datasets to return per page (default: 100).
                Server may use a different default if None is passed.
            cursor: Cursor for pagination. Use the `next_cursor` from a previous
                response to get the next page. None for the first page.
            timeout: Request timeout in seconds (default: 5).

        Returns:
            Dictionary with pagination response containing:
                - data: List of dataset dictionaries with fields: id, name, description,
                  metadata, created_at (datetime), updated_at (datetime), example_count (int)
                - next_cursor: String cursor for next page, or None if no more pages

        Raises:
            httpx.HTTPStatusError: If the API request fails (e.g., invalid cursor, network error).
        """  # noqa: E501
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor

        response = self._client.get(
            url="v1/datasets",
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        response_data = response.json()
        records = response_data["data"]
        next_cursor = response_data.get("next_cursor")

        return v1.ListDatasetsResponseBody(data=records, next_cursor=next_cursor)

    def list(
        self,
        *,
        limit: Optional[int] = None,
        timeout: Optional[float] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.Dataset]:
        """
        List available datasets with automatic pagination handling.

        This is the recommended method for most use cases. It automatically handles
        pagination behind the scenes and returns a simple list of datasets. For large
        datasets collections, consider using a limit to control memory usage.

        Args:
            limit: Maximum number of datasets to return. If None, returns all available
                datasets (use with caution for large collections).
            timeout: Request timeout in seconds for each paginated request (default: 5).

        Returns:
            List of dataset dictionaries, each containing: id, name, description,
            metadata, created_at (datetime), updated_at (datetime), example_count (int).
            Limited to the requested number if limit is specified.

        Raises:
            httpx.HTTPStatusError: If any API request fails during pagination.

        Example::

            from phoenix.client import Client
            client = Client()

            # Get all datasets (automatically paginates, includes counts)
            all_datasets = client.datasets.list()
            print(f"Found {len(all_datasets)} total datasets")

            # Get datasets with example counts
            for dataset in all_datasets:
                print(f"{dataset['name']}: {dataset['example_count']} examples")

            # Get only first 10 datasets (efficient for large collections)
            limited_datasets = client.datasets.list(limit=10)
            print(f"Found {len(limited_datasets)} datasets (limited to 10)")
        """  # noqa: E501
        all_datasets: list[v1.Dataset] = []
        cursor = None

        while True:
            # Use limit as page size if specified, otherwise use reasonable default
            page_size = min(limit or 100, 100) if limit else 100

            # Don't fetch more than we need
            if limit is not None:
                remaining = limit - len(all_datasets)
                if remaining <= 0:
                    break
                page_size = min(page_size, remaining)

            response = self._paginate(
                cursor=cursor,
                limit=page_size,
                timeout=timeout,
            )
            all_datasets.extend(response["data"])

            cursor = response["next_cursor"]
            if cursor is None or (limit is not None and len(all_datasets) >= limit):
                break

        # Trim to exact limit if needed
        if limit is not None and len(all_datasets) > limit:
            all_datasets = all_datasets[:limit]

        return all_datasets

    def create_dataset(
        self,
        *,
        name: str,
        examples: Optional[Union[Mapping[str, Any], Iterable[Mapping[str, Any]]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        split_keys: Iterable[str] = (),
        span_id_key: Optional[str] = None,
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        dataset_description: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Create a new dataset by uploading examples to the Phoenix server.

        Args:
            dataset_name: Name of the dataset.
            examples: Either a single dictionary with required 'input' and 'output' keys
                and an optional 'metadata' key, or an iterable of such dictionaries.
                When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
            split_keys: List of column names used for automatically assigning examples to splits.
            span_id_key: Optional column name containing span IDs to link dataset examples
                back to their original traces. The column should contain OTEL span_id values
                (string format). Examples will be linked to spans if they exist in the database.
            inputs: List of dictionaries each corresponding to an example.
            outputs: List of dictionaries each corresponding to an example.
            metadata: List of dictionaries each corresponding to an example.
            dataset_description: Description of the dataset.
            timeout: Optional request timeout in seconds.

        Returns:
            A Dataset object containing the uploaded dataset and examples.

        Raises:
            ValueError: If invalid parameter combinations are provided.
            ImportError: If pandas is required but not installed.
            httpx.HTTPStatusError: If the API returns an error response.

        Example::

            from phoenix.client import Client
            import pandas as pd

            client = Client()

            # Create dataset with span ID links
            spans_df = pd.DataFrame({
                "input": ["What is AI?", "Explain ML"],
                "output": ["Artificial Intelligence is...", "Machine Learning is..."],
                "context.span_id": ["abc123", "def456"]
            })

            dataset = client.datasets.create_dataset(
                name="my-dataset",
                dataframe=spans_df,
                input_keys=["input"],
                output_keys=["output"],
                span_id_key="context.span_id"
            )
        """
        has_examples = examples is not None
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if sum([has_examples, has_tabular, has_json]) > 1:
            raise ValueError(
                "Please provide only one of: examples, tabular data (dataframe/csv_file_path), "
                "or dictionaries (inputs/outputs/metadata)"
            )

        if dataframe is not None and csv_file_path is not None:
            raise ValueError("Please provide either dataframe or csv_file_path, but not both")

        splits_from_examples: list[Any] = []
        span_ids_from_examples: list[Optional[str]] = []
        if examples is not None:
            examples_list: list[_InputDatasetExample]
            if _is_input_dataset_example(examples):
                examples_list = [examples]
            elif _is_iterable_of_input_dataset_examples(examples):
                examples_list = list(examples)
            else:
                raise ValueError(
                    "examples must be a single dictionary with required 'input' and 'output' keys "
                    "and an optional 'metadata' key, or an iterable of such dictionaries"
                )

            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example.get("metadata", {})) for example in examples_list]
            splits_from_examples = [example.get("splits", None) for example in examples_list]
            span_ids_from_examples = [example.get("span_id", None) for example in examples_list]

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None
            return self._upload_tabular_dataset(
                table,
                dataset_name=name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                split_keys=split_keys,
                span_id_key=span_id_key,
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )
        else:
            return self._upload_json_dataset(
                dataset_name=name,
                inputs=inputs,
                outputs=outputs,
                metadata=metadata,
                splits=splits_from_examples if examples is not None else [],
                span_ids=span_ids_from_examples if examples is not None else [],
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )

    def add_examples_to_dataset(
        self,
        *,
        dataset: DatasetIdentifier,
        examples: Optional[Union[Mapping[str, Any], Iterable[Mapping[str, Any]]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        split_keys: Iterable[str] = (),
        span_id_key: Optional[str] = None,
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Append examples to an existing dataset on the Phoenix server.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict with 'id'/'name' fields.
            examples: Either a single dictionary with required 'input' and 'output' keys
                and an optional 'metadata' key, or an iterable of such dictionaries.
                When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
            split_keys: List of column names used for automatically assigning examples to splits.
            span_id_key: Optional column name containing span IDs to link dataset examples
                back to their original traces. The column should contain OTEL span_id values
                (string format). Examples will be linked to spans if they exist in the database.
            inputs: List of dictionaries each corresponding to an example.
            outputs: List of dictionaries each corresponding to an example.
            metadata: List of dictionaries each corresponding to an example.
            timeout: Optional request timeout in seconds.

        Returns:
            A Dataset object containing the updated dataset and examples.

        Raises:
            ValueError: If invalid parameter combinations are provided.
            ImportError: If pandas is required but not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        resolved_id, resolved_name = self._resolve_dataset_id_and_name(dataset, timeout=timeout)

        if not resolved_name:
            if resolved_id:
                response = self._client.get(
                    url=f"v1/datasets/{quote(resolved_id)}",
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                resolved_name = response.json()["data"]["name"]
            else:
                raise ValueError("Could not determine dataset name from input")

        # At this point resolved_name is guaranteed to be not None
        assert resolved_name is not None

        has_examples = examples is not None
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if sum([has_examples, has_tabular, has_json]) > 1:
            raise ValueError(
                "Please provide only one of: examples, tabular data (dataframe/csv_file_path), "
                "or dictionaries (inputs/outputs/metadata)"
            )

        if dataframe is not None and csv_file_path is not None:
            raise ValueError("Please provide either dataframe or csv_file_path, but not both")

        splits_from_examples: list[Any] = []
        span_ids_from_examples: list[Optional[str]] = []
        if examples is not None:
            examples_list: list[_InputDatasetExample]
            if _is_input_dataset_example(examples):
                examples_list = [examples]
            elif _is_iterable_of_input_dataset_examples(examples):
                examples_list = list(examples)
            else:
                raise ValueError(
                    "examples must be a single dictionary with required 'input' and 'output' keys "
                    "and an optional 'metadata' key, or an iterable of such dictionaries"
                )

            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example.get("metadata", {})) for example in examples_list]
            splits_from_examples = [example.get("splits") for example in examples_list]
            span_ids_from_examples = [example.get("span_id", None) for example in examples_list]

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None
            return self._upload_tabular_dataset(
                table,
                dataset_name=resolved_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                split_keys=split_keys,
                span_id_key=span_id_key,
                dataset_description=None,
                action="append",
                timeout=timeout,
            )
        else:
            return self._upload_json_dataset(
                dataset_name=resolved_name,
                inputs=inputs,
                outputs=outputs,
                metadata=metadata,
                splits=splits_from_examples if examples is not None else [],
                span_ids=span_ids_from_examples if examples is not None else [],
                dataset_description=None,
                action="append",
                timeout=timeout,
            )

    def _get_dataset_id_by_name(
        self,
        *,
        dataset_name: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> str:
        """
        Gets a dataset ID by name.

        Args:
            dataset_name: The name of the dataset.
            timeout: Optional request timeout in seconds.

        Returns:
            The dataset ID.

        Raises:
            ValueError: If dataset not found or multiple datasets found.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        response = self._client.get(
            url="v1/datasets",
            params={"name": dataset_name},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        records = response.json()["data"]
        if not records:
            raise ValueError(f"Dataset not found: {dataset_name}")
        if len(records) > 1:
            raise ValueError(f"Multiple datasets found with name: {dataset_name}")

        return str(records[0]["id"])

    def _upload_tabular_dataset(
        self,
        table: Union[str, Path, "pd.DataFrame"],
        *,
        dataset_name: str,
        input_keys: Iterable[str],
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        split_keys: Iterable[str] = (),
        span_id_key: Optional[str] = None,
        dataset_description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Upload tabular data (CSV or DataFrame) as dataset.
        """
        input_keys_set = frozenset(input_keys)
        output_keys_set = frozenset(output_keys)
        metadata_keys_set = frozenset(metadata_keys)
        split_keys_set = frozenset(split_keys)

        # Auto-infer keys if none provided
        if not any([input_keys_set, output_keys_set, metadata_keys_set]):
            input_keys_tuple, output_keys_tuple, metadata_keys_tuple = _infer_keys(table)
            input_keys_set = frozenset(input_keys_tuple)
            output_keys_set = frozenset(output_keys_tuple)
            metadata_keys_set = frozenset(metadata_keys_tuple)

        keys = DatasetKeys(
            input_keys_set, output_keys_set, metadata_keys_set, split_keys_set, span_id_key
        )

        if isinstance(table, Path) or isinstance(table, str):
            file = _prepare_csv(Path(table), keys)
        else:
            try:
                import pandas as pd

                if not isinstance(table, pd.DataFrame):  # pyright: ignore[reportUnnecessaryIsInstance]
                    raise ValueError("Expected pandas DataFrame")
            except ImportError:
                raise ImportError(
                    "pandas is required to upload DataFrames. Install it with 'pip install pandas'"
                )
            file = _prepare_dataframe_as_csv(table, keys)

        logger.info("Uploading dataset...")
        data_dict: dict[str, Any] = {
            "action": action,
            "name": dataset_name,
            "description": dataset_description or "",
            "input_keys[]": sorted(keys.input),
            "output_keys[]": sorted(keys.output),
            "metadata_keys[]": sorted(keys.metadata),
            "split_keys[]": sorted(keys.split),
        }

        # Add span_id_key if present
        if keys.span_id:
            data_dict["span_id_key"] = keys.span_id

        response = self._client.post(
            url="v1/datasets/upload",
            files={"file": file},
            data=data_dict,
            params={"sync": True},
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        return self._process_dataset_upload_response(response, timeout=timeout)

    def _upload_json_dataset(
        self,
        *,
        dataset_name: str,
        inputs: Iterable[Mapping[str, Any]],
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        splits: Iterable[Any] = (),
        span_ids: Iterable[Optional[str]] = (),
        dataset_description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Upload JSON data as dataset.
        """
        # Convert to lists to handle generators and validate
        inputs_list = list(inputs)
        outputs_list = list(outputs) if outputs else []
        metadata_list = list(metadata) if metadata else []
        splits_list = list(splits) if splits else []
        span_ids_list = list(span_ids) if span_ids else []

        if not inputs_list:
            raise ValueError("inputs must be non-empty")

        if not _is_all_dict(inputs_list):
            raise ValueError("inputs must contain only dictionaries")

        for name, data in [
            ("outputs", outputs_list),
            ("metadata", metadata_list),
        ]:
            if data:
                if len(data) != len(inputs_list):
                    raise ValueError(
                        f"{name} must have same length as inputs "
                        f"({len(data)} != {len(inputs_list)})"
                    )
                if not _is_all_dict(data):
                    raise ValueError(f"{name} must contain only dictionaries")

        # Validate splits separately (can be string, list of strings, or None)
        if splits_list and len(splits_list) != len(inputs_list):
            raise ValueError(
                f"splits must have same length as inputs ({len(splits_list)} != {len(inputs_list)})"
            )

        # Validate span_ids separately (can be string or None)
        if span_ids_list and len(span_ids_list) != len(inputs_list):
            raise ValueError(
                f"span_ids length ({len(span_ids_list)}) != inputs length ({len(inputs_list)})"
            )

        payload: dict[str, Any] = {
            "action": action,
            "name": dataset_name,
            "inputs": inputs_list,
        }
        # Only include optional fields if they have meaningful values
        if outputs_list:
            payload["outputs"] = outputs_list
        if metadata_list:
            payload["metadata"] = metadata_list
        if splits_list and any(s is not None for s in splits_list):
            payload["splits"] = splits_list
        if span_ids_list and any(s is not None for s in span_ids_list):
            payload["span_ids"] = span_ids_list
        if dataset_description is not None:
            payload["description"] = dataset_description

        logger.info("Uploading dataset...")
        response = self._client.post(
            url="v1/datasets/upload",
            json=payload,
            params={"sync": True},
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        return self._process_dataset_upload_response(response, timeout=timeout)

    def _process_dataset_upload_response(
        self,
        response: httpx.Response,
        *,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Process the response from dataset upload operations.
        """
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            try:
                error_detail = response.json().get("detail", str(e))
            except Exception:
                error_detail = response.text or str(e)
            raise DatasetUploadError(f"Dataset upload failed: {error_detail}") from e

        upload_data = response.json()["data"]
        dataset_id = upload_data["dataset_id"]
        version_id = upload_data["version_id"]

        dataset = self.get_dataset(
            dataset=dataset_id,
            version_id=version_id,
            timeout=timeout,
        )

        logger.info(f"Dataset uploaded successfully. ID: {dataset_id}, Version: {version_id}")

        return dataset


class AsyncDatasets:
    """
    Provides async methods for interacting with dataset resources.

    Examples:
        Basic usage::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # Get a dataset
            dataset = await client.datasets.get_dataset(dataset="my-dataset")
            print(f"Dataset {dataset.name} has {len(dataset)} examples")

        Creating and updating datasets::

            # Create a new dataset
            dataset = await client.datasets.create_dataset(
                name="qa-dataset",
                inputs=[
                    {"question": "What is 2+2?"},
                    {"question": "What's the capital of France?"},
                ],
                outputs=[{"answer": "4"}, {"answer": "Paris"}]
            )

            # Add more examples later
            updated = await client.datasets.add_examples_to_dataset(
                dataset="qa-dataset",
                inputs=[{"question": "Who wrote Hamlet?"}],
                outputs=[{"answer": "Shakespeare"}]
            )

        Working with DataFrames::

            import pandas as pd

            # Convert dataset to DataFrame (sync operation)
            df = dataset.to_dataframe()
            print(df.columns)  # Index(['input', 'output', 'metadata'], dtype='object')

            # Create dataset from DataFrame
            df = pd.DataFrame({
                "prompt": ["Hello", "Hi there"],
                "response": ["Hi!", "Hello!"],
                "score": [0.9, 0.95]
            })
            dataset = await client.datasets.create_dataset(
                name="greetings",
                dataframe=df,
                input_keys=["prompt"],
                output_keys=["response"],
                metadata_keys=["score"]
            )
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def _resolve_dataset_id_and_name(
        self,
        dataset: DatasetIdentifier,
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Resolve dataset ID and name from various input forms.

        Returns:
            Tuple of (dataset_id, dataset_name), where either or both may be None
        """
        if isinstance(dataset, Dataset):
            return dataset.id, dataset.name
        elif isinstance(dataset, str):
            if is_node_id(dataset, "Dataset"):
                return dataset, None
            else:
                return None, dataset
        elif isinstance(dataset, dict):  # pyright: ignore[reportUnnecessaryIsInstance]
            return dataset.get("id"), dataset.get("name")
        else:
            raise ValueError(
                "Dataset must be a dataset ID string, name string, Dataset object, or dict"
            )

    async def get_dataset(
        self,
        *,
        dataset: DatasetIdentifier,
        version_id: Optional[str] = None,
        splits: Optional[Sequence[str]] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Gets the dataset for a specific version, or gets the latest version of
        the dataset if no version is specified.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict with 'id'/'name' fields.
            version_id: An ID for the version of the dataset, or None.
            splits: Optional list of dataset split names to filter by.
                If provided, only returns examples that belong to the specified splits.
            timeout: Optional request timeout in seconds.

        Returns:
            A Dataset object containing the dataset metadata and examples.

        Raises:
            ValueError: If dataset format is invalid.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        resolved_id, resolved_name = await self._resolve_dataset_id_and_name(dataset)

        if resolved_id:
            dataset_id = resolved_id
        elif resolved_name:
            dataset_id = await self._get_dataset_id_by_name(
                dataset_name=resolved_name, timeout=timeout
            )
        else:
            # This shouldn't happen with current resolution logic, but just in case
            raise ValueError("Could not determine dataset ID or name from input")

        dataset_response = await self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}",
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        dataset_response.raise_for_status()
        dataset_info = dataset_response.json()["data"]

        params: dict[str, Union[str, Sequence[str]]] = (
            {"version_id": version_id} if version_id else {}
        )
        if splits and len(splits) > 0:
            params["split"] = splits
        examples_response = await self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}/examples",
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        examples_response.raise_for_status()
        examples_data = examples_response.json()["data"]

        return Dataset(dataset_info, examples_data)

    async def get_dataset_versions(
        self,
        *,
        dataset: DatasetIdentifier,
        limit: Optional[int] = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.DatasetVersion]:
        """
        Get dataset versions as a list of dictionaries.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict with 'id'/'name' fields.
            limit: Maximum number of versions to return, starting from the most recent version
            timeout: Optional request timeout in seconds.

        Returns:
            List of dictionaries containing version information, including:
                - version_id: The version ID
                - created_at: When the version was created (as datetime object)
                - description: Version description (if any)
                - metadata: Version metadata (if any)

        Raises:
            ValueError: If dataset format is invalid.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        resolved_id, resolved_name = await self._resolve_dataset_id_and_name(dataset)

        if resolved_id:
            dataset_id = resolved_id
        elif resolved_name:
            dataset_id = await self._get_dataset_id_by_name(
                dataset_name=resolved_name, timeout=timeout
            )
        else:
            raise ValueError("Could not determine dataset ID or name from input")

        response = await self._client.get(
            url=f"v1/datasets/{dataset_id}/versions",
            params={"limit": limit},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        records = response.json()["data"]
        if not records:
            return []

        for record in records:
            if "created_at" in record:
                record["created_at"] = _parse_datetime(record["created_at"])

        return records  # type: ignore[no-any-return]

    async def _paginate(
        self,
        *,
        limit: Optional[int] = 100,
        cursor: Optional[str] = None,
        timeout: Optional[float] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.ListDatasetsResponseBody:
        """
        Internal method to paginate through available datasets with cursor-based pagination.

        This is a private method used internally by the list() method to handle pagination.
        Users should use the list() method instead of calling this directly.

        Args:
            limit: Maximum number of datasets to return per page (default: 100).
                Server may use a different default if None is passed.
            cursor: Cursor for pagination. Use the `next_cursor` from a previous
                response to get the next page. None for the first page.
            timeout: Request timeout in seconds (default: 5).

        Returns:
            Dictionary with pagination response containing:
                - data: List of dataset dictionaries with fields: id, name, description,
                  metadata, created_at (datetime), updated_at (datetime), example_count (int)
                - next_cursor: String cursor for next page, or None if no more pages

        Raises:
            httpx.HTTPStatusError: If the API request fails (e.g., invalid cursor, network error).
        """  # noqa: E501
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor

        response = await self._client.get(
            url="v1/datasets",
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        response_data = response.json()
        records = response_data["data"]
        next_cursor = response_data.get("next_cursor")

        return v1.ListDatasetsResponseBody(data=records, next_cursor=next_cursor)

    async def list(
        self,
        *,
        limit: Optional[int] = None,
        timeout: Optional[float] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.Dataset]:
        """
        List available datasets with automatic pagination handling.

        This is the recommended method for most use cases. It automatically handles
        pagination behind the scenes and returns a simple list of datasets. For large
        datasets collections, consider using a limit to control memory usage.

        Args:
            limit: Maximum number of datasets to return. If None, returns all available
                datasets (use with caution for large collections).
            timeout: Request timeout in seconds for each paginated request (default: 5).

        Returns:
            List of dataset dictionaries, each containing: id, name, description,
            metadata, created_at (datetime), updated_at (datetime), example_count (int).
            Limited to the requested number if limit is specified.

        Raises:
            httpx.HTTPStatusError: If any API request fails during pagination.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # Get all datasets (automatically paginates)
            all_datasets = await client.datasets.list()
            print(f"Found {len(all_datasets)} total datasets")

            # Get only first 10 datasets (efficient for large collections)
            limited_datasets = await client.datasets.list(limit=10)
            print(f"Found {len(limited_datasets)} datasets (limited to 10)")
        """  # noqa: E501
        all_datasets: list[v1.Dataset] = []
        cursor = None

        while True:
            # Use limit as page size if specified, otherwise use reasonable default
            page_size = min(limit or 100, 100) if limit else 100

            # Don't fetch more than we need
            if limit is not None:
                remaining = limit - len(all_datasets)
                if remaining <= 0:
                    break
                page_size = min(page_size, remaining)

            response = await self._paginate(
                cursor=cursor,
                limit=page_size,
                timeout=timeout,
            )
            all_datasets.extend(response["data"])

            cursor = response["next_cursor"]
            if cursor is None or (limit is not None and len(all_datasets) >= limit):
                break

        # Trim to exact limit if needed
        if limit is not None and len(all_datasets) > limit:
            all_datasets = all_datasets[:limit]

        return all_datasets

    async def create_dataset(
        self,
        *,
        name: str,
        examples: Optional[Union[Mapping[str, Any], Iterable[Mapping[str, Any]]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        split_keys: Iterable[str] = (),
        span_id_key: Optional[str] = None,
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        dataset_description: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Create a new dataset by uploading examples to the Phoenix server.

        Args:
            dataset_name: Name of the dataset.
            examples: Either a single dictionary with required 'input' and 'output' keys
                and an optional 'metadata' key, or an iterable of such dictionaries.
                to add. When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
            split_keys: List of column names used for automatically assigning examples to splits.
            inputs: List of dictionaries each corresponding to an example.
            outputs: List of dictionaries each corresponding to an example.
            metadata: List of dictionaries each corresponding to an example.
            dataset_description: Description of the dataset.
            timeout: Optional request timeout in seconds.

        Returns:
            A Dataset object containing the uploaded dataset and examples.

        Raises:
            ValueError: If invalid parameter combinations are provided.
            ImportError: If pandas is required but not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        has_examples = examples is not None
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if sum([has_examples, has_tabular, has_json]) > 1:
            raise ValueError(
                "Please provide only one of: examples, tabular data (dataframe/csv_file_path), "
                "or JSON data (inputs/outputs/metadata)"
            )

        if dataframe is not None and csv_file_path is not None:
            raise ValueError("Please provide either dataframe or csv_file_path, but not both")

        splits_from_examples: list[Any] = []
        span_ids_from_examples: list[Optional[str]] = []
        if examples is not None:
            examples_list: list[_InputDatasetExample]
            if _is_input_dataset_example(examples):
                examples_list = [examples]
            elif _is_iterable_of_input_dataset_examples(examples):
                examples_list = list(examples)
            else:
                raise ValueError(
                    "examples must be a single dictionary with required 'input' and 'output' keys "
                    "and an optional 'metadata' key, or an iterable of such dictionaries"
                )

            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example.get("metadata", {})) for example in examples_list]
            splits_from_examples = [example.get("splits", None) for example in examples_list]
            span_ids_from_examples = [example.get("span_id", None) for example in examples_list]

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None
            return await self._upload_tabular_dataset(
                table,
                dataset_name=name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                split_keys=split_keys,
                span_id_key=span_id_key,
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )
        else:
            return await self._upload_json_dataset(
                dataset_name=name,
                inputs=inputs,
                outputs=outputs,
                metadata=metadata,
                splits=splits_from_examples if examples is not None else [],
                span_ids=span_ids_from_examples if examples is not None else [],
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )

    async def add_examples_to_dataset(
        self,
        *,
        dataset: DatasetIdentifier,
        examples: Optional[Union[Mapping[str, Any], Iterable[Mapping[str, Any]]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        split_keys: Iterable[str] = (),
        span_id_key: Optional[str] = None,
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Append examples to an existing dataset on the Phoenix server.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict with 'id'/'name' fields.
            examples: Either a single dictionary with required 'input' and 'output' keys
                and an optional 'metadata' key, or an iterable of such dictionaries.
                When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
            split_keys: List of column names used for automatically assigning examples to splits.
            inputs: List of dictionaries each corresponding to an example.
            outputs: List of dictionaries each corresponding to an example.
            metadata: List of dictionaries each corresponding to an example.
            timeout: Optional request timeout in seconds.

        Returns:
            A Dataset object containing the updated dataset and examples.

        Raises:
            ValueError: If invalid parameter combinations are provided.
            ImportError: If pandas is required but not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        resolved_id, resolved_name = await self._resolve_dataset_id_and_name(dataset)

        if not resolved_name:
            if resolved_id:
                response = await self._client.get(
                    url=f"v1/datasets/{quote(resolved_id)}",
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                resolved_name = response.json()["data"]["name"]
            else:
                raise ValueError("Could not determine dataset name from input")

        # At this point resolved_name is guaranteed to be not None
        assert resolved_name is not None

        has_examples = examples is not None
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if sum([has_examples, has_tabular, has_json]) > 1:
            raise ValueError(
                "Please provide only one of: examples, tabular data (dataframe/csv_file_path), "
                "or JSON data (inputs/outputs/metadata)"
            )

        if dataframe is not None and csv_file_path is not None:
            raise ValueError("Please provide either dataframe or csv_file_path, but not both")

        splits_from_examples: list[Any] = []
        span_ids_from_examples: list[Optional[str]] = []
        if examples is not None:
            examples_list: list[_InputDatasetExample]
            if _is_input_dataset_example(examples):
                examples_list = [examples]
            elif _is_iterable_of_input_dataset_examples(examples):
                examples_list = list(examples)
            else:
                raise ValueError(
                    "examples must be a single dictionary with required 'input' and 'output' keys "
                    "and an optional 'metadata' key, or an iterable of such dictionaries"
                )

            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example.get("metadata", {})) for example in examples_list]
            splits_from_examples = [example.get("splits") for example in examples_list]
            span_ids_from_examples = [example.get("span_id", None) for example in examples_list]

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None
            return await self._upload_tabular_dataset(
                table,
                dataset_name=resolved_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                split_keys=split_keys,
                span_id_key=span_id_key,
                dataset_description=None,
                action="append",
                timeout=timeout,
            )
        else:
            return await self._upload_json_dataset(
                dataset_name=resolved_name,
                inputs=inputs,
                outputs=outputs,
                metadata=metadata,
                splits=splits_from_examples if examples is not None else [],
                span_ids=span_ids_from_examples if examples is not None else [],
                dataset_description=None,
                action="append",
                timeout=timeout,
            )

    async def _get_dataset_id_by_name(
        self,
        *,
        dataset_name: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> str:
        """Async version of _get_dataset_id_by_name."""
        response = await self._client.get(
            url="v1/datasets",
            params={"name": dataset_name},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        records = response.json()["data"]
        if not records:
            raise ValueError(f"Dataset not found: {dataset_name}")
        if len(records) > 1:
            raise ValueError(f"Multiple datasets found with name: {dataset_name}")

        return str(records[0]["id"])

    async def _upload_tabular_dataset(
        self,
        table: Union[str, Path, "pd.DataFrame"],
        *,
        dataset_name: str,
        input_keys: Iterable[str],
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        split_keys: Iterable[str] = (),
        span_id_key: Optional[str] = None,
        dataset_description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """Async version of _upload_tabular_dataset."""
        input_keys_set = frozenset(input_keys)
        output_keys_set = frozenset(output_keys)
        metadata_keys_set = frozenset(metadata_keys)
        split_keys_set = frozenset(split_keys)

        # Auto-infer keys if none provided
        if not any([input_keys_set, output_keys_set, metadata_keys_set]):
            input_keys_tuple, output_keys_tuple, metadata_keys_tuple = _infer_keys(table)
            input_keys_set = frozenset(input_keys_tuple)
            output_keys_set = frozenset(output_keys_tuple)
            metadata_keys_set = frozenset(metadata_keys_tuple)

        keys = DatasetKeys(
            input_keys_set, output_keys_set, metadata_keys_set, split_keys_set, span_id_key
        )

        if isinstance(table, Path) or isinstance(table, str):
            file = _prepare_csv(Path(table), keys)
        else:
            try:
                import pandas as pd

                if not isinstance(table, pd.DataFrame):  # pyright: ignore[reportUnnecessaryIsInstance]
                    raise ValueError("Expected pandas DataFrame")
            except ImportError:
                raise ImportError(
                    "pandas is required to upload DataFrames. Install it with 'pip install pandas'"
                )
            file = _prepare_dataframe_as_csv(table, keys)

        logger.info("Uploading dataset...")
        data_dict: dict[str, Any] = {
            "action": action,
            "name": dataset_name,
            "description": dataset_description or "",
            "input_keys[]": sorted(keys.input),
            "output_keys[]": sorted(keys.output),
            "metadata_keys[]": sorted(keys.metadata),
            "split_keys[]": sorted(keys.split),
        }

        # Add span_id_key if present
        if keys.span_id:
            data_dict["span_id_key"] = keys.span_id

        response = await self._client.post(
            url="v1/datasets/upload",
            files={"file": file},
            data=data_dict,
            params={"sync": True},
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        return await self._process_dataset_upload_response(response, timeout=timeout)

    async def _upload_json_dataset(
        self,
        *,
        dataset_name: str,
        inputs: Iterable[Mapping[str, Any]],
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        splits: Iterable[Any] = (),
        span_ids: Iterable[Optional[str]] = (),
        dataset_description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """Async version of _upload_json_dataset."""
        # Convert to lists to handle generators and validate
        inputs_list = list(inputs)
        outputs_list = list(outputs) if outputs else []
        metadata_list = list(metadata) if metadata else []
        splits_list = list(splits) if splits else []
        span_ids_list = list(span_ids) if span_ids else []

        if not inputs_list:
            raise ValueError("inputs must be non-empty")

        if not _is_all_dict(inputs_list):
            raise ValueError("inputs must contain only dictionaries")

        for name, data in [
            ("outputs", outputs_list),
            ("metadata", metadata_list),
        ]:
            if data:
                if len(data) != len(inputs_list):
                    raise ValueError(
                        f"{name} must have same length as inputs "
                        f"({len(data)} != {len(inputs_list)})"
                    )
                if not _is_all_dict(data):
                    raise ValueError(f"{name} must contain only dictionaries")

        # Validate splits separately (can be string, list of strings, or None)
        if splits_list and len(splits_list) != len(inputs_list):
            raise ValueError(
                f"splits must have same length as inputs ({len(splits_list)} != {len(inputs_list)})"
            )

        # Validate span_ids separately (can be string or None)
        if span_ids_list and len(span_ids_list) != len(inputs_list):
            raise ValueError(
                f"span_ids length ({len(span_ids_list)}) != inputs length ({len(inputs_list)})"
            )

        payload: dict[str, Any] = {
            "action": action,
            "name": dataset_name,
            "inputs": inputs_list,
        }
        # Only include optional fields if they have meaningful values
        if outputs_list:
            payload["outputs"] = outputs_list
        if metadata_list:
            payload["metadata"] = metadata_list
        if splits_list and any(s is not None for s in splits_list):
            payload["splits"] = splits_list
        if span_ids_list and any(s is not None for s in span_ids_list):
            payload["span_ids"] = span_ids_list
        if dataset_description is not None:
            payload["description"] = dataset_description

        logger.info("Uploading dataset...")
        response = await self._client.post(
            url="v1/datasets/upload",
            json=payload,
            params={"sync": True},
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        return await self._process_dataset_upload_response(response, timeout=timeout)

    async def _process_dataset_upload_response(
        self,
        response: httpx.Response,
        *,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """Async version of _process_dataset_upload_response."""
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            try:
                error_detail = response.json().get("detail", str(e))
            except Exception:
                error_detail = response.text or str(e)
            raise DatasetUploadError(f"Dataset upload failed: {error_detail}") from e

        upload_data = response.json()["data"]
        dataset_id = upload_data["dataset_id"]
        version_id = upload_data["version_id"]

        dataset = await self.get_dataset(
            dataset=dataset_id,
            version_id=version_id,
            timeout=timeout,
        )

        logger.info(f"Dataset uploaded successfully. ID: {dataset_id}, Version: {version_id}")

        return dataset


def _get_csv_column_headers(path: Path) -> tuple[str, ...]:
    """
    Extract column headers from CSV file.
    """
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(f"File does not exist: {path}")

    with open(path, "r") as f:
        reader = csv.reader(f)
        try:
            column_headers = tuple(next(reader))
            # Check if there's at least one data row
            next(reader)
        except StopIteration as e:
            raise ValueError("CSV file has no data rows") from e

    return column_headers


def _prepare_csv(path: Path, keys: DatasetKeys) -> tuple[str, BinaryIO, str, dict[str, str]]:
    """
    Prepare CSV file for upload with validation and compression.
    """
    column_headers = _get_csv_column_headers(path)
    header_counts = Counter(column_headers)
    duplicates = [h for h, count in header_counts.items() if count > 1]
    if duplicates:
        raise ValueError(f"Duplicate column headers in CSV: {duplicates}")

    keys.check_differences(frozenset(column_headers))

    with open(path, "rb") as f:
        content = f.read()

    compressed = BytesIO()
    compressed.write(gzip.compress(content))
    compressed.seek(0)

    return (path.name, compressed, "text/csv", {"Content-Encoding": "gzip"})


def _prepare_dataframe_as_csv(
    df: "pd.DataFrame", keys: DatasetKeys
) -> tuple[str, BinaryIO, str, dict[str, str]]:
    """
    Prepare pandas DataFrame for upload as compressed CSV.
    """
    if df.empty:
        raise ValueError("DataFrame has no data")

    column_counts = Counter(df.columns)
    duplicates = [col for col, count in column_counts.items() if count > 1]
    if duplicates:
        raise ValueError(f"Duplicate column names in DataFrame: {duplicates}")

    keys.check_differences(frozenset(df.columns))

    # Ensure consistent column ordering: input, output, metadata, split, span_id
    selected_columns: list[str] = (
        sorted(keys.input) + sorted(keys.output) + sorted(keys.metadata) + sorted(keys.split)
    )
    if keys.span_id:
        selected_columns.append(keys.span_id)

    csv_buffer = BytesIO()
    df[selected_columns].to_csv(csv_buffer, index=False)  # pyright: ignore[reportUnknownMemberType]
    csv_buffer.seek(0)

    compressed = BytesIO()
    compressed.write(gzip.compress(csv_buffer.read()))
    compressed.seek(0)

    return ("dataframe.csv", compressed, "text/csv", {"Content-Encoding": "gzip"})


def _infer_keys(
    table: Union[str, Path, "pd.DataFrame"],
) -> tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]:
    """
    Infer input/output/metadata keys from table structure.

    Uses pattern matching to detect response/output columns automatically.
    """
    try:
        import pandas as pd

        if isinstance(table, pd.DataFrame):
            column_headers = tuple(table.columns)
        else:
            column_headers = _get_csv_column_headers(Path(table))
    except ImportError as e:
        if not isinstance(table, (str, Path)):
            raise ValueError("Pandas not available, table must be a CSV file path") from e
        column_headers = _get_csv_column_headers(Path(table))

    # Pattern to match output/response columns
    output_pattern = re.compile(r"(?i)(response|answer|output)s?$")

    output_idx = None
    for i, header in enumerate(column_headers):
        if output_pattern.search(header):
            output_idx = i
            break

    if output_idx is None:
        # No output column found - all columns are inputs
        return (column_headers, (), ())

    # Split columns: inputs before output, output column, metadata after
    input_cols = column_headers[:output_idx]
    output_cols = (column_headers[output_idx],)
    metadata_cols = column_headers[output_idx + 1 :]

    return (input_cols, output_cols, metadata_cols)


def _is_all_dict(seq: Iterable[Any]) -> bool:
    """Check if all items in sequence are dictionaries."""
    return all(isinstance(item, dict) for item in seq)


class DatasetUploadError(Exception):
    """Custom exception for dataset upload errors."""

    pass
