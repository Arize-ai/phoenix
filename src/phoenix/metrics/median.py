"""
Find median.
"""

import pandas as pd


def median(df: pd.DataFrame) -> "pd.Series[float]":
    return df.median()
