from typing import Any, Awaitable, Callable

import pandas as pd
from pandas.testing import assert_frame_equal

from phoenix import Client
from phoenix.trace.dsl.helpers import get_qa_with_reference, get_retrieved_documents


async def test_get_retrieved_documents(
    px_client: Client,
    default_project: Any,
    abc_project: Any,
    acall: Callable[..., Awaitable[Any]],
) -> None:
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
    actual = await acall(get_retrieved_documents, px_client)
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )


async def test_get_qa_with_reference(
    px_client: Client,
    default_project: Any,
    abc_project: Any,
    acall: Callable[..., Awaitable[Any]],
) -> None:
    expected = pd.DataFrame(
        {
            "context.span_id": ["2345"],
            "input": ["210"],
            "output": ["321"],
            "reference": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    actual = await acall(get_qa_with_reference, px_client)
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
