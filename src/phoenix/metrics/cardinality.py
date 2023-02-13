import concurrent.futures as cf
from typing import Dict, List, Optional

import pandas as pd


def cardinality(
    df: pd.DataFrame, column_names: List[str], max_workers: Optional[int] = None
) -> Dict[str, int]:
    """
    Compute the cardinality of each str column in the dataframe
    E.x. if the dataframe column contains ["dog", "cat", "dog", "mouse"], the cardinality is 3
    """
    data = {}
    with cf.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_column_name = {
            executor.submit(lambda x: x.nunique(dropna=False), df[col]): col for col in column_names
        }
        for future in cf.as_completed(future_to_column_name):
            column_name = future_to_column_name[future]
            data[column_name] = future.result()
    return data
