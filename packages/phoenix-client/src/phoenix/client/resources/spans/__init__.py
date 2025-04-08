import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import httpx

from phoenix.client.types.spans import (
    GetSpansRequestBody,
    GetSpansResponseBody,
    SpanQuery,
)

logger = logging.getLogger(__name__)


class Spans:
    """
    Provides methods for interacting with span resources.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> from phoenix.client.types.spans import SpanQuery, Projection
            >>> client = Client()
            >>> query = SpanQuery(
            ...     select={"name": Projection(key="name")},
            ...     filter=SpanFilter(condition="name == 'my-span'")
            ... )
            >>> data = client.spans.get_spans(query=query)
            >>> # Convert to DataFrame if needed
            >>> import pandas as pd
            >>> df = pd.DataFrame(data)
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_spans(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        as_dataframe: bool = False,
    ) -> Union[List[Dict[str, Any]], Any]:
        """
        Retrieves spans based on the provided filter conditions.

        Args:
            query: Optional query to filter spans
            start_time: Optional start time for filtering
            end_time: Optional end time for filtering
            limit: Maximum number of spans to return
            root_spans_only: Whether to return only root spans
            project_name: Optional project name to filter by
            as_dataframe: If True, returns a pandas DataFrame. Requires pandas to be installed.

        Returns:
            List of dictionaries containing span data, or a pandas DataFrame if as_dataframe=True
        """
        request_body = GetSpansRequestBody(
            queries=[query] if query else [],
            start_time=start_time.isoformat() if start_time else None,
            end_time=end_time.isoformat() if end_time else None,
            limit=limit,
            root_spans_only=root_spans_only,
            project_name=project_name,
        )

        response = self._client.post(
            "/api/v1/spans",
            json=request_body.to_dict(),
        )
        response.raise_for_status()
        response_body = GetSpansResponseBody.from_dict(response.json())
        data = [span.to_dict() for span in response_body.data]

        if as_dataframe:
            try:
                import pandas as pd

                return pd.DataFrame(data)
            except ImportError:
                raise ImportError(
                    "pandas is required to return a DataFrame. "
                    "Install it with 'pip install pandas' or set as_dataframe=False"
                )
        return data


class AsyncSpans:
    """
    Provides async methods for interacting with span resources.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> from phoenix.client.types.spans import SpanQuery, Projection
            >>> client = Client()
            >>> query = SpanQuery(
            ...     select={"name": Projection(key="name")},
            ...     filter=SpanFilter(condition="name == 'my-span'")
            ... )
            >>> data = await client.spans.get_spans(query=query)
            >>> # Convert to DataFrame if needed
            >>> import pandas as pd
            >>> df = pd.DataFrame(data)
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def get_spans(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        as_dataframe: bool = False,
    ) -> Union[List[Dict[str, Any]], Any]:
        """
        Retrieves spans based on the provided filter conditions.

        Args:
            query: Optional query to filter spans
            start_time: Optional start time for filtering
            end_time: Optional end time for filtering
            limit: Maximum number of spans to return
            root_spans_only: Whether to return only root spans
            project_name: Optional project name to filter by
            as_dataframe: If True, returns a pandas DataFrame. Requires pandas to be installed.

        Returns:
            List of dictionaries containing span data, or a pandas DataFrame if as_dataframe=True
        """
        request_body = GetSpansRequestBody(
            queries=[query] if query else [],
            start_time=start_time.isoformat() if start_time else None,
            end_time=end_time.isoformat() if end_time else None,
            limit=limit,
            root_spans_only=root_spans_only,
            project_name=project_name,
        )

        response = await self._client.post(
            "/api/v1/spans",
            json=request_body.to_dict(),
        )
        response.raise_for_status()
        response_body = GetSpansResponseBody.from_dict(response.json())
        data = [span.to_dict() for span in response_body.data]

        if as_dataframe:
            try:
                import pandas as pd

                return pd.DataFrame(data)
            except ImportError:
                raise ImportError(
                    "pandas is required to return a DataFrame. "
                    "Install it with 'pip install pandas' or set as_dataframe=False"
                )
        return data
