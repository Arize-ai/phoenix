"""
Cardinality metrics
"""

import concurrent.futures as cf
from typing import Any, List, Optional

import pandas as pd


def cardinality(
    df: pd.DataFrame, column_names: List[str], max_workers: Optional[int] = None
) -> "pd.Series[Any]":
    index = []
    data = []
    with cf.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_column_name = {
            executor.submit(lambda x: x.nunique(dropna=False), df[col]): col for col in column_names
        }
        for future in cf.as_completed(future_to_column_name):
            column_name = future_to_column_name[future]
            index.append(column_name)
            data.append(future.result())
    return pd.Series(data, index=index)
