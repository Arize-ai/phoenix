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
        Basic usage:
            >>> from phoenix.client import Client
            >>> from phoenix.client.types.spans import SpanQuery
            >>> client = Client()
            >>> query = SpanQuery().select("name", "span_id").where("name == 'my-span'")
            >>> df = client.spans.get_spans_dataframe(query=query)

    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_spans_dataframe(
        self,
        query: Optional[SpanQuery],
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
            query: A SpanQuery object defining the query criteria.
            start_time: Optional start time for filtering.
            end_time: Optional end time for filtering.
            limit: Maximum number of spans to return.
            root_spans_only: Whether to return only root spans.
            project_name: Optional project name to filter by.
            timeout: Optional request timeout in seconds.

        Returns:
            pandas DataFrame

        Raises:
            ImportError: If pandas is not installed
            TimeoutError: If the request times out.
        """
        project_name = project_name
        query = query if query else SpanQuery()
        normalized_start_time = normalize_datetime(start_time)
        normalized_end_time = normalize_datetime(end_time)

        request_body = SpanQueryRequestBody(
            queries=list(query),
            start_time=_to_iso_format(normalized_start_time),
            end_time=_to_iso_format(normalized_end_time),
            limit=limit,
            root_spans_only=root_spans_only,
        )

        try:
            response = self._client.post(
                url="v1/spans",
                headers={"accept": "application/json"},
                params={"project_name": project_name} if project_name else None,
                json=request_body.to_dict(),
                timeout=timeout,
            )
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
            else:
                response.raise_for_status()
                logger.warning("Received non-multipart response when expecting dataframe.")
                pass
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

        response.raise_for_status()
        return df


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
        query: Optional[SpanQuery],
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
            query: A SpanQuery object defining the query criteria.
            start_time: Optional start time for filtering.
            end_time: Optional end time for filtering.
            limit: Maximum number of spans to return.
            root_spans_only: Whether to return only root spans.
            project_name: Optional project name to filter by.
            timeout: Optional request timeout in seconds.

        Returns:
            pandas DataFrame

        Raises:
            ImportError: If pandas is not installed
            TimeoutError: If the request times out.
        """
        project_name = project_name
        query = query if query else SpanQuery()
        normalized_start_time = normalize_datetime(start_time)
        normalized_end_time = normalize_datetime(end_time)

        request_body = SpanQueryRequestBody(
            queries=list(query),
            start_time=_to_iso_format(normalized_start_time),
            end_time=_to_iso_format(normalized_end_time),
            limit=limit,
            root_spans_only=root_spans_only,
        )

        try:
            response = await self._client.post(
                url="v1/spans",
                headers={"accept": "application/json"},
                params={"project_name": project_name} if project_name else None,
                json=request_body.to_dict(),
                timeout=timeout,
            )
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
            else:
                response.raise_for_status()
                logger.warning("Received non-multipart response when expecting dataframe.")
                pass
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

        response.raise_for_status()
        return df


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def decode_df_from_json_string(obj: str) -> "pd.DataFrame":
    import pandas as pd
    from pandas.io.json._table_schema import parse_table_schema

    df = cast(pd.DataFrame, parse_table_schema(StringIO(obj).read(), False))
    df.index.names = [x.split("_", 1)[1] or None for x in df.index.names]  # type: ignore
    return df.set_axis([x.split("_", 1)[1] for x in df.columns], axis=1)


class TimeoutError(Exception): ...
