import json
from typing import List

import pandas as pd


def json_lines_to_df(lines: List[str]) -> pd.DataFrame:
    """
    Convert a list of JSON line strings to a Pandas DataFrame.
    """
    data = []

    for line in lines:
        # Load the JSON object from the line
        data.append(json.loads(line))

    # Normalize data to a flat structure
    df = pd.concat([pd.json_normalize(item) for item in data], ignore_index=True)
    return df
