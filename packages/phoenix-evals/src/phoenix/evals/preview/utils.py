from typing import Any, Callable, Dict, Mapping, Optional, Set, Union

import jq  # type: ignore

InputMappingType = Optional[Mapping[str, Union[str, Callable[[Mapping[str, Any]], Any]]]]


# --- Input Map/Transform Helpers ---
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
    mapping = input_mapping or {}
    remapped_eval_input: Dict[str, Any] = {}

    # Process both required fields and any fields explicitly present in mapping.
    # Optional fields can be populated via mapping, but only required fields are strictly validated.
    fields_to_process: Set[str] = set(required_fields) | set(mapping.keys())

    for field_name in fields_to_process:
        extractor = mapping.get(field_name, field_name)

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
                    found = False
            else:
                try:
                    value = _extract_with_path(eval_input, path)
                    found = True
                except ValueError as e:
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
            key_repr = (
                extractor
                if isinstance(extractor, str)
                else f"callable:{getattr(extractor, '__name__', 'lambda')}"
            )
            _validate_field_value(value, field_name, str(key_repr))
            remapped_eval_input[field_name] = value
        else:
            # Optional field: include only if we successfully extracted or present
            if found:
                remapped_eval_input[field_name] = value

    # Pass through any top-level keys from eval_input that weren't explicitly mapped.
    # This allows optional schema fields supplied by the caller to be included without mapping.
    mapped_values = set()
    for field_name, extractor in mapping.items():
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


def _validate_field_value(value: Any, field_name: str, key: str) -> None:
    """
    Validate that a required field value is present and not empty.

    Raises ValueError if:
      - value is None
      - value is an empty or whitespace-only string
      - value is an empty list/tuple/dict
    """
    if value is None:
        raise ValueError(f"Required field '{field_name}' (from '{key}') cannot be None")
    if isinstance(value, str):
        if value.strip() == "":
            raise ValueError(
                f"Required field '{field_name}' (from '{key}') cannot be empty or whitespace-only"
            )
    elif isinstance(value, (list, tuple)) and len(value) == 0:
        raise ValueError(f"Required field '{field_name}' (from '{key}') cannot be empty")
    elif isinstance(value, dict) and len(value) == 0:
        raise ValueError(f"Required field '{field_name}' (from '{key}') cannot be empty")


def _extract_with_path(payload: Mapping[str, Any], path: str) -> Any:
    """
    Extract a value from a nested JSON structure using jq.

    The path is a string with the following format:
    - dict traversal via dots: input.query
    - list index via brackets: items[0]
    - combination of both: input.docs[0]

    Returns:
        The extracted value.

    Raises:
        ValueError: If the path is invalid or the value is not found.
    """
    if not path:
        return None

    try:
        # Convert to jq syntax: ensure path starts with a dot
        jq_path = "." + path if not path.startswith(".") else path
        result = jq.first(jq_path, payload)

        # jq.first returns None when the path doesn't exist, but we want to raise an error
        if result is None:
            # Check if the path is valid by trying to compile it
            jq.compile(jq_path)
            # If compilation succeeds but result is None, the path doesn't exist
            # We need to distinguish between missing keys and index out of bounds
            if "[" in path:
                # This is likely an index out of bounds error
                raise ValueError(f"Index out of range for path '{path}'")
            else:
                # Check if this is a simple key that exists in the payload
                if path in payload:
                    # The key exists but has a None value, which is valid
                    return payload[path]
                else:
                    # This is a missing key error
                    raise ValueError(f"Missing key while resolving path '{path}'")

        return result
    except Exception as e:
        # Convert jq errors to more user-friendly messages
        if "Cannot index string with number" in str(e):
            raise ValueError(f"Index out of range for path '{path}'") from e
        elif "Cannot index" in str(e):
            raise ValueError(f"Missing key while resolving path '{path}'") from e
        else:
            raise ValueError(f"Invalid path '{path}': {str(e)}") from e
