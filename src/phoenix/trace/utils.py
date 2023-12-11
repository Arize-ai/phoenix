import json
import re
from traceback import format_exception
from typing import List, Optional, Tuple, cast

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
    """Extracts the stacktrace from an exception.

    Args:
        exception (BaseException): The exception to extract the stacktrace from.

    Returns:
        str: The stacktrace.
    """
    exception_type = type(exception)
    exception_traceback = exception.__traceback__
    stack_trace_lines = format_exception(exception_type, exception, exception_traceback)
    return "".join(stack_trace_lines)


_VERSION_TRIPLET_REGEX = re.compile(r"(\d+)\.(\d+)\.(\d+)")


def extract_version_triplet(version: str) -> Optional[Tuple[int, int, int]]:
    return (
        cast(Tuple[int, int, int], tuple(map(int, match.groups())))
        if (match := _VERSION_TRIPLET_REGEX.search(version))
        else None
    )
