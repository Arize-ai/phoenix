import pandas as pd
import pytest
from pandas.testing import assert_frame_equal

from phoenix.trace.utils import json_lines_to_df


@pytest.mark.parametrize(
    "lines",
    [
        [],
        ["\n"],
        ["", "   ", "\t"],
    ],
)
def test_json_lines_to_df_returns_empty_dataframe_without_json_objects(
    lines: list[str],
) -> None:
    assert_frame_equal(json_lines_to_df(lines), pd.DataFrame())


def test_json_lines_to_df_skips_blank_lines() -> None:
    lines = ['{"name": "first"}\n', "\n", '  {"name": "second"}\n', ""]
    assert json_lines_to_df(lines).to_dict(orient="records") == [
        {"name": "first"},
        {"name": "second"},
    ]
