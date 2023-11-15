from typing import Hashable, Iterable, Union

import pandas as pd


def ensure_df_has_columns(df: pd.DataFrame, columns: Iterable[str]) -> None:
    """
    Ensure that the given DataFrame has the specified columns. If a column is
    missing, it will be added with None values.

    Args:
        df (pd.DataFrame): The DataFrame to ensure columns for. columns
        (Iterable[str]): The list of column names to ensure.

    Returns:
        None
    """
    for column in columns:
        if column not in df.columns:
            df[column] = None


def first_missing_index(src_df: pd.DataFrame, dst_df: pd.DataFrame) -> Union[Hashable, None]:
    """
    Returns the index of the first row in `dst_df` that is not present in
    `src_df`.

    Args:
        src_df (pd.DataFrame): The source DataFrame.
        dst_df (pd.DataFrame): The destination DataFrame.

    Returns:
       index (Union[Hashable, None]): The index of the first missing row
    """

    for index, row in dst_df.iterrows():
        if index not in src_df.index:
            return index
    return None


def first_missing_row_number(src_df: pd.DataFrame, dst_df: pd.DataFrame) -> Union[int, None]:
    """
    Returns the row number of the first row in `dst_df` that is not present in
    `src_df`.

    Args:
        src_df (pd.DataFrame): The source DataFrame.
        dst_df (pd.DataFrame): The destination DataFrame.

    Returns:
       row_number (Union[int, None]): The row number of the first missing row
    """
    missing_index = first_missing_index(src_df, dst_df)
    if missing_index is None:
        return None
    loc = dst_df.index.get_loc(missing_index)
    # Fallback to 0 if the index is not found
    return loc if isinstance(loc, int) else 0
