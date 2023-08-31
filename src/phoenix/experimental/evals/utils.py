"""
Utility functions for evaluations.
"""

import json
from urllib.error import HTTPError
from urllib.request import urlopen

import pandas as pd


def download_benchmark_dataset(task: str, dataset_name: str) -> pd.DataFrame:
    """Downloads an Arize evals benchmark dataset as a pandas dataframe.

    Args:
        task (str): Task to be performed.
        dataset_name (str): Name of the dataset.

    Returns:
        pandas.DataFrame: A pandas dataframe containing the data.
    """
    url = f"http://storage.googleapis.com/arize-assets/phoenix/evals/{task}/{dataset_name}.jsonl"
    try:
        with urlopen(url) as f:
            return pd.DataFrame([json.loads(line.decode()) for line in f.readlines()])
    except HTTPError:
        raise ValueError(f'Dataset "{dataset_name}" for "{task}" task does not exist.')
