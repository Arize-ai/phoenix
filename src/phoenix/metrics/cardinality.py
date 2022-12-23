"""
Cardinality metrics
"""

import concurrent.futures as cf
from typing import Any, Dict, List, Optional, TypeAlias

import pandas as pd
from pandas.core.algorithms import value_counts

Column: TypeAlias = "pd.Series[Any]"


def cardinality(
    df: pd.DataFrame, column_names: List[str], max_workers: Optional[int] = None
) -> Dict[str, Column]:
    data = {}
    with cf.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_column_name = {
            executor.submit(value_counts, df[col], dropna=False): col for col in column_names
        }
        for future in cf.as_completed(future_to_column_name):
            column_name = future_to_column_name[future]
            data[column_name] = future.result()
    return data
