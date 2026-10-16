import pytest

from phoenix.trace.utils import json_lines_to_df


@pytest.mark.parametrize(
    "lines",
    [
        pytest.param([], id="no-lines"),
        pytest.param(["\n"], id="newline-only"),
        pytest.param(["", "  \n", "\t\n"], id="whitespace-only"),
    ],
)
def test_json_lines_to_df_returns_empty_dataframe_when_there_are_no_json_objects(
    lines: list[str],
) -> None:
    df = json_lines_to_df(lines)
    assert df.empty
    assert df.columns.empty


def test_json_lines_to_df_skips_blank_lines() -> None:
    lines = [
        '{"name": "a", "attributes": {"x": 1}}\n',
        "\n",
        '{"name": "b", "attributes": {"x": 2}}\n',
        "\n",
    ]
    df = json_lines_to_df(lines)
    assert df["name"].tolist() == ["a", "b"]
    assert df["attributes.x"].tolist() == [1, 2]
