import logging
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import httpx

from phoenix.client.types.spans import (
    GetSpansResponseBody,
    SpanData,
    SpanQuery,
    SpanQueryRequestBody,
)

if TYPE_CHECKING:
    import pandas as pd

logger = logging.getLogger(__name__)


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
        project_name: Optional[str] = None,
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

        response = self._client.post(
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

    def get_spans(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
    ) -> list[SpanData]:
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
            list of SpanData
        """
        request_body = SpanQueryRequestBody(
            queries=[query] if query else [],
            start_time=start_time.isoformat() if start_time else None,
            end_time=end_time.isoformat() if end_time else None,
            limit=limit,
            root_spans_only=root_spans_only,
            project_name=project_name,
        )

        response = self._client.post(
            "v1/spans",
            json=request_body.to_dict(),
        )
        response.raise_for_status()
        response_body = GetSpansResponseBody.from_dict(response.json())
        return response_body.data


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
            return pd.DataFrame(data)
        except ImportError:
            raise ImportError(
                "pandas is required to use get_spans_dataframe. "
                "Install it with 'pip install pandas'"
            )

    async def get_spans(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
    ) -> list[SpanData]:
        """
        Retrieves spans based on the provided filter conditions.
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
        return response_body.data
