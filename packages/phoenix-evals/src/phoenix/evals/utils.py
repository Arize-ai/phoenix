import inspect
import json
from typing import TYPE_CHECKING, Any, Callable, Dict, Mapping, Optional, Set, Union

import pandas as pd

if TYPE_CHECKING:
    pass

from jsonpath_ng import parse  # type: ignore
from jsonpath_ng.exceptions import JsonPathParserError  # type: ignore

from phoenix.evals.legacy.utils import (
    _EXPLANATION,  # pyright: ignore[reportPrivateUsage]
    _FUNCTION_NAME,  # pyright: ignore[reportPrivateUsage]
    _RESPONSE,  # pyright: ignore[reportPrivateUsage]
    NOT_PARSABLE,
    SUPPORTED_AUDIO_FORMATS,
    SUPPORTED_IMAGE_FORMATS,
    download_benchmark_dataset,
    emoji_guard,
    get_audio_format_from_base64,
    get_image_format_from_base64,
    get_tqdm_progress_bar_formatter,
    openai_function_call_kwargs,
    parse_openai_function_call,
    printif,
    snap_to_rail,
)

InputMappingType = Optional[Mapping[str, Union[str, Callable[[Mapping[str, Any]], Any]]]]


# --- Input Map/Transform Helpers ---
def _bind_mapping_function(
    mapping_function: Callable[..., Any],
    eval_input: Mapping[str, Any],
) -> Any:
    """
    Bind eval_input values to a mapping_function's parameters by name when possible.

    - If the function has 0 or 1 parameters, call it with the entire eval_input
      for backward compatibility.
    - If the function has >1 parameters, attempt to bind by matching parameter names to keys
      in eval_input. Required parameters not present cause a fallback to legacy behavior.
    - *args/**kwargs are ignored for explicit binding.
    """
    try:
        sig = inspect.signature(mapping_function)
    except (ValueError, TypeError):
        # Non-inspectable callables (e.g., builtins) -> legacy behavior
        return mapping_function(eval_input)

    parameters = sig.parameters
    if len(parameters) == 0:
        raise ValueError("Mapping functions must have at least one parameter.")
    if len(parameters) <= 1:
        if len(parameters) == 1:
            parameter_name = next(iter(parameters.keys()))
            if parameter_name in eval_input:
                return mapping_function(eval_input[parameter_name])
            else:
                return mapping_function(eval_input)
        else:
            return mapping_function(eval_input)

    provided_kwargs: Dict[str, Any] = {
        name: eval_input[name] for name in parameters.keys() if name in eval_input
    }
    bound = sig.bind_partial(**provided_kwargs)
    bound.apply_defaults()
    return mapping_function(**bound.arguments)


def remap_eval_input(
    eval_input: Mapping[str, Any],
    required_fields: Set[str],
    input_mapping: Optional[InputMappingType] = None,
) -> Dict[str, Any]:
    """
    Remap eval_input keys based on required_fields and an optional input_mapping.

    Args:
        eval_input: The input dictionary to be remapped.
        required_fields: The required field names as a set of strings.
        input_mapping: Optional mapping from evaluator-required field -> eval_input key.

    Returns:
        A dictionary with keys as required_fields and values from eval_input.

    Raises:
        ValueError: If a required field is missing in eval_input or has a null/empty value.
    """
    input_mapping = input_mapping or {}
    remapped_eval_input: Dict[str, Any] = {}

    # Process both required fields and any fields explicitly present in mapping.
    # Optional fields can be populated via mapping, but only required fields are strictly validated.
    fields_to_process: Set[str] = set(required_fields) | set(input_mapping.keys())

    for field_name in fields_to_process:
        extractor = input_mapping.get(field_name, field_name)

        # Compute value and whether we successfully found/extracted it
        found = False
        value: Any = None

        if callable(extractor):
            value = _bind_mapping_function(extractor, eval_input)
            found = True
        elif isinstance(extractor, str):
            path = extractor
            # If path is empty, try direct key
            if not path:
                key = field_name
                if key in eval_input:
                    value = eval_input[key]
                    found = True
            else:
                try:
                    value = extract_with_jsonpath(eval_input, path)
                    found = True
                except (JsonPathParserError, ValueError) as e:
                    # Missing/invalid path: for required fields, re-raise; for optional,
                    # treat as not found
                    if field_name in required_fields:
                        raise e
                    found = False
        else:
            # Unsupported extractor type
            msg = (
                f"Invalid mapping for field '{field_name}': expected str or callable, "
                f"got {type(extractor)}"
            )
            raise TypeError(msg)

        is_required = field_name in required_fields

        if is_required:
            # Minimal presence check; defer strict checks to Pydantic
            if not found:
                msg = (
                    f"Missing required field: '{field_name}'. "
                    f"eval_input keys={list(eval_input.keys())}"
                )
                raise ValueError(msg)
            remapped_eval_input[field_name] = value
        else:
            # Optional field: include only if we successfully extracted or present
            if found:
                remapped_eval_input[field_name] = value

    # Pass through any top-level keys from eval_input that weren't explicitly mapped.
    # This allows optional schema fields supplied by the caller to be included without mapping.
    mapped_values = set()
    for field_name, extractor in input_mapping.items():
        if isinstance(extractor, str):
            path = extractor
            if not path:  # Empty path means direct key mapping
                mapped_values.add(field_name)
            else:
                # For path mappings, extract the first key
                # Find the first key (before any dots or brackets)
                first_key = path.split(".")[0].split("[")[0]
                if first_key:
                    mapped_values.add(first_key)

    for k, v in eval_input.items():
        # Only pass through keys that weren't explicitly mapped to avoid duplicates
        if k not in remapped_eval_input and k not in mapped_values:
            remapped_eval_input[k] = v

    return remapped_eval_input


def extract_with_jsonpath(data: Mapping[str, Any], path: str, match_all: bool = False) -> Any:
    """
    Extract a value from a nested JSON structure using jsonpath-ng.

    Args:
        data: The input dictionary to be extracted from.
        path: The jsonpath to extract from the data.
        match_all: If True, return a list of all matches. By default, return only the first match.

    Returns:
        The extracted value (can be None).

    Raises:
        JsonPathParserError: If the path is not parseable (invalid syntax).
        ValueError: If the path is invalid or not found (missing key, index out of bounds, etc).
    """
    expr = parse(path)
    matches = expr.find(data)
    if not matches:
        raise ValueError(f"Path not found: {path}")
    return [m.value for m in matches] if match_all else matches[0].value


def _merge_metadata_with_direction(score_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Merge existing metadata with direction field from score data.

    Args:
        score_data: Dictionary containing score information including metadata and direction

    Returns:
        Merged metadata dictionary with direction field added, or None if no metadata exists
    """
    metadata = score_data.get("metadata", {})
    direction = score_data.get("direction")

    if metadata is None:
        metadata = {}

    # Create a copy to avoid modifying the original
    merged_metadata = dict(metadata)

    # Add direction if it exists
    if direction is not None:
        merged_metadata["direction"] = direction

    return merged_metadata if merged_metadata else None


def format_as_annotation_dataframe(
    dataframe: pd.DataFrame,
    score_name: str,
    score_display_name: Union[str, None] = None,
) -> pd.DataFrame:
    """Format scores as annotations for logging to Phoenix.

    This function takes the output of evaluate_dataframe, extracts a specific score column, and
    formats it for Phoenix logging. Score, label, explanation, and metadata are extracted from the
    score column and exploded into separate columns. Annotation name and kind are also added as
    columns. If score_display_name is not provided, the score_name is used.

    Args:
        dataframe (pd.DataFrame): DataFrame returned by (async_)evaluate_dataframe
        score_name (str): Name of the score column to log (e.g., "precision", "hallucination")
        score_display_name (str): Desired display name for the score, if different from the
        score_name. Defaults to None.

    Returns:
        pd.DataFrame: DataFrame with the score column, annotation name, and annotator kind columns.

    Examples::
        from phoenix.client import Client
        from phoenix.evals import evaluate_dataframe
        from phoenix.evals.utils import format_as_annotation_dataframe

        client = Client()
        results = evaluate_dataframe(df, evaluators)
        hallucination_annotations = format_as_annotation_dataframe(results, "hallucination")
        client.spans.log_span_annotations_dataframe(dataframe=hallucination_annotations)
    """

    score_column = f"{score_name}_score"
    score_display_name = score_display_name or score_name

    if score_column not in dataframe.columns:
        raise ValueError(f"Score column '{score_column}' not found in DataFrame")

    # Find span_id column (look for column containing "span_id")
    span_id_col = None
    for col in dataframe.columns:
        if "span_id" in col.lower():
            span_id_col = col
            break

    if span_id_col is None:
        raise ValueError("No column containing 'span_id' found in DataFrame")

    # Create working copy with required columns
    eval_df = dataframe[[span_id_col, score_column]].copy()

    # Parse JSON score data
    cols = ["score", "label", "explanation", "source"]
    parsed = eval_df[score_column].apply(lambda x: json.loads(x) if isinstance(x, str) and x else None)
    eval_df[cols] = parsed.apply(lambda d: pd.Series([(d or {}).get(k) for k in cols]))

    # Infer annotator_kind from score.source in first non-null score
    annotator_kind = "LLM"  # default
    if not eval_df[score_column].isna().all():
        first_score = (
            eval_df[score_column].dropna().iloc[0]
            if not eval_df[score_column].dropna().empty
            else None
        )
        if first_score and "source" in first_score:
            source = first_score["source"]
            if source == "heuristic":
                annotator_kind = "CODE"
            elif source == "llm":
                annotator_kind = "LLM"
            elif source == "human":
                annotator_kind = "HUMAN"

    # Add annotation name and kind columns
    eval_df["annotation_name"] = score_display_name
    eval_df["annotator_kind"] = annotator_kind

    # Keep only required columns
    columns_to_keep = [
        span_id_col,
        "score",
        "label",
        "explanation",
        "metadata",
        "annotation_name",
        "annotator_kind",
    ]
    eval_df = eval_df[columns_to_keep]

    return eval_df


__all__ = [
    # evals 1.0
    "NOT_PARSABLE",
    "SUPPORTED_IMAGE_FORMATS",
    "SUPPORTED_AUDIO_FORMATS",
    "snap_to_rail",
    "printif",
    "parse_openai_function_call",
    "openai_function_call_kwargs",
    "get_tqdm_progress_bar_formatter",
    "get_image_format_from_base64",
    "get_audio_format_from_base64",
    "emoji_guard",
    "download_benchmark_dataset",
    "_EXPLANATION",
    "_RESPONSE",
    "_FUNCTION_NAME",
    # evals 2.0
    "InputMappingType",
    "remap_eval_input",
    "extract_with_jsonpath",
    # logging utilities
    "format_as_annotation_dataframe",
]
