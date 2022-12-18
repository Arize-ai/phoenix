"""
Percent empty
"""

import pandas as pd


def percent_empty(df: pd.DataFrame) -> "pd.Series[float]":
    return df.isnull().sum() / df.shape[0]
