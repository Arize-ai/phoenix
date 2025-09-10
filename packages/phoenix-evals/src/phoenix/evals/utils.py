import base64
import json
import os
from io import BytesIO
from typing import Any, Dict, List, Literal, Optional, Tuple
from urllib.error import HTTPError
from urllib.request import urlopen
from zipfile import ZipFile

import pandas as pd
from tqdm.auto import tqdm

# Rather than returning None, we return this string to indicate that the LLM output could not be
# parsed.
# This is useful for debugging as well as to just treat the output as a non-parsable category
NOT_PARSABLE = "NOT_PARSABLE"

# values in the default openai function call,
# defined here only to prevent typos
_RESPONSE = "response"
_EXPLANATION = "explanation"
_FUNCTION_NAME = "record_response"
SUPPORTED_AUDIO_FORMATS = {"mp3", "wav"}
SUPPORTED_IMAGE_FORMATS = {
    "png",
    "jpeg",
    "jpg",
    "webp",
    "heic",
    "heif",
    "bmp",
    "gif",
    "tiff",
    "ico",
}


def download_benchmark_dataset(task: str, dataset_name: str) -> pd.DataFrame:
    """Downloads an Arize evals benchmark dataset as a pandas dataframe.

    Args:
        task (str): Task to be performed.
        dataset_name (str): Name of the dataset.

    Returns:
        pandas.DataFrame: A pandas dataframe containing the data.
    """
    jsonl_file_name = f"{dataset_name}.jsonl"
    url = f"http://storage.googleapis.com/arize-phoenix-assets/evals/{task}/{jsonl_file_name}.zip"
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
        raw_string (Optional[str]): An input to be snapped to a rail.

        rails (List[str]): The target set of strings to snap to.

        verbose (bool, optional): Whether to print debug information. Defaults to False.

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


def printif(condition: bool, *args: Any, **kwargs: Any) -> None:
    """Print arguments if the condition is True.

    Args:
        condition (bool): Whether to print or not.
        *args (Any): Positional arguments to pass to tqdm.write.
        **kwargs (Any): Keyword arguments to pass to tqdm.write.
    """
    if condition:
        tqdm.write(*args, **kwargs)


def get_audio_format_from_base64(
    enc_str: str,
) -> Literal["mp3", "wav", "ogg", "flac", "m4a", "aac"]:
    """
    Determines the audio format from a base64 encoded string by checking file signatures.

    Args:
        enc_str (str): Base64 encoded audio data

    Returns:
        Literal["mp3", "wav", "ogg", "flac", "m4a", "aac"]: Audio format as string

    Raises:
        ValueError: If the audio format is not supported or cannot be determined
    """
    audio_bytes = base64.b64decode(enc_str)

    if len(audio_bytes) < 12:
        raise ValueError("Audio data too short to determine format")

    # WAV check
    if audio_bytes[0:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return "wav"

    # OGG check
    if audio_bytes[0:4] == b"OggS":
        return "ogg"

    # FLAC check
    if audio_bytes[0:4] == b"fLaC":
        return "flac"

    # M4A check (ISO Base Media File Format)
    if len(audio_bytes) > 10 and (audio_bytes[4:11] == b"ftypM4A" or audio_bytes[0:4] == b"M4A "):
        return "m4a"

    # AAC check
    if audio_bytes[:2] in (bytearray([0xFF, 0xF1]), bytearray([0xFF, 0xF9])):
        return "aac"

    # MP3 checks
    if len(audio_bytes) >= 3:
        if audio_bytes[0:3] == b"ID3":
            return "mp3"
        elif audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0 == 0xE0):  # MPEG sync
            return "mp3"

    # If no match, raise an error
    raise ValueError(
        "Unsupported audio format. Supported formats are: mp3, wav, ogg, flac, m4a, aac"
    )


def get_image_format_from_base64(
    enc_str: str,
) -> Literal["png", "jpeg", "jpg", "webp", "heic", "heif", "bmp", "gif", "tiff", "ico"]:
    """
    Determines the image format from a base64 encoded string by checking file signatures.

    Args:
        enc_str (str): Base64 encoded image data

    Returns:
        Literal["png", "jpeg", "jpg", "webp", "heic", "heif", "bmp", "gif", "tiff", "ico"]:
            Image format as string

    Raises:
        ValueError: If the image format is not supported or cannot be determined
    """
    image_bytes = base64.b64decode(enc_str)

    if len(image_bytes) < 12:
        raise ValueError("Image data too short to determine format")

    # PNG
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"

    # JPEG (also covers .jpg)
    if image_bytes[0:3] == b"\xff\xd8\xff":
        return "jpeg"

    # WEBP
    if image_bytes[0:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "webp"

    # HEIC / HEIF — ISO Base Media Format with 'ftypheic' or similar brands
    if image_bytes[4:12] in (b"ftypheic", b"ftypheix", b"ftyphevc", b"ftyphevx"):
        return "heic"
    if image_bytes[4:12] in (b"ftypmif1", b"ftypmsf1"):
        return "heif"

    # BMP
    if image_bytes.startswith(b"BM"):
        return "bmp"

    # GIF
    if image_bytes.startswith(b"GIF87a") or image_bytes.startswith(b"GIF89a"):
        return "gif"

    # TIFF
    if image_bytes.startswith(b"II*\x00") or image_bytes.startswith(b"MM\x00*"):
        return "tiff"

    # ICO
    if image_bytes[:4] == b"\x00\x00\x01\x00":
        return "ico"

    raise ValueError(
        "Unsupported image format. Supported formats are: "
        + ", ".join(sorted(SUPPORTED_IMAGE_FORMATS))
    )


def emoji_guard(emoji: str, fallback: str = "") -> str:
    """Return emoji on non-Windows systems, fallback on Windows.

    Args:
        emoji (str): The emoji string to display.
        fallback (str, optional): The fallback string for Windows. Defaults to "".

    Returns:
        str: The emoji or fallback string depending on the operating system.
    """
    # Windows has problems with showing emojis
    if os.name == "nt":
        return fallback
    return emoji
