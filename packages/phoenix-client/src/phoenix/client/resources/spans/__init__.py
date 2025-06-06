import logging
import random
import warnings
from copy import deepcopy
from datetime import datetime, timezone, tzinfo
from io import StringIO
from typing import TYPE_CHECKING, Iterable, Optional, Sequence, Union, cast

import httpx
from opentelemetry.sdk.trace.id_generator import RandomIdGenerator as DefaultOTelIDGenerator

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1
from phoenix.client.types.spans import SpanQuery
from phoenix.client.utils.id_handling import is_node_id

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 5
_LOCAL_TIMEZONE = datetime.now(timezone.utc).astimezone().tzinfo
_MAX_SPAN_IDS_PER_REQUEST = 100


# Source implementation:opentelemetry.sdk.trace.id_generator.RandomIdGenerator

_INVALID_SPAN_ID = 0x0000000000000000
_INVALID_TRACE_ID = 0x00000000000000000000000000000000


def _generate_trace_id() -> str:
    """Generates a random trace ID in hexadecimal format (16 bytes / 128 bits)."""
    trace_id = random.getrandbits(128)
    while trace_id == _INVALID_TRACE_ID:
        trace_id = random.getrandbits(128)
    return _hex(trace_id)


def _generate_span_id() -> str:
    """Generates a random span ID in hexadecimal format (8 bytes / 64 bits)."""
    span_id = random.getrandbits(64)
    while span_id == _INVALID_SPAN_ID:
        span_id = random.getrandbits(64)
    return _hex(span_id)


def _hex(number: int) -> str:
    """Converts an integer to a hexadecimal string."""
    return hex(number)[2:]


class Spans:
    """
    Provides methods for interacting with span resources.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> from phoenix.client.types.spans import SpanQuery
            >>> client = Client()
            >>> query = SpanQuery().select("name", "span_id").where("name == 'my-span'")
            >>> df = client.spans.get_spans_dataframe(query=query)
            >>> all_spans_in_project = client.spans.get_spans_dataframe()

            # Create spans
            >>> spans = [{"id": "1", "name": "test", "context": {"trace_id": "123", "span_id": "456"}, ...}]
            >>> result = client.spans.create_spans(project_identifier="my-project", spans=spans)
            >>> print(f"Queued {result['total_queued']} spans")

            # Create spans with error handling
            >>> try:
            ...     result = client.spans.create_spans(
            ...         project_identifier="my-project",
            ...         spans=spans,
            ...         check_duplicates=True,
            ...         raise_on_error=True
            ...     )
            ... except SpanCreationError as e:
            ...     print(f"Failed to create spans: {e}")
            ...     print(f"Invalid spans: {len(e.invalid_spans)}")

            # Create spans with new IDs to guarantee success
            >>> result = client.spans.create_spans(
            ...     project_identifier="my-project",
            ...     spans=spans,
            ...     generate_new_ids=True
            ... )
            >>> print(f"All {result['total_queued']} spans queued successfully")

    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_spans_dataframe(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_identifier: Optional[str] = None,
        project_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Retrieves spans based on the provided filter conditions.

        Args:
            query: A SpanQuery object defining the query criteria.
            start_time: Optional start time for filtering.
            end_time: Optional end time for filtering.
            limit: Maximum number of spans to return.
            root_spans_only: Whether to return only root spans.
            project_name: Optional project name to filter by. Deprecated, use `project_identifier`
                to also specify by the project id.
            project_identifier: Optional project identifier (name or id) to filter by.
            timeout: Optional request timeout in seconds.

        Returns:
            pandas DataFrame

        Raises:
            ImportError: If pandas is not installed
            TimeoutError: If the request times out.
        """
        project_name = project_name
        query = query if query else SpanQuery()
        normalized_start_time = _normalize_datetime(start_time)
        normalized_end_time = _normalize_datetime(end_time)

        request_body = {
            "queries": [query.to_dict()],
            "start_time": _to_iso_format(normalized_start_time),
            "end_time": _to_iso_format(normalized_end_time),
            "limit": limit,
            "root_spans_only": root_spans_only,
        }

        try:
            import pandas as pd

            _ = pd  # Prevent unused symbol error

            if project_identifier and project_name:
                raise ValueError("Provide only one of 'project_identifier' or 'project_name'.")
            elif project_identifier and not project_name:
                if is_node_id(project_identifier, node_type="Project"):
                    project_response = self._client.get(
                        url=f"v1/projects/{project_identifier}",
                        headers={"accept": "application/json"},
                        timeout=timeout,
                    )
                    project_response.raise_for_status()
                    project = project_response.json()
                    project_name = project["data"]["name"]
                else:
                    project_name = project_identifier

            response = self._client.post(
                url="v1/spans",
                headers={"accept": "application/json"},
                params={"project_name": project_name} if project_name else None,
                json=request_body,
                timeout=timeout,
            )
            return _process_span_dataframe(response)
        except httpx.TimeoutException as error:
            error_message = (
                (
                    f"The request timed out after {timeout} seconds. The timeout can be increased "
                    "by passing a larger value to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
                if timeout is not None
                else (
                    "The request timed out. The timeout can be adjusted by "
                    "passing a number of seconds to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
            )
            raise TimeoutError(error_message) from error
        except ImportError:
            raise ImportError(
                "pandas is required to use get_spans_dataframe. "
                "Install it with 'pip install pandas'"
            )

    def get_span_annotations_dataframe(
        self,
        *,
        spans_dataframe: Optional["pd.DataFrame"] = None,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str = "default",
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Fetches span annotations and returns them as a pandas DataFrame.

        Exactly one of *spans_dataframe*, *span_ids*, or *spans* should be provided.

        Args:
            spans_dataframe: A DataFrame (typically returned by `get_spans_dataframe`) with a
                `context.span_id` or `span_id` column.
            span_ids: An iterable of span IDs.
            spans: A list of Span objects (typically returned by `get_spans`).
            project_identifier: The project identifier (name or ID) used in the API path.
            include_annotation_names: Optional list of annotation names to include. If provided,
                only annotations with these names will be returned.
            exclude_annotation_names: Optional list of annotation names to exclude from results.
                Defaults to ["note"] to exclude note annotations, which are reserved for notes
                added via the UI.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A DataFrame where each row corresponds to a single span annotation.

        Raises:
            ValueError: If not exactly one of *spans_dataframe*, *span_ids*, or *spans* is provided,
                or if the `context.span_id` or `span_id` column is missing from *spans_dataframe*.
            ImportError: If pandas is not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        try:
            import pandas as pd
        except ImportError:  # pragma: no cover
            raise ImportError(
                "pandas is required to use get_span_annotations_dataframe. "
                "Install it with 'pip install pandas'"
            )

        # Validate input parameters
        provided_params = sum(
            [
                spans_dataframe is not None,
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'spans_dataframe', 'span_ids', or 'spans'.")

        if spans_dataframe is not None:
            span_ids_raw: list[str] = cast(
                list[str], spans_dataframe["context.span_id"].dropna().tolist()
            )
            span_ids_list = list({*span_ids_raw})
        elif span_ids is not None:
            span_ids_list = list({*span_ids})
        else:
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return pd.DataFrame()

        annotations: list[v1.SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(v1.SpanAnnotationsResponseBody, payload)
                batch = cast(list[v1.SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break  # finished paginating this batch

        df = pd.DataFrame(annotations)
        df = _flatten_nested_column(df, "result")
        df.rename(columns={"name": "annotation_name"}, inplace=True)
        if not df.empty:
            df.set_index("span_id", inplace=True)  # type: ignore[unused-ignore]
        return df

    def get_span_annotations(
        self,
        *,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str,
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.SpanAnnotation]:
        """
        Fetches span annotations and returns them as a list of SpanAnnotation objects.

        Exactly one of *span_ids* or *spans* should be provided.

        Args:
            span_ids: An iterable of span IDs.
            spans: A list of Span objects (typically returned by `get_spans`).
            project_identifier: The project identifier (name or ID) used in the API path.
            include_annotation_names: Optional list of annotation names to include. If provided,
                only annotations with these names will be returned.
            exclude_annotation_names: Optional list of annotation names to exclude from results.
                Defaults to ["note"] to exclude note annotations, which are reserved for notes
                added via the UI.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A list of SpanAnnotation objects.

        Raises:
            ValueError: If not exactly one of *span_ids* or *spans* is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        # Validate input parameters
        provided_params = sum(
            [
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'span_ids' or 'spans'.")

        if span_ids is not None:
            span_ids_list = list({*span_ids})
        else:  # spans is not None
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return []

        annotations: list[v1.SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(v1.SpanAnnotationsResponseBody, payload)
                batch = cast(list[v1.SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break

        return annotations

    def get_spans(
        self,
        *,
        project_identifier: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.Span]:
        """
        Retrieves spans with simple filtering options.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            start_time: Optional start time for filtering (inclusive lower bound).
            end_time: Optional end time for filtering (exclusive upper bound).
            limit: Maximum number of spans to return (default: 100).
            timeout: Optional request timeout in seconds.

        Returns:
            A list of Span objects.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.
        """
        all_spans: list[v1.Span] = []
        cursor: Optional[str] = None
        page_size = min(100, limit)

        while len(all_spans) < limit:
            remaining = limit - len(all_spans)
            current_page_size = min(page_size, remaining)

            params: dict[str, Union[int, str, Sequence[str]]] = {
                "limit": current_page_size,
            }

            if start_time:
                params["start_time"] = start_time.isoformat()
            if end_time:
                params["end_time"] = end_time.isoformat()
            if cursor:
                params["cursor"] = cursor

            response = self._client.get(
                url=f"v1/projects/{project_identifier}/spans",
                params=params,
                headers={"accept": "application/json"},
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
            payload = cast(v1.SpansResponseBody, payload)

            spans = payload["data"]
            all_spans.extend(spans)

            cursor = payload.get("next_cursor")
            if not cursor or not spans:
                break

        return all_spans[:limit]

    def create_spans(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        check_duplicates: bool = False,
        raise_on_error: bool = False,
        generate_new_ids: bool = False,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Creates spans in a project.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans: A sequence of Span objects to create.
            check_duplicates: If true, check for existing spans before queuing.
                Adds latency but provides immediate feedback (default: False).
            raise_on_error: If true, raise SpanCreationError when spans fail to be queued.
                If false, log warnings instead (default: False).
            generate_new_ids: If true, generate new valid span_ids and trace_ids for all spans
                to guarantee insertion success. This will regenerate IDs while maintaining
                the parent-child relationships within the span collection (default: False).
            timeout: Optional request timeout in seconds.

        Returns:
            A CreateSpansResponseBody with statistics about the operation including
            total_received, total_queued, total_duplicates, total_invalid, and
            optionally lists of duplicate_spans and invalid_spans.

        Raises:
            SpanCreationError: If raise_on_error is True and some spans failed to be queued.
            httpx.HTTPStatusError: If the API returns an error response.
            httpx.TimeoutException: If the request times out.
        """
        # Generate new IDs if requested
        if generate_new_ids:
            spans = list(deepcopy(spans))  # Deep copy to avoid modifying the original

            # Create mappings for old to new IDs
            trace_id_mapping: dict[str, str] = {}
            span_id_mapping: dict[str, str] = {}

            # First pass: Generate new IDs and build mappings
            for span in spans:
                if span.get("context"):
                    old_trace_id = span["context"].get("trace_id", "")
                    if old_trace_id and old_trace_id not in trace_id_mapping:
                        trace_id_mapping[old_trace_id] = _generate_trace_id()

                    old_span_id = span["context"].get("span_id", "")
                    if old_span_id and old_span_id not in span_id_mapping:
                        span_id_mapping[old_span_id] = _generate_span_id()

            # Second pass: Apply new IDs and update parent references
            for span in spans:
                if span.get("context"):
                    # Update trace_id
                    old_trace_id = span["context"].get("trace_id", "")
                    if old_trace_id in trace_id_mapping:
                        span["context"]["trace_id"] = trace_id_mapping[old_trace_id]

                    # Update span_id
                    old_span_id = span["context"].get("span_id", "")
                    if old_span_id in span_id_mapping:
                        span["context"]["span_id"] = span_id_mapping[old_span_id]

                # Update parent_id if it exists
                old_parent_id = span.get("parent_id")
                if old_parent_id and old_parent_id in span_id_mapping:
                    span["parent_id"] = span_id_mapping[old_parent_id]

        request_body = v1.CreateSpansRequestBody(data=list(spans))

        params: dict[str, Union[bool, str]] = {}
        if check_duplicates:
            params["check_duplicates"] = check_duplicates

        try:
            response = self._client.post(
                url=f"v1/projects/{project_identifier}/spans",
                json=request_body,
                params=params,
                headers={"accept": "application/json"},
                timeout=timeout,
            )
            response.raise_for_status()
            result = cast(v1.CreateSpansResponseBody, response.json())

            # Check for failures
            total_received = result.get("total_received", 0)
            total_queued = result.get("total_queued", 0)
            total_invalid = result.get("total_invalid", 0)
            total_duplicates = result.get("total_duplicates", 0)
            invalid_spans = result.get("invalid_spans", [])
            duplicate_spans = result.get("duplicate_spans", [])

            # Handle invalid spans
            if total_invalid > 0:
                error_details: list[str] = []
                for invalid_span in invalid_spans[:5]:  # Show first 5 errors
                    span_id = invalid_span.get("span_id", "unknown")
                    error = invalid_span.get("error", "unknown error")
                    error_details.append(f"  - Span {span_id}: {error}")

                if len(invalid_spans) > 5:
                    error_details.append(f"  ... and {len(invalid_spans) - 5} more errors")

                error_msg = f"Failed to queue {total_invalid} invalid spans:\n" + "\n".join(
                    error_details
                )

                if raise_on_error:
                    raise SpanCreationError(
                        message=error_msg,
                        invalid_spans=invalid_spans,
                        duplicate_spans=duplicate_spans,
                        total_received=total_received,
                        total_queued=total_queued,
                        total_invalid=total_invalid,
                        total_duplicates=total_duplicates,
                    )
                else:
                    warnings.warn(error_msg, UserWarning)

            # Handle duplicates (only warn, don't error)
            if check_duplicates and total_duplicates > 0:
                dup_info: list[str] = []
                for dup_span in duplicate_spans[:5]:  # Show first 5 duplicates
                    span_id = dup_span.get("span_id", "unknown")
                    dup_info.append(f"  - Span {span_id}")

                if len(duplicate_spans) > 5:
                    dup_info.append(f"  ... and {len(duplicate_spans) - 5} more duplicates")

                warning_msg = (
                    f"Found {total_duplicates} duplicate spans that were not queued:\n"
                    + "\n".join(dup_info)
                )
                warnings.warn(warning_msg, UserWarning)

            # Log summary
            if total_queued < total_received:
                logger.info(
                    f"Span creation summary: {total_queued}/{total_received} spans queued "
                    f"({total_invalid} invalid, {total_duplicates} duplicates)"
                )

            return result

        except httpx.TimeoutException as error:
            error_message = (
                (
                    f"The request timed out after {timeout} seconds. The timeout can be increased "
                    "by passing a larger value to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
                if timeout is not None
                else (
                    "The request timed out. The timeout can be adjusted by "
                    "passing a number of seconds to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
            )
            raise TimeoutError(error_message) from error


class AsyncSpans:
    """
    Provides async methods for interacting with span resources.

    Example:
        Basic usage:
            >>> from phoenix.client import AsyncClient
            >>> from phoenix.client.types.spans import SpanQuery
            >>> client = AsyncClient()
            >>> query = SpanQuery().select("name", "span_id").where("name == 'my-span'")
            >>> df = await client.spans.get_spans_dataframe(query=query)

            # Create spans
            >>> spans = [{"id": "1", "name": "test", "context": {"trace_id": "123", "span_id": "456"}, ...}]
            >>> result = await client.spans.create_spans(project_identifier="my-project", spans=spans)
            >>> print(f"Queued {result['total_queued']} spans")

            # Create spans with error handling
            >>> try:
            ...     result = await client.spans.create_spans(
            ...         project_identifier="my-project",
            ...         spans=spans,
            ...         check_duplicates=True,
            ...         raise_on_error=True
            ...     )
            ... except SpanCreationError as e:
            ...     print(f"Failed to create spans: {e}")
            ...     print(f"Invalid spans: {len(e.invalid_spans)}")

            # Create spans with new IDs to guarantee success
            >>> result = await client.spans.create_spans(
            ...     project_identifier="my-project",
            ...     spans=spans,
            ...     generate_new_ids=True
            ... )
            >>> print(f"All {result['total_queued']} spans queued successfully")

    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def get_spans_dataframe(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        project_identifier: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Retrieves spans based on the provided filter conditions.

        Args:
            query: A SpanQuery object defining the query criteria.
            start_time: Optional start time for filtering.
            end_time: Optional end time for filtering.
            limit: Maximum number of spans to return.
            root_spans_only: Whether to return only root spans.
            project_name: Optional project name to filter by. Deprecated, use `project_identifier`
                to also specify by the project id.
            project_identifier: Optional project identifier (name or id) to filter by.
            timeout: Optional request timeout in seconds.

        Returns:
            pandas DataFrame

        Raises:
            ImportError: If pandas is not installed
            TimeoutError: If the request times out.
        """
        project_name = project_name
        query = query if query else SpanQuery()
        normalized_start_time = _normalize_datetime(start_time)
        normalized_end_time = _normalize_datetime(end_time)

        request_body = {
            "queries": [query.to_dict()],
            "start_time": _to_iso_format(normalized_start_time),
            "end_time": _to_iso_format(normalized_end_time),
            "limit": limit,
            "root_spans_only": root_spans_only,
        }

        try:
            import pandas as pd

            _ = pd  # Prevent unused symbol error

            if project_identifier and project_name:
                raise ValueError("Provide only one of 'project_identifier' or 'project_name'.")
            elif project_identifier and not project_name:
                if is_node_id(project_identifier, node_type="Project"):
                    project_response = await self._client.get(
                        url=f"v1/projects/{project_identifier}",
                        headers={"accept": "application/json"},
                        timeout=timeout,
                    )
                    project_response.raise_for_status()
                    project = project_response.json()
                    project_name = project["data"]["name"]
                else:
                    project_name = project_identifier

            response = await self._client.post(
                url="v1/spans",
                headers={"accept": "application/json"},
                params={"project_name": project_name} if project_name else None,
                json=request_body,
                timeout=timeout,
            )
            await response.aread()
            return _process_span_dataframe(response)
        except httpx.TimeoutException as error:
            error_message = (
                (
                    f"The request timed out after {timeout} seconds. The timeout can be increased "
                    "by passing a larger value to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
                if timeout is not None
                else (
                    "The request timed out. The timeout can be adjusted by "
                    "passing a number of seconds to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
            )
            raise TimeoutError(error_message) from error
        except ImportError:
            raise ImportError(
                "pandas is required to use get_spans_dataframe. "
                "Install it with 'pip install pandas'"
            )

    async def get_span_annotations_dataframe(
        self,
        *,
        spans_dataframe: Optional["pd.DataFrame"] = None,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str,
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Fetches span annotations and returns them as a pandas DataFrame.

        Exactly one of *spans_dataframe*, *span_ids*, or *spans* should be provided.

        Args:
            spans_dataframe: A DataFrame (typically returned by `get_spans_dataframe`) with a
                `context.span_id` or `span_id` column.
            span_ids: An iterable of span IDs.
            spans: A list of Span objects (typically returned by `get_spans`).
            project_identifier: The project identifier (name or ID) used in the API path.
            include_annotation_names: Optional list of annotation names to include. If provided,
                only annotations with these names will be returned.
            exclude_annotation_names: Optional list of annotation names to exclude from results.
                Defaults to ["note"] to exclude note annotations, which are reserved for notes
                added via the UI.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A DataFrame where each row corresponds to a single span annotation.

        Raises:
            ValueError: If not exactly one of *spans_dataframe*, *span_ids*, or *spans* is provided,
                or if the `context.span_id` or `span_id` column is missing from *spans_dataframe*.
            ImportError: If pandas is not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        try:
            import pandas as pd
        except ImportError:  # pragma: no cover
            raise ImportError(
                "pandas is required to use get_span_annotations_dataframe. "
                "Install it with 'pip install pandas'"
            )

        # Validate input parameters
        provided_params = sum(
            [
                spans_dataframe is not None,
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'spans_dataframe', 'span_ids', or 'spans'.")

        if spans_dataframe is not None:
            span_ids_raw: list[str] = cast(
                list[str], spans_dataframe["context.span_id"].dropna().tolist()
            )
            span_ids_list = list({*span_ids_raw})
        elif span_ids is not None:
            span_ids_list = list({*span_ids})
        else:
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return pd.DataFrame()

        annotations: list[v1.SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = await self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(v1.SpanAnnotationsResponseBody, payload)
                batch = cast(list[v1.SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break  # finished paginating this batch

        df = pd.DataFrame(annotations)
        df = _flatten_nested_column(df, "result")
        df.rename(columns={"name": "annotation_name"}, inplace=True)
        if not df.empty:
            df.set_index("span_id", inplace=True)  # type: ignore[unused-ignore]
        return df

    async def get_span_annotations(
        self,
        *,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str,
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.SpanAnnotation]:
        """
        Fetches span annotations and returns them as a list of SpanAnnotation objects.

        Exactly one of *span_ids* or *spans* should be provided.

        Args:
            span_ids: An iterable of span IDs.
            spans: A list of Span objects (typically returned by `get_spans`).
            project_identifier: The project identifier (name or ID) used in the API path.
            include_annotation_names: Optional list of annotation names to include. If provided,
                only annotations with these names will be returned.
            exclude_annotation_names: Optional list of annotation names to exclude from results.
                Defaults to ["note"] to exclude note annotations, which are reserved for notes
                added via the UI.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A list of SpanAnnotation objects.

        Raises:
            ValueError: If not exactly one of *span_ids* or *spans* is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        # Validate input parameters
        provided_params = sum(
            [
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'span_ids' or 'spans'.")

        if span_ids is not None:
            span_ids_list = list({*span_ids})
        else:  # spans is not None
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return []

        annotations: list[v1.SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = await self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(v1.SpanAnnotationsResponseBody, payload)
                batch = cast(list[v1.SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break

        return annotations

    async def get_spans(
        self,
        *,
        project_identifier: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.Span]:
        """
        Retrieves spans with simple filtering options.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            start_time: Optional start time for filtering (inclusive lower bound).
            end_time: Optional end time for filtering (exclusive upper bound).
            limit: Maximum number of spans to return (default: 100).
            timeout: Optional request timeout in seconds.

        Returns:
            A list of Span objects.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.
        """
        all_spans: list[v1.Span] = []
        cursor: Optional[str] = None
        page_size = min(100, limit)

        while len(all_spans) < limit:
            remaining = limit - len(all_spans)
            current_page_size = min(page_size, remaining)

            params: dict[str, Union[int, str, Sequence[str]]] = {
                "limit": current_page_size,
            }

            if start_time:
                params["start_time"] = start_time.isoformat()
            if end_time:
                params["end_time"] = end_time.isoformat()
            if cursor:
                params["cursor"] = cursor

            response = await self._client.get(
                url=f"v1/projects/{project_identifier}/spans",
                params=params,
                headers={"accept": "application/json"},
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
            payload = cast(v1.SpanSearchResponseBody, payload)

            spans = payload["data"]
            all_spans.extend(spans)

            cursor = payload.get("next_cursor")
            if not cursor or not spans:
                break

        return all_spans[:limit]

    async def create_spans(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        check_duplicates: bool = False,
        raise_on_error: bool = False,
        generate_new_ids: bool = False,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Creates spans in a project.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans: A sequence of Span objects to create.
            check_duplicates: If true, check for existing spans before queuing.
                Adds latency but provides immediate feedback (default: False).
            raise_on_error: If true, raise SpanCreationError when spans fail to be queued.
                If false, log warnings instead (default: False).
            generate_new_ids: If true, generate new valid span_ids and trace_ids for all spans
                to guarantee insertion success. This will regenerate IDs while maintaining
                the parent-child relationships within the span collection (default: False).
            timeout: Optional request timeout in seconds.

        Returns:
            A CreateSpansResponseBody with statistics about the operation including
            total_received, total_queued, total_duplicates, total_invalid, and
            optionally lists of duplicate_spans and invalid_spans.

        Raises:
            SpanCreationError: If raise_on_error is True and some spans failed to be queued.
            httpx.HTTPStatusError: If the API returns an error response.
            httpx.TimeoutException: If the request times out.
        """
        # Generate new IDs if requested
        if generate_new_ids:
            spans = list(deepcopy(spans))  # Deep copy to avoid modifying the original

            # Create mappings for old to new IDs
            trace_id_mapping: dict[str, str] = {}
            span_id_mapping: dict[str, str] = {}

            # First pass: Generate new IDs and build mappings
            for span in spans:
                if span.get("context"):
                    old_trace_id = span["context"].get("trace_id", "")
                    if old_trace_id and old_trace_id not in trace_id_mapping:
                        trace_id_mapping[old_trace_id] = _generate_trace_id()

                    old_span_id = span["context"].get("span_id", "")
                    if old_span_id and old_span_id not in span_id_mapping:
                        span_id_mapping[old_span_id] = _generate_span_id()

            # Second pass: Apply new IDs and update parent references
            for span in spans:
                if span.get("context"):
                    # Update trace_id
                    old_trace_id = span["context"].get("trace_id", "")
                    if old_trace_id in trace_id_mapping:
                        span["context"]["trace_id"] = trace_id_mapping[old_trace_id]

                    # Update span_id
                    old_span_id = span["context"].get("span_id", "")
                    if old_span_id in span_id_mapping:
                        span["context"]["span_id"] = span_id_mapping[old_span_id]

                # Update parent_id if it exists
                old_parent_id = span.get("parent_id")
                if old_parent_id and old_parent_id in span_id_mapping:
                    span["parent_id"] = span_id_mapping[old_parent_id]

        request_body = v1.CreateSpansRequestBody(data=list(spans))

        params: dict[str, Union[bool, str]] = {}
        if check_duplicates:
            params["check_duplicates"] = check_duplicates

        try:
            response = await self._client.post(
                url=f"v1/projects/{project_identifier}/spans",
                json=request_body,
                params=params,
                headers={"accept": "application/json"},
                timeout=timeout,
            )
            response.raise_for_status()
            result = cast(v1.CreateSpansResponseBody, response.json())

            # Check for failures
            total_received = result.get("total_received", 0)
            total_queued = result.get("total_queued", 0)
            total_invalid = result.get("total_invalid", 0)
            total_duplicates = result.get("total_duplicates", 0)
            invalid_spans = result.get("invalid_spans", [])
            duplicate_spans = result.get("duplicate_spans", [])

            # Handle invalid spans
            if total_invalid > 0:
                error_details: list[str] = []
                for invalid_span in invalid_spans[:5]:  # Show first 5 errors
                    span_id = invalid_span.get("span_id", "unknown")
                    error = invalid_span.get("error", "unknown error")
                    error_details.append(f"  - Span {span_id}: {error}")

                if len(invalid_spans) > 5:
                    error_details.append(f"  ... and {len(invalid_spans) - 5} more errors")

                error_msg = f"Failed to queue {total_invalid} invalid spans:\n" + "\n".join(
                    error_details
                )

                if raise_on_error:
                    raise SpanCreationError(
                        message=error_msg,
                        invalid_spans=invalid_spans,
                        duplicate_spans=duplicate_spans,
                        total_received=total_received,
                        total_queued=total_queued,
                        total_invalid=total_invalid,
                        total_duplicates=total_duplicates,
                    )
                else:
                    warnings.warn(error_msg, UserWarning)

            # Handle duplicates (only warn, don't error)
            if check_duplicates and total_duplicates > 0:
                dup_info: list[str] = []
                for dup_span in duplicate_spans[:5]:  # Show first 5 duplicates
                    span_id = dup_span.get("span_id", "unknown")
                    dup_info.append(f"  - Span {span_id}")

                if len(duplicate_spans) > 5:
                    dup_info.append(f"  ... and {len(duplicate_spans) - 5} more duplicates")

                warning_msg = (
                    f"Found {total_duplicates} duplicate spans that were not queued:\n"
                    + "\n".join(dup_info)
                )
                warnings.warn(warning_msg, UserWarning)

            # Log summary
            if total_queued < total_received:
                logger.info(
                    f"Span creation summary: {total_queued}/{total_received} spans queued "
                    f"({total_invalid} invalid, {total_duplicates} duplicates)"
                )

            return result

        except httpx.TimeoutException as error:
            error_message = (
                (
                    f"The request timed out after {timeout} seconds. The timeout can be increased "
                    "by passing a larger value to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
                if timeout is not None
                else (
                    "The request timed out. The timeout can be adjusted by "
                    "passing a number of seconds to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
            )
            raise TimeoutError(error_message) from error


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _decode_df_from_json_string(obj: str) -> "pd.DataFrame":
    import pandas as pd
    from pandas.io.json._table_schema import parse_table_schema  # type: ignore

    df = cast(pd.DataFrame, parse_table_schema(StringIO(obj).read(), False))
    df.index.names = [x.split("_", 1)[1] or None for x in df.index.names]  # type: ignore
    return df.set_axis([x.split("_", 1)[1] for x in df.columns], axis=1)  # type: ignore[override,unused-ignore]


def _normalize_datetime(
    dt: Optional[datetime],
    tz: Optional[tzinfo] = None,
) -> Optional[datetime]:
    """
    If the input datetime is timezone-naive, it is localized as local timezone
    unless tzinfo is specified.
    """
    if not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        dt = dt.replace(tzinfo=tz if tz else _LOCAL_TIMEZONE)
    return dt.astimezone(timezone.utc)


def _process_span_dataframe(response: httpx.Response) -> "pd.DataFrame":
    """Processes the httpx response to extract a pandas DataFrame, handling multipart responses."""
    import pandas as pd

    content_type = response.headers.get("Content-Type")
    dfs: list["pd.DataFrame"] = []
    if isinstance(content_type, str) and "multipart/mixed" in content_type:
        if "boundary=" in content_type:
            boundary_token = content_type.split("boundary=")[1].split(";", 1)[0]
        else:
            raise ValueError(
                "Boundary not found in Content-Type header for multipart/mixed response"
            )
        boundary = f"--{boundary_token}"
        text = response.text
        while boundary in text:
            part, text = text.split(boundary, 1)
            if "Content-Type: application/json" in part:
                json_string = part.split("\r\n\r\n", 1)[1].strip()
                df = _decode_df_from_json_string(json_string)
                dfs.append(df)
    else:
        response.raise_for_status()
        logger.warning("Received non-multipart response when expecting dataframe.")

    if dfs:
        return dfs[0]  # only passing in one query
    else:
        return pd.DataFrame()


def _flatten_nested_column(df: "pd.DataFrame", column_name: str) -> "pd.DataFrame":
    import pandas as pd

    if column_name in df.columns:
        # Flatten the nested dictionary column and prefix each resulting column with
        # the original column name (e.g., "result.label").
        nested_df = pd.json_normalize(df[column_name]).rename(  # type: ignore[arg-type]
            columns=lambda col: f"{column_name}.{col}"
        )
        df = pd.concat([df.drop(columns=[column_name]), nested_df], axis=1)
    return df


class TimeoutError(Exception): ...


class SpanCreationError(Exception):
    """Raised when some spans fail to be queued for creation."""

    def __init__(
        self,
        message: str,
        invalid_spans: Optional[Sequence[v1.InvalidSpanInfo]] = None,
        duplicate_spans: Optional[Sequence[v1.DuplicateSpanInfo]] = None,
        total_received: int = 0,
        total_queued: int = 0,
        total_invalid: int = 0,
        total_duplicates: int = 0,
    ):
        super().__init__(message)
        self.invalid_spans = invalid_spans or []
        self.duplicate_spans = duplicate_spans or []
        self.total_received = total_received
        self.total_queued = total_queued
        self.total_invalid = total_invalid
        self.total_duplicates = total_duplicates
