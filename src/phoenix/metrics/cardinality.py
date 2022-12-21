"""
Cardinality metrics
"""

import concurrent.futures as cf
from typing import Any, Dict, Optional

import pandas as pd
from pandas.core.algorithms import value_counts


def cardinality(df: pd.DataFrame, max_workers: Optional[int] = None) -> Dict[str, "pd.Series[Any]"]:
    data: Dict[str, pd.Series[Any]] = {}
    with cf.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_column_name: Dict[cf.Future[Any], str] = {
            executor.submit(value_counts, df[col], dropna=False): str(col) for col in df.columns
        }
        for future in cf.as_completed(future_to_column_name):
            column_name: str = future_to_column_name[future]
            column: pd.Series[Any] = future.result()
            data[column_name] = column
    return data
