import csv
import gzip
import logging
import re
from collections import Counter
from collections.abc import Iterable, Mapping
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, Any, BinaryIO, Literal, Optional, Union
from urllib.parse import quote, urljoin

import httpx

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 5


# Stub classes for client interface compatibility
class DatasetKeys:
    """
    Stub for dataset key validation logic.

    TRICKY: This replicates the DatasetKeys functionality from phoenix.db.insertion.dataset
    without importing from the main phoenix package.
    """

    def __init__(
        self, input_keys: frozenset[str], output_keys: frozenset[str], metadata_keys: frozenset[str]
    ):
        self.input = input_keys
        self.output = output_keys
        self.metadata = metadata_keys

    def check_differences(self, available_keys: frozenset[str]) -> None:
        """Check that all specified keys exist in available keys."""
        # TODO: Implement validation logic
        raise NotImplementedError("DatasetKeys validation needs to be implemented")

    def __iter__(self):
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
        # TODO: Implement - needs to handle name->id lookup and version resolution
        raise NotImplementedError("Method needs to be implemented")

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
        # TODO: Implement - straightforward API call returning DataFrame
        raise NotImplementedError("Method needs to be implemented")

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
        # TODO: Implement - complex method with multiple upload formats
        # TRICKY: Need to handle CSV/DataFrame vs JSON inputs, file uploads,
        # key validation, gzip compression. Pandas usage must be lazy-imported.
        raise NotImplementedError("Method needs to be implemented")

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
        # TODO: Implement - similar to create_dataset but with append action
        # TRICKY: Same complexity as create_dataset
        raise NotImplementedError("Method needs to be implemented")

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
        # TODO: Implement - straightforward API call with error handling
        raise NotImplementedError("Method needs to be implemented")

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

        TRICKY IMPLEMENTATION NOTES:
        - Need to handle both CSV files and pandas DataFrames
        - Requires DatasetKeys validation and key inference logic
        - CSV files need column header validation for duplicates
        - DataFrame conversion to JSON with gzip compression (avoid heavy PyArrow dependency)
        - CSV files need gzip compression
        - File upload handling with proper MIME types and headers
        - Complex error handling for various file/data issues
        - All pandas usage must be lazy-imported with proper ImportError handling
        """
        # TODO: Implement - very complex method
        raise NotImplementedError("Method needs to be implemented")

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

        TRICKY IMPLEMENTATION NOTES:
        - Need to validate that inputs/outputs/metadata are all dictionaries
        - Sequence length validation between inputs/outputs/metadata
        - Gzip compression for JSON payload
        - Convert pandas Series to lists to avoid serialization issues
        """
        # TODO: Implement - moderately complex validation and upload
        raise NotImplementedError("Method needs to be implemented")

    def _process_dataset_upload_response(
        self,
        response: httpx.Response,
        *,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]:
        """
        Process the response from dataset upload operations.

        TRICKY IMPLEMENTATION NOTES:
        - Need to handle HTTP errors with custom DatasetUploadError
        - Extract dataset_id from response and make follow-up API call
        - Build complete response tuple with dataset info and examples
        - Print user-friendly URLs and version information
        - Convert datetime strings to datetime objects
        """
        # TODO: Implement - response processing with follow-up calls
        raise NotImplementedError("Method needs to be implemented")


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
        # TODO: Implement async version
        raise NotImplementedError("Method needs to be implemented")

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
        # TODO: Implement async version
        raise NotImplementedError("Method needs to be implemented")

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
        # TODO: Implement async version
        raise NotImplementedError("Method needs to be implemented")

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
        # TODO: Implement async version
        raise NotImplementedError("Method needs to be implemented")

    # TODO: Add async versions of private helper methods as needed


# Helper functions that will need to be implemented
# These are currently in session/client.py and need to be moved/adapted


def _get_csv_column_headers(path: Path) -> tuple[str, ...]:
    """
    Extract column headers from CSV file.

    TRICKY: Need proper error handling for missing files, empty files, etc.
    """
    # TODO: Implement using only built-in csv module
    raise NotImplementedError("Helper function needs to be implemented")


def _prepare_csv(path: Path, keys: DatasetKeys) -> tuple[str, BinaryIO, str, dict[str, str]]:
    """
    Prepare CSV file for upload with validation and compression.

    TRICKY:
    - Column header validation for duplicates using built-in csv module
    - DatasetKeys validation against CSV columns
    - Gzip compression of file contents
    - Return proper file tuple for httpx file upload
    """
    # TODO: Implement using only built-ins (csv, gzip)
    raise NotImplementedError("Helper function needs to be implemented")


def _prepare_dataframe_as_json(
    df: "pd.DataFrame", keys: DatasetKeys
) -> tuple[str, BinaryIO, str, dict[str, str]]:
    """
    Prepare pandas DataFrame for upload as compressed JSON.

    TRICKY:
    - Convert DataFrame to JSON format using pandas.to_dict()
    - Gzip compression for upload
    - Proper column validation
    - Return file tuple for httpx upload
    - Must lazy-import pandas with proper error handling
    """
    # TODO: Implement using JSON serialization instead of PyArrow to avoid heavy dependency
    raise NotImplementedError("Helper function needs to be implemented")


def _infer_keys(
    table: Union[str, Path, "pd.DataFrame"],
) -> tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]:
    """
    Infer input/output/metadata keys from table structure.

    TRICKY: Pattern matching to detect response/output columns automatically
    """
    # TODO: Implement using regex and built-in csv for file inspection
    raise NotImplementedError("Helper function needs to be implemented")


def _is_all_dict(seq: Iterable[Any]) -> bool:
    """Check if all items in sequence are dictionaries."""
    return all(isinstance(item, dict) for item in seq)


class DatasetUploadError(Exception):
    """Custom exception for dataset upload errors."""

    ...


# MIGRATION NOTES:
#
# DEPENDENCY MINIMIZATION APPROACH:
#
# 1. Core Dependencies (Always Available):
#    - httpx: Already required by the client
#    - All Python built-ins: csv, gzip, json, pathlib, datetime, etc.
#    - Generated types from phoenix.client.__generated__.v1
#
# 2. Optional Dependencies (Lazy Import):
#    - pandas: Only imported when DataFrame methods are actually called
#    - Graceful ImportError handling with helpful error messages
#    - All DataFrame functionality behind try/except ImportError blocks
#
# 3. Removed Heavy Dependencies:
#    - PyArrow: Replaced with JSON serialization approach for DataFrames
#    - No direct phoenix package imports
#    - No SQLAlchemy, starlette, or other server dependencies
#
# CLIENT INTERFACE DESIGN:
#
# We return tuples of generated v1 types directly instead of wrapper classes:
# - get_dataset() → tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]
# - create_dataset() → tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]
# - add_examples_to_dataset() → tuple[Union[v1.Dataset, v1.DatasetWithExampleCount], v1.ListDatasetExamplesData]
#
# BENEFITS OF USING GENERATED TYPES DIRECTLY:
# ✅ Lightweight: No wrapper classes, fewer dependencies
# ✅ Type Safety: TypedDict provides static type checking
# ✅ API Consistency: Same types used across client and server
# ✅ Maintainability: One source of truth for type definitions
# ✅ Simplicity: Users work with familiar dict-like structures
#
# DATASET METHODS BEING MIGRATED FROM SESSION CLIENT:
#
# 📦 SESSION CLIENT → NEW CLIENT METHOD MAPPING:
# - get_dataset() → get_dataset() (returns tuple instead of wrapper class)
# - get_dataset_versions() → get_dataset_versions_dataframe()
# - upload_dataset() → create_dataset() (returns tuple instead of wrapper class)
# - append_to_dataset() → add_examples_to_dataset() (returns tuple instead of wrapper class)
# - _get_dataset_id_by_name() → _get_dataset_id_by_name()
# - _upload_tabular_dataset() → _upload_tabular_dataset() (returns tuple)
# - _upload_json_dataset() → _upload_json_dataset() (returns tuple)
# - _process_dataset_upload_response() → _process_dataset_upload_response() (returns tuple)
#
# DATETIME HANDLING:
# - Generated types use ISO datetime strings (v1.DatasetExample["updated_at"]: str)
# - Users can convert to datetime objects using _parse_datetime() utility if needed
# - Example: _parse_datetime(example["updated_at"]) → datetime object
#
# TUPLE RESPONSE FORMAT:
# All dataset methods return (dataset_info, examples_data) where:
# - dataset_info: v1.Dataset or v1.DatasetWithExampleCount (basic info + metadata)
# - examples_data: v1.ListDatasetExamplesData (dataset_id, version_id, examples list)
#
# This gives users access to:
# - dataset_info["id"], dataset_info["name"], dataset_info["description"], etc.
# - examples_data["version_id"] for the specific version
# - examples_data["examples"] for the list of v1.DatasetExample dicts
# - Individual examples: examples_data["examples"][0]["input"], ["output"], ["metadata"], etc.
#
# 📉 COMPRESSION STRATEGY FOR DATASET UPLOADS - QUESTIONS STILL UNRESOLVED:
#
# Current session client compression analysis for dataset methods:
# - _upload_json_dataset (Line 745): Sets "Content-Encoding: gzip" header but doesn't compress payload! 🤔
# - _prepare_csv (Line 824): Manual gzip.compress(f.read()) for CSV files 🤔
#
# COMPRESSION QUESTIONS TO RESOLVE:
# 1. JSON Dataset Upload: Session client sets gzip header but doesn't compress payload
#    - Suggests server may not require compression for JSON dataset uploads
#    - Or httpx handles compression automatically
#    - Or it's a bug/inconsistency
#
# 2. CSV Dataset Upload: Manual compression might be server requirement or optimization
#    - Need to test if server accepts uncompressed CSV for dataset uploads
#    - Compression may not provide significant benefit for typical dataset sizes
#
# RECOMMENDED IMPLEMENTATION PHASES:
#
# Phase 1 - Minimal Working Version (START HERE):
# ```python
# def create_dataset(self, *, dataset_name: str, inputs: list[dict], ...):
#     response = self._client.post(
#         url="v1/datasets/upload",
#         json={"name": dataset_name, "inputs": inputs, ...}
#         # NO compression headers - test if server accepts this
#     )
# ```
#
# Phase 2 - Add Compression Only If Required:
# ```python
# import gzip
# import json
# payload = json.dumps({...}).encode('utf-8')
# compressed = gzip.compress(payload)
# response = self._client.post(
#     url="v1/datasets/upload",
#     content=compressed,
#     headers={"Content-Encoding": "gzip", "Content-Type": "application/json"}
# )
# ```
#
# TESTING STRATEGY FOR DATASET UPLOADS:
# 1. Test dataset upload server requirements:
#    - Try dataset uploads without compression first
#    - Check if server returns errors or accepts uncompressed data
#    - Measure performance difference with/without compression for dataset uploads
# 2. Gradual enhancement:
#    - Start with simplest approach that works
#    - Add compression only if server requires it or significant performance benefit
#    - Prioritize correctness over premature optimization
#
# BENEFITS OF MINIMAL COMPRESSION APPROACH:
# - ✅ Simpler code: No gzip import, no manual compression logic
# - ✅ Fewer edge cases: No compression errors or encoding issues
# - ✅ Faster development: Focus on core dataset functionality first
# - ✅ Easier debugging: Raw dataset payloads are human-readable
# - ✅ Modern HTTP: Most servers/proxies handle compression automatically
#
# MOST TRICKY IMPLEMENTATIONS STILL TO CONSIDER:
#
# 1. Dataset File Upload Handling:
#    - Need to handle CSV files and JSON data with only built-ins
#    - DataFrame support via lazy pandas import + JSON serialization
#    - Gzip compression using built-in gzip module (ONLY IF REQUIRED BY SERVER)
#    - Proper MIME types and headers for different upload formats
#    - httpx file upload syntax for dataset uploads
#
# 2. DatasetKeys Integration:
#    - Created stub DatasetKeys class to avoid importing from phoenix.db
#    - Key validation logic using frozensets and difference checking
#    - Key inference logic with regex pattern matching for dataset columns
#
# 3. Lightweight DataFrame Handling for Datasets:
#    - JSON serialization instead of PyArrow to avoid heavy dependency
#    - Pandas usage behind lazy imports with ImportError handling
#    - CSV handling using built-in csv module for dataset uploads
#
# 4. Dataset Response Processing:
#    - Upload response parsing using v1.UploadDatasetResponseBody
#    - Follow-up API calls to get complete dataset info using v1.ListDatasetExamplesResponseBody
#    - Return tuples of generated types instead of wrapper classes
#    - URL construction for user feedback
#
# 5. Dataset Parameter Validation:
#    - Complex validation between mutually exclusive parameter groups (dataframe vs csv vs inputs)
#    - Length validation between related sequences (inputs/outputs/metadata)
#    - Type checking for dictionary sequences using built-in isinstance
#
# 6. Dataset Error Handling:
#    - Custom DatasetUploadError with proper error message extraction
#    - File system errors for CSV files
#    - HTTP error handling with informative messages
#    - ImportError handling for optional pandas dependency
#
# 7. Async Dataset Versions:
#    - All dataset file operations and HTTP calls need async equivalents
#    - Proper async context managers for file handling
#    - Same lazy import approach for pandas in async methods
#
# 8. Generated Type Integration for Datasets:
#    - Use v1.Dataset, v1.DatasetExample, v1.DatasetVersion for API data
#    - Use v1.ListDatasetExamplesResponseBody, v1.UploadDatasetResponseBody for responses
#    - Return tuples of generated types directly (no wrapper classes needed)
#    - DatasetKeys stub class still needed to replicate validation logic without phoenix.db dependency
