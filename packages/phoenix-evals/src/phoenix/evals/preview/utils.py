import inspect
from typing import Any, Callable, Dict, Mapping, Optional, Set, Union

from jsonpath_ng import parse  # type: ignore
from jsonpath_ng.exceptions import JsonPathParserError  # type: ignore

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
    if len(parameters) <= 1:
        if len(parameters) == 1:
            parameter_name = next(iter(parameters.keys()))
            if parameter_name in eval_input:
                pass
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
