import logging
from datetime import datetime
from typing import Optional

import httpx
import pandas as pd

from phoenix.client.types.spans import (
    GetSpansRequestBody,
    GetSpansResponseBody,
    SpanQuery,
)

logger = logging.getLogger(__name__)


class Spans:
    """
    Provides methods for interacting with span resources.

    This class allows you to query spans using the query DSL.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> from phoenix.client.types.spans import SpanQuery, Projection
            >>> client = Client()
            >>> query = SpanQuery(
            ...     select={"name": Projection(key="name")},
            ...     filter=SpanFilter(condition="name == 'my-span'")
            ... )
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
    ) -> pd.DataFrame:
        """
        Retrieves spans as a pandas DataFrame based on the provided filter conditions.

        Args:
            query (Optional[SpanQuery]): The query to execute.
            start_time (Optional[datetime]): Start time to filter spans by.
            end_time (Optional[datetime]): End time to filter spans by.
            limit (int): Maximum number of spans to return.
            root_spans_only (Optional[bool]): Whether to only return root spans.
            project_name (Optional[str]): The name of the project to query.

        Returns:
            pd.DataFrame: A DataFrame containing the spans.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.

        Example:
            Basic usage:
                >>> from phoenix.client import Client
                >>> from phoenix.client.types.spans import SpanQuery, Projection
                >>> client = Client()
                >>> query = SpanQuery(
                ...     select={"name": Projection(key="name")},
                ...     filter=SpanFilter(condition="name == 'my-span'")
                ... )
                >>> df = client.spans.get_spans_dataframe(query=query)
        """
        url = "v1/spans"

        # Convert datetime objects to ISO format strings if provided
        start_time_str = start_time.isoformat() if start_time else None
        end_time_str = end_time.isoformat() if end_time else None

        # Create request body
        request_body = GetSpansRequestBody(
            queries=[query] if query else [],
            start_time=start_time_str,
            end_time=end_time_str,
            limit=limit,
            root_spans_only=root_spans_only,
            project_name=project_name,
        )

        # Make request
        response = self._client.post(url=url, json=request_body.dict())
        response.raise_for_status()

        # Parse response
        response_body = GetSpansResponseBody.parse_obj(response.json())

        # Convert to DataFrame
        if not response_body.data:
            return pd.DataFrame()

        return pd.DataFrame([span.dict() for span in response_body.data])


class AsyncSpans:
    """
    Provides asynchronous methods for interacting with span resources.

    This class allows you to query spans using the query DSL.

    Example:
        Basic usage:
            >>> from phoenix.client import AsyncClient
            >>> from phoenix.client.types.spans import SpanQuery, Projection
            >>> client = AsyncClient()
            >>> query = SpanQuery(
            ...     select={"name": Projection(key="name")},
            ...     filter=SpanFilter(condition="name == 'my-span'")
            ... )
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
    ) -> pd.DataFrame:
        """
        Retrieves spans as a pandas DataFrame based on the provided filter conditions.

        Args:
            query (Optional[SpanQuery]): The query to execute.
            start_time (Optional[datetime]): Start time to filter spans by.
            end_time (Optional[datetime]): End time to filter spans by.
            limit (int): Maximum number of spans to return.
            root_spans_only (Optional[bool]): Whether to only return root spans.
            project_name (Optional[str]): The name of the project to query.

        Returns:
            pd.DataFrame: A DataFrame containing the spans.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.

        Example:
            Basic usage:
                >>> from phoenix.client import AsyncClient
                >>> from phoenix.client.types.spans import SpanQuery, Projection
                >>> client = AsyncClient()
                >>> query = SpanQuery(
                ...     select={"name": Projection(key="name")},
                ...     filter=SpanFilter(condition="name == 'my-span'")
                ... )
                >>> df = await client.spans.get_spans_dataframe(query=query)
        """
        url = "v1/spans"

        # Convert datetime objects to ISO format strings if provided
        start_time_str = start_time.isoformat() if start_time else None
        end_time_str = end_time.isoformat() if end_time else None

        # Create request body
        request_body = GetSpansRequestBody(
            queries=[query] if query else [],
            start_time=start_time_str,
            end_time=end_time_str,
            limit=limit,
            root_spans_only=root_spans_only,
            project_name=project_name,
        )

        # Make request
        response = await self._client.post(url=url, json=request_body.dict())
        response.raise_for_status()

        # Parse response
        response_body = GetSpansResponseBody.parse_obj(response.json())

        # Convert to DataFrame
        if not response_body.data:
            return pd.DataFrame()

        return pd.DataFrame([span.dict() for span in response_body.data])
