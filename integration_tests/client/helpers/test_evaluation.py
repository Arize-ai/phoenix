from typing import Any

import numpy as np
import pandas as pd
from pandas.testing import assert_frame_equal

from phoenix.client import Client
from phoenix.client.helpers.evaluation import (
    get_qa_with_context,
    get_retrieved_documents,
)


async def test_get_retrieved_documents(
    px_client: Client,
    default_project: Any,
    abc_project: Any,
) -> None:
    expected = pd.DataFrame(
        {
            "context.span_id": ["4567", "5678", "5678", "6789", "6789", "6789"],
            "document_position": [0, 0, 1, 0, 1, 2],
            "context.trace_id": ["0123", "0123", "0123", "0123", "0123", "0123"],
            "input": ["xyz", "xyz", "xyz", "xyz", "xyz", "xyz"],
            "context": ["A", None, "B", None, None, "C"],
            "document_score": [1, np.nan, 2, np.nan, np.nan, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    actual = get_retrieved_documents(px_client)
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )


async def test_get_qa_with_context(
    px_client: Client,
    default_project: Any,
    abc_project: Any,
) -> None:
    expected = pd.DataFrame(
        {
            "context.span_id": ["2345"],
            "input": ["210"],
            "output": ["321"],
            "context": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    assert (actual := get_qa_with_context(px_client)) is not None
    actual["context"] = actual["context"].map(lambda s: "\n\n".join(sorted(s.split("\n\n"))))
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
