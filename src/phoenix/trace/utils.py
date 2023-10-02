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
    df = pd.concat([pd.json_normalize(item, max_level=1) for item in data], ignore_index=True)
    return df


def get_stacktrace(exception: BaseException) -> str:
    """Gets stacktrace from exception."""
    exception_type = type(exception)
    exception_traceback = exception.__traceback__
    stack_trace_lines = format_exception(exception_type, exception, exception_traceback)
    return "".join(stack_trace_lines)
