import csv
import gzip
import json
import logging
import re
from collections import Counter
from collections.abc import Iterable, Mapping
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, Any, BinaryIO, Iterator, Literal, Optional, Union
from urllib.parse import quote

import httpx

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 5


def _is_valid_dataset_example(obj: Any) -> bool:
    """
    Check if an object is a valid DatasetExample using the TypedDict's annotations.
    """
    if not isinstance(obj, dict):
        return False

    # Get the required fields from the TypedDict annotations
    required_fields = set(v1.DatasetExample.__annotations__.keys())

    # Check all required fields are present
    if not required_fields.issubset(obj.keys()):
        return False
    return True


class Dataset:
    """
    A dataset with its examples and version information.

    This class combines dataset metadata with examples data for a more ergonomic API.
    It provides easy access to common fields and can be passed directly to other dataset methods.

    Attributes:
        id: The dataset ID
        name: The dataset name
        description: The dataset description
        version_id: The current version ID
        examples: List of examples in this version
        metadata: Additional dataset metadata
        created_at: When the dataset was created
        updated_at: When the dataset was last updated
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
    def examples(self) -> list[v1.DatasetExample]:
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
        # Try to get from DatasetWithExampleCount first
        if "example_count" in self._dataset_info:
            return self._dataset_info["example_count"]
        # Fall back to counting examples
        return len(self.examples)

    def __repr__(self) -> str:
        return (
            f"Dataset(id={self.id!r}, name={self.name!r}, "
            f"version_id={self.version_id!r}, examples={self.example_count})"
        )

    def __len__(self) -> int:
        """Number of examples in this dataset version."""
        return len(self.examples)

    def __iter__(self) -> Iterator[v1.DatasetExample]:
        """Iterate over examples."""
        return iter(self.examples)

    def __getitem__(self, index: int) -> v1.DatasetExample:
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

        Example:
            >>> dataset = client.datasets.get_dataset(dataset_name="my-dataset")
            >>> df = dataset.to_dataframe()
            >>> print(df.columns)
            Index(['input', 'output', 'metadata'], dtype='object')
            >>> print(df.index.name)
            example_id
        """
        try:
            import pandas as pd
        except ImportError:
            raise ImportError(
                "pandas is required to use to_dataframe(). " "Install it with 'pip install pandas'"
            )

        from copy import deepcopy

        if not self.examples:
            # Return empty DataFrame with expected structure
            return pd.DataFrame(columns=["input", "output", "metadata"]).set_index(
                pd.Index([], name="example_id")
            )

        # Convert examples to records for DataFrame
        records = [
            {
                "example_id": example["id"],
                "input": deepcopy(example["input"]),
                "output": deepcopy(example["output"]),
                "metadata": deepcopy(example["metadata"]),
            }
            for example in self.examples
        ]

        return pd.DataFrame.from_records(records).set_index("example_id")


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
        self, input_keys: frozenset[str], output_keys: frozenset[str], metadata_keys: frozenset[str]
    ):
        self.input = input_keys
        self.output = output_keys
        self.metadata = metadata_keys

        # Check for overlapping keys
        if self.input & self.output:
            raise ValueError(f"Input and output keys overlap: {self.input & self.output}")
        if self.input & self.metadata:
            raise ValueError(f"Input and metadata keys overlap: {self.input & self.metadata}")
        if self.output & self.metadata:
            raise ValueError(f"Output and metadata keys overlap: {self.output & self.metadata}")

    def check_differences(self, available_keys: frozenset[str]) -> None:
        """Check that all specified keys exist in available keys."""
        all_keys = self.input | self.output | self.metadata
        if diff := all_keys - available_keys:
            raise ValueError(f"Keys not found in available columns: {diff}")

    def __iter__(self) -> "Iterator[str]":
        """Allow iteration over all keys."""
        return iter(self.input | self.output | self.metadata)


def _parse_datetime(datetime_str: str) -> datetime:
    """Convert ISO datetime string to datetime object."""
    return datetime.fromisoformat(datetime_str)


class Datasets:
    """
    Provides methods for interacting with dataset resources.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> client = Client()
            >>> dataset = client.datasets.get_dataset(dataset_name="my-dataset")
            >>> print(f"Dataset {dataset.name} has {len(dataset)} examples")
            >>> versions = client.datasets.get_dataset_versions(dataset=dataset)

        Method chaining:
            >>> # Create dataset and get its versions
            >>> dataset = client.datasets.create_dataset(
            ...     dataset_name="my-dataset",
            ...     inputs=[{"text": "hello"}],
            ...     outputs=[{"response": "hi"}]
            ... )
            >>> versions = client.datasets.get_dataset_versions(dataset=dataset)
            >>>
            >>> # Add individual examples from one dataset to another
            >>> source_dataset = client.datasets.get_dataset(dataset_name="source")
            >>> updated = client.datasets.add_examples_to_dataset(
            ...     dataset_name="target",
            ...     examples=source_dataset[0]  # Pass a single example!
            ... )
            >>> print(f"Dataset now has {len(updated)} examples")
            >>>
            >>> # Or add multiple specific examples
            >>> client.datasets.add_examples_to_dataset(
            ...     dataset_name="target",
            ...     examples=source_dataset.examples[:5]  # First 5 examples
            ... )

        Working with examples:
            >>> # Iterate over examples
            >>> for example in dataset:
            ...     print(example["input"], "->", example["output"])
            >>>
            >>> # Access examples by index
            >>> first_example = dataset[0]
            >>>
            >>> # Get all examples as a list
            >>> all_examples = dataset.examples
            >>>
            >>> # Convert to pandas DataFrame (requires pandas)
            >>> df = dataset.to_dataframe()
            >>> print(df.head())
            >>> # DataFrame has 'input', 'output', 'metadata' columns containing dictionaries

        Using DataFrame with add_examples_to_dataset:
            >>> # Get dataset and convert to DataFrame
            >>> source = client.datasets.get_dataset(dataset_name="source")
            >>> df = source.to_dataframe()
            >>>
            >>> # Extract dictionaries from DataFrame columns
            >>> inputs = df['input'].tolist()
            >>> outputs = df['output'].tolist()
            >>> metadata = df['metadata'].tolist()
            >>>
            >>> # Use extracted data to create/update datasets
            >>> client.datasets.add_examples_to_dataset(
            ...     dataset_name="target",
            ...     inputs=inputs,
            ...     outputs=outputs,
            ...     metadata=metadata
            ... )
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def _resolve_dataset_id_and_name(
        self,
        *,
        dataset: Optional[DatasetIdentifier] = None,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Resolve dataset ID and name from various input forms.

        Returns:
            Tuple of (dataset_id, dataset_name), where either or both may be None
        """
        # If dataset identifier provided, extract ID/name from it
        if dataset is not None:
            if isinstance(dataset, Dataset):
                # Dataset object
                return dataset.id, dataset.name
            elif isinstance(dataset, str):
                # Could be ID or name - try to determine which
                # If it looks like a base64 ID, treat as ID, otherwise as name
                if len(dataset) > 20 and not any(c.isspace() for c in dataset):
                    return dataset, None
                else:
                    return None, dataset
            elif isinstance(dataset, dict):
                # Dictionary with id/name fields
                return dataset.get("id"), dataset.get("name")

        # Use explicit parameters if provided
        return dataset_id, dataset_name

    def get_dataset(
        self,
        *,
        dataset: Optional[DatasetIdentifier] = None,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        version_id: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Gets the dataset for a specific version, or gets the latest version of
        the dataset if no version is specified.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict.
            dataset_id: An ID for the dataset.
            dataset_name: The name for the dataset. If provided, the ID
                is ignored and the dataset is retrieved by name.
            version_id: An ID for the version of the dataset, or None.
            timeout: Optional request timeout in seconds.

        Returns:
            A Dataset object containing the dataset metadata and examples.

        Raises:
            ValueError: If no dataset identifier is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        # Resolve dataset identification
        resolved_id, resolved_name = self._resolve_dataset_id_and_name(
            dataset=dataset, dataset_id=dataset_id, dataset_name=dataset_name, timeout=timeout
        )

        # Use explicit dataset_name parameter if provided, otherwise prefer resolved_id over resolved_name
        if dataset_name:
            resolved_id = self._get_dataset_id_by_name(dataset_name=dataset_name, timeout=timeout)
        elif resolved_id:
            # Use the resolved ID directly
            pass
        elif resolved_name:
            resolved_id = self._get_dataset_id_by_name(dataset_name=resolved_name, timeout=timeout)
        else:
            raise ValueError("Dataset id, name, or dataset object must be provided.")

        # Get dataset info
        dataset_response = self._client.get(
            url=f"v1/datasets/{quote(resolved_id)}",
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        dataset_response.raise_for_status()
        dataset_info = dataset_response.json()["data"]

        # Get examples
        params = {"version_id": version_id} if version_id else None
        examples_response = self._client.get(
            url=f"v1/datasets/{quote(resolved_id)}/examples",
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
        dataset: Optional[DatasetIdentifier] = None,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        limit: Optional[int] = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[dict[str, Any]]:
        """
        Get dataset versions as a list of dictionaries.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict.
            dataset_id: Dataset ID
            dataset_name: Dataset name (will be resolved to ID)
            limit: Maximum number of versions to return, starting from the most recent version
            timeout: Optional request timeout in seconds.

        Returns:
            List of dictionaries containing version information, including:
                - version_id: The version ID
                - created_at: When the version was created (as datetime object)
                - description: Version description (if any)
                - metadata: Version metadata (if any)

        Raises:
            ValueError: If no dataset identifier is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        # Resolve dataset identification
        resolved_id, resolved_name = self._resolve_dataset_id_and_name(
            dataset=dataset, dataset_id=dataset_id, dataset_name=dataset_name, timeout=timeout
        )

        if resolved_name and not resolved_id:
            resolved_id = self._get_dataset_id_by_name(dataset_name=resolved_name, timeout=timeout)

        if not resolved_id:
            raise ValueError("Dataset id, name, or dataset object must be provided.")

        response = self._client.get(
            url=f"v1/datasets/{resolved_id}/versions",
            params={"limit": limit},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        records = response.json()["data"]
        if not records:
            return []

        # Parse datetime strings to datetime objects
        for record in records:
            if "created_at" in record:
                record["created_at"] = _parse_datetime(record["created_at"])

        return records

    def create_dataset(
        self,
        *,
        dataset_name: str,
        examples: Optional[Union[v1.DatasetExample, Iterable[v1.DatasetExample]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
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
            examples: Either a single DatasetExample or list of DatasetExample objects to add.
                When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
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
        # Handle examples parameter by extracting inputs/outputs/metadata
        if examples is not None:
            # Check if examples is a single DatasetExample or iterable
            if _is_valid_dataset_example(examples):
                # Single DatasetExample
                examples_list = [examples]
            else:
                # Iterable of DatasetExample objects
                examples_list = list(examples)

            # Extract inputs, outputs, metadata from examples
            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example["metadata"]) for example in examples_list]

        # Validate parameter combinations
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

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None  # Type narrowing for mypy
            return self._upload_tabular_dataset(
                table,
                dataset_name=dataset_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )
        else:
            return self._upload_json_dataset(
                dataset_name=dataset_name,
                inputs=inputs,
                outputs=outputs,
                metadata=metadata,
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )

    def add_examples_to_dataset(
        self,
        *,
        dataset: Optional[DatasetIdentifier] = None,
        dataset_name: Optional[str] = None,
        examples: Optional[Union[v1.DatasetExample, Iterable[v1.DatasetExample]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Append examples to an existing dataset on the Phoenix server.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict.
            dataset_name: Name of the dataset. If dataset is provided, this is ignored.
            examples: Either a single DatasetExample or list of DatasetExample objects to add.
                When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
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
        # Resolve dataset name
        _, resolved_name = self._resolve_dataset_id_and_name(
            dataset=dataset, dataset_name=dataset_name, timeout=timeout
        )

        if not resolved_name:
            raise ValueError("Dataset name or dataset object must be provided.")

        # Handle examples parameter by extracting inputs/outputs/metadata
        if examples is not None:
            # Check if examples is a single DatasetExample or iterable
            if _is_valid_dataset_example(examples):
                # Single DatasetExample
                examples_list = [examples]
            else:
                # Iterable of DatasetExample objects
                examples_list = list(examples)

            # Extract inputs, outputs, metadata from examples
            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example["metadata"]) for example in examples_list]

        # Validate parameter combinations
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

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None  # Type narrowing for mypy
            return self._upload_tabular_dataset(
                table,
                dataset_name=resolved_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
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
        dataset_description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Upload tabular data (CSV or DataFrame) as dataset.
        """
        # Convert keys to frozensets and validate
        input_keys_set = frozenset(input_keys)
        output_keys_set = frozenset(output_keys)
        metadata_keys_set = frozenset(metadata_keys)

        # Auto-infer keys if none provided
        if not any([input_keys_set, output_keys_set, metadata_keys_set]):
            input_keys_tuple, output_keys_tuple, metadata_keys_tuple = _infer_keys(table)
            input_keys_set = frozenset(input_keys_tuple)
            output_keys_set = frozenset(output_keys_tuple)
            metadata_keys_set = frozenset(metadata_keys_tuple)

        keys = DatasetKeys(input_keys_set, output_keys_set, metadata_keys_set)

        if isinstance(table, Path) or isinstance(table, str):
            # Handle CSV file
            file = _prepare_csv(Path(table), keys)
        else:
            # Handle DataFrame - requires pandas
            try:
                import pandas as pd

                if not isinstance(table, pd.DataFrame):
                    raise ValueError("Expected pandas DataFrame")
            except ImportError:
                raise ImportError(
                    "pandas is required to upload DataFrames. "
                    "Install it with 'pip install pandas'"
                )
            file = _prepare_dataframe_as_json(table, keys)

        # Upload file
        logger.info("Uploading dataset...")
        response = self._client.post(
            url="v1/datasets/upload",
            files={"file": file},
            data={
                "action": action,
                "name": dataset_name,
                "description": dataset_description or "",
                "input_keys[]": sorted(keys.input),
                "output_keys[]": sorted(keys.output),
                "metadata_keys[]": sorted(keys.metadata),
            },
            params={"sync": True},
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

        if not inputs_list:
            raise ValueError("inputs must be non-empty")

        if not _is_all_dict(inputs_list):
            raise ValueError("inputs must contain only dictionaries")

        # Validate outputs and metadata if provided
        for name, data in [("outputs", outputs_list), ("metadata", metadata_list)]:
            if data:
                if len(data) != len(inputs_list):
                    raise ValueError(
                        f"{name} must have same length as inputs "
                        f"({len(data)} != {len(inputs_list)})"
                    )
                if not _is_all_dict(data):
                    raise ValueError(f"{name} must contain only dictionaries")

        # Prepare request payload
        payload = {
            "action": action,
            "name": dataset_name,
            "inputs": inputs_list,
            "outputs": outputs_list or [{}] * len(inputs_list),
            "metadata": metadata_list or [{}] * len(inputs_list),
        }

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
            # Extract error message from response if available
            try:
                error_detail = response.json().get("detail", str(e))
            except:
                error_detail = response.text or str(e)
            raise DatasetUploadError(f"Dataset upload failed: {error_detail}") from e

        # Get dataset and version IDs from upload response
        upload_data = response.json()["data"]
        dataset_id = upload_data["dataset_id"]
        version_id = upload_data["version_id"]

        # Get full dataset info and examples
        dataset = self.get_dataset(
            dataset_id=dataset_id,
            version_id=version_id,
            timeout=timeout,
        )

        # Log success info
        logger.info(f"Dataset uploaded successfully. ID: {dataset_id}, Version: {version_id}")

        return dataset


class AsyncDatasets:
    """
    Provides async methods for interacting with dataset resources.

    Example:
        Basic usage:
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()
            >>> dataset = await client.datasets.get_dataset(dataset_name="my-dataset")
            >>> print(f"Dataset {dataset.name} has {len(dataset)} examples")
            >>> df = dataset.to_dataframe()  # Convert to pandas DataFrame

        Method chaining:
            >>> # Create dataset and chain operations
            >>> dataset = await client.datasets.create_dataset(
            ...     dataset_name="my-dataset",
            ...     inputs=[{"text": "hello"}],
            ...     outputs=[{"response": "hi"}]
            ... )
            >>> versions = await client.datasets.get_dataset_versions(dataset=dataset)
            >>>
            >>> # Add individual examples from one dataset to another
            >>> source_dataset = await client.datasets.get_dataset(dataset_name="source")
            >>> await client.datasets.add_examples_to_dataset(
            ...     dataset_name="target",
            ...     examples=source_dataset[0]  # Pass a single example!
            ... )

        Using DataFrame with add_examples_to_dataset:
            >>> # Get dataset and convert to DataFrame
            >>> source = await client.datasets.get_dataset(dataset_name="source")
            >>> df = source.to_dataframe()
            >>>
            >>> # Extract dictionaries from DataFrame columns
            >>> inputs = df['input'].tolist()
            >>> outputs = df['output'].tolist()
            >>> metadata = df['metadata'].tolist()
            >>>
            >>> # Use extracted data to create/update datasets
            >>> await client.datasets.add_examples_to_dataset(
            ...     dataset_name="target",
            ...     inputs=inputs,
            ...     outputs=outputs,
            ...     metadata=metadata
            ... )
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def _resolve_dataset_id_and_name(
        self,
        *,
        dataset: Optional[DatasetIdentifier] = None,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Resolve dataset ID and name from various input forms.

        Returns:
            Tuple of (dataset_id, dataset_name), where either or both may be None
        """
        # If dataset identifier provided, extract ID/name from it
        if dataset is not None:
            if isinstance(dataset, Dataset):
                # Dataset object
                return dataset.id, dataset.name
            elif isinstance(dataset, str):
                # Could be ID or name - try to determine which
                # If it looks like a base64 ID, treat as ID, otherwise as name
                if len(dataset) > 20 and not any(c.isspace() for c in dataset):
                    return dataset, None
                else:
                    return None, dataset
            elif isinstance(dataset, dict):
                # Dictionary with id/name fields
                return dataset.get("id"), dataset.get("name")

        # Use explicit parameters if provided
        return dataset_id, dataset_name

    async def get_dataset(
        self,
        *,
        dataset: Optional[DatasetIdentifier] = None,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        version_id: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Async version of get_dataset.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                dataset object, or tuple returned from other dataset methods.
            dataset_id: An ID for the dataset.
            dataset_name: The name for the dataset. If provided, the ID
                is ignored and the dataset is retrieved by name.
            version_id: An ID for the version of the dataset, or None.
            timeout: Optional request timeout in seconds.

        Returns:
            A tuple of (dataset_info, examples_data) containing the dataset metadata
            and examples with version information.
        """
        # Resolve dataset identification
        resolved_id, resolved_name = await self._resolve_dataset_id_and_name(
            dataset=dataset, dataset_id=dataset_id, dataset_name=dataset_name, timeout=timeout
        )

        # Use explicit dataset_name parameter if provided, otherwise prefer resolved_id over resolved_name
        if dataset_name:
            resolved_id = await self._get_dataset_id_by_name(
                dataset_name=dataset_name, timeout=timeout
            )
        elif resolved_id:
            # Use the resolved ID directly
            pass
        elif resolved_name:
            resolved_id = await self._get_dataset_id_by_name(
                dataset_name=resolved_name, timeout=timeout
            )
        else:
            raise ValueError("Dataset id, name, or dataset object must be provided.")

        # Get dataset info
        dataset_response = await self._client.get(
            url=f"v1/datasets/{quote(resolved_id)}",
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        dataset_response.raise_for_status()
        dataset_info = dataset_response.json()["data"]

        # Get examples
        params = {"version_id": version_id} if version_id else None
        examples_response = await self._client.get(
            url=f"v1/datasets/{quote(resolved_id)}/examples",
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
        dataset: Optional[DatasetIdentifier] = None,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        limit: Optional[int] = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[dict[str, Any]]:
        """
        Get dataset versions as a list of dictionaries.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict.
            dataset_id: Dataset ID
            dataset_name: Dataset name (will be resolved to ID)
            limit: Maximum number of versions to return, starting from the most recent version
            timeout: Optional request timeout in seconds.

        Returns:
            List of dictionaries containing version information, including:
                - version_id: The version ID
                - created_at: When the version was created (as datetime object)
                - description: Version description (if any)
                - metadata: Version metadata (if any)

        Raises:
            ValueError: If no dataset identifier is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        # Resolve dataset identification
        resolved_id, resolved_name = await self._resolve_dataset_id_and_name(
            dataset=dataset, dataset_id=dataset_id, dataset_name=dataset_name, timeout=timeout
        )

        if resolved_name and not resolved_id:
            resolved_id = await self._get_dataset_id_by_name(
                dataset_name=resolved_name, timeout=timeout
            )

        if not resolved_id:
            raise ValueError("Dataset id, name, or dataset object must be provided.")

        response = await self._client.get(
            url=f"v1/datasets/{resolved_id}/versions",
            params={"limit": limit},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        records = response.json()["data"]
        if not records:
            return []

        # Parse datetime strings to datetime objects
        for record in records:
            if "created_at" in record:
                record["created_at"] = _parse_datetime(record["created_at"])

        return records

    async def create_dataset(
        self,
        *,
        dataset_name: str,
        examples: Optional[Union[v1.DatasetExample, Iterable[v1.DatasetExample]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
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
            examples: Either a single DatasetExample or list of DatasetExample objects to add.
                When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
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
        # Handle examples parameter by extracting inputs/outputs/metadata
        if examples is not None:
            # Check if examples is a single DatasetExample or iterable
            if _is_valid_dataset_example(examples):
                # Single DatasetExample
                examples_list = [examples]
            else:
                # Iterable of DatasetExample objects
                examples_list = list(examples)

            # Extract inputs, outputs, metadata from examples
            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example["metadata"]) for example in examples_list]

        # Validate parameter combinations
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

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None  # Type narrowing for mypy
            return await self._upload_tabular_dataset(
                table,
                dataset_name=dataset_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )
        else:
            return await self._upload_json_dataset(
                dataset_name=dataset_name,
                inputs=inputs,
                outputs=outputs,
                metadata=metadata,
                dataset_description=dataset_description,
                action="create",
                timeout=timeout,
            )

    async def add_examples_to_dataset(
        self,
        *,
        dataset: Optional[DatasetIdentifier] = None,
        dataset_name: Optional[str] = None,
        examples: Optional[Union[v1.DatasetExample, Iterable[v1.DatasetExample]]] = None,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """
        Async version of add_examples_to_dataset.

        Args:
            dataset: A dataset identifier - can be a dataset ID string, name string,
                Dataset object, or dict.
            dataset_name: Name of the dataset. If dataset is provided, this is ignored.
            examples: Either a single DatasetExample or list of DatasetExample objects to add.
                When provided, inputs/outputs/metadata are extracted automatically.
            dataframe: pandas DataFrame (requires pandas to be installed).
            csv_file_path: Location of a CSV text file
            input_keys: List of column names used as input keys.
            output_keys: List of column names used as output keys.
            metadata_keys: List of column names used as metadata keys.
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
        # Resolve dataset name
        _, resolved_name = await self._resolve_dataset_id_and_name(
            dataset=dataset, dataset_name=dataset_name, timeout=timeout
        )

        if not resolved_name:
            raise ValueError("Dataset name or dataset object must be provided.")

        # Handle examples parameter by extracting inputs/outputs/metadata
        if examples is not None:
            # Check if examples is a single DatasetExample or iterable
            if _is_valid_dataset_example(examples):
                # Single DatasetExample
                examples_list = [examples]
            else:
                # Iterable of DatasetExample objects
                examples_list = list(examples)

            # Extract inputs, outputs, metadata from examples
            inputs = [dict(example["input"]) for example in examples_list]
            outputs = [dict(example["output"]) for example in examples_list]
            metadata = [dict(example["metadata"]) for example in examples_list]

        # Validate parameter combinations
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

        if has_tabular:
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None  # Type narrowing for mypy
            return await self._upload_tabular_dataset(
                table,
                dataset_name=resolved_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
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
        dataset_description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """Async version of _upload_tabular_dataset."""
        # Convert keys to frozensets and validate
        input_keys_set = frozenset(input_keys)
        output_keys_set = frozenset(output_keys)
        metadata_keys_set = frozenset(metadata_keys)

        # Auto-infer keys if none provided
        if not any([input_keys_set, output_keys_set, metadata_keys_set]):
            input_keys_tuple, output_keys_tuple, metadata_keys_tuple = _infer_keys(table)
            input_keys_set = frozenset(input_keys_tuple)
            output_keys_set = frozenset(output_keys_tuple)
            metadata_keys_set = frozenset(metadata_keys_tuple)

        keys = DatasetKeys(input_keys_set, output_keys_set, metadata_keys_set)

        if isinstance(table, Path) or isinstance(table, str):
            # Handle CSV file
            file = _prepare_csv(Path(table), keys)
        else:
            # Handle DataFrame - requires pandas
            try:
                import pandas as pd

                if not isinstance(table, pd.DataFrame):
                    raise ValueError("Expected pandas DataFrame")
            except ImportError:
                raise ImportError(
                    "pandas is required to upload DataFrames. "
                    "Install it with 'pip install pandas'"
                )
            file = _prepare_dataframe_as_json(table, keys)

        # Upload file
        logger.info("Uploading dataset...")
        response = await self._client.post(
            url="v1/datasets/upload",
            files={"file": file},
            data={
                "action": action,
                "name": dataset_name,
                "description": dataset_description or "",
                "input_keys[]": sorted(keys.input),
                "output_keys[]": sorted(keys.output),
                "metadata_keys[]": sorted(keys.metadata),
            },
            params={"sync": True},
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
        dataset_description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Dataset:
        """Async version of _upload_json_dataset."""
        # Convert to lists to handle generators and validate
        inputs_list = list(inputs)
        outputs_list = list(outputs) if outputs else []
        metadata_list = list(metadata) if metadata else []

        if not inputs_list:
            raise ValueError("inputs must be non-empty")

        if not _is_all_dict(inputs_list):
            raise ValueError("inputs must contain only dictionaries")

        # Validate outputs and metadata if provided
        for name, data in [("outputs", outputs_list), ("metadata", metadata_list)]:
            if data:
                if len(data) != len(inputs_list):
                    raise ValueError(
                        f"{name} must have same length as inputs "
                        f"({len(data)} != {len(inputs_list)})"
                    )
                if not _is_all_dict(data):
                    raise ValueError(f"{name} must contain only dictionaries")

        # Prepare request payload
        payload = {
            "action": action,
            "name": dataset_name,
            "inputs": inputs_list,
            "outputs": outputs_list or [{}] * len(inputs_list),
            "metadata": metadata_list or [{}] * len(inputs_list),
        }

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
            # Extract error message from response if available
            try:
                error_detail = response.json().get("detail", str(e))
            except:
                error_detail = response.text or str(e)
            raise DatasetUploadError(f"Dataset upload failed: {error_detail}") from e

        # Get dataset and version IDs from upload response
        upload_data = response.json()["data"]
        dataset_id = upload_data["dataset_id"]
        version_id = upload_data["version_id"]

        # Get full dataset info and examples
        dataset = await self.get_dataset(
            dataset_id=dataset_id,
            version_id=version_id,
            timeout=timeout,
        )

        # Log success info
        logger.info(f"Dataset uploaded successfully. ID: {dataset_id}, Version: {version_id}")

        return dataset


# Helper functions


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
        except StopIteration:
            raise ValueError("CSV file has no data rows")

    return column_headers


def _prepare_csv(path: Path, keys: DatasetKeys) -> tuple[str, BinaryIO, str, dict[str, str]]:
    """
    Prepare CSV file for upload with validation and compression.
    """
    # Get and validate headers
    column_headers = _get_csv_column_headers(path)
    header_counts = Counter(column_headers)
    duplicates = [h for h, count in header_counts.items() if count > 1]
    if duplicates:
        raise ValueError(f"Duplicate column headers in CSV: {duplicates}")

    # Check that all keys exist in headers
    keys.check_differences(frozenset(column_headers))

    # Read and compress file
    with open(path, "rb") as f:
        content = f.read()

    compressed = BytesIO()
    compressed.write(gzip.compress(content))
    compressed.seek(0)

    return (path.name, compressed, "text/csv", {"Content-Encoding": "gzip"})


def _prepare_dataframe_as_json(
    df: "pd.DataFrame", keys: DatasetKeys
) -> tuple[str, BinaryIO, str, dict[str, str]]:
    """
    Prepare pandas DataFrame for upload as compressed JSON.
    """
    import pandas as pd

    if df.empty:
        raise ValueError("DataFrame has no data")

    # Check for duplicate columns
    column_counts = Counter(df.columns)
    duplicates = [col for col, count in column_counts.items() if count > 1]
    if duplicates:
        raise ValueError(f"Duplicate column names in DataFrame: {duplicates}")

    # Validate keys exist
    keys.check_differences(frozenset(df.columns))

    # Convert DataFrame to list of records for JSON serialization
    # Only include columns specified in keys
    selected_columns = list(keys)
    records = df[selected_columns].to_dict(orient="records")

    # Serialize to JSON and compress
    json_str = json.dumps(records, default=str)  # default=str handles dates/etc
    compressed = BytesIO()
    compressed.write(gzip.compress(json_str.encode("utf-8")))
    compressed.seek(0)

    return ("dataframe.json", compressed, "application/json", {"Content-Encoding": "gzip"})


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
    except ImportError:
        # If pandas not available, must be CSV
        if not isinstance(table, (str, Path)):
            raise ValueError("Pandas not available, table must be a CSV file path")
        column_headers = _get_csv_column_headers(Path(table))

    # Pattern to match output/response columns
    output_pattern = re.compile(r"(?i)(response|answer|output)s?$")

    # Find first column that matches output pattern
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


# IMPLEMENTATION NOTES:
#
# Key Design Decisions Made:
#
# 1. **No PyArrow Dependency**: Replaced PyArrow serialization with JSON + gzip compression
#    for DataFrames. This significantly reduces the dependency footprint while maintaining
#    functionality. The server already supports JSON uploads.
#
# 2. **Rich Dataset Objects**: Methods return a rich Dataset class that combines dataset
#    metadata with examples data. This provides a more ergonomic API with property access
#    to common fields like id, name, version_id, and examples.
#
# 3. **Simplified Compression**: Always use gzip for file uploads (CSV and DataFrame-as-JSON).
#    Removed the complexity around compression decisions - the server handles it well.
#
# 4. **Lazy Pandas Import**: All pandas usage is behind try/except ImportError blocks with
#    helpful error messages, making pandas truly optional.
#
# 5. **Simplified Error Handling**: Using DatasetUploadError for upload-specific errors,
#    standard httpx.HTTPStatusError for API errors, and ValueError for validation.
#
# 6. **No Printing/URLs**: Removed print statements and URL construction from the old client.
#    This should be handled by the application layer, not the client library.
#
# 7. **Consistent Parameter Names**: Using underscore versions (dataset_name, dataset_id)
#    throughout for Python convention consistency.
#
# ERGONOMICS IMPROVEMENTS:
#
# 1. **Flexible Input Parameters**: All dataset methods accept a `dataset` parameter
#    that can be a dataset ID, name, Dataset object, or dict. This enables natural
#    method chaining without manual ID extraction.
#
# 2. **Rich Dataset Class**: The Dataset class provides:
#    - Property access to common fields (id, name, version_id, examples)
#    - Iterator support for looping over examples
#    - Index access to get specific examples
#    - Length support to get example count
#
# 3. **Consistent Parameter Patterns**: All methods consistently accept dataset_id,
#    dataset_name, or the flexible dataset parameter for maximum flexibility.
#
# Areas for Future Enhancement:
#
# 1. **Key Inference**: The pattern-based key inference is simplistic. Could be enhanced
#    with more sophisticated patterns or configuration.
#
# 2. **Async File I/O**: The async methods still use synchronous file I/O for CSV reading.
#    Could use aiofiles for true async I/O if performance becomes an issue.
#
# 3. **Additional Workflow Methods**: Could add more convenience methods like:
#    - clone_dataset() for duplicating datasets
#    - compare_datasets() for dataset comparison workflows
#    - batch operations for processing multiple datasets
