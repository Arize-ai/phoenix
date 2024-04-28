import asyncio
from datetime import datetime
from typing import List, Optional

import nest_asyncio
import pandas as pd
from pandas.testing import assert_frame_equal
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.dsl.helpers import get_qa_with_reference, get_retrieved_documents
from sqlalchemy.ext.asyncio import AsyncSession


def test_get_retrieved_documents(
    session: AsyncSession, default_project: None, abc_project: None
) -> None:
    nest_asyncio.apply()  # needed to use an async session inside the client Mock
    mock = _Mock(session)
    expected = pd.DataFrame(
        {
            "context.span_id": ["4567", "4567", "4567"],
            "document_position": [0, 1, 2],
            "context.trace_id": ["0123", "0123", "0123"],
            "input": ["xyz", "xyz", "xyz"],
            "reference": ["A", "B", "C"],
            "document_score": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    actual = get_retrieved_documents(mock)
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )


def test_get_qa_with_reference(
    session: AsyncSession, default_project: None, abc_project: None
) -> None:
    nest_asyncio.apply()  # needed to use an async session inside the client Mock
    mock = _Mock(session)
    expected = pd.DataFrame(
        {
            "context.span_id": ["2345"],
            "input": ["210"],
            "output": ["321"],
            "reference": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    actual = get_qa_with_reference(mock)
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )


class _Mock:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def query_spans(
        self,
        *span_queries: SpanQuery,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        project_name: Optional[str] = None,
    ) -> List[pd.DataFrame]:
        ans = [
            asyncio.run(
                self.session.run_sync(
                    sq,
                    start_time=start_time,
                    stop_time=stop_time,
                    project_name=project_name,
                )
            )
            for sq in span_queries
        ]
        if len(ans) == 1:
            return ans[0]
        return ans
