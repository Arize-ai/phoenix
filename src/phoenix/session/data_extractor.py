from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional, Union, cast

import pandas as pd

from phoenix.trace import Evaluations
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.trace_dataset import TraceDataset

DEFAULT_SPAN_LIMIT = 1000


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
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]: ...

    def get_spans_dataframe(
        self,
        filter_condition: Optional[str] = None,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = DEFAULT_SPAN_LIMIT,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
    ) -> Optional[pd.DataFrame]:
        return cast(
            Optional[pd.DataFrame],
            self.query_spans(
                SpanQuery().where(filter_condition or ""),
                start_time=start_time,
                end_time=end_time,
                limit=limit,
                root_spans_only=root_spans_only,
                project_name=project_name,
            ),
        )

    @abstractmethod
    def get_evaluations(
        self,
        project_name: Optional[str] = None,
    ) -> List[Evaluations]: ...

    def get_trace_dataset(
        self,
        project_name: Optional[str] = None,
    ) -> Optional[TraceDataset]:
        if (dataframe := self.get_spans_dataframe(project_name=project_name)) is None:
            return None
        evaluations = self.get_evaluations(project_name=project_name)
        return TraceDataset(dataframe=dataframe, evaluations=evaluations)
