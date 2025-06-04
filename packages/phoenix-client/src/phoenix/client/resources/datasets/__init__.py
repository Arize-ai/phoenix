import csv
import gzip
import json
import logging
import re
from collections import Counter
from collections.abc import Iterable, Mapping
from datetime import datetime
from io import BytesIO, StringIO
from pathlib import Path
from typing import TYPE_CHECKING, Any, BinaryIO, Iterator, Literal, Optional, Union
from urllib.parse import quote, urljoin

import httpx

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 5


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
            >>> dataset, examples = client.datasets.get_dataset(dataset_name="my-dataset")
            >>> versions_df = client.datasets.get_dataset_versions_dataframe(dataset_id="123")
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_dataset(
        self,
        *,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        version_id: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
        """
        Gets the dataset for a specific version, or gets the latest version of
        the dataset if no version is specified.

        Args:
            dataset_id: An ID for the dataset.
            dataset_name: The name for the dataset. If provided, the ID
                is ignored and the dataset is retrieved by name.
            version_id: An ID for the version of the dataset, or None.
            timeout: Optional request timeout in seconds.

        Returns:
            A tuple of (dataset_info, examples_data) containing the dataset metadata
            and examples with version information.

        Raises:
            ValueError: If neither dataset_id nor dataset_name is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if dataset_name:
            dataset_id = self._get_dataset_id_by_name(dataset_name=dataset_name, timeout=timeout)

        if not dataset_id:
            raise ValueError("Dataset id or name must be provided.")

        # Get dataset info
        dataset_response = self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}",
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        dataset_response.raise_for_status()
        dataset_info = dataset_response.json()["data"]

        # Get examples
        params = {"version_id": version_id} if version_id else None
        examples_response = self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}/examples",
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        examples_response.raise_for_status()
        examples_data = examples_response.json()["data"]

        return dataset_info, examples_data

    def get_dataset_versions_dataframe(
        self,
        *,
        dataset_id: str,
        limit: Optional[int] = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Get dataset versions as pandas DataFrame.

        Args:
            dataset_id: Dataset ID
            limit: Maximum number of versions to return, starting from the most recent version
            timeout: Optional request timeout in seconds.

        Returns:
            pandas DataFrame with version information

        Raises:
            ImportError: If pandas is not installed
            httpx.HTTPStatusError: If the API returns an error response.
        """
        try:
            import pandas as pd
        except ImportError:
            raise ImportError(
                "pandas is required to use get_dataset_versions_dataframe. "
                "Install it with 'pip install pandas'"
            )

        response = self._client.get(
            url=f"v1/datasets/{dataset_id}/versions",
            params={"limit": limit},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        if not (records := response.json()["data"]):
            return pd.DataFrame()

        df = pd.DataFrame.from_records(records, index="version_id")
        df["created_at"] = pd.to_datetime(df["created_at"])
        return df

    def create_dataset(
        self,
        *,
        dataset_name: str,
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
        """
        Create a new dataset by uploading examples to the Phoenix server.

        Args:
            dataset_name: Name of the dataset.
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
            A tuple of (dataset_info, examples_data) containing the uploaded dataset
            metadata and examples with version information.

        Raises:
            ValueError: If invalid parameter combinations are provided.
            ImportError: If pandas is required but not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        # Validate parameter combinations
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if has_tabular and has_json:
            raise ValueError(
                "Please provide either tabular data (dataframe/csv_file_path) "
                "or JSON data (inputs/outputs/metadata), but not both"
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
        dataset_name: str,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
        """
        Append examples to an existing dataset on the Phoenix server.

        Args:
            dataset_name: Name of the dataset.
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
            A tuple of (dataset_info, examples_data) containing the dataset
            metadata and examples with version information.

        Raises:
            ValueError: If invalid parameter combinations are provided.
            ImportError: If pandas is required but not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        # Validate parameter combinations
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if has_tabular and has_json:
            raise ValueError(
                "Please provide either tabular data (dataframe/csv_file_path) "
                "or JSON data (inputs/outputs/metadata), but not both"
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
                dataset_description=None,
                action="append",
                timeout=timeout,
            )
        else:
            return self._upload_json_dataset(
                dataset_name=dataset_name,
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
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
        dataset_info, examples_data = self.get_dataset(
            dataset_id=dataset_id,
            version_id=version_id,
            timeout=timeout,
        )

        # Log success info
        logger.info(f"Dataset uploaded successfully. ID: {dataset_id}, Version: {version_id}")

        return dataset_info, examples_data


class AsyncDatasets:
    """
    Provides async methods for interacting with dataset resources.

    Example:
        Basic usage:
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()
            >>> dataset_info, examples_data = await client.datasets.get_dataset(dataset_name="my-dataset")
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def get_dataset(
        self,
        *,
        dataset_id: Optional[str] = None,
        dataset_name: Optional[str] = None,
        version_id: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
        """Async version of get_dataset."""
        if dataset_name:
            dataset_id = await self._get_dataset_id_by_name(
                dataset_name=dataset_name, timeout=timeout
            )

        if not dataset_id:
            raise ValueError("Dataset id or name must be provided.")

        # Get dataset info
        dataset_response = await self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}",
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        dataset_response.raise_for_status()
        dataset_info = dataset_response.json()["data"]

        # Get examples
        params = {"version_id": version_id} if version_id else None
        examples_response = await self._client.get(
            url=f"v1/datasets/{quote(dataset_id)}/examples",
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        examples_response.raise_for_status()
        examples_data = examples_response.json()["data"]

        return dataset_info, examples_data

    async def get_dataset_versions_dataframe(
        self,
        *,
        dataset_id: str,
        limit: Optional[int] = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """Async version of get_dataset_versions_dataframe."""
        try:
            import pandas as pd
        except ImportError:
            raise ImportError(
                "pandas is required to use get_dataset_versions_dataframe. "
                "Install it with 'pip install pandas'"
            )

        response = await self._client.get(
            url=f"v1/datasets/{dataset_id}/versions",
            params={"limit": limit},
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()

        if not (records := response.json()["data"]):
            return pd.DataFrame()

        df = pd.DataFrame.from_records(records, index="version_id")
        df["created_at"] = pd.to_datetime(df["created_at"])
        return df

    async def create_dataset(
        self,
        *,
        dataset_name: str,
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
        """Async version of create_dataset."""
        # Use sync dataset instance for implementation logic
        sync_datasets = Datasets(None)  # type: ignore

        # Validate parameter combinations (reuse sync logic)
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if has_tabular and has_json:
            raise ValueError(
                "Please provide either tabular data (dataframe/csv_file_path) "
                "or JSON data (inputs/outputs/metadata), but not both"
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
        dataset_name: str,
        dataframe: Optional["pd.DataFrame"] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
        """Async version of add_examples_to_dataset."""
        # Validate parameter combinations (reuse sync logic)
        has_tabular = dataframe is not None or csv_file_path is not None
        has_json = any(inputs) or any(outputs) or any(metadata)

        if has_tabular and has_json:
            raise ValueError(
                "Please provide either tabular data (dataframe/csv_file_path) "
                "or JSON data (inputs/outputs/metadata), but not both"
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
                dataset_description=None,
                action="append",
                timeout=timeout,
            )
        else:
            return await self._upload_json_dataset(
                dataset_name=dataset_name,
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
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
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
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
        dataset_info, examples_data = await self.get_dataset(
            dataset_id=dataset_id,
            version_id=version_id,
            timeout=timeout,
        )

        # Log success info
        logger.info(f"Dataset uploaded successfully. ID: {dataset_id}, Version: {version_id}")

        return dataset_info, examples_data


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
# 2. **Return Tuples of Generated Types**: Methods return tuples like
#    (dataset_info, examples_data) instead of wrapper classes. This is consistent with
#    the spans module and keeps the client lightweight.
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
# Areas Still Needing Design Decisions:

#
# 3. **Key Inference**: The pattern-based key inference is simplistic. Could be enhanced
#    with more sophisticated patterns or configuration.
#
# 4. **Async File I/O**: The async methods still use synchronous file I/O for CSV reading.
#    Could use aiofiles for true async I/O if performance becomes an issue.
#
#
# DEVELOPER FLOW IMPROVEMENT OPPORTUNITIES:
#
# Current Issues Identified:
#
# 1. **Awkward Object Flow**: Tuple returns require manual ID extraction for chaining operations.
#    Users must do: dataset_info, examples = create_dataset(...); id = dataset_info["id"]
#    Instead of: dataset = create_dataset(...); dataset.get_versions()
#
# 2. **Inconsistent Parameter Patterns**: Some methods take dataset_id, others dataset_name,
#    creating friction in workflows. get_dataset() accepts both, but get_dataset_versions_dataframe()
#    only accepts dataset_id.
#
# 3. **Complex Return Types**: Tuple unpacking (dataset_info, examples_data) creates cognitive
#    overhead. No clear "primary" object representing "the dataset".
#
# Potential Improvements (Future Considerations):
#
# 1. **Dataset Wrapper Class**: A lightweight DatasetResult class that provides:
#    - .id, .name, .version_id properties for easy access
#    - .get_versions_dataframe() method for chaining
#    - .add_examples() method for fluent operations
#    - Maintains backward compatibility with tuple returns via overloads
#
# 2. **Consistent Parameter Handling**: All methods should accept flexible dataset identification
#    via both dataset_id and dataset_name parameters consistently.
#
# 3. **Workflow-Specific Methods**: Add convenience methods like:
#    - create_and_get_versions() for common patterns
#    - clone_dataset() for duplicating existing datasets
#    - Methods that naturally flow from one to the next
#
# 4. **Better Type Hints**: DatasetIdentifier = Union[str, DatasetResult] for parameters
#    that can accept either raw IDs/names or dataset objects.
#
# 5. **Improved Documentation**: Examples showing natural workflows rather than isolated
#    method calls. Focus on "working with a dataset" rather than "calling methods".
#
# These improvements would make the API more ergonomic while maintaining the current
# architectural decisions around generated types and lightweight client design.
