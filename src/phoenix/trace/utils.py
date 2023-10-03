import importlib
import json
from traceback import format_exception
from types import ModuleType
from typing import List, Optional

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


def import_package(package_name: str, pypi_name: Optional[str] = None) -> ModuleType:
    """
    Dynamically imports a package.

    Args:
        package_name (str): Name of the package to import.

        pypi_name (Optional[str], optional): Name of the package on PyPI, if different from the
        package name.

    Returns:
        ModuleType: The imported package.
    """
    try:
        return importlib.import_module(package_name)
    except ImportError:
        raise ImportError(
            f"The {package_name} package is not installed. "
            f"Install with `pip install {pypi_name or package_name}`."
        )
