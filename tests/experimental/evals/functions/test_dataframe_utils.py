import pandas as pd
from phoenix.experimental.evals.functions.dataframe_utils import (
    ensure_df_has_columns,
    first_missing_index,
    first_missing_row_number,
)


def test_ensure_df_has_columns():
    # Test when df has all the required columns
    df = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]})
    ensure_df_has_columns(df, ["A", "B"])
    assert set(df.columns) == {"A", "B"}
    assert df["A"].tolist() == [1, 2, 3]
    assert df["B"].tolist() == [4, 5, 6]

    # Test when df is missing some of the required columns
    df = pd.DataFrame({"A": [1, 2, 3]})
    ensure_df_has_columns(df, ["A", "B"])
    assert set(df.columns) == {"A", "B"}
    assert df["B"].isnull().all()
    assert df["A"].tolist() == [1, 2, 3]

    # Test when df is missing all of the required columns
    df = pd.DataFrame()
    ensure_df_has_columns(df, ["A", "B"])
    assert set(df.columns) == {"A", "B"}
    assert df["A"].isnull().all()
    assert df["B"].isnull().all()

    # Test when columns is an empty list
    df = pd.DataFrame({"A": [1, 2, 3]})
    ensure_df_has_columns(df, [])
    assert set(df.columns) == {"A"}


def test_first_missing_index():
    # Test when dst_df has an index not in src_df
    src_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    dst_df = pd.DataFrame({"A": [1, 2, 3, 4]}, index=[1, 2, 3, 4])
    assert first_missing_index(src_df, dst_df) == 4

    # Test when dst_df is a subset of src_df
    src_df = pd.DataFrame({"A": [1, 2, 3, 4]}, index=[1, 2, 3, 4])
    dst_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    assert first_missing_index(src_df, dst_df) is None

    # Test when src_df and dst_df are identical
    src_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    dst_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    assert first_missing_index(src_df, dst_df) is None

    # Test when src_df is empty
    src_df = pd.DataFrame()
    dst_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    assert first_missing_index(src_df, dst_df) == 1

    # Test when dst_df is empty
    src_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    dst_df = pd.DataFrame()
    assert first_missing_index(src_df, dst_df) is None


def test_first_missing_row_number():
    # Test when dst_df has a row not in src_df
    src_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    dst_df = pd.DataFrame({"A": [1, 2, 3, 4]}, index=[1, 2, 3, 4])
    assert first_missing_row_number(src_df, dst_df) == 3

    # Test when dst_df is a subset of src_df
    src_df = pd.DataFrame({"A": [1, 2, 3, 4]}, index=[1, 2, 3, 4])
    dst_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    assert first_missing_row_number(src_df, dst_df) is None

    # Test when src_df and dst_df are identical
    src_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    dst_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    assert first_missing_row_number(src_df, dst_df) is None

    # Test when src_df is empty
    src_df = pd.DataFrame()
    dst_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    assert first_missing_row_number(src_df, dst_df) == 0

    # Test when dst_df is empty
    src_df = pd.DataFrame({"A": [1, 2, 3]}, index=[1, 2, 3])
    dst_df = pd.DataFrame()
    assert first_missing_row_number(src_df, dst_df) is None
