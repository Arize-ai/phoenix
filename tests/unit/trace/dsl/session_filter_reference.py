"""Reference semantics for the session filter DSL, as executable Python.

`matches` evaluates a filter condition directly over the in-memory fixture sessions defined
here, independently of the SQLAlchemy translation in `phoenix.trace.dsl.session_filter`. The
differential suite in `test_session_filter.py` seeds the same fixtures into the database and
asserts the compiled row set equals this module's selection.

String containment (`in`) ignores case at this grain, while equality stays exact — see
`_contains`.

An absent value is `MISSING`, and every comparison it takes part in evaluates to `MISSING`
rather than to True or False, so a session is selected only when the whole condition
evaluates to exactly True. Reductions skip missing values: `len`/`sum` of nothing is 0, while
`max`/`min` of nothing is `MISSING`.

Modeled: session intrinsics, the flat aggregate names, the comprehension grammar over the five
iterables, root-span `attributes[...]` / `metadata[...]` access resolved by OTel wire key, the
root-span IO names (`first_input`, `last_output`, `any_input`, `any_output`), and the
`annotations[...]` subscript.

`annotations["q"]` compiles to an outer join on the annotation relation, so a session with
several rows under one name is several candidate rows and matches when *any* of them satisfies
the whole condition. That is modeled here by binding one row per referenced annotation name and
trying every combination — the same reason two spellings of one name share a row while two
different names vary independently.
"""

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
"""An absent value: every comparison it takes part in yields `MISSING`, never True or False."""

_INPUT_VALUE_PATH: tuple[str, ...] = ("input", "value")
_OUTPUT_VALUE_PATH: tuple[str, ...] = ("output", "value")
_EXISTS_NAME_PATHS: Mapping[str, tuple[str, ...]] = {
    "any_input": _INPUT_VALUE_PATH,
    "any_output": _OUTPUT_VALUE_PATH,
}


@dataclass(frozen=True)
class ReferenceAnnotation:
    name: str
    label: Optional[str] = None
    score: Optional[float] = None
    # Annotations are unique on (name, entity, identifier), so several rows can share one name.
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
    # The root-span names read parentless spans only, so a child span's IO is not the session's.
    is_root: bool = True

    @property
    def llm_token_count_total(self) -> int:
        """Mirrors the coalescing `Span.llm_token_count_total` hybrid, so it is never missing."""
        return (self.llm_token_count_prompt or 0) + (self.llm_token_count_completion or 0)


@dataclass(frozen=True)
class ReferenceTurn:
    start_time: datetime
    latency_ms: float
    spans: tuple[ReferenceSpan, ...] = ()

    @property
    def end_time(self) -> datetime:
        return self.start_time + timedelta(milliseconds=self.latency_ms)


@dataclass(frozen=True)
class ReferenceSession:
    session_id: str
    start_time: datetime
    end_time: datetime
    turns: tuple[ReferenceTurn, ...] = ()
    annotations: tuple[ReferenceAnnotation, ...] = ()

    @property
    def spans(self) -> tuple[ReferenceSpan, ...]:
        return tuple(span for turn in self.turns for span in turn.spans)

    @property
    def root_spans(self) -> tuple[ReferenceSpan, ...]:
        """Every parentless span, earliest turn first — the universe the IO names read."""
        return tuple(span for turn in self.turns for span in turn.spans if span.is_root)

    @property
    def root_span_attributes(self) -> Mapping[str, Any]:
        """The earliest root span's attributes — what `attributes[...]` / `metadata[...]` read."""
        roots = self.root_spans
        return (roots[0].attributes or {}) if roots else {}

    @property
    def first_input(self) -> Any:
        return self._root_span_io(0, _INPUT_VALUE_PATH)

    @property
    def last_output(self) -> Any:
        return self._root_span_io(-1, _OUTPUT_VALUE_PATH)

    def _root_span_io(self, index: int, path: Sequence[str]) -> Any:
        """One end of the root-span window. The path is read literally, not by wire key: the
        compiler's window subquery indexes the stored JSON directly."""
        roots = self.root_spans
        return _traverse(roots[index].attributes or {}, path) if roots else MISSING

    def any_root_span_io(self, path: Sequence[str]) -> tuple[Any, ...]:
        """Every root span's value at `path` — the universe `any_input` / `any_output` search."""
        return tuple(_traverse(span.attributes or {}, path) for span in self.root_spans)

    def annotations_named(self, name: str) -> tuple[ReferenceAnnotation, ...]:
        return tuple(annotation for annotation in self.annotations if annotation.name == name)

    @property
    def span_costs(self) -> tuple[ReferenceSpanCost, ...]:
        return tuple(span.cost for span in self.spans if span.cost is not None)

    @property
    def duration_ms(self) -> float:
        return round((self.end_time - self.start_time).total_seconds() * 1000, 1)

    @property
    def num_traces(self) -> int:
        return len(self.turns)

    @property
    def num_traces_with_error(self) -> int:
        return sum(
            1 for turn in self.turns if any(span.status_code == "ERROR" for span in turn.spans)
        )

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
    def _llm_spans(self) -> tuple[ReferenceSpan, ...]:
        return tuple(span for span in self.spans if span.span_kind.upper() == "LLM")

    def _span_kind_count(self, span_kind: str) -> int:
        return sum(1 for span in self.spans if span.span_kind.upper() == span_kind)


_FLAT_NAMES: frozenset[str] = frozenset(
    {
        "session_id",
        "start_time",
        "end_time",
        "duration_ms",
        "num_traces",
        "num_traces_with_error",
        "token_count_prompt",
        "token_count_completion",
        "token_count_total",
        "prompt_cost",
        "completion_cost",
        "total_cost",
        "tool_span_count",
        "llm_span_count",
        "first_input",
        "last_output",
    }
)

_SESSION_ITERABLES: Mapping[str, Callable[[ReferenceSession], tuple[Any, ...]]] = {
    "spans": lambda session: session.spans,
    "traces": lambda session: session.turns,
    "session_annotations": lambda session: session.annotations,
    "span_annotations": lambda session: tuple(
        annotation for span in session.spans for annotation in span.annotations
    ),
    "span_cost_details": lambda session: tuple(
        detail for cost in session.span_costs for detail in cost.details
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
    "traces": frozenset({"start_time", "end_time", "latency_ms"}),
    "session_annotations": frozenset({"name", "label", "score"}),
    "span_annotations": frozenset({"name", "label", "score"}),
    "span_cost_details": frozenset({"token_type", "is_prompt", "cost", "tokens", "cost_per_token"}),
}

_NESTED_ITERABLES: Mapping[str, Mapping[str, str]] = {"traces": {"spans": "spans"}}

_UPPERCASE_FIELDS: frozenset[str] = frozenset({"span_kind", "status_code"})
_DATETIME_FIELDS: frozenset[str] = frozenset({"start_time", "end_time"})

_QUANTIFIERS: frozenset[str] = frozenset({"any", "all"})
_REDUCERS: frozenset[str] = frozenset({"len", "max", "min", "sum"})
_CASTS: frozenset[str] = frozenset({"str", "float", "int"})

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


def matches(condition: str, session: ReferenceSession) -> bool:
    """Whether `session` satisfies `condition` — true only when the condition is exactly True.

    Each referenced annotation name contributes one candidate row (or a single absent row when
    the session carries none), and the session matches if any combination of them satisfies the
    whole condition — the outer join plus `DISTINCT` the compiler emits, read as Python.
    """
    tree = ast.parse(condition, mode="eval").body
    names = sorted(_annotation_names(tree))
    candidates = [session.annotations_named(name) or (None,) for name in names]
    return any(
        _Evaluator(session, dict(zip(names, rows))).evaluate(tree, {}) is True
        for rows in product(*candidates)
    )


def _annotation_names(tree: ast.expr) -> set[str]:
    names = (_annotation_key(node) for node in ast.walk(tree) if isinstance(node, ast.expr))
    return {name for name in names if name is not None}


def _annotation_key(node: ast.expr) -> Optional[str]:
    """The annotation name an `annotations["..."]` subscript reads, if that is what this is."""
    if (
        isinstance(node, ast.Subscript)
        and isinstance(node.value, ast.Name)
        and node.value.id in ("annotations", "evals")
        and isinstance(node.slice, ast.Constant)
        and isinstance(key := node.slice.value, str)
    ):
        return key
    return None


def matching_session_ids(
    condition: str,
    sessions: Sequence[ReferenceSession],
) -> set[str]:
    """The `session_id`s of every fixture session the condition selects."""
    return {session.session_id for session in sessions if matches(condition, session)}


class _Evaluator:
    def __init__(
        self,
        session: ReferenceSession,
        annotations: Optional[Mapping[str, Optional[ReferenceAnnotation]]] = None,
    ) -> None:
        self._session = session
        self._annotations = annotations or {}

    def evaluate(self, node: ast.expr, scope: _Scope) -> Any:
        if isinstance(node, ast.BoolOp):
            values = [self.evaluate(value, scope) for value in node.values]
            if isinstance(node.op, ast.And):
                return _kleene_and(values)
            return _kleene_or(values)
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
            return self._element_field(node, scope)
        if isinstance(node, ast.Subscript):
            if (key := _annotation_key(node)) is not None:
                # A bare annotation reference is an existence check, so it is a value already.
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
            return getattr(self._session, node.id)
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
        attributes = self._session.root_span_attributes
        if not all(isinstance(key, str) for key in keys):
            return _traverse(attributes, keys)
        for path in _wire_key_candidate_paths([str(key) for key in keys]):
            value = _traverse(attributes, path)
            if value is not MISSING:
                return value
        return MISSING

    def _compare_links(self, node: ast.Compare, scope: _Scope) -> Iterator[Any]:
        left = node.left
        for op, right in zip(node.ops, node.comparators):
            yield self._compare(left, op, right, scope)
            left = right

    def _compare(
        self, left_node: ast.expr, op: ast.cmpop, right_node: ast.expr, scope: _Scope
    ) -> Any:
        if (
            isinstance(op, (ast.In, ast.NotIn))
            and isinstance(right_node, ast.Name)
            and (path := _EXISTS_NAME_PATHS.get(right_node.id)) is not None
        ):
            # EXISTS / NOT EXISTS over the session's root spans: a boolean either way, so a
            # session with no input at all is matched by `not in` rather than dropped.
            needle = self.evaluate(left_node, scope)
            found = any(
                value is not MISSING and _contains(value, needle)
                for value in self._session.any_root_span_io(path)
            )
            return found if isinstance(op, ast.In) else not found
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
        # The compiler uppercases both sides of a comparison against an uppercase-normalized
        # field, so stored casing never decides the outcome.
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
        # The compiler guards division denominators with nullif, so a zero divisor is missing
        # rather than a dialect-divergent error.
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
            raise SyntaxError("`len` takes a list comprehension, not a generator expression")
        if not isinstance(argument, (ast.GeneratorExp, ast.ListComp)):
            raise SyntaxError(f"`{name}` takes a comprehension over an iterable")
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
        iterable, elements = self._iterable(generator.iter, scope)
        for element in elements:
            inner = {**scope, generator.target.id: (iterable, element)}
            if all(self.evaluate(condition, inner) is True for condition in generator.ifs):
                yield inner

    def _iterable(self, node: ast.expr, scope: _Scope) -> tuple[str, tuple[Any, ...]]:
        if isinstance(node, ast.Name) and node.id in _SESSION_ITERABLES:
            return node.id, _SESSION_ITERABLES[node.id](self._session)
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in scope
        ):
            outer_iterable, outer_element = scope[node.value.id]
            nested = _NESTED_ITERABLES.get(outer_iterable, {})
            if node.attr in nested:
                return nested[node.attr], tuple(getattr(outer_element, node.attr))
        raise SyntaxError(f"unknown iterable: {ast.unparse(node)}")


def _attribute_path_keys(node: ast.Subscript) -> Optional[tuple[Union[str, int], ...]]:
    """The key chain of an `attributes[...]` / `metadata[...]` subscript, `metadata` desugared."""
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
    """The compiler's candidate family, derived independently: the fully dot-split path first,
    then each shape with a literal remainder from one boundary onward."""
    segments = ".".join(keys).split(".")
    paths = [tuple(segments)]
    for j in range(len(segments) - 1, -1, -1):
        candidate = (*segments[:j], ".".join(segments[j:]))
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
        # Session-grain string containment ignores case; membership in a literal list, and
        # equality anywhere, stay exact.
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

# One corpus, executed two ways: seeded into the database for the compiled filter, and read
# directly by the reference evaluator. Between them the fixtures straddle every boundary the
# comprehension grammar has — a session with no members at all, missing element fields under
# both quantifiers and every reduction, an `if` clause that selects nothing, a turn with no
# LLM span, and each of the five iterables.
FIXTURE_SESSIONS: tuple[ReferenceSession, ...] = (
    ReferenceSession(session_id="no-turns", start_time=_BASE_TIME, end_time=_BASE_TIME),
    ReferenceSession(
        session_id="clean",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=10),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=1000.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        llm_token_count_prompt=10,
                        llm_token_count_completion=5,
                        attributes={"input": {"value": "hello there"}},
                    ),
                    ReferenceSpan(
                        name="chat",
                        latency_ms=200.0,
                        llm_token_count_prompt=20,
                        llm_token_count_completion=5,
                        attributes={"output": {"value": "goodbye"}},
                        cost=ReferenceSpanCost(
                            prompt_cost=0.125,
                            details=(
                                ReferenceCostDetail(
                                    token_type="input",
                                    is_prompt=True,
                                    cost=0.125,
                                    tokens=50.0,
                                    cost_per_token=0.0025,
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="errored",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=30),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=1000.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        llm_token_count_prompt=1,
                        llm_token_count_completion=1,
                        attributes={"input": {"value": "please refund my order"}},
                    ),
                    # A child span: its input is not the session's, so `any_input` must not see it.
                    ReferenceSpan(
                        name="search",
                        span_kind="TOOL",
                        status_code="ERROR",
                        latency_ms=50.0,
                        attributes={"input": {"value": "internal tool payload"}},
                        is_root=False,
                    ),
                ),
            ),
            ReferenceTurn(
                start_time=_BASE_TIME + timedelta(seconds=10),
                latency_ms=2000.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=1500.0,
                        llm_token_count_prompt=2,
                        llm_token_count_completion=2,
                        attributes={"output": {"value": "sorry about that"}},
                    ),
                ),
            ),
            # A turn with no LLM span at all, so `all(any(...))` over turns has a counterexample.
            ReferenceTurn(
                start_time=_BASE_TIME + timedelta(seconds=20),
                latency_ms=500.0,
                spans=(ReferenceSpan(name="cleanup", span_kind="TOOL", latency_ms=40.0),),
            ),
        ),
    ),
    ReferenceSession(
        session_id="null-tokens",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=5),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=500.0,
                spans=(
                    ReferenceSpan(name="chat", latency_ms=100.0),
                    ReferenceSpan(name="chat", latency_ms=300.0, llm_token_count_prompt=50),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="tools",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=2),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=200.0,
                spans=(
                    ReferenceSpan(name="chat", latency_ms=50.0),
                    ReferenceSpan(name="search", span_kind="TOOL", latency_ms=10.0),
                    ReferenceSpan(name="search", span_kind="TOOL", latency_ms=20.0),
                    ReferenceSpan(name="lookup", span_kind="TOOL", latency_ms=30.0),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="slow",
        start_time=_BASE_TIME + timedelta(hours=2),
        end_time=_BASE_TIME + timedelta(hours=2, seconds=20),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME + timedelta(hours=2),
                latency_ms=6000.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=5900.0,
                        llm_token_count_prompt=100,
                        llm_token_count_completion=100,
                        attributes={"input": {"value": "Hello Slow"}},
                    ),
                ),
            ),
            ReferenceTurn(
                start_time=_BASE_TIME + timedelta(hours=2, seconds=10),
                latency_ms=7000.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=6800.0,
                        llm_token_count_prompt=100,
                        llm_token_count_completion=100,
                        attributes={"output": {"value": "done"}},
                    ),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="annotated",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=5),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=500.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        llm_token_count_prompt=5,
                        llm_token_count_completion=5,
                        annotations=(
                            ReferenceAnnotation(name="Hallucination", label="correct", score=0.8),
                        ),
                    ),
                ),
            ),
        ),
        # Several rows share the name `Quality`, one of them with neither label nor score: the
        # shape that makes `annotations["Quality"]` a set of candidate rows rather than a value.
        annotations=(
            ReferenceAnnotation(name="Quality", label="good", score=0.95),
            ReferenceAnnotation(name="Quality", label="bad", score=0.4, identifier="second"),
            ReferenceAnnotation(name="Quality", identifier="third"),
            ReferenceAnnotation(name="Coverage"),
        ),
    ),
    # One annotation under the same name, scoring below every threshold the corpus asks about.
    ReferenceSession(
        session_id="annotated-low",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=5),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=500.0,
                spans=(ReferenceSpan(name="chat", latency_ms=100.0),),
            ),
        ),
        annotations=(ReferenceAnnotation(name="Quality", label="bad", score=0.3),),
    ),
    # Root-span attribute storage shapes for wire-key resolution: fully nested, whole-literal,
    # both shapes at once (the full split must win), and a prefix collision whose remainder is a
    # literal key. Every other session misses these keys entirely.
    ReferenceSession(
        session_id="attr-nested",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=1),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=100.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        attributes={
                            "llm": {"model_name": "gpt-4o"},
                            "metadata": {"tier": "gold"},
                            "docs": [{"score": 0.5}],
                        },
                    ),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="attr-literal",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=1),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=100.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        attributes={"llm.model_name": "gpt-4o-mini"},
                    ),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="attr-shadowed",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=1),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=100.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        attributes={
                            "llm": {"model_name": "gpt-4o"},
                            "llm.model_name": "claude-3-5-sonnet",
                        },
                    ),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="attr-collision",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=1),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=100.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        attributes={"a": {"b": 1, "b.c": 2}},
                    ),
                ),
            ),
        ),
    ),
    ReferenceSession(
        session_id="costed",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=5),
        turns=(
            ReferenceTurn(
                start_time=_BASE_TIME,
                latency_ms=500.0,
                spans=(
                    ReferenceSpan(
                        name="chat",
                        latency_ms=100.0,
                        llm_token_count_prompt=8,
                        llm_token_count_completion=8,
                        cost=ReferenceSpanCost(
                            prompt_cost=0.25,
                            completion_cost=0.5,
                            details=(
                                ReferenceCostDetail(
                                    token_type="input",
                                    is_prompt=True,
                                    cost=0.25,
                                    tokens=100.0,
                                    cost_per_token=0.0025,
                                ),
                                ReferenceCostDetail(
                                    token_type="output",
                                    is_prompt=False,
                                    cost=0.5,
                                    tokens=200.0,
                                    cost_per_token=0.0025,
                                ),
                                ReferenceCostDetail(token_type="audio", is_prompt=False),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    ),
)

DIFFERENTIAL_CONDITIONS: tuple[str, ...] = (
    # Quantifiers over spans, including the vacuous `all` and the uppercase-coerced comparand.
    'any(s.status_code == "ERROR" for s in spans)',
    'all(s.status_code == "OK" for s in spans)',
    'any(s.span_kind == "tool" for s in spans)',
    'not any(s.name == "search" for s in spans)',
    # A missing element field is a counterexample under `all` and never a match under `any`.
    "all(s.llm_token_count_prompt < 1000 for s in spans)",
    "any(s.llm_token_count_prompt > 5 for s in spans)",
    "all(s.llm_token_count_prompt is not None for s in spans)",
    # Reductions, their empty-selection results, and the `if` clause.
    'len([s for s in spans if s.span_kind == "TOOL"]) >= 2',
    "len([s for s in spans]) == 0",
    "sum(s.llm_token_count_prompt for s in spans) > 30",
    "sum(s.llm_token_count_prompt for s in spans) == 0",
    "max(s.latency_ms for s in spans) > 1000",
    'min(s.latency_ms for s in spans if s.span_kind == "TOOL") < 30',
    "max(s.llm_token_count_prompt for s in spans) is None",
    "not (max(s.latency_ms for s in spans) < 1000)",
    # Reductions agree with the flat aggregates computed over the same rows.
    'sum(s.llm_token_count_total for s in spans if s.span_kind == "LLM") == token_count_total',
    "len([t for t in traces]) == num_traces",
    'len([s for s in spans if s.span_kind == "TOOL"]) == tool_span_count',
    # Turns, their datetime fields, and turn -> span nesting.
    "any(t.latency_ms > 5000 for t in traces)",
    "any(t.start_time > '2026-07-01T13:00:00+00:00' for t in traces)",
    'any(any(s.status_code == "ERROR" for s in t.spans) for t in traces)',
    'all(any(s.span_kind == "LLM" for s in t.spans) for t in traces)',
    # Annotations at both grains, and cost details.
    'any(a.name == "Quality" and a.score > 0.5 for a in session_annotations)',
    "all(a.score is not None for a in session_annotations)",
    'any(a.label == "correct" for a in span_annotations)',
    'any(d.token_type == "output" and d.cost > 0 for d in span_cost_details)',
    "sum(d.tokens for d in span_cost_details) > 100",
    # Composition with the flat names the comprehension grammar sits alongside.
    'duration_ms > 5000 and any(s.span_kind == "TOOL" for s in spans)',
    'num_traces >= 2 or len([s for s in spans if s.status_code == "ERROR"]) > 0',
    "num_traces >= 1 and total_cost > 0.1",
    # Root-span attributes resolve by wire key: both spellings of one key, either storage shape,
    # full-split precedence when shapes coexist, the collision remainder, a raw numeric path,
    # and the miss (a missing key fails every comparison).
    'attributes["llm.model_name"] == "gpt-4o"',
    'attributes["llm"]["model_name"] == "gpt-4o"',
    '"gpt" in attributes["llm.model_name"]',
    '"gpt" in attributes["llm"]["model_name"]',
    'attributes["llm.model_name"] == "claude-3-5-sonnet"',
    'attributes["a.b.c"] == 2',
    'attributes["a"]["b"] == 1',
    'attributes["docs"][0]["score"] > 0.4',
    'attributes["llm.model_name"] is None',
    'metadata["tier"] == "gold"',
    'num_traces >= 1 and attributes["llm.model_name"] is not None',
    # Case polarity: `in` over a string haystack ignores case wherever the haystack comes from
    # — a session column, a root-span attribute, or an element field — including a needle that
    # lands mid-string and one that the uppercase-coerced fields rewrite first. `==` is exact,
    # and membership in a literal list is unaffected.
    '"GPT" in attributes["llm.model_name"]',
    '"4O" in attributes["llm.model_name"]',
    'attributes["llm.model_name"] == "GPT-4O"',
    '"ATTR" in session_id',
    'session_id == "ATTR-NESTED"',
    'any("SEARCH" in s.name for s in spans)',
    'any("too" in s.span_kind for s in spans)',
    'any("CORRECT" in a.label for a in span_annotations)',
    'any(a.label == "CORRECT" for a in span_annotations)',
    'any(a.name in ["Quality", "Coverage"] for a in session_annotations)',
    'any(a.name in ["QUALITY"] for a in session_annotations)',
    # Root-span IO names. `first_input` / `last_output` read the two ends of the root-span window
    # and are SQL null when that end records nothing, so `not in` and `==` exclude those
    # sessions; `any_input` / `any_output` are EXISTS over every root span, so `not in` matches a
    # session with no input at all. A child span's IO belongs to neither.
    "'hello' in first_input",
    "'HELLO' in first_input",
    "'hello' not in first_input",
    "first_input == 'hello there'",
    "first_input is None",
    "first_input is not None",
    "'bye' in last_output",
    "'done' in last_output",
    "last_output is None",
    "'refund' in any_input",
    "'REFUND' in any_input",
    "'refund' not in any_input",
    "'internal' in any_input",
    "'sorry' in any_output",
    "'sorry' not in any_output",
    "'hello' in any_input and num_traces > 0",
    "'hello' in first_input or 'hello' in last_output",
    # Annotation point access: several rows can share one name, so the subscript is existential
    # over them, and two attributes of one name read the same row.
    'annotations["Quality"]',
    'annotations["Missing"]',
    'annotations["Quality"].score > 0.9',
    'annotations["Quality"].score > 0.5',
    'annotations["Quality"].label == "good"',
    'annotations["Quality"].score > 0.5 and annotations["Quality"].label == "good"',
    'annotations["Quality"].score > 0.5 and annotations["Quality"].label == "bad"',
    'annotations["Quality"].score is None',
    'annotations["Missing"].score > 0',
    'annotations["Quality"].score > 0.5 and num_traces > 0',
)

# `annotations["q"].<attr>` and the equivalent quantification over `session_annotations` are two
# grammars over one table — an aliased outer join versus an EXISTS. Where they overlap they must
# select the same sessions, whatever the row multiplicity under a name.
AGREEMENT_PAIRS: tuple[tuple[str, str], ...] = (
    (
        'annotations["Quality"]',
        'any(a.name == "Quality" for a in session_annotations)',
    ),
    (
        'annotations["Quality"].score > 0.9',
        'any(a.name == "Quality" and a.score > 0.9 for a in session_annotations)',
    ),
    (
        'annotations["Quality"].label == "good"',
        'any(a.name == "Quality" and a.label == "good" for a in session_annotations)',
    ),
    (
        'annotations["Quality"].score > 0.5 and annotations["Quality"].label == "good"',
        'any(a.name == "Quality" and a.score > 0.5 and a.label == "good" '
        "for a in session_annotations)",
    ),
    (
        'annotations["Missing"].score > 0',
        'any(a.name == "Missing" and a.score > 0 for a in session_annotations)',
    ),
)
