import pandas as pd

from phoenix.trace.utils import json_lines_to_df


def test_json_lines_to_df_returns_empty_dataframe_for_empty_input() -> None:
    assert json_lines_to_df([]).equals(pd.DataFrame())


def test_json_lines_to_df_skips_blank_lines() -> None:
    df = json_lines_to_df(['{"name": "first"}\n', "\n", "  "])

    assert df.to_dict(orient="records") == [{"name": "first"}]
