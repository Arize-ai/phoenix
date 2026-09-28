"""Deterministic graders for structured answers and generated GraphQL queries."""

from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from graphql import GraphQLError, GraphQLSchema, build_schema, parse, validate
from graphql.language import (
    BooleanValueNode,
    FieldNode,
    FragmentDefinitionNode,
    FragmentSpreadNode,
    InlineFragmentNode,
    NamedTypeNode,
    NullValueNode,
    OperationDefinitionNode,
    SelectionSetNode,
    VariableNode,
)
from phoenix.evals import create_evaluator


def _artifact(output: Any, language: str) -> str:
    text = (
        output.get("final_answer", output.get("assistant_text"))
        if isinstance(output, dict)
        else None
    )
    if not isinstance(text, str) or not text.strip():
        raise ValueError("No assistant answer was produced")
    text = text.strip()
    fence = re.fullmatch(rf"```(?:{language})?\s*\n(.*?)\n```", text, re.DOTALL)
    return fence.group(1).strip() if fence else text


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def _invalid_constant(value: str) -> None:
    raise ValueError(f"Non-finite JSON number: {value}")


def _number(value: str) -> int | float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"Non-finite JSON number: {value}")
    return int(number) if number.is_integer() else number


@create_evaluator(name="assistant_json_match", kind="code")
def assistant_json_match(output: Any, expected: Any) -> dict[str, Any]:
    """Compare the complete JSON artifact, rejecting duplicate keys and non-finite numbers."""
    if not isinstance(expected, dict) or "assistant_json" not in expected:
        raise ValueError("assistant_json_match requires expected.assistant_json")
    try:
        actual = json.loads(
            _artifact(output, "json"),
            object_pairs_hook=_unique_object,
            parse_constant=_invalid_constant,
            parse_float=_number,
        )
    except ValueError as exc:
        return {"score": 0.0, "label": "invalid_json", "explanation": str(exc)}
    # Canonical JSON distinguishes true from 1, unlike Python object equality.
    reference = json.loads(
        json.dumps(expected["assistant_json"], allow_nan=False), parse_float=_number
    )
    passed = json.dumps(actual, sort_keys=True) == json.dumps(reference, sort_keys=True)
    return {
        "score": float(passed),
        "label": "pass" if passed else "mismatch",
        "explanation": "JSON artifact matches"
        if passed
        else "JSON artifact differs from reference",
        "metadata": {"actual": actual, "expected": expected["assistant_json"]},
    }


@lru_cache(maxsize=1)
def _schema() -> GraphQLSchema:
    root = Path(__file__).resolve().parents[4]
    return build_schema((root / "js/app/schema.graphql").read_text(encoding="utf-8"))


@create_evaluator(name="graphql_query_valid", kind="code")
def graphql_query_valid(output: Any, expected: Any) -> dict[str, Any]:
    """Validate a paginated project query against the checked-in Phoenix GraphQL schema."""
    if not isinstance(expected, dict) or expected.get("graphql_query") != "paginated_projects":
        raise ValueError("graphql_query_valid requires graphql_query: paginated_projects")
    try:
        document = parse(_artifact(output, "graphql"))
    except (ValueError, GraphQLError) as exc:
        # Syntax errors are agent misses; schema-loading failures below are infrastructure errors.
        return {"score": 0.0, "label": "invalid_query", "explanation": str(exc)}
    errors = validate(_schema(), document)
    if errors:
        return {"score": 0.0, "label": "invalid_query", "explanation": "; ".join(map(str, errors))}
    operations = [
        node for node in document.definitions if isinstance(node, OperationDefinitionNode)
    ]
    paths: set[str] = set()
    projects: list[FieldNode] = []
    fragments = {
        node.name.value: node
        for node in document.definitions
        if isinstance(node, FragmentDefinitionNode)
    }

    def visit(selection_set: SelectionSetNode, prefix: str = "") -> None:
        for node in selection_set.selections:
            # Required fields must be returned for every cursor value. A field
            # hidden by @skip/@include is not a usable pagination artifact.
            if any(
                not isinstance(argument.value, BooleanValueNode)
                or argument.value.value != (directive.name.value == "include")
                for directive in node.directives or ()
                if directive.name.value in {"skip", "include"}
                for argument in directive.arguments
            ):
                continue
            # Schema validation above rejects undefined and cyclic fragments.
            if isinstance(node, FragmentSpreadNode):
                visit(fragments[node.name.value].selection_set, prefix)
            elif isinstance(node, InlineFragmentNode):
                visit(node.selection_set, prefix)
            if not isinstance(node, FieldNode):
                continue
            path = f"{prefix}.{node.name.value}".lstrip(".")
            paths.add(path)
            if path == "projects":
                projects.append(node)
            if node.selection_set:
                visit(node.selection_set, path)

    for operation in operations:
        visit(operation.selection_set)
    required = {
        "projects.edges.node.id",
        "projects.edges.node.name",
        "projects.pageInfo.hasNextPage",
        "projects.pageInfo.endCursor",
    }
    after_variable = any(
        argument.name.value == "after"
        and isinstance(argument.value, VariableNode)
        and argument.value.name.value == "after"
        for project in projects
        for argument in project.arguments
    )
    first_two = any(
        argument.name.value == "first" and getattr(argument.value, "value", None) == "2"
        for project in projects
        for argument in project.arguments
    )
    passed = (
        len(operations) == 1
        and len(projects) == 1
        and operations[0].operation.value == "query"
        and required <= paths
        and after_variable
        and first_two
        and any(
            variable.variable.name.value == "after"
            and isinstance(variable.type, NamedTypeNode)
            and variable.type.name.value == "String"
            and (
                variable.default_value is None or isinstance(variable.default_value, NullValueNode)
            )
            for variable in operations[0].variable_definitions or ()
        )
    )
    return {
        "score": float(passed),
        "label": "pass" if passed else "missing_pagination",
        "explanation": "Valid paginated project query"
        if passed
        else "Query misses requested fields or pagination",
        "metadata": {
            "missing_fields": sorted(required - paths),
            "after_variable": after_variable,
            "first_two": first_two,
        },
    }
