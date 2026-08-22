"""Deterministic fake tools for instrumented datagen recorders."""

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
from typing import TYPE_CHECKING, Any, Final, cast

if TYPE_CHECKING or __package__:
    from scripts.datagen.profile import ToolPatchOperation, ToolResultOverlay
else:
    from profile import ToolPatchOperation, ToolResultOverlay

MAX_TOOL_LOOP_STEPS: Final = 6
FAILURE_NONE: Final = "none"
FAILURE_DELAY: Final = "tool_delay"
FAILURE_EXCEPTION: Final = "tool_exception"
_FAILURE_MODES = frozenset({FAILURE_NONE, FAILURE_DELAY, FAILURE_EXCEPTION})
_WORD = re.compile(r"[a-z0-9]+")

JSON = None | bool | int | float | str | list["JSON"] | dict[str, "JSON"]
ToolResult = dict[str, JSON]
ToolHandler = Callable[[Mapping[str, Any], "ToolContext", str], ToolResult]


class ToolError(ValueError):
    """Base class for deterministic fake-tool errors."""


class ToolArgumentError(ToolError):
    """Raised when a tool call does not match its model-facing schema."""


class InjectedToolFailure(ToolError):
    """Raised for a matrix cell configured with a tool failure."""


class ToolLoopLimitExceeded(ToolError):
    """Raised when an agent attempts more than six tool calls."""


@dataclass(frozen=True)
class ToolContext:
    pass_seed: int
    cell_id: str
    fixture_set: Mapping[str, Any]
    result_overlays: tuple[ToolResultOverlay, ...] = ()
    failure_mode: str = FAILURE_NONE
    call_ordinal: int = 1

    def __post_init__(self) -> None:
        if isinstance(self.pass_seed, bool) or not isinstance(self.pass_seed, int):
            raise ToolError("pass_seed must be an integer")
        if not self.cell_id:
            raise ToolError("cell_id must be non-empty")
        if self.failure_mode not in _FAILURE_MODES:
            raise ToolError(f"unknown failure mode {self.failure_mode!r}")
        if not 1 <= self.call_ordinal <= MAX_TOOL_LOOP_STEPS:
            raise ToolLoopLimitExceeded(
                f"tool call ordinal {self.call_ordinal} exceeds the six-step limit"
            )
        if not isinstance(self.fixture_set.get("name"), str):
            raise ToolError("fixture_set must have a string name")

    def invocation_id(self, tool_name: str, arguments: Mapping[str, Any]) -> str:
        payload = {
            "arguments": arguments,
            "call_ordinal": self.call_ordinal,
            "cell_id": self.cell_id,
            "failure_mode": self.failure_mode,
            "fixture_set": self.fixture_set,
            "pass_seed": self.pass_seed,
            "tool_name": tool_name,
        }
        return sha256(_canonical_json(payload).encode()).hexdigest()


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
                "parameters": _json_copy(self.parameters),
            },
        }

    def validate(self, arguments: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(arguments, Mapping):
            raise ToolArgumentError(f"{self.name} arguments must be an object")
        properties = self.parameters["properties"]
        required = set(self.parameters["required"])
        unknown = set(arguments) - set(properties)
        missing = required - set(arguments)
        if unknown:
            raise ToolArgumentError(f"{self.name} has unknown arguments: {sorted(unknown)}")
        if missing:
            raise ToolArgumentError(f"{self.name} is missing arguments: {sorted(missing)}")
        validated = dict(arguments)
        for name, value in validated.items():
            _validate_value(self.name, name, value, properties[name])
        return validated


@dataclass(frozen=True)
class InvocationRecord:
    invocation_id: str
    tool_name: str
    cell_id: str
    fixture_set: str
    call_ordinal: int
    arguments: Mapping[str, Any]
    outcome: str
    declared_delay_ms: int
    result: Mapping[str, Any] | None = None
    error: str | None = None
    engaged_seed_ids: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, JSON]:
        return {
            "invocation_id": self.invocation_id,
            "tool_name": self.tool_name,
            "cell_id": self.cell_id,
            "fixture_set": self.fixture_set,
            "call_ordinal": self.call_ordinal,
            "arguments": _json_copy(self.arguments),
            "outcome": self.outcome,
            "declared_delay_ms": self.declared_delay_ms,
            "result": _json_copy(self.result) if self.result is not None else None,
            "error": self.error,
            "engaged_seed_ids": list(self.engaged_seed_ids),
        }


class InvocationLedger:
    def __init__(self, path: Path | None = None) -> None:
        self._path = path
        self._records: list[InvocationRecord] = []
        if path is not None:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                    try:
                        value = json.loads(line)
                    except json.JSONDecodeError as error:
                        raise ToolError(
                            f"invalid invocation ledger JSON at line {line_number}"
                        ) from error
                    if not isinstance(value, Mapping):
                        raise ToolError(
                            f"invocation ledger line {line_number} must be an object"
                        )
                    self._records.append(
                        InvocationRecord(
                            invocation_id=str(value["invocation_id"]),
                            tool_name=str(value["tool_name"]),
                            cell_id=str(value["cell_id"]),
                            fixture_set=str(value["fixture_set"]),
                            call_ordinal=int(value["call_ordinal"]),
                            arguments=cast(Mapping[str, Any], value["arguments"]),
                            outcome=str(value["outcome"]),
                            declared_delay_ms=int(value["declared_delay_ms"]),
                            result=cast(Mapping[str, Any] | None, value.get("result")),
                            error=cast(str | None, value.get("error")),
                            engaged_seed_ids=tuple(value.get("engaged_seed_ids", ())),
                        )
                    )

    @property
    def records(self) -> tuple[InvocationRecord, ...]:
        return tuple(self._records)

    def append(self, record: InvocationRecord) -> None:
        self._records.append(record)
        if self._path is not None:
            with self._path.open("a", encoding="utf-8") as output:
                output.write(_canonical_json(record.to_dict()) + "\n")


class ToolRegistry:
    def __init__(self, specs: Sequence[ToolSpec]) -> None:
        by_name = {spec.name: spec for spec in specs}
        if len(by_name) != len(specs):
            raise ToolError("tool names must be unique")
        self._specs = MappingProxyType(by_name)

    @property
    def names(self) -> tuple[str, ...]:
        return tuple(self._specs)

    def model_schemas(self) -> list[dict[str, JSON]]:
        return [spec.model_schema() for spec in self._specs.values()]

    def invoke(
        self,
        name: str,
        arguments: Mapping[str, Any],
        context: ToolContext,
        ledger: InvocationLedger,
    ) -> ToolResult:
        try:
            spec = self._specs[name]
        except KeyError as error:
            raise ToolError(f"unknown tool {name!r}") from error
        validated = spec.validate(arguments)
        invocation_id = context.invocation_id(name, validated)
        delay_ms = _declared_delay_ms(invocation_id, context.failure_mode)
        if context.failure_mode == FAILURE_EXCEPTION:
            message = f"injected failure for {name} ({invocation_id[:12]})"
            ledger.append(
                InvocationRecord(
                    invocation_id=invocation_id,
                    tool_name=name,
                    cell_id=context.cell_id,
                    fixture_set=str(context.fixture_set["name"]),
                    call_ordinal=context.call_ordinal,
                    arguments=validated,
                    outcome="error",
                    declared_delay_ms=delay_ms,
                    error=message,
                )
            )
            raise InjectedToolFailure(message)
        result = spec.handler(validated, context, invocation_id)
        result, engaged_seed_ids = _apply_result_overlays(
            name,
            validated,
            result,
            context.result_overlays,
            invocation_id,
        )
        ledger.append(
            InvocationRecord(
                invocation_id=invocation_id,
                tool_name=name,
                cell_id=context.cell_id,
                fixture_set=str(context.fixture_set["name"]),
                call_ordinal=context.call_ordinal,
                arguments=validated,
                outcome="success",
                declared_delay_ms=delay_ms,
                result=result,
                engaged_seed_ids=engaged_seed_ids,
            )
        )
        return result


def load_fixture_sets(path: Path) -> Mapping[str, Mapping[str, Any]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ToolError(f"unable to load tool fixtures from {path}: {error}") from error
    if not isinstance(value, dict) or value.get("schema_version") != 1:
        raise ToolError(f"unsupported tool fixture schema in {path}")
    domains = value.get("fixture_sets")
    if not isinstance(domains, dict) or not domains:
        raise ToolError(f"tool fixtures in {path} must define fixture_sets")
    parsed: dict[str, Mapping[str, Any]] = {}
    for name, fixtures in domains.items():
        if not isinstance(name, str) or not isinstance(fixtures, dict):
            raise ToolError(f"invalid fixture set in {path}")
        if fixtures.get("name") != name:
            raise ToolError(f"fixture set {name!r} must repeat its name")
        for field in ("documents", "records", "statuses"):
            if not isinstance(fixtures.get(field), list):
                raise ToolError(f"fixture set {name!r} must define a {field} list")
        parsed[name] = MappingProxyType(fixtures)
    return MappingProxyType(parsed)


def load_default_fixture_sets() -> Mapping[str, Mapping[str, Any]]:
    return load_fixture_sets(Path(__file__).with_name("tool_fixtures.json"))


def build_registry() -> ToolRegistry:
    return ToolRegistry(
        (
            ToolSpec(
                name="document_search",
                description="Search the domain document collection for relevant passages.",
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
                description="Look up a structured domain record by its identifier.",
                parameters=_object_schema(
                    {"record_id": {"type": "string", "minLength": 1}},
                    required=("record_id",),
                ),
                handler=_record_lookup,
            ),
            ToolSpec(
                name="safe_arithmetic",
                description="Calculate a numeric expression using basic arithmetic.",
                parameters=_object_schema(
                    {"expression": {"type": "string", "minLength": 1, "maxLength": 128}},
                    required=("expression",),
                ),
                handler=_safe_arithmetic,
            ),
            ToolSpec(
                name="status_lookup",
                description="Look up the current status of a domain item.",
                parameters=_object_schema(
                    {"status_id": {"type": "string", "minLength": 1}},
                    required=("status_id",),
                ),
                handler=_status_lookup,
            ),
            ToolSpec(
                name="ticket_creation",
                description="Create a support ticket with a deterministic identifier.",
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
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
    }[expected](value)
    if not valid:
        raise ToolArgumentError(f"{tool}.{name} must be a {expected}")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            raise ToolArgumentError(f"{tool}.{name} is too short")
        if len(value) > schema.get("maxLength", math.inf):
            raise ToolArgumentError(f"{tool}.{name} is too long")
        if "enum" in schema and value not in schema["enum"]:
            raise ToolArgumentError(f"{tool}.{name} must be one of {schema['enum']}")
    if isinstance(value, int) and not isinstance(value, bool):
        if value < schema.get("minimum", -math.inf) or value > schema.get("maximum", math.inf):
            raise ToolArgumentError(f"{tool}.{name} is outside its allowed range")


def _document_search(
    arguments: Mapping[str, Any], context: ToolContext, invocation_id: str
) -> ToolResult:
    query_terms = set(_WORD.findall(str(arguments["query"]).lower()))
    documents = context.fixture_set["documents"]
    ranked = sorted(
        documents,
        key=lambda document: (
            -len(query_terms & set(_WORD.findall(str(document["text"]).lower()))),
            sha256(f"{invocation_id}:{document['id']}".encode()).hexdigest(),
        ),
    )
    limit = int(arguments.get("limit", 3))
    return {
        "invocation_id": invocation_id,
        "documents": [_json_copy(document) for document in ranked[:limit]],
    }


def _record_lookup(
    arguments: Mapping[str, Any], context: ToolContext, invocation_id: str
) -> ToolResult:
    record_id = str(arguments["record_id"])
    record = next(
        (record for record in context.fixture_set["records"] if record["id"] == record_id), None
    )
    return {
        "invocation_id": invocation_id,
        "found": record is not None,
        "record": _json_copy(record) if record is not None else None,
    }


def _safe_arithmetic(
    arguments: Mapping[str, Any], context: ToolContext, invocation_id: str
) -> ToolResult:
    expression = str(arguments["expression"])
    try:
        parsed = ast.parse(expression, mode="eval")
        result = _evaluate_arithmetic(parsed.body)
    except (SyntaxError, ArithmeticError, ValueError) as error:
        raise ToolArgumentError(f"invalid arithmetic expression: {error}") from error
    if not math.isfinite(float(result)) or abs(result) > 1_000_000_000_000:
        raise ToolArgumentError("arithmetic result is outside the allowed range")
    return {"invocation_id": invocation_id, "expression": expression, "result": result}


def _status_lookup(
    arguments: Mapping[str, Any], context: ToolContext, invocation_id: str
) -> ToolResult:
    status_id = str(arguments["status_id"])
    status = next(
        (status for status in context.fixture_set["statuses"] if status["id"] == status_id), None
    )
    return {
        "invocation_id": invocation_id,
        "found": status is not None,
        "status": _json_copy(status) if status is not None else None,
    }


def _ticket_creation(
    arguments: Mapping[str, Any], context: ToolContext, invocation_id: str
) -> ToolResult:
    return {
        "invocation_id": invocation_id,
        "ticket_id": f"TKT-{invocation_id[:12].upper()}",
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
        if abs(node.value) > 1_000_000_000_000:
            raise ValueError("number is outside the allowed range")
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY_OPERATORS:
        left = _evaluate_arithmetic(node.left)
        right = _evaluate_arithmetic(node.right)
        return _BINARY_OPERATORS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPERATORS:
        return _UNARY_OPERATORS[type(node.op)](_evaluate_arithmetic(node.operand))
    raise ValueError("only numeric literals and +, -, *, /, //, % are allowed")


def _declared_delay_ms(invocation_id: str, failure_mode: str) -> int:
    if failure_mode != FAILURE_DELAY:
        return 0
    return 50 + int(invocation_id[:8], 16) % 451


def _apply_result_overlays(
    tool_name: str,
    arguments: Mapping[str, Any],
    result: ToolResult,
    overlays: Sequence[ToolResultOverlay],
    invocation_id: str,
) -> tuple[ToolResult, tuple[str, ...]]:
    patched = cast(ToolResult, _json_copy(result))
    engaged_seed_ids: set[str] = set()
    for overlay in overlays:
        if overlay.tool_name != tool_name or not all(
            arguments.get(name) == value for name, value in overlay.match_arguments.items()
        ):
            continue
        for operation in overlay.operations:
            _apply_json_pointer_operation(patched, operation)
            if patched.get("invocation_id") != invocation_id:
                raise ToolError("result overlays may not alter invocation_id")
        if overlay.source_seed_id is not None:
            engaged_seed_ids.add(overlay.source_seed_id)
    return patched, tuple(sorted(engaged_seed_ids))


def _apply_json_pointer_operation(result: ToolResult, operation: ToolPatchOperation) -> None:
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


def _patch_mapping(parent: dict[str, JSON], token: str, operation: ToolPatchOperation) -> None:
    if operation.operation == "add":
        parent[token] = _json_copy(operation.value)
        return
    if token not in parent:
        raise ToolError(f"tool overlay path component {token!r} does not exist")
    if operation.operation == "remove":
        del parent[token]
    else:
        parent[token] = _json_copy(operation.value)


def _patch_sequence(parent: list[JSON], token: str, operation: ToolPatchOperation) -> None:
    if operation.operation == "add":
        if token == "-":
            parent.append(_json_copy(operation.value))
        else:
            parent.insert(
                _list_index(token, len(parent), allow_end=True), _json_copy(operation.value)
            )
        return
    index = _list_index(token, len(parent), allow_end=False)
    if operation.operation == "remove":
        del parent[index]
    else:
        parent[index] = _json_copy(operation.value)


def _json_pointer_tokens(path: str) -> list[str]:
    if not path.startswith("/") or path == "/":
        raise ToolError("tool overlay paths must be non-root JSON Pointers")
    tokens = []
    for raw in path[1:].split("/"):
        if re.search(r"~(?![01])", raw):
            raise ToolError(f"tool overlay path {path!r} has an invalid escape")
        tokens.append(raw.replace("~1", "/").replace("~0", "~"))
    if tokens[0] == "invocation_id":
        raise ToolError("result overlays may not alter invocation_id")
    return tokens


def _list_index(token: str, length: int, *, allow_end: bool) -> int:
    if not token.isdigit() or (len(token) > 1 and token.startswith("0")):
        raise ToolError(f"tool overlay list index {token!r} is invalid")
    index = int(token)
    limit = length if allow_end else length - 1
    if index > limit:
        raise ToolError(f"tool overlay list index {index} is out of range")
    return index


def _canonical_json(value: Any) -> str:
    return json.dumps(_plain_json(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _json_copy(value: Any) -> Any:
    return json.loads(_canonical_json(value))


def _plain_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _plain_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain_json(item) for item in value]
    return value


DEFAULT_REGISTRY = build_registry()
