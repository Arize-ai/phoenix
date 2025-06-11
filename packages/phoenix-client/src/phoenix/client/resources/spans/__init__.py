import json
import logging
from datetime import datetime, timezone, tzinfo
from io import StringIO
from typing import TYPE_CHECKING, Any, Iterable, Optional, Sequence, Union, cast

import httpx

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1
from phoenix.client.exceptions import SpanCreationError
from phoenix.client.types.spans import SpanQuery
from phoenix.client.utils.id_handling import is_node_id

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 5
_LOCAL_TIMEZONE = datetime.now(timezone.utc).astimezone().tzinfo
_MAX_SPAN_IDS_PER_REQUEST = 100


class Spans:
    """
    Provides methods for interacting with span resources.

    Example:
        Non-DataFrame methods:
            >>> from phoenix.client import Client
            >>> client = Client()

            # Get spans as list
            >>> spans = client.spans.get_spans(
            ...     project_identifier="my-project",
            ...     limit=100
            ... )

            # Get span annotations as list
            >>> annotations = client.spans.get_span_annotations(
            ...     span_ids=["span1", "span2"],
            ...     project_identifier="my-project"
            ... )

            # Create spans
            >>> spans = [
            ...     {
            ...         "id": "1",
            ...         "name": "test",
            ...         "context": {"trace_id": "123", "span_id": "456"},
            ...     }
            ... ]
            >>> result = client.spans.create_spans(
            ...     project_identifier="my-project",
            ...     spans=spans
            ... )
            >>> print(f"Queued {result['total_queued']} spans")

        DataFrame methods:
            >>> from phoenix.client.types.spans import SpanQuery

            # Get spans as DataFrame
            >>> query = SpanQuery().select(annotations["relevance"])
            >>> df = client.spans.get_spans_dataframe(query=query)

            # Get span annotations as DataFrame
            >>> annotations_df = client.spans.get_span_annotations_dataframe(
            ...     span_ids=["span1", "span2"],
            ...     project_identifier="my-project"
            ... )

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
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Creates spans in a project.

        If any spans are invalid or duplicates, no spans will be created and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans: A sequence of Span objects to create.
            timeout: Optional request timeout in seconds.

        Returns:
            A CreateSpansResponseBody with statistics about the operation. When successful,
            total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """
        response = self._make_create_spans_request(
            project_identifier=project_identifier,
            spans=spans,
            timeout=timeout,
        )

        result = self._parse_create_spans_response(response, spans)

        self._handle_create_spans_result(result)

        return result

    def _make_create_spans_request(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        timeout: Optional[int],
    ) -> httpx.Response:
        """Make the HTTP request to create spans."""
        request_body = v1.CreateSpansRequestBody(data=list(spans))
        params: dict[str, Union[bool, str]] = {}

        response = self._client.post(
            url=f"v1/projects/{project_identifier}/spans",
            json=request_body,
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        # For 400 and 422 errors, the server returns structured error information
        # Don't raise for these, but do raise for other error status codes
        if response.status_code not in (400, 422):
            response.raise_for_status()

        return response

    def _parse_create_spans_response(
        self,
        response: httpx.Response,
        spans: Sequence[v1.Span],
    ) -> v1.CreateSpansResponseBody:
        """Parse the response from create spans request."""
        response_data = response.json()

        # Check if this is a FastAPI validation error (has 'detail' field)
        if response.status_code == 422 and "detail" in response_data:
            return self._parse_validation_error_response(response_data, spans)

        if response.status_code == 400 and "detail" in response_data:
            detail = response_data["detail"]

            # For 400 errors, the server now returns properly formatted JSON in the detail field
            parsed_detail = json.loads(detail)
            return cast(v1.CreateSpansResponseBody, parsed_detail)

        # For successful responses (202), return the response data directly
        return cast(v1.CreateSpansResponseBody, response_data)

    def _parse_validation_error_response(
        self,
        response_data: dict[str, Any],
        spans: Sequence[v1.Span],
    ) -> v1.CreateSpansResponseBody:
        """Convert FastAPI validation errors to our expected format."""
        invalid_spans: list[v1.InvalidSpanInfo] = []

        for error in response_data.get("detail", []):
            invalid_span = self._extract_invalid_span_from_error(error, spans)
            if invalid_span:
                invalid_spans.append(invalid_span)

        return cast(
            v1.CreateSpansResponseBody,
            {
                "total_received": len(spans),
                "total_queued": len(spans) - len(invalid_spans),
                "total_duplicates": 0,
                "total_invalid": len(invalid_spans),
                "duplicate_spans": [],
                "invalid_spans": invalid_spans,
            },
        )

    def _extract_invalid_span_from_error(
        self,
        error: dict[str, Any],
        spans: Sequence[v1.Span],
    ) -> Optional[v1.InvalidSpanInfo]:
        """Extract invalid span info from a validation error."""
        loc_raw = error.get("loc", [])
        if not isinstance(loc_raw, list):
            return None

        loc: list[Any] = loc_raw  # Type annotation to help pyright
        if not (
            len(loc) >= 3 and loc[0] == "body" and loc[1] == "data" and isinstance(loc[2], int)
        ):
            return None

        span_index = loc[2]
        if span_index >= len(spans):
            return None

        span: Any = spans[span_index]
        span_dict = cast(dict[str, Any], span)
        return {
            "span_id": span_dict.get("context", {}).get("span_id", "unknown"),
            "trace_id": span_dict.get("context", {}).get("trace_id", "unknown"),
            "error": error.get("msg", "Validation error"),
        }

    def _handle_create_spans_result(
        self,
        result: v1.CreateSpansResponseBody,
    ) -> None:
        """Handle any errors from the create spans result."""
        # Extract statistics
        total_received = result.get("total_received", 0)
        total_queued = result.get("total_queued", 0)
        total_invalid = result.get("total_invalid", 0)
        total_duplicates = result.get("total_duplicates", 0)
        invalid_spans = result.get("invalid_spans", [])
        duplicate_spans = result.get("duplicate_spans", [])

        # If there are any failures, raise an error
        if total_invalid > 0 or total_duplicates > 0:
            error_msg = self._format_error_message(
                total_invalid=total_invalid,
                total_duplicates=total_duplicates,
                invalid_spans=invalid_spans,
                duplicate_spans=duplicate_spans,
            )
            raise SpanCreationError(
                message=error_msg,
                invalid_spans=list(invalid_spans),
                duplicate_spans=list(duplicate_spans),
                total_received=total_received,
                total_queued=total_queued,
                total_invalid=total_invalid,
                total_duplicates=total_duplicates,
            )

    def _format_error_message(
        self,
        *,
        total_invalid: int,
        total_duplicates: int,
        invalid_spans: Sequence[v1.InvalidSpanInfo],
        duplicate_spans: Sequence[v1.DuplicateSpanInfo],
    ) -> str:
        """Format error message for failed spans."""
        MAX_ERRORS_TO_SHOW = 5
        error_parts: list[str] = []

        if total_invalid > 0:
            error_parts.append(f"Failed to queue {total_invalid} invalid spans:")
            for invalid_span in invalid_spans[:MAX_ERRORS_TO_SHOW]:
                span_id = invalid_span.get("span_id", "unknown")
                error = invalid_span.get("error", "unknown error")
                error_parts.append(f"  - Span {span_id}: {error}")
            if len(invalid_spans) > MAX_ERRORS_TO_SHOW:
                error_parts.append(
                    f"  ... and {len(invalid_spans) - MAX_ERRORS_TO_SHOW} more invalid spans"
                )

        if total_duplicates > 0:
            if error_parts:
                error_parts.append("")  # Add blank line
            error_parts.append(f"Found {total_duplicates} duplicate spans:")
            for dup_span in duplicate_spans[:MAX_ERRORS_TO_SHOW]:
                span_id = dup_span.get("span_id", "unknown")
                error_parts.append(f"  - Span {span_id}")
            if len(duplicate_spans) > MAX_ERRORS_TO_SHOW:
                error_parts.append(
                    f"  ... and {len(duplicate_spans) - MAX_ERRORS_TO_SHOW} more duplicates"
                )

        return "\n".join(error_parts)


class AsyncSpans:
    """
    Provides async methods for interacting with span resources.

    Example:
        Non-DataFrame methods:
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()

            # Get spans as list
            >>> spans = await client.spans.get_spans(
            ...     project_identifier="my-project",
            ...     limit=100
            ... )

            # Get span annotations as list
            >>> annotations = await client.spans.get_span_annotations(
            ...     span_ids=["span1", "span2"],
            ...     project_identifier="my-project"
            ... )

            # Create spans
            >>> spans = [
            ...     {
            ...         "id": "1",
            ...         "name": "test",
            ...         "context": {"trace_id": "123", "span_id": "456"},
            ...     }
            ... ]
            >>> result = await client.spans.create_spans(
            ...     project_identifier="my-project",
            ...     spans=spans
            ... )
            >>> print(f"Queued {result['total_queued']} spans")

        DataFrame methods:
            >>> from phoenix.client.types.spans import SpanQuery

            # Get spans as DataFrame
            >>> query = SpanQuery().select(annotations["relevance"])
            >>> df = await client.spans.get_spans_dataframe(query=query)

            # Get span annotations as DataFrame
            >>> annotations_df = await client.spans.get_span_annotations_dataframe(
            ...     span_ids=["span1", "span2"],
            ...     project_identifier="my-project"
            ... )

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
            payload = cast(v1.SpansResponseBody, payload)

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
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Creates spans in a project.

        If any spans are invalid or duplicates, no spans will be created and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans: A sequence of Span objects to create.
            timeout: Optional request timeout in seconds.

        Returns:
            A CreateSpansResponseBody with statistics about the operation. When successful,
            total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """
        response = await self._make_create_spans_request(
            project_identifier=project_identifier,
            spans=spans,
            timeout=timeout,
        )

        result = self._parse_create_spans_response(response, spans)

        self._handle_create_spans_result(result)

        return result

    async def _make_create_spans_request(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        timeout: Optional[int],
    ) -> httpx.Response:
        """Make the HTTP request to create spans."""
        request_body = v1.CreateSpansRequestBody(data=list(spans))
        params: dict[str, Union[bool, str]] = {}

        response = await self._client.post(
            url=f"v1/projects/{project_identifier}/spans",
            json=request_body,
            params=params,
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        if response.status_code not in (400, 422):
            response.raise_for_status()

        return response

    def _parse_create_spans_response(
        self,
        response: httpx.Response,
        spans: Sequence[v1.Span],
    ) -> v1.CreateSpansResponseBody:
        """Parse the response from create spans request."""
        response_data = response.json()

        if response.status_code == 422 and "detail" in response_data:
            return self._parse_validation_error_response(response_data, spans)

        if response.status_code == 400 and "detail" in response_data:
            detail = response_data["detail"]
            if isinstance(detail, dict):
                return cast(v1.CreateSpansResponseBody, detail)
            else:
                return cast(
                    v1.CreateSpansResponseBody,
                    {
                        "total_received": len(spans),
                        "total_queued": 0,
                        "total_duplicates": 0,
                        "total_invalid": len(spans),
                        "duplicate_spans": [],
                        "invalid_spans": [
                            {
                                "span_id": span.get("context", {}).get("span_id", "unknown"),
                                "trace_id": span.get("context", {}).get("trace_id", "unknown"),
                                "error": str(detail),
                            }
                            for span in spans
                        ],
                    },
                )

        return cast(v1.CreateSpansResponseBody, response_data)

    def _parse_validation_error_response(
        self,
        response_data: dict[str, Any],
        spans: Sequence[v1.Span],
    ) -> v1.CreateSpansResponseBody:
        """Convert FastAPI validation errors to our expected format."""
        invalid_spans: list[v1.InvalidSpanInfo] = []

        for error in response_data.get("detail", []):
            invalid_span = self._extract_invalid_span_from_error(error, spans)
            if invalid_span:
                invalid_spans.append(invalid_span)

        return cast(
            v1.CreateSpansResponseBody,
            {
                "total_received": len(spans),
                "total_queued": len(spans) - len(invalid_spans),
                "total_duplicates": 0,
                "total_invalid": len(invalid_spans),
                "duplicate_spans": [],
                "invalid_spans": invalid_spans,
            },
        )

    def _extract_invalid_span_from_error(
        self,
        error: dict[str, Any],
        spans: Sequence[v1.Span],
    ) -> Optional[v1.InvalidSpanInfo]:
        """Extract invalid span info from a validation error."""
        loc_raw = error.get("loc", [])
        if not isinstance(loc_raw, list):
            return None

        loc: list[Any] = loc_raw  # Type annotation to help pyright
        if not (
            len(loc) >= 3 and loc[0] == "body" and loc[1] == "data" and isinstance(loc[2], int)
        ):
            return None

        span_index = loc[2]
        if span_index >= len(spans):
            return None

        span: Any = spans[span_index]
        span_dict = cast(dict[str, Any], span)
        return {
            "span_id": span_dict.get("context", {}).get("span_id", "unknown"),
            "trace_id": span_dict.get("context", {}).get("trace_id", "unknown"),
            "error": error.get("msg", "Validation error"),
        }

    def _handle_create_spans_result(
        self,
        result: v1.CreateSpansResponseBody,
    ) -> None:
        """Handle any errors from the create spans result."""
        # Extract statistics
        total_received = result.get("total_received", 0)
        total_queued = result.get("total_queued", 0)
        total_invalid = result.get("total_invalid", 0)
        total_duplicates = result.get("total_duplicates", 0)
        invalid_spans = result.get("invalid_spans", [])
        duplicate_spans = result.get("duplicate_spans", [])

        # If there are any failures, raise an error
        if total_invalid > 0 or total_duplicates > 0:
            error_msg = self._format_error_message(
                total_invalid=total_invalid,
                total_duplicates=total_duplicates,
                invalid_spans=invalid_spans,
                duplicate_spans=duplicate_spans,
            )
            raise SpanCreationError(
                message=error_msg,
                invalid_spans=list(invalid_spans),
                duplicate_spans=list(duplicate_spans),
                total_received=total_received,
                total_queued=total_queued,
                total_invalid=total_invalid,
                total_duplicates=total_duplicates,
            )

    def _format_error_message(
        self,
        *,
        total_invalid: int,
        total_duplicates: int,
        invalid_spans: Sequence[v1.InvalidSpanInfo],
        duplicate_spans: Sequence[v1.DuplicateSpanInfo],
    ) -> str:
        """Format error message for failed spans."""
        MAX_ERRORS_TO_SHOW = 5
        error_parts: list[str] = []

        if total_invalid > 0:
            error_parts.append(f"Failed to queue {total_invalid} invalid spans:")
            for invalid_span in invalid_spans[:MAX_ERRORS_TO_SHOW]:
                span_id = invalid_span.get("span_id", "unknown")
                error = invalid_span.get("error", "unknown error")
                error_parts.append(f"  - Span {span_id}: {error}")
            if len(invalid_spans) > MAX_ERRORS_TO_SHOW:
                error_parts.append(
                    f"  ... and {len(invalid_spans) - MAX_ERRORS_TO_SHOW} more invalid spans"
                )

        if total_duplicates > 0:
            if error_parts:
                error_parts.append("")  # Add blank line
            error_parts.append(f"Found {total_duplicates} duplicate spans:")
            for dup_span in duplicate_spans[:MAX_ERRORS_TO_SHOW]:
                span_id = dup_span.get("span_id", "unknown")
                error_parts.append(f"  - Span {span_id}")
            if len(duplicate_spans) > MAX_ERRORS_TO_SHOW:
                error_parts.append(
                    f"  ... and {len(duplicate_spans) - MAX_ERRORS_TO_SHOW} more duplicates"
                )

        return "\n".join(error_parts)


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
