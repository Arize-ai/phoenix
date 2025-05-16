import base64
import logging
from datetime import datetime, timezone, tzinfo
from io import StringIO
from typing import TYPE_CHECKING, Iterable, Optional, Sequence, Union, cast

import httpx

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1
from phoenix.client.types.spans import (
    SpanQuery,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 5
_LOCAL_TIMEZONE = datetime.now(timezone.utc).astimezone().tzinfo
_MAX_SPAN_IDS_PER_REQUEST = 100


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
                if _is_node_id(project_identifier, node_type="Project"):
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
        project_identifier: str = "default",
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Fetches span annotations and returns them as a pandas DataFrame.

        Exactly one of *spans_dataframe* or *span_ids* should be provided.

        Args:
            spans_dataframe: A DataFrame (typically returned by `get_spans_dataframe`) with a
                `context.span_id` or `span_id` column.
            span_ids: An iterable of span IDs.
            project_identifier: The project identifier (name or ID) used in the API path.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A DataFrame where each row corresponds to a single span annotation.

        Raises:
            ValueError: If neither or both of *spans_dataframe* and *span_ids* are provided, or if
                the `context.span_id` or `span_id` column is missing from *spans_dataframe*.
            ImportError: If pandas is not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        try:
            import pandas as pd
        except ImportError:  # pragma: no cover
            raise ImportError(
                "pandas is required to use get_span_annotations_dataframe. "
                "Install it with 'pip install pandas'"
            )

        # Validate input parameters
        if (spans_dataframe is None and span_ids is None) or (
            spans_dataframe is not None and span_ids is not None
        ):
            raise ValueError("Provide exactly one of 'spans_dataframe' or 'span_ids'.")

        if spans_dataframe is not None:
            span_ids_raw: list[str] = cast(
                list[str], spans_dataframe["context.span_id"].dropna().tolist()
            )
            span_ids_list = list({*span_ids_raw})
        else:
            assert span_ids is not None
            span_ids_list = list({*span_ids})

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
        df.set_index("span_id", inplace=True)  # type: ignore[unused-ignore]
        return df

    def get_span_annotations(
        self,
        *,
        span_ids: Iterable[str],
        project_identifier: str,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.SpanAnnotation]:
        """
        Fetches span annotations and returns them as a list of SpanAnnotation objects.

        Args:
            span_ids: An iterable of span IDs.
            project_identifier: The project identifier (name or ID) used in the API path.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A list of SpanAnnotation objects.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.
        """
        span_ids_list = list({*span_ids})

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
                if _is_node_id(project_identifier, node_type="Project"):
                    project_response = await self._client.get(
                        url=f"v1/projects/{project_identifier}",
                        headers={"accept": "application/json"},
                        timeout=timeout,
                    )
                    project_response.raise_for_status()
                    project = project_response.json()
                    project_name = project["name"]
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
        project_identifier: str,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Fetches span annotations and returns them as a pandas DataFrame.

        Exactly one of *spans_dataframe* or *span_ids* should be provided.

        Args:
            spans_dataframe: A DataFrame (typically returned by `get_spans_dataframe`) with a
                `context.span_id` or `span_id` column.
            span_ids: An iterable of span IDs.
            project_identifier: The project identifier (name or ID) used in the API path.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A DataFrame where each row corresponds to a single span annotation.

        Raises:
            ValueError: If neither or both of *spans_dataframe* and *span_ids* are provided, or if
                the `context.span_id` or `span_id` column is missing from *spans_dataframe*.
            ImportError: If pandas is not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        try:
            import pandas as pd
        except ImportError:  # pragma: no cover
            raise ImportError(
                "pandas is required to use get_span_annotations_dataframe. "
                "Install it with 'pip install pandas'"
            )

        if (spans_dataframe is None and span_ids is None) or (
            spans_dataframe is not None and span_ids is not None
        ):
            raise ValueError("Provide exactly one of 'spans_dataframe' or 'span_ids'.")

        if spans_dataframe is not None:
            span_ids_raw: list[str] = cast(
                list[str], spans_dataframe["context.span_id"].dropna().tolist()
            )
            span_ids_list = list({*span_ids_raw})
        else:
            assert span_ids is not None
            span_ids_list = list({*span_ids})

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

        df = pd.DataFrame(annotations)
        df = _flatten_nested_column(df, "result")
        df.rename(columns={"name": "annotation_name"}, inplace=True)
        df.set_index("span_id", inplace=True)  # type: ignore[unused-ignore]
        return df

    async def get_span_annotations(
        self,
        *,
        span_ids: Iterable[str],
        project_identifier: str,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.SpanAnnotation]:
        """
        Fetches span annotations and returns them as a list of SpanAnnotation objects.

        Args:
            span_ids: An iterable of span IDs.
            project_identifier: The project identifier (name or ID) used in the API path.
            limit: Maximum number of annotations returned per request page.
            timeout: Optional request timeout in seconds.

        Returns:
            A list of SpanAnnotation objects.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.
        """
        span_ids_list = list({*span_ids})  # remove duplicates while preserving type

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


def _is_node_id(s: str, node_type: str) -> bool:
    try:
        decoded = base64.b64decode(s, validate=True)
        if not decoded.startswith(f"{node_type}:".encode("utf-8")):
            return False
        return True
    except Exception:
        return False


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
