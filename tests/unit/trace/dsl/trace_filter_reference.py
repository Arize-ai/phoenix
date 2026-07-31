"""Independent executable semantics for the trace filter DSL."""

import ast
import operator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from itertools import product
from typing import Any, Callable, Iterator, Mapping, Optional, Sequence, Union


class _Missing:
    def __repr__(self) -> str:
        return "MISSING"


MISSING = _Missing()


@dataclass(frozen=True)
class ReferenceAnnotation:
    name: str
    label: Optional[str] = None
    score: Optional[float] = None
    identifier: str = ""


@dataclass(frozen=True)
class ReferenceCostDetail:
    token_type: str
    is_prompt: bool
    cost: Optional[float] = None
    tokens: Optional[float] = None
    cost_per_token: Optional[float] = None


@dataclass(frozen=True)
class ReferenceSpanCost:
    prompt_cost: Optional[float] = None
    completion_cost: Optional[float] = None
    details: tuple[ReferenceCostDetail, ...] = ()

    @property
    def total_cost(self) -> Optional[float]:
        if self.prompt_cost is None and self.completion_cost is None:
            return None
        return (self.prompt_cost or 0.0) + (self.completion_cost or 0.0)


@dataclass(frozen=True)
class ReferenceSpan:
    name: str
    span_kind: str = "LLM"
    status_code: str = "OK"
    latency_ms: float = 100.0
    llm_token_count_prompt: Optional[int] = None
    llm_token_count_completion: Optional[int] = None
    annotations: tuple[ReferenceAnnotation, ...] = ()
    cost: Optional[ReferenceSpanCost] = None
    attributes: Optional[Mapping[str, Any]] = None
    parent: Optional[str] = None

    @property
    def llm_token_count_total(self) -> int:
        return (self.llm_token_count_prompt or 0) + (self.llm_token_count_completion or 0)


@dataclass(frozen=True)
class ReferenceTrace:
    trace_id: str
    start_time: datetime
    end_time: datetime
    spans: tuple[ReferenceSpan, ...] = ()
    annotations: tuple[ReferenceAnnotation, ...] = ()

    @property
    def latency_ms(self) -> float:
        # SQL rounds trace latency before filtering, so the reference follows that contract.
        return round((self.end_time - self.start_time).total_seconds() * 1000, 1)

    @property
    def root_span(self) -> Optional[ReferenceSpan]:
        return next((span for span in self.spans if span.parent is None), None)

    @property
    def root_span_attributes(self) -> Mapping[str, Any]:
        root = self.root_span
        return (root.attributes or {}) if root is not None else {}

    @property
    def input(self) -> Any:
        return _traverse(self.root_span_attributes, ("input", "value"))

    @property
    def output(self) -> Any:
        return _traverse(self.root_span_attributes, ("output", "value"))

    @property
    def num_spans(self) -> int:
        return len(self.spans)

    @property
    def error_count(self) -> int:
        return sum(1 for span in self.spans if span.status_code.upper() == "ERROR")

    @property
    def token_count_prompt(self) -> int:
        return sum(span.llm_token_count_prompt or 0 for span in self._llm_spans)

    @property
    def token_count_completion(self) -> int:
        return sum(span.llm_token_count_completion or 0 for span in self._llm_spans)

    @property
    def token_count_total(self) -> int:
        return sum(span.llm_token_count_total for span in self._llm_spans)

    @property
    def prompt_cost(self) -> float:
        return sum(cost.prompt_cost or 0.0 for cost in self.span_costs)

    @property
    def completion_cost(self) -> float:
        return sum(cost.completion_cost or 0.0 for cost in self.span_costs)

    @property
    def total_cost(self) -> float:
        return sum(cost.total_cost or 0.0 for cost in self.span_costs)

    @property
    def tool_span_count(self) -> int:
        return self._span_kind_count("TOOL")

    @property
    def llm_span_count(self) -> int:
        return self._span_kind_count("LLM")

    @property
    def span_costs(self) -> tuple[ReferenceSpanCost, ...]:
        return tuple(span.cost for span in self.spans if span.cost is not None)

    @property
    def _llm_spans(self) -> tuple[ReferenceSpan, ...]:
        return tuple(span for span in self.spans if span.span_kind.upper() == "LLM")

    def _span_kind_count(self, span_kind: str) -> int:
        return sum(1 for span in self.spans if span.span_kind.upper() == span_kind)

    def annotations_named(self, name: str) -> tuple[ReferenceAnnotation, ...]:
        return tuple(annotation for annotation in self.annotations if annotation.name == name)


_FLAT_NAMES = frozenset(
    {
        "trace_id",
        "start_time",
        "end_time",
        "latency_ms",
        "num_spans",
        "error_count",
        "token_count_prompt",
        "token_count_completion",
        "token_count_total",
        "prompt_cost",
        "completion_cost",
        "total_cost",
        "tool_span_count",
        "llm_span_count",
        "input",
        "output",
    }
)

_ITERABLES: Mapping[str, Callable[[ReferenceTrace], tuple[Any, ...]]] = {
    "spans": lambda trace: trace.spans,
    "trace_annotations": lambda trace: trace.annotations,
    "span_annotations": lambda trace: tuple(
        annotation for span in trace.spans for annotation in span.annotations
    ),
    "span_cost_details": lambda trace: tuple(
        detail for cost in trace.span_costs for detail in cost.details
    ),
}

_ELEMENT_FIELDS: Mapping[str, frozenset[str]] = {
    "spans": frozenset(
        {
            "name",
            "span_kind",
            "status_code",
            "latency_ms",
            "llm_token_count_prompt",
            "llm_token_count_completion",
            "llm_token_count_total",
        }
    ),
    "trace_annotations": frozenset({"name", "label", "score"}),
    "span_annotations": frozenset({"name", "label", "score"}),
    "span_cost_details": frozenset({"token_type", "is_prompt", "cost", "tokens", "cost_per_token"}),
}

_UPPERCASE_FIELDS = frozenset({"span_kind", "status_code"})
_DATETIME_FIELDS = frozenset({"start_time", "end_time"})
_QUANTIFIERS = frozenset({"any", "all"})
_REDUCERS = frozenset({"len", "max", "min", "sum"})
_CASTS = frozenset({"str", "float", "int"})

_COMPARATORS: Mapping[type, Callable[[Any, Any], bool]] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.Is: operator.eq,
    ast.IsNot: operator.ne,
}

_ARITHMETIC: Mapping[type, Callable[[Any, Any], Any]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}

_Scope = Mapping[str, tuple[str, Any]]


def matches(condition: str, trace: ReferenceTrace) -> bool:
    tree = ast.parse(condition, mode="eval").body
    names = sorted(_annotation_names(tree))
    candidates = [trace.annotations_named(name) or (None,) for name in names]
    return any(
        _Evaluator(trace, dict(zip(names, rows))).evaluate(tree, {}) is True
        for rows in product(*candidates)
    )


def matching_trace_ids(condition: str, traces: Sequence[ReferenceTrace]) -> set[str]:
    return {trace.trace_id for trace in traces if matches(condition, trace)}


def _annotation_names(tree: ast.expr) -> set[str]:
    names = (_annotation_key(node) for node in ast.walk(tree) if isinstance(node, ast.expr))
    return {name for name in names if name is not None}


def _annotation_key(node: ast.expr) -> Optional[str]:
    if (
        isinstance(node, ast.Subscript)
        and isinstance(node.value, ast.Name)
        and node.value.id in ("annotations", "evals")
        and isinstance(node.slice, ast.Constant)
        and isinstance(node.slice.value, str)
    ):
        return node.slice.value
    return None


class _Evaluator:
    def __init__(
        self,
        trace: ReferenceTrace,
        annotations: Optional[Mapping[str, Optional[ReferenceAnnotation]]] = None,
    ) -> None:
        self._trace = trace
        self._annotations = annotations or {}

    def evaluate(self, node: ast.expr, scope: _Scope) -> Any:
        if isinstance(node, ast.BoolOp):
            values = [self.evaluate(value, scope) for value in node.values]
            return _kleene_and(values) if isinstance(node.op, ast.And) else _kleene_or(values)
        if isinstance(node, ast.UnaryOp):
            operand = self.evaluate(node.operand, scope)
            if isinstance(node.op, ast.Not):
                return _kleene_not(operand)
            if operand is MISSING:
                return MISSING
            return -operand if isinstance(node.op, ast.USub) else +operand
        if isinstance(node, ast.Compare):
            return _kleene_and(list(self._compare_links(node, scope)))
        if isinstance(node, ast.BinOp):
            return self._arithmetic(node, scope)
        if isinstance(node, ast.Call):
            return self._call(node, scope)
        if isinstance(node, ast.Constant):
            return MISSING if node.value is None else node.value
        if isinstance(node, (ast.List, ast.Tuple)):
            return tuple(self.evaluate(element, scope) for element in node.elts)
        if isinstance(node, ast.Name):
            return self._name(node, scope)
        if isinstance(node, ast.Attribute):
            if _annotation_key(node.value) is not None:
                return self._annotation_attribute(node)
            if isinstance(node.value, ast.Name) and node.value.id == "user" and node.attr == "id":
                return self._root_value(("user", "id"))
            return self._element_field(node, scope)
        if isinstance(node, ast.Subscript):
            if (key := _annotation_key(node)) is not None:
                return self._annotations.get(key) is not None
            return self._root_span_attribute(node)
        raise SyntaxError(f"unsupported expression: {ast.unparse(node)}")

    def _annotation_attribute(self, node: ast.Attribute) -> Any:
        key = _annotation_key(node.value)
        annotation = self._annotations.get(str(key))
        if annotation is None or node.attr not in ("score", "label"):
            return MISSING
        value = getattr(annotation, node.attr)
        return MISSING if value is None else value

    def _name(self, node: ast.Name, scope: _Scope) -> Any:
        if node.id in scope:
            return scope[node.id][1]
        if node.id in _FLAT_NAMES:
            return getattr(self._trace, node.id)
        raise SyntaxError(f"unknown name `{node.id}`")

    def _element_field(self, node: ast.Attribute, scope: _Scope) -> Any:
        if not isinstance(node.value, ast.Name) or node.value.id not in scope:
            raise SyntaxError(f"unsupported attribute access: {ast.unparse(node)}")
        iterable, element = scope[node.value.id]
        if node.attr not in _ELEMENT_FIELDS[iterable]:
            raise SyntaxError(f"`{iterable}` elements have no field `{node.attr}`")
        value = getattr(element, node.attr)
        return MISSING if value is None else value

    def _root_span_attribute(self, node: ast.Subscript) -> Any:
        keys = _attribute_path_keys(node)
        if keys is None:
            raise SyntaxError(f"unsupported subscript: {ast.unparse(node)}")
        if not all(isinstance(key, str) for key in keys):
            return _traverse(self._trace.root_span_attributes, keys)
        for path in _wire_key_candidate_paths([str(key) for key in keys]):
            value = self._root_value(path)
            if value is not MISSING:
                return value
        return MISSING

    def _root_value(self, path: Sequence[Union[str, int]]) -> Any:
        return _traverse(self._trace.root_span_attributes, path)

    def _compare_links(self, node: ast.Compare, scope: _Scope) -> Iterator[Any]:
        left = node.left
        for op, right in zip(node.ops, node.comparators):
            yield self._compare(left, op, right, scope)
            left = right

    def _compare(
        self, left_node: ast.expr, op: ast.cmpop, right_node: ast.expr, scope: _Scope
    ) -> Any:
        if isinstance(op, (ast.Is, ast.IsNot, ast.Eq, ast.NotEq)):
            if _is_none_literal(right_node):
                value_node: Optional[ast.expr] = left_node
            elif _is_none_literal(left_node):
                value_node = right_node
            else:
                value_node = None
            if value_node is not None:
                absent = self.evaluate(value_node, scope) is MISSING
                return absent if isinstance(op, (ast.Is, ast.Eq)) else not absent
        left = self.evaluate(left_node, scope)
        right = self.evaluate(right_node, scope)
        left, right = self._coerce(left_node, right_node, left, right, scope)
        if left is MISSING or right is MISSING:
            return MISSING
        if isinstance(op, (ast.In, ast.NotIn)):
            contained = _contains(right, left)
            return contained if isinstance(op, ast.In) else not contained
        comparator = _COMPARATORS.get(type(op))
        if comparator is None:
            raise SyntaxError(f"unsupported comparison: {ast.unparse(op)}")
        return comparator(left, right)

    def _coerce(
        self,
        left_node: ast.expr,
        right_node: ast.expr,
        left: Any,
        right: Any,
        scope: _Scope,
    ) -> tuple[Any, Any]:
        left_kind = self._name_kind(left_node, scope)
        right_kind = self._name_kind(right_node, scope)
        if "uppercase" in (left_kind, right_kind):
            left, right = _uppercase(left), _uppercase(right)
        if left_kind == "datetime" and isinstance(right, str):
            right = _parse_datetime_literal(right)
        elif right_kind == "datetime" and isinstance(left, str):
            left = _parse_datetime_literal(left)
        return left, right

    def _name_kind(self, node: ast.expr, scope: _Scope) -> Optional[str]:
        name: Optional[str] = None
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in scope
        ):
            name = node.attr
        elif isinstance(node, ast.Name) and node.id not in scope:
            name = node.id
        if name in _UPPERCASE_FIELDS:
            return "uppercase"
        if name in _DATETIME_FIELDS:
            return "datetime"
        return None

    def _arithmetic(self, node: ast.BinOp, scope: _Scope) -> Any:
        left = self.evaluate(node.left, scope)
        right = self.evaluate(node.right, scope)
        if left is MISSING or right is MISSING:
            return MISSING
        if isinstance(node.op, (ast.Div, ast.FloorDiv, ast.Mod)) and right == 0:
            return MISSING
        arithmetic = _ARITHMETIC.get(type(node.op))
        if arithmetic is None:
            raise SyntaxError(f"unsupported operator: {ast.unparse(node.op)}")
        return arithmetic(left, right)

    def _call(self, node: ast.Call, scope: _Scope) -> Any:
        if not isinstance(node.func, ast.Name) or len(node.args) != 1 or node.keywords:
            raise SyntaxError(f"unsupported call: {ast.unparse(node)}")
        name = node.func.id
        argument = node.args[0]
        if name in _CASTS:
            value = self.evaluate(argument, scope)
            if value is MISSING:
                return MISSING
            return str(value) if name == "str" else float(value)
        if name not in _QUANTIFIERS and name not in _REDUCERS:
            raise SyntaxError(f"unsupported call: `{name}`")
        if name == "len" and not isinstance(argument, ast.ListComp):
            raise SyntaxError("`len` takes a list comprehension")
        if not isinstance(argument, (ast.GeneratorExp, ast.ListComp)):
            raise SyntaxError(f"`{name}` takes a comprehension")
        values = [
            self.evaluate(argument.elt, inner) for inner in self._selected_elements(argument, scope)
        ]
        if name == "any":
            return any(value is True for value in values)
        if name == "all":
            return all(value is True for value in values)
        if name == "len":
            return len(values)
        present = [value for value in values if value is not MISSING]
        if name == "sum":
            return sum(present)
        if not present:
            return MISSING
        return max(present) if name == "max" else min(present)

    def _selected_elements(
        self,
        node: Union[ast.GeneratorExp, ast.ListComp],
        scope: _Scope,
    ) -> Iterator[_Scope]:
        if len(node.generators) != 1:
            raise SyntaxError("a comprehension takes exactly one `for` clause")
        generator = node.generators[0]
        if not isinstance(generator.target, ast.Name):
            raise SyntaxError("a comprehension loop variable must be a plain name")
        iterable, elements = self._iterable(generator.iter)
        for element in elements:
            inner = {**scope, generator.target.id: (iterable, element)}
            if all(self.evaluate(condition, inner) is True for condition in generator.ifs):
                yield inner

    def _iterable(self, node: ast.expr) -> tuple[str, tuple[Any, ...]]:
        if isinstance(node, ast.Name) and node.id in _ITERABLES:
            return node.id, _ITERABLES[node.id](self._trace)
        raise SyntaxError(f"unknown iterable: {ast.unparse(node)}")


def _attribute_path_keys(node: ast.Subscript) -> Optional[tuple[Union[str, int], ...]]:
    keys: list[Union[str, int]] = []
    current: ast.expr = node
    while isinstance(current, ast.Subscript):
        if not (
            isinstance(current.slice, ast.Constant)
            and isinstance(current.slice.value, (str, int))
            and not isinstance(current.slice.value, bool)
        ):
            return None
        keys.append(current.slice.value)
        current = current.value
    if not isinstance(current, ast.Name) or current.id not in ("attributes", "metadata"):
        return None
    if current.id == "metadata":
        keys.append("metadata")
    return tuple(reversed(keys))


def _wire_key_candidate_paths(keys: Sequence[str]) -> tuple[tuple[str, ...], ...]:
    segments = ".".join(keys).split(".")
    paths = [tuple(segments)]
    for index in range(len(segments) - 1, -1, -1):
        candidate = (*segments[:index], ".".join(segments[index:]))
        if candidate != paths[0]:
            paths.append(candidate)
    return tuple(paths)


def _traverse(value: Any, path: Sequence[Union[str, int]]) -> Any:
    for key in path:
        if isinstance(value, Mapping) and key in value:
            value = value[key]
        elif isinstance(value, (list, tuple)) and isinstance(key, int) and 0 <= key < len(value):
            value = value[key]
        else:
            return MISSING
    return MISSING if value is None else value


def _kleene_and(values: Sequence[Any]) -> Any:
    result: Any = True
    for value in values:
        if value is False:
            return False
        if value is not True:
            result = MISSING
    return result


def _kleene_or(values: Sequence[Any]) -> Any:
    result: Any = False
    for value in values:
        if value is True:
            return True
        if value is not False:
            result = MISSING
    return result


def _kleene_not(value: Any) -> Any:
    return MISSING if value is MISSING else not value


def _is_none_literal(node: ast.expr) -> bool:
    return isinstance(node, ast.Constant) and node.value is None


def _contains(haystack: Any, needle: Any) -> bool:
    if isinstance(haystack, (list, tuple)):
        return needle in haystack
    if isinstance(haystack, str) and isinstance(needle, str):
        return needle.lower() in haystack.lower()
    raise SyntaxError(f"`in` expects a list or a string, got {haystack!r}")


def _uppercase(value: Any) -> Any:
    if isinstance(value, str):
        return value.upper()
    if isinstance(value, (list, tuple)):
        return tuple(_uppercase(element) for element in value)
    return value


def _parse_datetime_literal(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


_BASE_TIME = datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc)

FIXTURE_TRACES: tuple[ReferenceTrace, ...] = (
    ReferenceTrace("empty", _BASE_TIME, _BASE_TIME),
    ReferenceTrace(
        "clean-chat",
        _BASE_TIME,
        _BASE_TIME + timedelta(milliseconds=1000.04),
        spans=(
            ReferenceSpan(
                "Chat",
                span_kind="llm",
                llm_token_count_prompt=10,
                llm_token_count_completion=5,
                attributes={
                    "input": {"value": "Hello there"},
                    "output": {"value": "Goodbye"},
                    "user": {"id": "u1"},
                    "metadata": {"tier": "gold"},
                    "llm": {"model_name": "gpt-4o"},
                },
            ),
            ReferenceSpan(
                "lookup",
                span_kind="tool",
                parent="root",
                llm_token_count_prompt=999,
                annotations=(ReferenceAnnotation("Correctness", label="correct", score=0.9),),
            ),
        ),
    ),
    ReferenceTrace(
        "errored",
        _BASE_TIME + timedelta(minutes=1),
        _BASE_TIME + timedelta(minutes=1, seconds=2),
        spans=(
            ReferenceSpan(
                "chat",
                llm_token_count_prompt=2,
                llm_token_count_completion=3,
                attributes={"input": {"value": "Please refund"}},
            ),
            ReferenceSpan("search", span_kind="TOOL", status_code="error", parent="root"),
        ),
    ),
    ReferenceTrace(
        "annotated",
        _BASE_TIME + timedelta(minutes=2),
        _BASE_TIME + timedelta(minutes=2, seconds=1),
        spans=(ReferenceSpan("chat", llm_token_count_prompt=None),),
        annotations=(
            ReferenceAnnotation("Quality", label="good", score=0.95),
            ReferenceAnnotation("Quality", label="bad", score=0.4, identifier="second"),
            ReferenceAnnotation("Quality", identifier="third"),
            ReferenceAnnotation("Coverage"),
        ),
    ),
    ReferenceTrace(
        "costed",
        _BASE_TIME + timedelta(minutes=3),
        _BASE_TIME + timedelta(minutes=3, milliseconds=1001),
        spans=(
            ReferenceSpan(
                "chat",
                llm_token_count_prompt=8,
                llm_token_count_completion=8,
                cost=ReferenceSpanCost(
                    prompt_cost=0.25,
                    completion_cost=0.5,
                    details=(
                        ReferenceCostDetail("input", True, 0.25, 100.0, 0.0025),
                        ReferenceCostDetail("output", False, 0.5, 200.0, 0.0025),
                        ReferenceCostDetail("audio", False),
                    ),
                ),
            ),
        ),
    ),
    ReferenceTrace(
        "orphan-only",
        _BASE_TIME + timedelta(minutes=4),
        _BASE_TIME + timedelta(minutes=4, seconds=1),
        spans=(
            ReferenceSpan(
                "orphan",
                attributes={"input": {"value": "orphan input"}, "user": {"id": "orphan"}},
                parent="missing-parent",
            ),
        ),
    ),
)

DIFFERENTIAL_CONDITIONS: tuple[str, ...] = (
    "error_count > 0",
    'any(s.status_code == "error" for s in spans)',
    'all(s.status_code == "OK" for s in spans)',
    "not any(s.llm_token_count_prompt > 100 for s in spans)",
    "all(s.llm_token_count_prompt < 100 for s in spans)",
    'input == "missing" and error_count == 0',
    'input == "missing" or error_count > 0',
    'not (input == "missing")',
    'any(s.span_kind == "tool" for s in spans)',
    "len([s for s in spans]) == num_spans",
    'len([s for s in spans if s.span_kind == "TOOL"]) == tool_span_count',
    'sum(s.llm_token_count_total for s in spans if s.span_kind == "LLM") == token_count_total',
    "sum(s.llm_token_count_prompt for s in spans) == 0",
    "max(s.llm_token_count_prompt for s in spans) is None",
    "not (max(s.llm_token_count_prompt for s in spans) < 100)",
    'min(s.latency_ms for s in spans if s.span_kind == "TOOL") is None',
    "token_count_total > 10 and total_cost == 0",
    "total_cost > 0.5 and prompt_cost == 0.25",
    'any(a.name == "Quality" and a.score > 0.5 for a in trace_annotations)',
    "all(a.score is not None for a in trace_annotations)",
    'any(a.label == "correct" for a in span_annotations)',
    'any(d.token_type == "output" and d.cost > 0 for d in span_cost_details)',
    "sum(d.tokens for d in span_cost_details) > 100",
    'annotations["Quality"]',
    'annotations["Quality"].score > 0.9',
    'annotations["Quality"].score > 0.5 and annotations["Quality"].label == "good"',
    'annotations["Quality"].score is None',
    'annotations["Missing"].score > 0',
    '"hello" in input',
    'input == "Hello there"',
    'output == "Goodbye"',
    'user.id == "u1"',
    'metadata["tier"] == "gold"',
    '"GPT" in attributes["llm.model_name"]',
    'attributes["llm"]["model_name"] == "gpt-4o"',
    "input is None",
    '"orphan" in input',
    'start_time >= "2026-07-01T12:02:00Z"',
    'end_time < "2026-07-01T12:03:02Z"',
    "latency_ms == 1000.0",
    "latency_ms >= 1000.1",
    '"CHAT" in trace_id',
    'trace_id == "CLEAN"',
    'any("CHAT" in s.name for s in spans)',
    'any(s.name == "Chat" for s in spans)',
)
