"""Small deterministic tool set for offline trace recorders."""

from __future__ import annotations

import ast
import json
import math
import operator
import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from types import MappingProxyType
from typing import Any, TypeAlias, cast

JSON: TypeAlias = None | bool | int | float | str | list["JSON"] | dict[str, "JSON"]
ToolResult: TypeAlias = dict[str, JSON]
ToolHandler: TypeAlias = Callable[[Mapping[str, Any], Mapping[str, Any]], ToolResult]

_WORD = re.compile(r"[a-z0-9]+")


class ToolError(ValueError):
    """Raised when local tool data or arguments are invalid."""


_MISSING = object()


@dataclass(frozen=True)
class ToolPatchOperation:
    operation: str
    path: str
    value: Any = _MISSING

    def __post_init__(self) -> None:
        if self.operation not in {"add", "replace", "remove"}:
            raise ToolError(f"unknown tool overlay operation {self.operation!r}")
        _json_pointer_tokens(self.path)
        if self.operation == "remove":
            if self.value is not _MISSING:
                raise ToolError("remove tool overlay operations may not define a value")
        elif self.value is _MISSING:
            raise ToolError(f"{self.operation} tool overlay operations require a value")
        else:
            object.__setattr__(self, "value", _freeze_json(self.value))


@dataclass(frozen=True)
class ToolResultOverlay:
    tool_name: str
    match_arguments: Mapping[str, Any]
    operations: tuple[ToolPatchOperation, ...]

    def __post_init__(self) -> None:
        if not self.tool_name:
            raise ToolError("tool overlay names must be non-empty")
        if not isinstance(self.match_arguments, Mapping):
            raise ToolError("tool overlay match_arguments must be an object")
        if not self.operations:
            raise ToolError("tool overlays must define at least one operation")
        frozen_arguments = _freeze_json(self.match_arguments)
        object.__setattr__(self, "match_arguments", cast(Mapping[str, Any], frozen_arguments))
        object.__setattr__(self, "operations", tuple(self.operations))


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters: Mapping[str, Any]
    handler: ToolHandler

    def model_schema(self) -> dict[str, JSON]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": _json_copy(dict(self.parameters)),
            },
        }


class ToolRegistry:
    def __init__(self, specs: Sequence[ToolSpec]) -> None:
        by_name = {spec.name: spec for spec in specs}
        if len(by_name) != len(specs):
            raise ToolError("tool names must be unique")
        self._specs = MappingProxyType(by_name)

    def model_schemas(self) -> tuple[dict[str, JSON], ...]:
        return tuple(spec.model_schema() for spec in self._specs.values())

    def invoke(
        self,
        name: str,
        arguments: Mapping[str, Any],
        fixture_set: Mapping[str, Any],
        result_overlays: Sequence[ToolResultOverlay] = (),
    ) -> ToolResult:
        try:
            spec = self._specs[name]
        except KeyError as error:
            raise ToolError(f"unknown tool {name!r}") from error
        validated = _validate_arguments(spec, arguments)
        result = spec.handler(validated, fixture_set)
        return _apply_result_overlays(name, validated, result, result_overlays)


@dataclass(frozen=True)
class LocalTools:
    fixture_set: Mapping[str, Any]
    registry: ToolRegistry
    result_overlays: tuple[ToolResultOverlay, ...] = ()

    @property
    def schemas(self) -> tuple[dict[str, JSON], ...]:
        return self.registry.model_schemas()

    def invoke(self, name: str, arguments: Mapping[str, Any]) -> ToolResult:
        return self.registry.invoke(name, arguments, self.fixture_set, self.result_overlays)


def load_fixture_sets(path: Path | None = None) -> Mapping[str, Mapping[str, Any]]:
    source = path or Path(__file__).with_name("tool_fixtures.json")
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ToolError(f"unable to load tool fixtures from {source}: {error}") from error
    if not isinstance(value, dict) or not value:
        raise ToolError(f"tool fixtures in {source} must be a non-empty object")
    fixture_sets: dict[str, Mapping[str, Any]] = {}
    for name, fixture_set in value.items():
        if not isinstance(name, str) or not isinstance(fixture_set, dict):
            raise ToolError(f"invalid tool fixture set in {source}")
        if fixture_set.get("name") != name:
            raise ToolError(f"tool fixture set {name!r} must repeat its name")
        for field in ("documents", "records", "statuses"):
            if not isinstance(fixture_set.get(field), list):
                raise ToolError(f"tool fixture set {name!r} must define {field}")
        fixture_sets[name] = MappingProxyType(fixture_set)
    return MappingProxyType(fixture_sets)


def local_tools(
    name: str,
    *,
    fixture_set: Mapping[str, Any] | None = None,
    result_overlays: Sequence[ToolResultOverlay] = (),
) -> LocalTools:
    if fixture_set is None:
        try:
            fixture_set = load_fixture_sets()[name]
        except KeyError as error:
            raise ToolError(f"unknown tool fixture set {name!r}") from error
    if fixture_set.get("name") != name:
        raise ToolError(f"tool fixture set must be named {name!r}")
    overlays = tuple(result_overlays)
    validate_result_overlays(fixture_set, overlays)
    return LocalTools(fixture_set, DEFAULT_REGISTRY, overlays)


def validate_result_overlays(
    fixture_set: Mapping[str, Any],
    overlays: Sequence[ToolResultOverlay],
) -> None:
    occupied_paths: list[tuple[str, Mapping[str, Any], str]] = []
    for overlay in overlays:
        try:
            spec = DEFAULT_REGISTRY._specs[overlay.tool_name]
        except KeyError as error:
            raise ToolError(f"unknown tool {overlay.tool_name!r} in result overlay") from error
        matching_arguments = _validation_arguments(spec, overlay.match_arguments, fixture_set)
        for operation in overlay.operations:
            for tool_name, match_arguments, path in occupied_paths:
                if (
                    tool_name == overlay.tool_name
                    and path == operation.path
                    and _argument_matches_overlap(match_arguments, overlay.match_arguments)
                ):
                    raise ToolError(
                        f"tool overlays collide at {overlay.tool_name!r} {operation.path!r}"
                    )
            occupied_paths.append((overlay.tool_name, overlay.match_arguments, operation.path))
        for arguments in matching_arguments:
            result = spec.handler(arguments, fixture_set)
            for operation in overlay.operations:
                _apply_json_pointer_operation(result, operation)


def build_registry() -> ToolRegistry:
    return ToolRegistry(
        (
            ToolSpec(
                name="document_search",
                description="Search local reference documents for relevant passages.",
                parameters=_object_schema(
                    {
                        "query": {"type": "string", "minLength": 1},
                        "limit": {"type": "integer", "minimum": 1, "maximum": 5},
                    },
                    required=("query",),
                ),
                handler=_document_search,
            ),
            ToolSpec(
                name="record_lookup",
                description="Look up a local record by identifier.",
                parameters=_object_schema(
                    {"record_id": {"type": "string", "minLength": 1}},
                    required=("record_id",),
                ),
                handler=_record_lookup,
            ),
            ToolSpec(
                name="safe_arithmetic",
                description="Calculate an expression using basic arithmetic.",
                parameters=_object_schema(
                    {"expression": {"type": "string", "minLength": 1, "maxLength": 128}},
                    required=("expression",),
                ),
                handler=_safe_arithmetic,
            ),
            ToolSpec(
                name="status_lookup",
                description="Look up the current status of a local item.",
                parameters=_object_schema(
                    {"status_id": {"type": "string", "minLength": 1}},
                    required=("status_id",),
                ),
                handler=_status_lookup,
            ),
            ToolSpec(
                name="ticket_creation",
                description="Create a deterministic local ticket.",
                parameters=_object_schema(
                    {
                        "title": {"type": "string", "minLength": 1, "maxLength": 120},
                        "description": {"type": "string", "minLength": 1, "maxLength": 1000},
                        "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    },
                    required=("title", "description", "priority"),
                ),
                handler=_ticket_creation,
            ),
        )
    )


def _validate_arguments(spec: ToolSpec, arguments: Mapping[str, Any]) -> dict[str, Any]:
    result = _validate_argument_subset(spec, arguments)
    required = set(spec.parameters["required"])
    missing = required - set(arguments)
    if missing:
        raise ToolError(f"{spec.name} is missing arguments: {sorted(missing)}")
    return result


def _validate_argument_subset(spec: ToolSpec, arguments: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(arguments, Mapping):
        raise ToolError(f"{spec.name} arguments must be an object")
    properties = spec.parameters["properties"]
    unknown = set(arguments) - set(properties)
    if unknown:
        raise ToolError(f"{spec.name} has unknown arguments: {sorted(unknown)}")
    result = dict(arguments)
    for name, value in result.items():
        _validate_value(spec.name, name, value, properties[name])
    return result


def _validation_arguments(
    spec: ToolSpec,
    selector: Mapping[str, Any],
    fixture_set: Mapping[str, Any],
) -> tuple[dict[str, Any], ...]:
    validated_selector = _validate_argument_subset(spec, selector)
    if spec.name == "document_search":
        candidates = [{"query": "local guidance"}]
    elif spec.name == "record_lookup":
        candidates = [{"record_id": str(item["id"])} for item in fixture_set["records"]] + [
            {"record_id": "__missing_record__"}
        ]
    elif spec.name == "status_lookup":
        candidates = [{"status_id": str(item["id"])} for item in fixture_set["statuses"]] + [
            {"status_id": "__missing_status__"}
        ]
    elif spec.name == "safe_arithmetic":
        candidates = [{"expression": "0"}]
    else:
        candidates = [
            {
                "title": "Local request",
                "description": "Validate the authored result shape.",
                "priority": "low",
            }
        ]
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in candidates:
        arguments = _validate_arguments(spec, {**candidate, **validated_selector})
        key = json.dumps(arguments, sort_keys=True, separators=(",", ":"))
        if key not in seen:
            results.append(arguments)
            seen.add(key)
    return tuple(results)


def _object_schema(properties: Mapping[str, Any], *, required: Sequence[str]) -> Mapping[str, Any]:
    return MappingProxyType(
        {
            "type": "object",
            "properties": dict(properties),
            "required": list(required),
            "additionalProperties": False,
        }
    )


def _validate_value(tool: str, name: str, value: Any, schema: Mapping[str, Any]) -> None:
    expected = schema["type"]
    valid = {
        "string": lambda item: isinstance(item, str),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
    }[expected](value)
    if not valid:
        raise ToolError(f"{tool}.{name} must be a {expected}")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            raise ToolError(f"{tool}.{name} is too short")
        if len(value) > schema.get("maxLength", math.inf):
            raise ToolError(f"{tool}.{name} is too long")
        if "enum" in schema and value not in schema["enum"]:
            raise ToolError(f"{tool}.{name} must be one of {schema['enum']}")
    if isinstance(value, int) and not isinstance(value, bool):
        if value < schema.get("minimum", -math.inf) or value > schema.get("maximum", math.inf):
            raise ToolError(f"{tool}.{name} is outside its allowed range")


def _document_search(
    arguments: Mapping[str, Any],
    fixture_set: Mapping[str, Any],
) -> ToolResult:
    query_terms = set(_WORD.findall(str(arguments["query"]).lower()))
    documents = fixture_set["documents"]
    ranked = sorted(
        documents,
        key=lambda document: (
            -len(query_terms & set(_WORD.findall(str(document["text"]).lower()))),
            str(document["id"]),
        ),
    )
    return {"documents": [_json_copy(document) for document in ranked[: arguments.get("limit", 3)]]}


def _record_lookup(
    arguments: Mapping[str, Any],
    fixture_set: Mapping[str, Any],
) -> ToolResult:
    record = next(
        (value for value in fixture_set["records"] if value["id"] == str(arguments["record_id"])),
        None,
    )
    return {
        "found": record is not None,
        "record": _json_copy(record) if record is not None else None,
    }


def _status_lookup(
    arguments: Mapping[str, Any],
    fixture_set: Mapping[str, Any],
) -> ToolResult:
    status = next(
        (value for value in fixture_set["statuses"] if value["id"] == str(arguments["status_id"])),
        None,
    )
    return {
        "found": status is not None,
        "status": _json_copy(status) if status is not None else None,
    }


def _safe_arithmetic(
    arguments: Mapping[str, Any],
    fixture_set: Mapping[str, Any],
) -> ToolResult:
    del fixture_set
    expression = str(arguments["expression"])
    try:
        result = _evaluate_arithmetic(ast.parse(expression, mode="eval").body)
    except (SyntaxError, ArithmeticError, ValueError) as error:
        raise ToolError(f"invalid arithmetic expression: {error}") from error
    if not math.isfinite(float(result)) or abs(result) > 1_000_000_000_000:
        raise ToolError("arithmetic result is outside the allowed range")
    return {"expression": expression, "result": result}


def _ticket_creation(
    arguments: Mapping[str, Any],
    fixture_set: Mapping[str, Any],
) -> ToolResult:
    del fixture_set
    encoded = json.dumps(arguments, sort_keys=True, separators=(",", ":")).encode()
    return {
        "ticket_id": f"TKT-{sha256(encoded).hexdigest()[:12].upper()}",
        "state": "created",
        "priority": str(arguments["priority"]),
    }


_BINARY_OPERATORS: Mapping[type[ast.operator], Callable[[float, float], float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}
_UNARY_OPERATORS: Mapping[type[ast.unaryop], Callable[[float], float]] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def _evaluate_arithmetic(node: ast.expr) -> int | float:
    if (
        isinstance(node, ast.Constant)
        and isinstance(node.value, (int, float))
        and not isinstance(node.value, bool)
    ):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY_OPERATORS:
        return _BINARY_OPERATORS[type(node.op)](
            _evaluate_arithmetic(node.left),
            _evaluate_arithmetic(node.right),
        )
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPERATORS:
        return _UNARY_OPERATORS[type(node.op)](_evaluate_arithmetic(node.operand))
    raise ValueError("only numeric literals and +, -, *, /, //, % are allowed")


def _argument_matches_overlap(left: Mapping[str, Any], right: Mapping[str, Any]) -> bool:
    return all(left[key] == right[key] for key in left.keys() & right.keys())


def _apply_result_overlays(
    tool_name: str,
    arguments: Mapping[str, Any],
    result: ToolResult,
    overlays: Sequence[ToolResultOverlay],
) -> ToolResult:
    patched = cast(ToolResult, _json_copy(result))
    for overlay in overlays:
        if overlay.tool_name != tool_name or not all(
            arguments.get(name) == value for name, value in overlay.match_arguments.items()
        ):
            continue
        for operation in overlay.operations:
            _apply_json_pointer_operation(patched, operation)
    return patched


def _apply_json_pointer_operation(
    result: ToolResult,
    operation: ToolPatchOperation,
) -> None:
    tokens = _json_pointer_tokens(operation.path)
    parent: Any = result
    for token in tokens[:-1]:
        if isinstance(parent, dict) and token in parent:
            parent = parent[token]
        elif isinstance(parent, list):
            parent = parent[_list_index(token, len(parent), allow_end=False)]
        else:
            raise ToolError(f"tool overlay path {operation.path!r} does not exist")
    token = tokens[-1]
    if isinstance(parent, dict):
        _patch_mapping(parent, token, operation)
    elif isinstance(parent, list):
        _patch_sequence(parent, token, operation)
    else:
        raise ToolError(f"tool overlay path {operation.path!r} has a scalar parent")


def _patch_mapping(
    parent: dict[str, JSON],
    token: str,
    operation: ToolPatchOperation,
) -> None:
    if operation.operation == "add":
        parent[token] = _json_copy(operation.value)
        return
    if token not in parent:
        raise ToolError(f"tool overlay path component {token!r} does not exist")
    if operation.operation == "remove":
        del parent[token]
    else:
        parent[token] = _json_copy(operation.value)


def _patch_sequence(
    parent: list[JSON],
    token: str,
    operation: ToolPatchOperation,
) -> None:
    if operation.operation == "add":
        if token == "-":
            parent.append(_json_copy(operation.value))
        else:
            parent.insert(
                _list_index(token, len(parent), allow_end=True),
                _json_copy(operation.value),
            )
        return
    index = _list_index(token, len(parent), allow_end=False)
    if operation.operation == "remove":
        del parent[index]
    else:
        parent[index] = _json_copy(operation.value)


def _json_pointer_tokens(path: str) -> list[str]:
    if not isinstance(path, str) or not path.startswith("/") or path == "/":
        raise ToolError("tool overlay paths must be non-root JSON Pointers")
    tokens = []
    for raw in path[1:].split("/"):
        if re.search(r"~(?![01])", raw):
            raise ToolError(f"tool overlay path {path!r} has an invalid escape")
        tokens.append(raw.replace("~1", "/").replace("~0", "~"))
    return tokens


def _list_index(token: str, length: int, *, allow_end: bool) -> int:
    if not token.isdigit() or (len(token) > 1 and token.startswith("0")):
        raise ToolError(f"tool overlay list index {token!r} is invalid")
    index = int(token)
    limit = length if allow_end else length - 1
    if index > limit:
        raise ToolError(f"tool overlay list index {index} is out of range")
    return index


def _json_copy(value: Any) -> Any:
    return json.loads(json.dumps(_plain_json(value)))


def _freeze_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): _freeze_json(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_json(item) for item in value)
    try:
        json.dumps(value)
    except (TypeError, ValueError) as error:
        raise ToolError(f"tool overlay values must be JSON-compatible: {error}") from error
    return value


def _plain_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _plain_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain_json(item) for item in value]
    return value


DEFAULT_REGISTRY = build_registry()
