"""Evaluator input mapping and template variable type casting and validation."""

import json
from copy import deepcopy
from typing import Any

from jsonpath_ng.parser import JsonPathParser
from jsonschema import ValidationError, validate
from opentelemetry.trace import get_current_span

from phoenix.db.types.evaluators import InputMapping


def apply_input_mapping(
    *,
    input_schema: dict[str, Any],
    input_mapping: InputMapping,
    context: dict[str, Any],
) -> dict[str, Any]:
    declared_keys = input_schema.get("properties") or {}
    accepts_any_key = not declared_keys or input_schema.get("additionalProperties") is True
    ignored_keys: list[str] = []
    result: dict[str, Any] = {}
    # apply path mappings
    if input_mapping.path_mapping:
        for key, path_expr in input_mapping.path_mapping.items():
            if not accepts_any_key and key not in declared_keys:
                ignored_keys.append(key)
                continue
            try:
                parser = JsonPathParser()
                jsonpath = parser.parse(path_expr)
            except Exception as e:
                raise ValueError(f"Invalid JSONPath expression '{path_expr}' for key '{key}': {e}")
            matches = jsonpath.find(context)
            if matches:
                if len(matches) == 1:
                    result[key] = matches[0].value
                else:
                    result[key] = [match.value for match in matches]
            else:
                raise ValueError(
                    f"JSONPath expression '{path_expr}' for key '{key}' did not match any values"
                )

    # literal mappings take priority over path mappings
    if input_mapping.literal_mapping:
        for key, value in input_mapping.literal_mapping.items():
            if not accepts_any_key and key not in declared_keys:
                ignored_keys.append(key)
                continue
            result[key] = value

    if ignored_keys:
        get_current_span().set_attribute("input_mapping.ignored_keys", sorted(set(ignored_keys)))

    # for any key in the input schema that is still not in result,
    # set result[input_schema_key] to context[input_schema_key]
    for key in declared_keys:
        if key not in result and key in context:
            result[key] = context[key]

    return result


class _JSONRenderedDict(dict[str, Any]):
    """
    A mapping a template can both walk into and name on its own.

    A variable a dotted token reads into has to reach the renderer as a mapping,
    so it cannot be serialized up front the way a string variable is. Naming the
    same variable on its own then renders it, and this renders it as JSON rather
    than as a Python repr.
    """

    def __str__(self) -> str:
        return json.dumps(self, default=str)


def cast_template_variable_types(
    *,
    template_variables: dict[str, Any],
    input_schema: dict[str, Any],
) -> dict[str, Any]:
    casted_template_variables = deepcopy(template_variables)
    properties = input_schema.get("properties", {})

    for key, prop_schema in properties.items():
        if key in casted_template_variables:
            value = casted_template_variables[key]
            prop_type = prop_schema.get("type")
            if prop_type == "string" and not isinstance(value, str):
                # A whole entity bound to a string variable renders into a prompt, so
                # it has to be JSON rather than a Python repr.
                casted_template_variables[key] = (
                    json.dumps(value, default=str)
                    if isinstance(value, (dict, list))
                    else str(value)
                )
            elif prop_type is None and isinstance(value, dict):
                casted_template_variables[key] = _JSONRenderedDict(value)

    return casted_template_variables


def validate_template_variables(
    *,
    template_variables: dict[str, Any],
    input_schema: dict[str, Any],
) -> None:
    try:
        validate(instance=template_variables, schema=input_schema)
    except ValidationError as e:
        raise ValueError(f"Input validation failed: {e.message}")
