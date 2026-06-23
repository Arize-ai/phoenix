import pandas as pd
from pandas.testing import assert_frame_equal

from phoenix.trace.utils import json_lines_to_df


def test_json_lines_to_df_returns_empty_dataframe_for_empty_input() -> None:
    assert_frame_equal(json_lines_to_df([]), pd.DataFrame())


def test_json_lines_to_df_ignores_blank_lines() -> None:
    assert_frame_equal(json_lines_to_df(["\n", "  \n"]), pd.DataFrame())


def test_json_lines_to_df_normalizes_json_lines() -> None:
    lines = [
        '{"name": "span-1", "context": {"trace_id": "trace-1", "span_id": "span-1"}}',
        "\n",
        '{"name": "span-2", "context": {"trace_id": "trace-2", "span_id": "span-2"}}',
    ]

    assert_frame_equal(
        json_lines_to_df(lines),
        pd.DataFrame(
            {
                "name": ["span-1", "span-2"],
                "context.trace_id": ["trace-1", "trace-2"],
                "context.span_id": ["span-1", "span-2"],
            }
        ),
    )
