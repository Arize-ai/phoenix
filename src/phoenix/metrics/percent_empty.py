from typing import Dict, List, Optional

from pandas import DataFrame


def percent_empty(dataframe: DataFrame, column_names: List[str]) -> Dict[str, Optional[float]]:
    """
    Returns a map of the dataframe column names to the percent of empty entries
    for each row.
    """
    num_records = dataframe.shape[0]
    if num_records == 0:
        return {col: None for col in column_names}
    return dict(dataframe[column_names].isnull().sum() / num_records)
