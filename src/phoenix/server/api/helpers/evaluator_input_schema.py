"""Input descriptions on LLM and code evaluators.

An LLM evaluator's inputs are the variables its prompt names; a code evaluator's are the
parameters of its `evaluate` function. Both are inferred from the source, so the only
thing an author can add is what each input should hold. That text is kept in the
evaluator's `input_schema` column as a JSON schema whose properties carry a
`description`, and read back by overlaying those descriptions on the schema inferred from
the current source. Re-inferring on read keeps the structure true to the source even when
the source moves without the column being rewritten, such as an evaluator that follows a
prompt's latest version.
"""

from typing import Any, Mapping, Optional, Sequence

from strawberry import UNSET

from phoenix.db import models
from phoenix.server.api.evaluators import infer_input_schema_from_prompt_template
from phoenix.server.api.helpers.code_evaluator_schema import (
    infer_python_evaluate_input_schema,
    infer_typescript_evaluate_input_schema,
)

InputDescriptions = dict[str, str]


def input_descriptions(input_schema: Optional[Mapping[str, Any]]) -> InputDescriptions:
    """The non-empty descriptions a stored or submitted schema carries, by input name."""
    if not isinstance(input_schema, Mapping):
        return {}
    properties = input_schema.get("properties")
    if not isinstance(properties, Mapping):
        return {}
    descriptions: InputDescriptions = {}
    for name, property_schema in properties.items():
        if not isinstance(property_schema, Mapping):
            continue
        description = property_schema.get("description")
        if isinstance(description, str) and description.strip():
            descriptions[name] = description
    return descriptions


def parse_input_schema(value: Any) -> InputDescriptions:
    """Validate a submitted input schema and return the descriptions it carries.

    Only each property's `description` is kept; the structure is always inferred from the
    evaluator's source. Raises ValueError on anything that is not a JSON schema object.
    """
    if not isinstance(value, Mapping):
        raise ValueError("input_schema must be an object")
    properties = value.get("properties", {})
    if not isinstance(properties, Mapping):
        raise ValueError("input_schema.properties must be an object")
    descriptions: InputDescriptions = {}
    for name, property_schema in properties.items():
        if not isinstance(name, str) or not name.strip():
            raise ValueError("input_schema property names must be non-empty strings")
        if not isinstance(property_schema, Mapping):
            raise ValueError(f"input_schema property {name!r} must be an object")
        description = property_schema.get("description")
        if description is None:
            continue
        if not isinstance(description, str):
            raise ValueError(f"The description of input {name!r} must be a string")
        if description.strip():
            descriptions[name] = description
    return descriptions


def with_input_descriptions(
    inferred_schema: Mapping[str, Any],
    descriptions: Mapping[str, str],
) -> dict[str, Any]:
    """The inferred schema with a description on each input that has one.

    Descriptions for inputs the source no longer declares are dropped.
    """
    properties = inferred_schema.get("properties")
    if not isinstance(properties, Mapping):
        return dict(inferred_schema)
    described: dict[str, Any] = {}
    for name, property_schema in properties.items():
        property_schema = dict(property_schema) if isinstance(property_schema, Mapping) else {}
        if name in descriptions:
            property_schema["description"] = descriptions[name]
        else:
            property_schema.pop("description", None)
        described[name] = property_schema
    return {**inferred_schema, "properties": described}


def stored_input_schema(
    inferred_schema: Mapping[str, Any],
    descriptions: Mapping[str, str],
) -> Optional[dict[str, Any]]:
    """What the `input_schema` column holds: the described schema, or NULL with nothing to say.

    Raises ValueError for a description of an input the source does not declare, so a
    caller cannot describe an input that will never be mapped.
    """
    declared = inferred_schema.get("properties")
    declared_names = set(declared) if isinstance(declared, Mapping) else set()
    unknown = sorted(name for name in descriptions if name not in declared_names)
    if unknown:
        raise ValueError(
            "input_schema describes inputs the evaluator does not declare: " + ", ".join(unknown)
        )
    if not descriptions:
        return None
    return with_input_descriptions(inferred_schema, descriptions)


def resolve_input_descriptions(
    submitted: Any,
    *,
    previous: Optional[Mapping[str, Any]],
    declared: Mapping[str, Any],
) -> InputDescriptions:
    """The descriptions an edit leaves in place: the submitted schema's when one is given,
    none when null is given, and the stored ones when the field is omitted (UNSET).

    Stored descriptions of inputs the source no longer declares are dropped silently,
    since the source moved on without them; a submitted description of an undeclared
    input is left in place for `stored_input_schema` to refuse.
    """
    if submitted is UNSET:
        return {
            name: text for name, text in input_descriptions(previous).items() if name in declared
        }
    if submitted is None:
        return {}
    return parse_input_schema(submitted)


def infer_code_input_schema(language: models.LanguageName, source_code: str) -> dict[str, Any]:
    """The schema a code evaluator's `evaluate` signature declares, by language."""
    if language == "PYTHON":
        schema, _ = infer_python_evaluate_input_schema(source_code)
    else:
        schema, _ = infer_typescript_evaluate_input_schema(source_code)
    return schema


def described_code_input_schema(
    language: models.LanguageName,
    source_code: str,
    stored: Optional[Mapping[str, Any]],
) -> dict[str, Any]:
    """A code evaluator's inferred schema with its stored descriptions overlaid."""
    return with_input_descriptions(
        infer_code_input_schema(language, source_code), input_descriptions(stored)
    )


def described_llm_input_schema(
    prompt_version: models.PromptVersion,
    stored: Optional[Mapping[str, Any]],
) -> dict[str, Any]:
    """An LLM evaluator's inferred schema with its stored descriptions overlaid."""
    return with_input_descriptions(
        infer_input_schema_from_prompt_template(
            template=prompt_version.template,
            template_format=prompt_version.template_format,
        ),
        input_descriptions(stored),
    )


def apply_llm_input_schema(
    evaluator: models.LLMEvaluator,
    prompt_version: models.PromptVersion,
    submitted: Any = UNSET,
) -> bool:
    """Store the descriptions an edit leaves on the evaluator's prompt variables.

    Returns whether the column changed. Raises ValueError for a malformed schema or a
    description of a variable the prompt does not name.
    """
    inferred = infer_input_schema_from_prompt_template(
        template=prompt_version.template,
        template_format=prompt_version.template_format,
    )
    descriptions = resolve_input_descriptions(
        submitted, previous=evaluator.input_schema, declared=inferred.get("properties") or {}
    )
    stored = stored_input_schema(inferred, descriptions)
    if evaluator.input_schema == stored:
        return False
    evaluator.input_schema = stored
    return True


def apply_code_input_schema(
    evaluator: models.CodeEvaluator,
    source_code: str,
    submitted: Any = UNSET,
) -> bool:
    """Store the descriptions an edit leaves on the `evaluate` parameters of `source_code`,
    the version the evaluator runs after the edit.

    Returns whether the column changed. Raises ValueError for a malformed schema or a
    description of a parameter the function does not declare.
    """
    inferred = infer_code_input_schema(evaluator.language, source_code)
    descriptions = resolve_input_descriptions(
        submitted, previous=evaluator.input_schema, declared=inferred.get("properties") or {}
    )
    stored = stored_input_schema(inferred, descriptions)
    if evaluator.input_schema == stored:
        return False
    evaluator.input_schema = stored
    return True


__all__: Sequence[str] = (
    "InputDescriptions",
    "apply_code_input_schema",
    "apply_llm_input_schema",
    "described_code_input_schema",
    "described_llm_input_schema",
    "infer_code_input_schema",
    "input_descriptions",
    "parse_input_schema",
    "resolve_input_descriptions",
    "stored_input_schema",
    "with_input_descriptions",
)
