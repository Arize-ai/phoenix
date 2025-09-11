from typing import Any, Callable, Dict, Mapping, Optional, Set, Union

from jsonpath_ng import parse  # type: ignore
from jsonpath_ng.exceptions import JsonPathParserError  # type: ignore

InputMappingType = Optional[Mapping[str, Union[str, Callable[[Mapping[str, Any]], Any]]]]


# --- Input Map/Transform Helpers ---
def remap_eval_input(
    eval_input: Mapping[str, Any],
    required_fields: Set[str],
    input_mapping: Optional[InputMappingType] = None,
) -> Dict[str, Any]:
    """Remap/transform eval_input based on required_fields and an optional input_mapping.

    Args:
        eval_input (Mapping[str, Any]): The input dictionary to be remapped.
        required_fields (Set[str]): The required field names as a set of strings.
        input_mapping (Optional[InputMappingType]): Optional mapping from evaluator-required field
            to eval_input key.

            InputMappingType is an alias for
            Optional[Mapping[str, Union[str, Callable[[Mapping[str, Any]], Any]]]].

    Returns:
        Dict[str, Any]: A dictionary with keys as required_fields and values from eval_input.

    Raises:
        ValueError: If a required field is missing in eval_input or has a null/empty value.
        TypeError: If the mapping for a field is not a string or callable.
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
            value = extractor(eval_input)
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
    """Extract a value from a nested JSON structure using jsonpath-ng.

    Args:
        data (Mapping[str, Any]): The input dictionary to be extracted from.
        path (str): The jsonpath to extract from the data.
        match_all (bool): If True, return a list of all matches. By default, return only the first
            match.

    Returns:
        Any: The extracted value (can be None).

    Raises:
        JsonPathParserError: If the path is not parseable (invalid syntax).
        ValueError: If the path is invalid or not found (missing key, index out of bounds, etc).

    Examples::

        extract_with_jsonpath({"a": {"b": "c"}}, "a.b")
        "c"
        extract_with_jsonpath({"a": {"b": "c"}}, "a.b", match_all=True)
        ["c"]
        extract_with_jsonpath({"a": [{"b": 1}, {"b": 2}]}, "a[1].b")
        2
        extract_with_jsonpath({"a": [{"b": 1}, {"b": 2}]}, "a[*].b", match_all=True)
        [1, 2]
    """
    expr = parse(path)
    matches = expr.find(data)
    if not matches:
        raise ValueError(f"Path not found: {path}")
    return [m.value for m in matches] if match_all else matches[0].value
