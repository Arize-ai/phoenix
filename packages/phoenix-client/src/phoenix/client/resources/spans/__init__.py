import json
import logging
from datetime import datetime, timezone, tzinfo
from io import StringIO
from typing import TYPE_CHECKING, Any, Iterable, Optional, Sequence, Union, cast

import httpx

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1
from phoenix.client.exceptions import DuplicateSpanInfo, InvalidSpanInfo, SpanCreationError
from phoenix.client.helpers.spans import dataframe_to_spans as _dataframe_to_spans
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

            # Log spans
            >>> spans = [
            ...     {
            ...         "id": "1",
            ...         "name": "test",
            ...         "context": {"trace_id": "123", "span_id": "456"},
            ...     }
            ... ]
            >>> result = client.spans.log_spans(
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

            # Delete a span
            >>> client.spans.delete(span_identifier="abc123def456")

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

    def log_spans(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Logs spans to a project.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans: A sequence of Span objects to log.
            timeout: Optional request timeout in seconds.

        Returns:
            A CreateSpansResponseBody with statistics about the operation. When successful,
            total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """
        request_body = v1.CreateSpansRequestBody(data=list(spans))

        response = self._client.post(
            url=f"v1/projects/{project_identifier}/spans",
            json=request_body,
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        if response.status_code not in (400, 422):
            response.raise_for_status()

        result = _parse_log_spans_response(response, spans)
        return result

    def log_spans_dataframe(
        self,
        *,
        project_identifier: str,
        spans_dataframe: "pd.DataFrame",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Logs spans to a project from a pandas DataFrame.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans_dataframe: A pandas DataFrame with a `context.span_id` or `span_id` column.
            timeout: Optional request timeout in seconds.
        """
        spans = _dataframe_to_spans(spans_dataframe)
        return self.log_spans(project_identifier=project_identifier, spans=spans, timeout=timeout)

    def delete(
        self,
        *,
        span_identifier: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """
        Deletes a single span by identifier.

        **Important**: This operation deletes ONLY the specified span itself and does NOT
        delete its descendants/children. All child spans will remain in the trace and
        become orphaned (their parent_id will point to a non-existent span).

        Behavior:
        - Deletes only the target span (preserves all descendant spans)
        - If this was the last span in the trace, the trace record is also deleted
        - If the deleted span had a parent, its cumulative metrics (error count, token counts)
          are subtracted from all ancestor spans in the chain

        **Note**: This operation is irreversible and may create orphaned spans.

        Args:
            span_identifier: The span identifier: either a relay GlobalID or OpenTelemetry span_id.
            timeout: Optional request timeout in seconds.

        Raises:
            httpx.HTTPStatusError: If the span is not found (404) or other API errors.
            httpx.TimeoutException: If the request times out.

        Example:
            >>> from phoenix.client import Client
            >>> client = Client()

            # Delete by OpenTelemetry span_id
            >>> client.spans.delete_span(span_identifier="051581bf3cb55c13")

            # Delete by Phoenix Global ID
            >>> client.spans.delete(span_identifier="U3BhbjoxMjM=")
        """
        response = self._client.delete(
            url=f"v1/spans/{span_identifier}",
            timeout=timeout,
        )
        response.raise_for_status()


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

            # Log spans
            >>> spans = [
            ...     {
            ...         "id": "1",
            ...         "name": "test",
            ...         "context": {"trace_id": "123", "span_id": "456"},
            ...     }
            ... ]
            >>> result = await client.spans.log_spans(
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

            # Delete a span
            >>> await client.spans.delete(span_identifier="abc123def456")

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

    async def log_spans(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Logs spans to a project.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans: A sequence of Span objects to log.
            timeout: Optional request timeout in seconds.

        Returns:
            A CreateSpansResponseBody with statistics about the operation. When successful,
            total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """
        request_body = v1.CreateSpansRequestBody(data=list(spans))

        response = await self._client.post(
            url=f"v1/projects/{project_identifier}/spans",
            json=request_body,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        if response.status_code not in (400, 422):
            response.raise_for_status()
        result = _parse_log_spans_response(response, spans)

        return result

    async def log_spans_dataframe(
        self,
        *,
        project_identifier: str,
        spans_dataframe: "pd.DataFrame",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """
        Logs spans to a project from a pandas DataFrame.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier: The project identifier (name or ID) used in the API path.
            spans_dataframe: A pandas DataFrame with a `context.span_id` or `span_id` column.
            timeout: Optional request timeout in seconds.

        Returns:
            A CreateSpansResponseBody with statistics about the operation. When successful,
            total_queued will equal total_received.
        """

        spans = _dataframe_to_spans(spans_dataframe)
        return await self.log_spans(
            project_identifier=project_identifier, spans=spans, timeout=timeout
        )

    async def delete(
        self,
        *,
        span_identifier: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """
        Deletes a single span by identifier.

        **Important**: This operation deletes ONLY the specified span itself and does NOT
        delete its descendants/children. All child spans will remain in the trace and
        become orphaned (their parent_id will point to a non-existent span).

        Behavior:
        - Deletes only the target span (preserves all descendant spans)
        - If this was the last span in the trace, the trace record is also deleted
        - If the deleted span had a parent, its cumulative metrics (error count, token counts)
          are subtracted from all ancestor spans in the chain

        **Note**: This operation is irreversible and may create orphaned spans.

        Args:
            span_identifier: The span identifier: either a relay GlobalID or OpenTelemetry span_id.
            timeout: Optional request timeout in seconds.

        Raises:
            httpx.HTTPStatusError: If the span is not found (404) or other API errors.
            httpx.TimeoutException: If the request times out.

        Example:
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()

            # Delete by OpenTelemetry span_id
            >>> await client.spans.delete(span_identifier="abc123def456")

            # Delete by Phoenix Global ID
            >>> await client.spans.delete(span_identifier="U3BhbjoxMjM=")
        """
        response = await self._client.delete(
            url=f"v1/spans/{span_identifier}",
            timeout=timeout,
        )
        response.raise_for_status()


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


def _format_log_spans_error_message(
    *,
    total_invalid: int,
    total_duplicates: int,
    invalid_spans: Sequence[InvalidSpanInfo],
    duplicate_spans: Sequence[DuplicateSpanInfo],
) -> str:
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


def _parse_log_spans_response(
    response: httpx.Response,
    spans: Sequence[v1.Span],
) -> v1.CreateSpansResponseBody:
    """Parse the response from log spans request."""
    response_data = response.json()

    if response.status_code == 422 and "detail" in response_data:
        error_response = _parse_log_spans_validation_error(response_data, spans)
        _raise_log_spans_error(error_response)

    if response.status_code == 400:
        if "detail" in response_data:
            detail = response_data["detail"]
            # For 400 errors, the server now returns properly formatted JSON in the detail field
            parsed_detail = json.loads(detail)
            _raise_log_spans_error(parsed_detail)
        elif "error" in response_data:
            # Handle case where error data is returned directly (not wrapped in detail)
            _raise_log_spans_error(response_data)

    return cast(v1.CreateSpansResponseBody, response_data)


def _parse_log_spans_validation_error(
    response_data: dict[str, Any],
    spans: Sequence[v1.Span],
) -> v1.CreateSpansResponseBody:
    """Convert FastAPI validation errors to our expected format."""
    invalid_spans: list[InvalidSpanInfo] = []

    for error in response_data.get("detail", []):
        invalid_span = _extract_invalid_span_from_log_spans_error(error, spans)
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


def _extract_invalid_span_from_log_spans_error(
    error: dict[str, Any],
    spans: Sequence[v1.Span],
) -> Optional[InvalidSpanInfo]:
    """Extract invalid span info from a validation error."""
    loc_raw = error.get("loc", [])
    if not isinstance(loc_raw, list):
        return None

    loc: list[Any] = loc_raw  # Type annotation to help pyright
    if not (len(loc) >= 3 and loc[0] == "body" and loc[1] == "data" and isinstance(loc[2], int)):
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


def _raise_log_spans_error(
    error_data: Union[dict[str, Any], v1.CreateSpansResponseBody],
) -> None:
    """Raise SpanCreationError from error response data."""
    total_received = error_data.get("total_received", 0)
    total_queued = error_data.get("total_queued", 0)
    total_invalid = cast(int, error_data.get("total_invalid", 0))
    total_duplicates = cast(int, error_data.get("total_duplicates", 0))
    invalid_spans = cast(list[InvalidSpanInfo], error_data.get("invalid_spans", []))
    duplicate_spans = cast(list[DuplicateSpanInfo], error_data.get("duplicate_spans", []))

    error_msg = _format_log_spans_error_message(
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
