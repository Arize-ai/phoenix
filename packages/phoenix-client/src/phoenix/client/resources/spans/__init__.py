import logging
from datetime import datetime
from io import StringIO
from typing import TYPE_CHECKING, Optional, cast

import httpx

from phoenix.config import get_env_project_name
from phoenix.datetime_utils import normalize_datetime

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.types.spans import (
    GetSpansResponseBody,
    SpanData,
    SpanQuery,
    SpanQueryRequestBody,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 5


class Spans:
    """
    Provides methods for interacting with span resources.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> from phoenix.client.types.spans import SpanQuery
            >>> client = Client()
            >>> query1 = SpanQuery().select("name", "span_id").where("name == 'my-span'")
            >>> query2 = SpanQuery().where("attributes.tag == 'test'")
            >>> df = client.spans.get_spans_dataframe(query1, query2, project_name="my-project")

    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_spans_dataframe(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """
        Retrieves spans based on the provided filter conditions.

        Args:
            *queries: One or more SpanQuery objects defining the query criteria.
            start_time: Optional start time for filtering.
            end_time: Optional end time for filtering.
            limit: Maximum number of spans to return.
            root_spans_only: Whether to return only root spans.
            project_name: Optional project name to filter by. Defaults to env var PHOENIX_PROJECT_NAME.
            timeout: Optional request timeout in seconds.

        Returns:
            pandas DataFrame

        Raises:
            ImportError: If pandas is not installed
            TimeoutError: If the request times out.
        """
        final_project_name = project_name or get_env_project_name()
        final_queries = queries if queries else (SpanQuery(),)
        normalized_start_time = normalize_datetime(start_time)
        normalized_end_time = normalize_datetime(end_time)

        request_body = SpanQueryRequestBody(
            queries=list(final_queries),
            start_time=_to_iso_format(normalized_start_time),
            end_time=_to_iso_format(normalized_end_time),
            limit=limit,
            root_spans_only=root_spans_only,
        )

        try:
            response = self._client.post(
                url="v1/spans",
                headers={"accept": "application/json"},
                params={"project_name": final_project_name},
                json=request_body.to_dict(),
                timeout=timeout,
            )
            results = []
            content_type = response.headers.get("Content-Type")
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
                        df = decode_df_from_json_string(json_string)
                        results.append(df)
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

        response.raise_for_status()
        return results


class AsyncSpans:
    """
    Provides async methods for interacting with span resources.

    Example:
        Basic usage:
            >>> import asyncio
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
        as_dataframe: bool = False,
    ) -> "pd.DataFrame":
        """
        Retrieves spans based on the provided filter conditions.

        Args:
            query: Optional query to filter spans
            start_time: Optional start time for filtering
            end_time: Optional end time for filtering
            limit: Maximum number of spans to return
            root_spans_only: Whether to return only root spans
            project_name: Optional project name to filter by

        Returns:
            pandas DataFrame

        Raises:
            ImportError: If pandas is not installed
        """
        request_body = SpanQueryRequestBody(
            queries=[query] if query else [],
            start_time=start_time.isoformat() if start_time else None,
            end_time=end_time.isoformat() if end_time else None,
            limit=limit,
            root_spans_only=root_spans_only,
            project_name=project_name,
        )

        response = await self._client.post(
            "v1/spans",
            json=request_body.to_dict(),
        )
        response.raise_for_status()
        response_body = GetSpansResponseBody.from_dict(response.json())
        data = [span.to_dict() for span in response_body.data]

        try:
            import pandas as pd

            return pd.DataFrame(data)
        except ImportError:
            raise ImportError(
                "pandas is required to use get_spans_dataframe. "
                "Install it with 'pip install pandas'"
            )

    async def get_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[SpanData]:
        """
        Retrieves spans based on the provided filter conditions.
        """
        final_project_name = project_name or get_env_project_name()
        final_queries = queries if queries else (SpanQuery(),)
        normalized_start_time = normalize_datetime(start_time)
        normalized_end_time = normalize_datetime(end_time)

        # Remove pre-conversion to dicts
        # query_dicts = [q.to_dict() for q in final_queries]

        request_body = SpanQueryRequestBody(
            # Pass the tuple of SpanQuery objects directly
            queries=list(final_queries),
            start_time=_to_iso_format(normalized_start_time),
            end_time=_to_iso_format(normalized_end_time),
            limit=limit,
            root_spans_only=root_spans_only,
            # project_name is now a query param, not in body
        )

        try:
            # Access the client via the parent
            response = await self._parent_client._client.post(
                "v1/spans",
                params={"project_name": final_project_name},
                # SpanQueryRequestBody.to_dict() handles internal conversion
                json=request_body.to_dict(),
                headers={"accept": "application/json"},
                timeout=timeout,
            )
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

            # Define TimeoutError or import if it exists elsewhere
            class TimeoutError(Exception): ...

            raise TimeoutError(error_message) from error

        response.raise_for_status()
        response_body = GetSpansResponseBody.from_dict(response.json())
        return response_body.data


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def decode_df_from_json_string(obj: str) -> "pd.DataFrame":
    try:
        import pandas as pd
        from pandas.io.json._table_schema import parse_table_schema
    except ImportError:
        raise ImportError(
            "pandas is required to use get_spans_dataframe. "
            "Install it with 'pip install pandas'"
        )

    df = cast(pd.DataFrame, parse_table_schema(StringIO(obj).read(), False))
    df.index.names = [x.split("_", 1)[1] or None for x in df.index.names]  # type: ignore
    return df.set_axis([x.split("_", 1)[1] for x in df.columns], axis=1)


class TimeoutError(Exception): ...
