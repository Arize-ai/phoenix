import json
from io import BytesIO
from urllib.error import HTTPError
from urllib.request import urlopen
from zipfile import ZipFile

import pandas as pd


def download_benchmark_dataset(task: str, dataset_name: str) -> pd.DataFrame:
    """Downloads an Arize evals benchmark dataset as a pandas dataframe.

    Args:
        task (str): Task to be performed.
        dataset_name (str): Name of the dataset.

    Returns:
        pandas.DataFrame: A pandas dataframe containing the data.
    """
    jsonl_file_name = f"{dataset_name}.jsonl"
    url = f"http://storage.googleapis.com/arize-assets/phoenix/evals/{task}/{jsonl_file_name}.zip"
    try:
        with urlopen(url) as response:
            zip_byte_stream = BytesIO(response.read())
            with ZipFile(zip_byte_stream) as zip_file:
                with zip_file.open(jsonl_file_name) as jsonl_file:
                    return pd.DataFrame(map(json.loads, jsonl_file.readlines()))
    except HTTPError:
        raise ValueError(f'Dataset "{dataset_name}" for "{task}" task does not exist.')


def get_tqdm_progress_bar_formatter(title: str) -> str:
    """Returns a progress bar formatter for use with tqdm.

    Args:
        title (str): The title of the progress bar, displayed as a prefix.

    Returns:
        str: A formatter to be passed to the bar_format argument of tqdm.
    """
    return (
        title + " |{bar}| {n_fmt}/{total_fmt} ({percentage:3.1f}%) "
        "| ⏳ {elapsed}<{remaining} | {rate_fmt}{postfix}"
    )
