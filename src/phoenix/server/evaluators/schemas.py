"""Evaluator input schema inference for prompt templates, code evaluators, and decisions."""

from __future__ import annotations

import ast
import re
from collections.abc import Iterable, Sequence
from typing import TYPE_CHECKING, Any, Optional

from typing_extensions import assert_never

from phoenix.db.types.decisions import DecisionInput
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptStringTemplate,
    PromptTemplate,
    PromptTemplateFormat,
    TextContentPart,
)
from phoenix.utilities.template_formatters import ParsedVariables, get_template_formatter

if TYPE_CHECKING:
    from phoenix.server.api.input_types.PromptVersionInput import PromptChatTemplateInput


def input_schema_from_parsed_variables(
    parsed_variables: Iterable[ParsedVariables],
) -> dict[str, Any]:
    """
    Build an evaluator input schema from the variables a template names.

    A template variable is bound by its root name, so `{{input}}` and
    `{{input.input}}` both require one variable named `input`. What the schema
    says about that variable is what the root has to hold for the template to
    render:
    - A variable a section or a dotted token reads into gets an empty schema, so
      it accepts any JSON type and reaches the renderer with its structure
      intact for the section or the path to walk.
    - A variable named on its own gets {"type": "string"}, so a whole entity
      bound to it is serialized before it lands in the prompt.
    """
    structured_vars: set[str] = set()
    string_vars: set[str] = set()
    for parsed in parsed_variables:
        structured_vars.update(parsed.section_variables())
        structured_vars.update(parsed.traversed_variables())
        string_vars.update(parsed.string_variables())

    # Sort iteration order for deterministic key ordering in the resulting dict
    properties: dict[str, dict[str, Any]] = {}
    for var in sorted(structured_vars):
        properties[var] = {}  # Empty schema accepts any JSON type
    for var in sorted(string_vars):
        if var not in structured_vars:
            properties[var] = {"type": "string"}

    all_vars = structured_vars | string_vars
    return {
        "type": "object",
        "properties": properties,
        "required": sorted(all_vars),
    }


def infer_input_schema_from_prompt_template(
    *,
    template: PromptTemplate,
    template_format: PromptTemplateFormat,
) -> dict[str, Any]:
    """Infer an evaluator input schema from a stored prompt template."""
    formatter = get_template_formatter(template_format)
    parsed: list[ParsedVariables] = []
    if isinstance(template, PromptStringTemplate):
        parsed.append(formatter.parse_with_types(template.template))
    elif isinstance(template, PromptChatTemplate):
        for message in template.messages:
            if isinstance(message.content, str):
                parsed.append(formatter.parse_with_types(message.content))
            elif isinstance(message.content, list):
                parsed.extend(
                    formatter.parse_with_types(part.text)
                    for part in message.content
                    if isinstance(part, TextContentPart)
                )
            else:
                assert_never(message.content)
    else:
        assert_never(template)
    return input_schema_from_parsed_variables(parsed)


def infer_input_schema_from_template(
    *,
    template: PromptChatTemplateInput,
    template_format: PromptTemplateFormat,
) -> dict[str, Any]:
    formatter = get_template_formatter(template_format)
    return input_schema_from_parsed_variables(
        formatter.parse_with_types(part.text.text)
        for msg in template.messages
        for part in msg.content
        if part.text is not None and isinstance(getattr(part.text, "text", None), str)
    )


def _make_object_input_schema(
    parameter_names: Sequence[str],
    required_names: Sequence[str],
) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {name: {} for name in parameter_names},
        "required": list(required_names),
    }


def infer_python_evaluate_input_schema(source_code: str) -> tuple[dict[str, Any], Optional[str]]:
    """Infer a Python evaluate function's input schema without executing its source.

    Returns:
        The input schema and None, or an empty schema and a signature error message.
    """
    try:
        module = ast.parse(source_code)
    except SyntaxError as exc:
        return (
            {},
            (
                "Could not parse the Python evaluator signature. "
                "Define a top-level function like "
                "`def evaluate(output, reference=None, input=None, metadata=None):`. "
                f"Parser error: {exc.msg}"
            ),
        )

    evaluate_function = next(
        (
            node
            for node in module.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "evaluate"
        ),
        None,
    )
    if evaluate_function is None:
        return (
            {},
            (
                "Could not infer the Python evaluator inputs because no top-level "
                "`evaluate(...)` function was found. Define a function like "
                "`def evaluate(output, reference=None, input=None, metadata=None):`."
            ),
        )

    args = evaluate_function.args
    positional_args = [*args.posonlyargs, *args.args]
    positional_required_count = len(positional_args) - len(args.defaults)
    required_names = [arg.arg for arg in positional_args[:positional_required_count]]
    required_names.extend(
        arg.arg for arg, default in zip(args.kwonlyargs, args.kw_defaults) if default is None
    )

    parameter_names = [arg.arg for arg in positional_args]
    parameter_names.extend(arg.arg for arg in args.kwonlyargs)

    return (_make_object_input_schema(parameter_names, required_names), None)


_TYPESCRIPT_FUNCTION_SIGNATURE_RE = re.compile(r"function\s+evaluate\s*\(([^)]*)\)")
_TYPESCRIPT_ARROW_SIGNATURE_RE = re.compile(r"(?:const|let|var)\s+evaluate\s*=\s*\(([^)]*)\)\s*=>")


def _extract_typescript_object_parameter_keys(params: str) -> tuple[list[str], list[str]]:
    destructured = re.match(r"^\{([^}]*)\}", params.strip())
    if destructured is None:
        return ([], [])

    parameter_names: list[str] = []
    for raw_part in destructured.group(1).split(","):
        part = raw_part.strip()
        if not part:
            continue
        part = part.split(":", 1)[0].strip()
        if not part:
            continue
        name = part.split("=", 1)[0].rstrip("?").strip()
        if not name:
            continue
        parameter_names.append(name)
    return (parameter_names, [])


def infer_typescript_evaluate_input_schema(
    source_code: str,
) -> tuple[dict[str, Any], Optional[str]]:
    """Infer a TypeScript evaluate function's input schema without executing its source.

    Returns:
        The input schema and None, or an empty schema and a signature error message.
    """
    signature = _TYPESCRIPT_FUNCTION_SIGNATURE_RE.search(
        source_code
    ) or _TYPESCRIPT_ARROW_SIGNATURE_RE.search(source_code)
    if signature is None:
        return (
            {},
            (
                "Could not infer the TypeScript evaluator inputs because no supported "
                "`evaluate(...)` signature was found. Define `evaluate` as either "
                "`function evaluate({ output, reference, input, metadata }: "
                "EvaluatorParams) { ... }` or `const evaluate = ({ output, "
                "reference, input, metadata }: EvaluatorParams) => { ... }`."
            ),
        )

    parameter_names, required_names = _extract_typescript_object_parameter_keys(signature.group(1))
    if not parameter_names:
        return (
            {},
            (
                "Could not infer the TypeScript evaluator inputs from the `evaluate(...)` "
                "signature. Use a destructured object parameter like "
                "`function evaluate({ output, reference, input, metadata }: "
                "EvaluatorParams) { ... }`."
            ),
        )

    return (_make_object_input_schema(parameter_names, required_names), None)


def decision_input_schema(inputs: Sequence[DecisionInput]) -> dict[str, Any]:
    """Describe inputs for mapping without enforcing their descriptive JSON schemas."""
    return {
        "type": "object",
        "properties": {input.name: input.json_schema or {} for input in inputs},
        "required": [input.name for input in inputs],
        "additionalProperties": False,
    }
