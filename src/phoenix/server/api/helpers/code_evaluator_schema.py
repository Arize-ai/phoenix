"""Static input schema inference for Python and TypeScript code evaluators."""

import ast
import re
from typing import Any, Optional, Sequence


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
