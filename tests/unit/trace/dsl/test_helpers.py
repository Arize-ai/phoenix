from typing import Any

import numpy as np
import pandas as pd
from pandas.testing import assert_frame_equal

from phoenix import Client
from phoenix.trace.dsl.helpers import (
    get_called_tools,
    get_qa_with_reference,
    get_retrieved_documents,
)


async def test_get_retrieved_documents(
    legacy_px_client: Client,
    default_project: Any,
    abc_project: Any,
) -> None:
    expected = pd.DataFrame(
        {
            "context.span_id": ["4567", "5678", "5678", "6789", "6789", "6789"],
            "document_position": [0, 0, 1, 0, 1, 2],
            "context.trace_id": ["0123", "0123", "0123", "0123", "0123", "0123"],
            "input": ["xyz", "xyz", "xyz", "xyz", "xyz", "xyz"],
            "reference": ["A", None, "B", None, None, "C"],
            "document_score": [1, np.nan, 2, np.nan, np.nan, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    actual = get_retrieved_documents(legacy_px_client)
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )


async def test_get_qa_with_reference(
    legacy_px_client: Client,
    default_project: Any,
    abc_project: Any,
) -> None:
    expected = pd.DataFrame(
        {
            "context.span_id": ["2345"],
            "input": ["210"],
            "output": ["321"],
            "reference": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    assert (actual := get_qa_with_reference(legacy_px_client)) is not None
    actual["reference"] = actual["reference"].map(lambda s: "\n\n".join(sorted(s.split("\n\n"))))
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )


async def test_get_called_tools(
    legacy_px_client: Client,
    default_project: Any,
    abc_project: Any,
) -> None:
    expected = pd.DataFrame(
        {
            "context.span_id": ["89101", "91011", "111213", "131415", "171819"],
            "input": [
                [
                    {
                        "message": {
                            "role": "user",
                            "content": "what is 2 times 3, and what is 2 plus 3",
                        }
                    }
                ],
                [{"message": {"role": "user", "content": "call foo"}}],
                [{"message": {"role": "user", "content": "abc"}}],
                [{"message": {"role": "user", "content": "test empty output"}}],
                [{"message": {"role": "user", "content": "test invalid tool"}}],
            ],
            "output": [
                [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "tool_call": {
                                        "id": "a",
                                        "function": {
                                            "name": "multiply",
                                            "arguments": '{\n  "a": 2,\n  "b": 3\n}',
                                        },
                                    }
                                },
                                {
                                    "tool_call": {
                                        "id": "b",
                                        "function": {
                                            "name": "add",
                                            "arguments": '{\n  "a": 2,\n  "b": 3\n}',
                                        },
                                    }
                                },
                            ],
                        }
                    }
                ],
                [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "tool_call": {
                                        "id": "c",
                                        "function": {
                                            "name": "foo",
                                        },
                                    }
                                }
                            ],
                        }
                    }
                ],
                [{"message": {"role": "assistant", "content": "xyz"}}],
                None,
                [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "tool_call": {
                                        "id": "invalid",
                                    }
                                }
                            ],
                        }
                    }
                ],
            ],
            "tool_call": [
                ["multiply(a=2, b=3)", "add(a=2, b=3)"],
                ["foo()"],
                None,
                None,
                None,
            ],
        }
    ).set_index("context.span_id")
    assert (actual := get_called_tools(legacy_px_client)) is not None
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
