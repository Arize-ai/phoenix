from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Union, cast

import pandas as pd

from phoenix.trace import Evaluations
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.trace_dataset import TraceDataset

DEFAULT_SPAN_LIMIT = 1000
DEFAULT_TIMEOUT_IN_SECONDS = 5


class TraceDataExtractor(ABC):
    """
    An abstract base class intended to constraint both `Client` and
    `Session` so that they both implement the same methods.
    """

    @abstractmethod
    def query_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = DEFAULT_SPAN_LIMIT,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Optional[Union[pd.DataFrame, list[pd.DataFrame]]]: ...

    def get_spans_dataframe(
        self,
        filter_condition: Optional[str] = None,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = DEFAULT_SPAN_LIMIT,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Optional[pd.DataFrame]:
        """
        Retrieves spans as a pandas DataFrame based on optional filter conditions.

        Args:
            filter_condition: Optional filter condition string
            start_time: Optional start time for filtering  
            end_time: Optional end time for filtering
            limit: Maximum number of spans to return
            root_spans_only: Whether to return only root spans
            project_name: Optional project name to filter by
            timeout: Request timeout in seconds

        Returns:
            pandas DataFrame containing span data, or None if no spans found
        """
        return cast(
            Optional[pd.DataFrame],
            self.query_spans(
                SpanQuery().where(filter_condition or ""),
                start_time=start_time,
                end_time=end_time,
                limit=limit,
                root_spans_only=root_spans_only,
                project_name=project_name,
                timeout=timeout,
            ),
        )

    @abstractmethod
    def get_evaluations(
        self,
        project_name: Optional[str] = None,
    ) -> list[Evaluations]: ...

    def get_trace_dataset(
        self,
        project_name: Optional[str] = None,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = DEFAULT_SPAN_LIMIT,
        root_spans_only: Optional[bool] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Optional[TraceDataset]:
        """
        Retrieves a complete trace dataset including spans and evaluations.

        Args:
            project_name: Optional project name to filter by
            start_time: Optional start time for filtering
            end_time: Optional end time for filtering
            limit: Maximum number of spans to return
            root_spans_only: Whether to return only root spans
            timeout: Request timeout in seconds

        Returns:
            TraceDataset object containing spans and evaluations, or None if no data found
        """
        if (
            dataframe := self.get_spans_dataframe(
                project_name=project_name,
                start_time=start_time,
                end_time=end_time,
                limit=limit,
                root_spans_only=root_spans_only,
                timeout=timeout,
            )
        ) is None:
            return None
        evaluations = self.get_evaluations(project_name=project_name)
        return TraceDataset(dataframe=dataframe, evaluations=evaluations)
