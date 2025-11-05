import functools
import inspect
import json
import warnings
from typing import Any, Callable, Dict, List, Mapping, Optional, Set, Union

import pandas as pd
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


def _deprecate_positional_args(
    func_name: str,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator to issue deprecation warnings for positional argument usage.

    Args:
        func_name: Name of the function being decorated (for warning message)
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Issue deprecation warning if called with ANY positional arguments
            if len(args) > 0:
                warnings.warn(
                    f"Positional arguments for {func_name} are deprecated and will be removed "
                    f"in a future version. Please use keyword arguments instead.",
                    DeprecationWarning,
                    stacklevel=2,
                )
            return func(*args, **kwargs)

        return wrapper

    return decorator


def _deprecate_source_and_heuristic(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator to deprecate the 'source' argument in favor of 'kind'.

    Args:
        func (Callable[..., Any]): Function to be decorated that may receive
            a deprecated 'source' argument.

    Returns:
        Callable[..., Any]: Wrapper function that converts 'source' argument
            to 'kind' and issues deprecation warning.
    """
    # TODO:Remove this once the `source` arg in Scores/Evaluators is no longer supported

    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        signature = inspect.signature(func)

        # Prevent silent override if both 'kind' and deprecated 'source' are provided and differ
        if "source" in kwargs and "kind" in kwargs and kwargs["kind"] != kwargs["source"]:
            raise ValueError("Provide only one of 'kind' or 'source' (they differ). Use 'kind'.")

        if "source" in kwargs:
            warnings.warn(
                "'source' is deprecated; next time, use 'kind' instead. This time, we'll \
                automatically convert it for you.",
                DeprecationWarning,
                stacklevel=2,
            )
            # Only set kind from source if kind wasn't already provided (or equal)
            if "kind" not in kwargs:
                kwargs["kind"] = kwargs["source"]
            kwargs.pop("source")
        if kwargs.get("kind") == "heuristic":
            warnings.warn(
                "Kind 'heuristic' is deprecated; next time, use 'code' instead. This time, we'll \
                automatically convert it for you.",
                DeprecationWarning,
                stacklevel=2,
            )
            kwargs["kind"] = "code"
        bound_args = signature.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        return func(*bound_args.args, **bound_args.kwargs)

    return wrapper


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


@_deprecate_positional_args("remap_eval_input")
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
        # if provided empty string, use field name directly
        if extractor == "":
            extractor = field_name
        # Compute value and whether we successfully found/extracted it
        found = False
        value: Any = None

        if callable(extractor):
            value = _bind_mapping_function(extractor, eval_input)
            found = True
        elif isinstance(extractor, str):
            path = extractor
            try:
                if path in eval_input:
                    value = eval_input[path]
                    found = True
                else:
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
    metadata = score_data.get("metadata")
    direction = score_data.get("direction")

    # If no metadata and no direction, return None
    if not metadata and not direction:
        return None

    # Start with existing metadata or empty dict
    result = dict(metadata) if metadata else {}

    # Add direction if it exists
    if direction is not None:
        result["direction"] = direction

    return result


def _format_score_data(
    dataframe: pd.DataFrame,
    span_id_cols: List[str],
    score_name: str,
    score_display_name: Optional[str] = None,
) -> pd.DataFrame:
    """Format score data as an annotation dataframe.

    Args:
        dataframe: The dataframe to format score data from.
        span_id_cols: The list of span_id columns to keep.
        score_name: The name of the score column to add.
        score_display_name (str): Desired display name for the score, if different from the
        score_name. Defaults to None.

    Returns:
        The dataframe with the score data added and formatted as an annotation dataframe.
    """

    score_column = f"{score_name}_score"
    score_display_name = score_display_name or score_name

    if score_column not in dataframe.columns:
        raise ValueError(f"Score column '{score_column}' not found in DataFrame")

    # Create copy with all span_id columns + score column
    eval_df = dataframe[span_id_cols + [score_column]].copy()

    # Parse JSON score data
    cols = ["score", "label", "explanation", "kind"]

    def _safe_json_load(x: Any) -> Any:
        if isinstance(x, str):
            if not x.strip():  # empty string
                return None
            return json.loads(x)  # JSON string
        elif isinstance(x, dict):
            return x  # already parsed
        else:
            return None

    parsed_score_col = eval_df[score_column].apply(_safe_json_load)

    eval_df[cols] = parsed_score_col.apply(lambda d: pd.Series([(d or {}).get(k) for k in cols]))

    eval_df["metadata"] = parsed_score_col.apply(
        lambda d: _merge_metadata_with_direction(d) if d else None
    )

    # Infer annotator_kind from score.kind (preferred) or score.source in first non-null score
    # TODO: Update this once we deprecate the source attribute
    annotator_kind = "LLM"  # default
    if not parsed_score_col.isna().all():
        no_na = parsed_score_col.dropna()
        first_score = None if no_na.empty else no_na.iloc[0]
        if first_score and isinstance(first_score, dict):
            source_or_kind = None
            if "kind" in first_score:
                source_or_kind = first_score["kind"]
            elif "source" in first_score:
                source_or_kind = first_score["source"]
            # TODO: Remove this once we deprecate heuristic kind
            if source_or_kind in ["heuristic", "code"]:
                annotator_kind = "CODE"
            elif source_or_kind == "llm":
                annotator_kind = "LLM"
            elif source_or_kind == "human":
                annotator_kind = "HUMAN"

    # Add annotation name and kind columns
    eval_df["annotation_name"] = score_display_name
    eval_df["annotator_kind"] = annotator_kind

    # Keep only required columns (all span_id columns + annotation columns)
    columns_to_keep = span_id_cols + [
        "score",
        "label",
        "explanation",
        "metadata",
        "annotation_name",
        "annotator_kind",
    ]
    eval_df = eval_df[columns_to_keep]

    return eval_df


@_deprecate_positional_args("to_annotation_dataframe")
def to_annotation_dataframe(
    dataframe: pd.DataFrame,
    score_names: Optional[List[str]] = None,
) -> pd.DataFrame:
    """Format scores as annotations for logging to Phoenix.

    This function takes the output of evaluate_dataframe, and a list of score names,
    formats it for Phoenix logging. If no score names are provided, the function will extract all
    scores from the dataframe (_score columns). Score, label, explanation, and metadata are
    extracted from the score column and exploded into separate columns. Annotation name and kind
    are also added as columns.

    Args:
        dataframe (pd.DataFrame): DataFrame returned by (async_)evaluate_dataframe
        score_names (List[str]): Names of the score columns to log (e.g., ["precision",
        "hallucination"]). If None, all columns ending with _score will be used.

    Returns:
        pd.DataFrame: DataFrame with the score column, annotation name, and annotator kind columns
        for the specified score names.

    Examples::

        from phoenix.client import Client
        from phoenix.evals import evaluate_dataframe
        from phoenix.evals.utils import to_annotation_dataframe

        client = Client()
        results = evaluate_dataframe(df, evaluators)

        # Log only hallucination annotations
        hallucination_annotations = to_annotation_dataframe(results, ["hallucination"])
        client.spans.log_span_annotations_dataframe(dataframe=hallucination_annotations)

        # Log all scores as annotations
        all_annotations = to_annotation_dataframe(results)
        client.spans.log_span_annotations_dataframe(dataframe=all_annotations)
    """

    # Step 1: Identify all span_id sources
    span_id_cols = [col for col in dataframe.columns if "span_id" in col.lower()]
    index_is_span_id = dataframe.index.name and "span_id" in dataframe.index.name.lower()

    # Step 2: Create a working copy and preserve all span info
    working_df = dataframe.copy()

    if index_is_span_id:
        # Add index as a span_id column if it isn't already a column
        index_col_name = dataframe.index.name or "span_id"
        if index_col_name not in working_df.columns:
            working_df[index_col_name] = working_df.index
            span_id_cols.append(index_col_name)
        else:
            # Index name matches existing column - just add the index values
            working_df[f"{index_col_name}_from_index"] = working_df.index
            span_id_cols.append(f"{index_col_name}_from_index")

    # Step 3: Reset index to avoid conflicts during concatenation
    working_df = working_df.reset_index(drop=True)

    # Step 4: Validate we have span_id information
    if not span_id_cols:
        raise ValueError("No column containing 'span_id' found in DataFrame")

    # Step 5: Process each score name
    if not score_names:  # Both None and empty list trigger auto-detection
        # use names from columns in dataframe ending with _score
        score_names = [col[:-6] for col in working_df.columns if col.endswith("_score")]

    result_dfs = []
    for score_name in score_names:
        eval_df = _format_score_data(working_df, span_id_cols, score_name)
        result_dfs.append(eval_df)

    if not result_dfs:
        return pd.DataFrame()

    # Step 6: Concatenate with new sequential indices
    result_df = pd.concat(result_dfs, ignore_index=True)

    return result_df


def default_tqdm_progress_bar_formatter(title: str) -> str:
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
    "to_annotation_dataframe",
    "default_tqdm_progress_bar_formatter",
]
