import json
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError
from urllib.request import urlopen
from zipfile import ZipFile

import pandas as pd

from phoenix.utilities.logging import printif

# Rather than returning None, we return this string to indicate that the LLM output could not be
# parsed.
# This is useful for debugging as well as to just treat the output as a non-parsable category
NOT_PARSABLE = "NOT_PARSABLE"

# values in the default openai function call,
# defined here only to prevent typos
_RESPONSE = "response"
_EXPLANATION = "explanation"
_FUNCTION_NAME = "record_response"


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


def snap_to_rail(raw_string: Optional[str], rails: List[str], verbose: bool = False) -> str:
    """
    Snaps a string to the nearest rail, or returns None if the string cannot be
    snapped to a rail.

    Args:
        raw_string (str): An input to be snapped to a rail.

        rails (List[str]): The target set of strings to snap to.

    Returns:
        str: A string from the rails argument or "UNPARSABLE" if the input
        string could not be snapped.
    """
    if not raw_string:
        return NOT_PARSABLE
    snap_string = raw_string.lower()
    rails = list(set(rail.lower() for rail in rails))
    rails.sort(key=len, reverse=True)
    found_rails = set()
    for rail in rails:
        if rail in snap_string:
            found_rails.add(rail)
            snap_string = snap_string.replace(rail, "")
    if len(found_rails) != 1:
        printif(verbose, f"- Cannot snap {repr(raw_string)} to rails")
        return NOT_PARSABLE
    rail = list(found_rails)[0]
    printif(verbose, f"- Snapped {repr(raw_string)} to rail: {rail}")
    return rail


def parse_openai_function_call(raw_output: str) -> Tuple[str, Optional[str]]:
    """
    Parses the output of an OpenAI function call.

    Args:
        raw_output (str): The raw output of an OpenAI function call.

    Returns:
        Tuple[str, Optional[str]]: A tuple of the unrailed label and an optional
        explanation.
    """
    try:
        function_arguments = json.loads(raw_output, strict=False)
        unrailed_label = function_arguments.get(_RESPONSE, "")
        explanation = function_arguments.get(_EXPLANATION)
    except json.JSONDecodeError:
        unrailed_label = raw_output
        explanation = None
    return unrailed_label, explanation


def openai_function_call_kwargs(rails: List[str], provide_explanation: bool) -> Dict[str, Any]:
    """
    Returns keyword arguments needed to invoke an OpenAI model with function
    calling for classification.

    Args:
        rails (List[str]): The rails to snap the output to.

        provide_explanation (bool): Whether to provide an explanation.

    Returns:
        Dict[str, Any]: A dictionary containing function call arguments.
    """
    openai_function = _default_openai_function(rails, provide_explanation)
    return {
        "functions": [openai_function],
        "function_call": {"name": openai_function["name"]},
    }


def _default_openai_function(
    rails: List[str],
    with_explanation: bool = False,
) -> Dict[str, Any]:
    """
    Returns a default OpenAI function call for classification.

    Args:
        rails (List[str]): A list of rails to snap the output to.

        with_explanation (bool, optional): Whether to include an explanation.

    Returns:
        Dict[str, Any]: A JSON schema object advertising a function to record
        the result of the LLM's classification.
    """
    properties = {
        **(
            {
                _EXPLANATION: {
                    "type": "string",
                    "description": "Explanation of the reasoning for your response.",
                },
            }
            if with_explanation
            else {}
        ),
        _RESPONSE: {"type": "string", "description": "Your response.", "enum": rails},
    }
    required = [*([_EXPLANATION] if with_explanation else []), _RESPONSE]
    return {
        "name": _FUNCTION_NAME,
        "description": "A function to record your response.",
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": required,
        },
    }
