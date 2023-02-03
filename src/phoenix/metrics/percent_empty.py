from typing import Dict, Optional

from pandas import DataFrame


def percent_empty(dataframe: DataFrame) -> Optional[Dict[str, float]]:
    """
    Returns a map of the dataframe column names to the percent of empty entries
    for each row.
    """
    num_records = dataframe.shape[0]
    if num_records == 0:
        return None
    return dataframe.isnull().sum() / dataframe.shape[0]
