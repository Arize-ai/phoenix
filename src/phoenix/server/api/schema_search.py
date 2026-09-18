"""Searchable sub-graph of the GraphQL schema for agents.

``build_index`` runs once per schema. ``search`` ranks hits for free text,
``lookup`` renders one type, field, or mutation in full with the path that
reaches it, and ``describe`` answers several of either within one budget.
Every renderer works to a character budget.
"""

from __future__ import annotations

import datetime
import decimal
import difflib
import enum
import functools
import heapq
import itertools
import json
import math
import re
import threading
from collections import Counter, OrderedDict, defaultdict, deque
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from typing import Iterable, Iterator, Mapping, Optional, Sequence, Union, cast

import snowballstemmer
from graphql import (
    GraphQLArgument,
    GraphQLEnumType,
    GraphQLEnumValue,
    GraphQLField,
    GraphQLInputField,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInt,
    GraphQLInterfaceType,
    GraphQLList,
    GraphQLNamedType,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLScalarType,
    GraphQLSchema,
    GraphQLUnionType,
    get_named_type,
    is_introspection_type,
    specified_scalar_types,
)
from graphql.execution.values import get_argument_values
from graphql.language import (
    ArgumentNode,
    FieldNode,
    ListValueNode,
    NameNode,
    ObjectValueNode,
    ValueNode,
    parse_const_value,
    parse_value,
    print_ast,
)
from graphql.pyutils import Undefined, is_collection
from graphql.utilities import ast_from_value, value_from_ast

__all__ = [
    "READ_ROOTS",
    "Index",
    "Unit",
    "build_index",
    "cached_index",
    "describe",
    "lookup",
    "lookup_many",
    "reach_paths",
    "search",
    "search_many",
    "tokenize",
]

# Entity types an agent starts from, after the schema's own query root. Reach
# paths are measured from the nearest of these, so a hit on a leaf type says
# how to get there from something the agent already knows how to fetch. Names
# absent from a schema are ignored.
READ_ROOTS: tuple[str, ...] = (
    "Project",
    "Span",
    "Trace",
    "ProjectSession",
    "SpanAnnotation",
    "Dataset",
    "DatasetExample",
    "DatasetVersion",
    "Experiment",
    "ExperimentRun",
    "Prompt",
    "PromptVersion",
)
_STOPWORDS = frozenset(
    {
        "a",
        "all",
        "an",
        "and",
        "by",
        "find",
        "for",
        "get",
        "how",
        "in",
        "of",
        "on",
        "the",
        "to",
        "with",
    }
)
_CAMEL = re.compile(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+")
_WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_NAME = re.compile(r"[_A-Za-z][_0-9A-Za-z]*")
# BM25F field weights: a match on the unit's own name outranks one on an
# argument, which outranks one on the parent type or in the description.
_FIELD_WEIGHTS: Mapping[str, float] = {"name": 3.0, "ident": 2.0, "parent": 0.5, "desc": 1.0}
_K1, _B = 1.2, 0.3
# A unit inherits a share of its owning type's own score, and units closer to
# a read root are boosted by up to this fraction, normalized over the matches.
_PARENT_SHARE = 0.2
_SHORT_PATH_BOOST = 0.5
_MAX_DEPTH = 4
_REACH_PATHS = 3
# Scoring is linear in query terms times units, so a query is bounded before
# any of it is stemmed or scored.
_MAX_QUERY_CHARS = 500
_MAX_QUERY_TERMS = 32
_MAX_STEM_CHARS = 40

_FieldLike = Union[GraphQLField, GraphQLInputField]
_ObjectLike = Union[GraphQLObjectType, GraphQLInterfaceType]
_ValueDef = Union[GraphQLArgument, GraphQLInputField]

# The pure-Python stemmer keeps working state on the instance, so calls are serialized.
_stemmer = snowballstemmer.stemmer("english")
_stemmer_lock = threading.Lock()


def tokenize(identifier: str) -> list[str]:
    """Split a camelCase or snake_case identifier into lowercase word tokens."""
    return [t.lower() for part in identifier.split("_") for t in _CAMEL.findall(part)]


# The schema vocabulary is about a thousand stems; the rest of the cache holds
# query words and evicts the least recently used once full.
@functools.lru_cache(maxsize=8192)
def _stem_cached(word: str) -> str:
    with _stemmer_lock:
        return str(_stemmer.stemWord(word))


def _stem(word: str) -> str:
    return word if len(word) > _MAX_STEM_CHARS else _stem_cached(word)


def _clip(text: str) -> str:
    """Caller text bounded before any of it is scanned, stemmed, or echoed. A cut
    ends in an ellipsis, so a cut name never spells another name."""
    text = text[: _MAX_QUERY_CHARS * 4].strip()
    return text if len(text) <= _MAX_QUERY_CHARS else text[:_MAX_QUERY_CHARS] + "…"


_MAX_ECHO = 80


def _echo(text: str) -> str:
    """Caller text as a message quotes it back: printable, and bounded even once
    ``repr`` has escaped it."""
    text = "".join(ch if ch.isprintable() else "\ufffd" for ch in text)
    shown = text[:_MAX_ECHO]
    while shown and len(repr(shown)) > _MAX_ECHO + 2:
        shown = shown[:-1]
    return shown if shown == text else shown + "…"


def _fit(text: str, budget: int) -> str:
    """``text`` within ``budget``, cut at a line end when one fits, else hard."""
    if len(text) <= budget:
        return text
    cut = text.rfind("\n", 0, budget + 1)
    return text[:cut] if cut > 0 else text[:budget]


def _expand(word: str) -> list[str]:
    """The word itself, plus its parts when it is a compound identifier."""
    parts = tokenize(word)
    return [word.lower(), *parts] if len(parts) > 1 else [word.lower()]


def _terms(text: Optional[str]) -> list[str]:
    """Stemmed tokens of free text; identifiers inside it contribute their parts."""
    return [_stem(t) for w in _WORD.findall(text or "") for t in _expand(w)]


def _ident_terms(identifier: str) -> list[str]:
    return [_stem(t) for t in tokenize(identifier)]


def _query_terms(query: str) -> list[str]:
    words = [w for w in _WORD.findall(query[:_MAX_QUERY_CHARS]) if w.lower() not in _STOPWORDS]
    tokens = [t for w in words for t in _expand(w)]
    return [_stem(t) for t in tokens[:_MAX_QUERY_TERMS]]


_MUTATION_TERM = _stem("mutation")
"""The query word that restricts a search to mutations."""
_MUTATIONS_ONLY = "# mutations only"


def _asks_mutations_only(query: str) -> bool:
    """Whether ``query`` contains "mutation" or "mutations" as a word of its own.

    The word inside an identifier such as ``DatasetMutationPayload`` names a
    type and does not filter.
    """
    return any(w.lower() in ("mutation", "mutations") for w in _WORD.findall(query))


@dataclass(frozen=True)
class Unit:
    kind: str  # field | mutation | input | enum | type
    parent: str  # owning type; "" for kind == "type"
    name: str
    signature: str
    return_type: str  # named return type; "" for enum values and types
    description: str
    terms: Mapping[str, Counter[str]]  # BM25F fields: name, ident, parent, desc

    @property
    def label(self) -> str:
        return f"{self.parent}.{self.name}" if self.parent else self.name

    @property
    def owner(self) -> str:
        return self.name if self.kind == "type" else self.parent


@dataclass
class Index:
    schema: GraphQLSchema
    query_root: str
    mutation_root: Optional[str]
    action_verbs: frozenset[str]  # stemmed leading token of every mutation name
    roots: frozenset[str]
    includes_mutations: bool
    excluded_mutations: Mapping[str, frozenset[str]]  # lowercase name -> its stemmed tokens
    units: list[Unit]
    idf: Mapping[str, float]
    avg_len: Mapping[str, float]
    nearest: Mapping[str, tuple[str, int, tuple[str, ...]]]  # type -> (root, depth, hops)
    used_by: Mapping[str, list[str]]  # input or enum type -> referencing "Type.field"
    returned_by: Mapping[str, list[str]]  # object type -> "Type.field" returning it
    by_key: Mapping[str, Unit]  # "Type", "Type.field", "mutationName"
    folded: Mapping[str, Unit]  # lowercase key -> its unit, when only one spelling has it
    by_member: Mapping[tuple[str, str], Unit]  # (owner, lowercase member) -> unit, when unique
    plumbing: frozenset[str]  # Relay wrapper types left out of the index
    owners: frozenset[str]  # every type that owns an indexed member, wrappers included
    aliases: frozenset[str]  # bare mutation names that resolve on their own

    def type_name(self, asked: str) -> Optional[str]:
        """The schema type or bare mutation name ``asked`` spells: exactly, else
        case-insensitively when unique. Scalars, wrappers, and hidden types count,
        so a name is never read as a different one merely because that one is indexed."""
        if asked.startswith("__"):
            return _by_case([n for n in self.schema.type_map if n.startswith("__")], asked)
        names = [n for n in self.schema.type_map if not n.startswith("__")]
        return _by_case([*names, *self.aliases], asked)

    def resolve(self, name: str) -> Optional[Unit]:
        """The indexed unit ``name`` denotes, or None. A dotted name's owner is
        resolved on its own first, then the member within that owner."""
        if (u := self.by_key.get(name)) is not None:
            return u
        owner, dot, member = name.partition(".")
        if not dot:
            n = self.type_name(name)
            return self.by_key.get(n) if n is not None else None
        exact = self.type_name(owner)
        if exact is None or exact in self.aliases:
            return None
        if (u := self.by_key.get(f"{exact}.{member}")) is not None:
            return u
        if exact in self.plumbing:
            t = self.schema.type_map[exact]
            assert isinstance(t, GraphQLObjectType)
            # A wrapper's own Relay field is explained, never looked up as a member;
            # a member spelled exactly wins over one that merely folds to it.
            field = _by_case(t.fields, member)
            if field is not None and field not in _wrapper_extras(t, self.schema):
                return None
        return self.by_member.get((exact, member.lower()))

    def owner(self, name: str) -> Optional[str]:
        """The type ``name`` denotes as an owner of indexed members, wrappers included."""
        n = self.type_name(name)
        return n if n is not None and (n in self.owners or n in self.plumbing) else None

    def depth(self, type_name: str) -> int:
        return self.nearest.get(type_name, ("", _MAX_DEPTH, ()))[1]

    def via(self, type_name: str) -> str:
        root, _, hops = self.nearest.get(type_name, ("", _MAX_DEPTH, ()))
        if not root:
            return ""
        return " > ".join(hops) if hops else root


# --- index -----------------------------------------------------------------------


_PAGE_INFO_FIELDS = frozenset({"hasNextPage", "hasPreviousPage", "startCursor", "endCursor"})


_PAGE_INFO_TYPES = {
    "hasNextPage": "Boolean",
    "hasPreviousPage": "Boolean",
    "startCursor": "String",
    "endCursor": "String",
}


def _is_page_info(t: GraphQLNamedType) -> bool:
    """Whether ``t`` is Relay page info by shape: only cursor-page fields of the
    Relay types, taking no arguments."""
    return (
        isinstance(t, GraphQLObjectType)
        and t.fields.keys() <= _PAGE_INFO_FIELDS
        and ("hasNextPage" in t.fields or "hasPreviousPage" in t.fields)
        and all(
            str(f.type).rstrip("!") == _PAGE_INFO_TYPES[n] and not f.args
            for n, f in t.fields.items()
        )
    )


def _takes_arguments(field: GraphQLField) -> bool:
    return bool(field.args)


def _edge_node(t: GraphQLNamedType) -> Optional[GraphQLNamedType]:
    """The node type of ``t`` when it is a Relay edge: a composite ``node`` beside a
    ``String`` ``cursor``, neither needing an argument."""
    if not isinstance(t, GraphQLObjectType) or not {"node", "cursor"} <= t.fields.keys():
        return None
    node_type = t.fields["node"].type
    if isinstance(node_type, GraphQLNonNull):
        node_type = node_type.of_type
    if isinstance(node_type, GraphQLList):
        return None  # a list of nodes is not one node
    node = get_named_type(node_type)
    composite = (GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType)
    if (
        isinstance(node, composite)
        and str(t.fields["cursor"].type).rstrip("!") == "String"
        and not _takes_arguments(t.fields["node"])
        and not _takes_arguments(t.fields["cursor"])
    ):
        return node
    return None


def _connection_node(t: GraphQLNamedType) -> Optional[GraphQLNamedType]:
    """The node type of ``t`` when it is a Relay connection: a list of edges beside
    an object ``pageInfo``."""
    if not isinstance(t, GraphQLObjectType) or not {"edges", "pageInfo"} <= t.fields.keys():
        return None
    edges_type = t.fields["edges"].type
    if isinstance(edges_type, GraphQLNonNull):
        edges_type = edges_type.of_type
    if not isinstance(edges_type, GraphQLList):
        return None
    inner = edges_type.of_type
    if isinstance(inner, GraphQLNonNull):
        inner = inner.of_type
    if isinstance(inner, GraphQLList):
        return None  # exactly one list layer around the edges
    page_type = t.fields["pageInfo"].type
    if isinstance(page_type, GraphQLNonNull):
        page_type = page_type.of_type
    if isinstance(page_type, GraphQLList) or not _is_page_info(page_type):
        return None
    if _takes_arguments(t.fields["edges"]) or _takes_arguments(t.fields["pageInfo"]):
        return None
    return _edge_node(get_named_type(t.fields["edges"].type))


def _node_type(named: GraphQLNamedType) -> GraphQLNamedType:
    """Collapse a Relay connection to its node type by structure, not by name."""
    return _connection_node(named) or named


def _is_relay_plumbing(t: GraphQLNamedType, schema: GraphQLSchema) -> bool:
    """Whether ``t`` is a connection, edge, or page-info type. A root never is."""
    if not isinstance(t, GraphQLObjectType) or t in (schema.query_type, schema.mutation_type):
        return False
    return _is_page_info(t) or _connection_node(t) is not None or _edge_node(t) is not None


def _wrapper_extras(t: GraphQLNamedType, schema: GraphQLSchema) -> list[str]:
    """Fields a connection or edge type carries beyond the Relay shape."""
    if not _is_relay_plumbing(t, schema) or _is_page_info(t):
        return []
    assert isinstance(t, GraphQLObjectType)
    shape = {"edges", "pageInfo"} if _connection_node(t) is not None else {"node", "cursor"}
    return [n for n in t.fields if n not in shape]


def _wrapper_walk(t: GraphQLNamedType, schema: GraphQLSchema) -> list[str]:
    """The fields of a wrapper worth following: its extras, and ``edges`` when the
    edge type has extras of its own."""
    walk = _wrapper_extras(t, schema)
    if walk or _is_relay_plumbing(t, schema):
        assert isinstance(t, GraphQLObjectType)
        edges = t.fields.get("edges")
        if edges is not None and _wrapper_extras(get_named_type(edges.type), schema):
            walk = [*walk, "edges"]
    return walk


def _skip(t: GraphQLNamedType, schema: GraphQLSchema) -> bool:
    return (
        is_introspection_type(t)
        or isinstance(t, GraphQLScalarType)
        or _is_relay_plumbing(t, schema)
    )


def _args(field: _FieldLike) -> Mapping[str, GraphQLArgument]:
    return field.args if isinstance(field, GraphQLField) else {}


_UNPRINTABLE = "<unprintable>"


# Definitions are unhashable and identity-keyed entries must outlive id reuse,
# so each entry keeps its definition; the cache is bounded like the others.
_DEFAULTS: "OrderedDict[tuple[int, int], tuple[_ValueDef, str]]" = OrderedDict()
_DEFAULTS_MAX = 65536
_BUILD_EPOCH = [0]  # advanced by every build, so a rebuild re-renders changed defaults


def _default(value_def: _ValueDef) -> str:
    """The `` = literal`` suffix of a default: its source text when that still
    delivers the current default, else a rendering by type that does. A default
    no literal delivers is marked rather than misspelled. Rendered once per
    argument or input field, since the checks are not cheap."""
    if value_def.default_value is Undefined:
        return ""
    key = (id(value_def), _BUILD_EPOCH[0])
    cached = _DEFAULTS.get(key)
    if cached is not None and cached[0] is value_def:
        return cached[1]
    rendered = _render_default(value_def)
    _DEFAULTS[key] = (value_def, rendered)
    while len(_DEFAULTS) > _DEFAULTS_MAX:
        _DEFAULTS.popitem(last=False)
    return rendered


def _render_default(value_def: _ValueDef) -> str:
    value = value_def.default_value
    candidates: list[Optional[str]] = []
    ast = value_def.ast_node
    if ast is not None and ast.default_value is not None:
        candidates.append(print_ast(ast.default_value))
    for by_name in (False, True):
        for by_output in (False, True):
            try:
                candidates.append(
                    _literal(value, value_def.type, enum_by_name=by_name, keys_by_output=by_output)
                )
            except Exception:
                pass
    for literal in candidates:
        if literal is not None and "\n" not in literal and _delivers(value_def, literal):
            return f" = {literal}"
    return f" = {_UNPRINTABLE}"


def _delivers(value_def: _ValueDef, literal: str) -> bool:
    """Whether supplying ``literal`` hands a resolver the same value as omitting
    the argument or field, as graphql-core coerces each."""
    try:
        node = parse_const_value(literal)
        if (
            value_from_ast(node, value_def.type) is Undefined
            or not _names_known_fields(node, value_def.type)
            or _repeats_a_field(node)
        ):
            return False  # the literal is not valid input for the current type
        if isinstance(value_def, GraphQLArgument):
            field = GraphQLField(GraphQLInt, args={"x": value_def})
            omitted = get_argument_values(
                field, FieldNode(name=NameNode(value="f"), arguments=[]), {}
            )
            given = ArgumentNode(name=NameNode(value="x"), value=node)
            supplied = get_argument_values(
                field, FieldNode(name=NameNode(value="f"), arguments=[given]), {}
            )
            return _equivalent(*omitted.values(), *supplied.values())
        # An omitted input field passes its default through uncoerced.
        return _equivalent(value_from_ast(node, value_def.type), value_def.default_value)
    except Exception:
        return False


def _names_known_fields(node: ValueNode, type_: GraphQLInputType) -> bool:
    """Whether every object field the literal names exists on ``type_``; the
    parser leaves unknown fields in place, validation rejects them."""
    if isinstance(type_, GraphQLNonNull):
        type_ = type_.of_type
    if isinstance(type_, GraphQLList):
        # A single value coerces to a one-item list.
        items = node.values if isinstance(node, ListValueNode) else [node]
        return all(_names_known_fields(v, type_.of_type) for v in items)
    if isinstance(node, ObjectValueNode) and isinstance(type_, GraphQLInputObjectType):
        names = [f.name.value for f in node.fields]
        return len(set(names)) == len(names) and all(
            f.name.value in type_.fields
            and _names_known_fields(f.value, type_.fields[f.name.value].type)
            for f in node.fields
        )
    return True


def _repeats_a_field(node: ValueNode) -> bool:
    """Whether any object in the literal names a field twice, which validation
    rejects even inside a custom scalar."""
    if isinstance(node, ListValueNode):
        return any(_repeats_a_field(v) for v in node.values)
    if isinstance(node, ObjectValueNode):
        names = [f.name.value for f in node.fields]
        return len(set(names)) != len(names) or any(_repeats_a_field(f.value) for f in node.fields)
    return False


def _equivalent(a: object, b: object, *, sequences: bool = False) -> bool:
    """Whether two coerced values are the same value of the same kind, so ``True``
    never passes for ``1``, inside containers and dictionary keys included, and
    a mapping keeps its order. With ``sequences``, a tuple and a list of the
    same items are the same value."""
    if sequences and isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_equivalent(x, y, sequences=True) for x, y in zip(a, b))
    if type(a) is not type(b):
        return False
    if isinstance(a, float):
        if a != b or math.copysign(1.0, a) != math.copysign(1.0, b):
            return False
        if type(a) is float:
            return True
    if type(a) in (str, bytes, int, bool) or isinstance(a, enum.Enum) or a is None:
        return bool(a == b)
    if isinstance(a, decimal.Decimal) and isinstance(b, decimal.Decimal):
        if a.as_tuple() != b.as_tuple():
            return False
    if isinstance(a, (datetime.datetime, datetime.time)) and isinstance(
        b, (datetime.datetime, datetime.time)
    ):
        if a.tzinfo != b.tzinfo or a.fold != b.fold or a.tzname() != b.tzname():
            return False
    if isinstance(a, Mapping) and isinstance(b, Mapping):
        same = len(a) == len(b) and all(
            _equivalent(k, m, sequences=sequences) and _equivalent(a[k], b[m], sequences=sequences)
            for k, m in zip(a, b)
        )
    elif isinstance(a, Sequence) and isinstance(b, Sequence):
        same = len(a) == len(b) and all(
            _equivalent(x, y, sequences=sequences) for x, y in zip(a, b)
        )
    elif isinstance(a, AbstractSet) and isinstance(b, AbstractSet):
        same = _pair_off(a, b) is not None
    else:
        same = True
        if type(a).__eq__ is not object.__eq__ and not (a == b):
            # A native payload, as a datetime subclass carries, is judged by the
            # equality the class inherits; only object's own identity test is skipped.
            return False
    if not same:
        return False
    if isinstance(a, deque) and isinstance(b, deque) and a.maxlen != b.maxlen:
        return False
    if isinstance(a, defaultdict) and isinstance(b, defaultdict):
        if a.default_factory is not b.default_factory:
            return False
    state_a, state_b = _state(a), _state(b)
    if state_a is None and state_b is None:
        return same if isinstance(a, (Mapping, Sequence, AbstractSet)) else bool(a == b)
    return _equivalent(state_a or {}, state_b or {}, sequences=sequences)


_Primitive = (str, bytes, int, float, bool, type(None))


def _pair_off(
    left: Iterable[object], right: Iterable[object]
) -> Optional[list[tuple[object, object]]]:
    """Each item of ``left`` paired with an item of ``right`` equivalent to it, every
    item on the right used once, or None when no such pairing exists. Primitive
    items pair by hash; the rest by search."""
    others: list[object] = []
    by_kind: dict[tuple[type, object], list[object]] = defaultdict(list)
    for x in right:
        (by_kind[(type(x), x)] if isinstance(x, _Primitive) else others).append(x)
    pairs: list[tuple[object, object]] = []
    for item in left:
        if isinstance(item, _Primitive):
            bucket = by_kind.get((type(item), item), [])
            hit = next((i for i, x in enumerate(bucket) if _equivalent(item, x)), -1)
            if hit < 0:
                return None
            pairs.append((item, bucket.pop(hit)))
            continue
        at = next((i for i, x in enumerate(others) if _equivalent(item, x)), -1)
        if at < 0:
            return None
        pairs.append((item, others.pop(at)))
    return pairs if not others and not any(by_kind.values()) else None


_NO_MATCH = object()


def _state(obj: object) -> Optional[dict[str, object]]:
    """The attributes an object carries in its dictionary and its slots, each slot
    read through the class that declares it so a shadowed slot stays distinct, or
    None when it has neither."""
    state: dict[str, object] = dict(getattr(obj, "__dict__", {}))
    found = hasattr(obj, "__dict__")
    for cls in type(obj).__mro__:
        declared = getattr(cls, "__slots__", ())
        for name in [declared] if isinstance(declared, str) else declared:
            if name in ("__dict__", "__weakref__"):
                continue
            if name.startswith("__") and not name.endswith("__"):
                name = f"_{cls.__name__.lstrip('_')}{name}"
            descriptor = cls.__dict__.get(name)
            if descriptor is None:
                continue
            found = True
            try:
                state[f"slot:{id(descriptor)}"] = descriptor.__get__(obj, cls)
            except AttributeError:
                continue
    return state if found else None


def _literal(
    value: object,
    type_: GraphQLInputType,
    *,
    enum_by_name: bool = False,
    keys_by_output: bool = False,
) -> Optional[str]:
    """``value`` written as an input literal of ``type_``, or None when it cannot be.

    An enum value is written by serialization, or with ``enum_by_name`` taken as
    a name already: graphql-core reads a default inside an input object as names
    but a top-level default as values. A custom scalar's literal is what it
    serializes to, accepted only when the scalar reads it back as the same value."""
    if isinstance(type_, GraphQLNonNull):
        type_ = type_.of_type
    if value is None:
        return "null"
    if isinstance(type_, GraphQLList):
        values = list(cast(Iterable[object], value)) if is_collection(value) else [value]
        items = [
            _literal(v, type_.of_type, enum_by_name=enum_by_name, keys_by_output=keys_by_output)
            for v in values
        ]
        return None if None in items else "[" + ", ".join(i for i in items if i) + "]"
    if isinstance(type_, GraphQLInputObjectType):
        if not isinstance(value, dict):
            return None
        # With ``keys_by_output`` every key is an output name, written by the input
        # name it came from; otherwise only keys that are no input name are.
        reverse = {f.out_name: n for n, f in type_.fields.items() if f.out_name}
        if not keys_by_output:
            reverse = {o: n for o, n in reverse.items() if o not in type_.fields}
        value = {reverse.get(k, k): v for k, v in value.items()}
        if not all(k in type_.fields for k in value):
            return None
        fields = {
            k: _literal(
                v, type_.fields[k].type, enum_by_name=enum_by_name, keys_by_output=keys_by_output
            )
            for k, v in value.items()
        }
        if None in fields.values():
            return None
        return "{" + ", ".join(f"{k}: {v}" for k, v in fields.items()) + "}"
    if isinstance(type_, GraphQLEnumType):
        if enum_by_name:
            return value if isinstance(value, str) and value in type_.values else None
        name = type_.serialize(value)
        return name if isinstance(name, str) else None
    if isinstance(type_, GraphQLScalarType) and type_.name not in specified_scalar_types:
        literal = _json_literal(type_.serialize(value))
        return literal if literal is not None and _coerces_back(type_, literal, value) else None
    try:
        node = ast_from_value(value, type_)
    except Exception:
        return None
    return print_ast(node) if node is not None else None


def _coerces_back(scalar: GraphQLScalarType, literal: str, value: object) -> bool:
    try:
        return _equivalent(scalar.parse_literal(parse_value(literal)), value)
    except Exception:
        return False


def _json_literal(value: object) -> Optional[str]:
    """A JSON-like value as an input literal, when every key is a name."""
    if isinstance(value, dict):
        if not all(isinstance(k, str) and _NAME.fullmatch(k) for k in value):
            return None
        fields = {k: _json_literal(v) for k, v in value.items()}
        if None in fields.values():
            return None
        return "{" + ", ".join(f"{k}: {v}" for k, v in fields.items()) + "}"
    if isinstance(value, (list, tuple)):
        items = [_json_literal(v) for v in value]
        return None if None in items else "[" + ", ".join(i for i in items if i) + "]"
    if value is None or isinstance(value, (bool, int, float, str)):
        return json.dumps(value)
    return None


_PAGINATION = "\u2026"
_PAGINATION_ARGS: Mapping[str, str] = {
    "first": "Int",
    "last": "Int",
    "after": "String",
    "before": "String",
}
# The page size and its default stay visible; the marker stands for the rest.
_PAGINATION_LEGEND = f"# {_PAGINATION} = last: Int, after: String, before: String"


def _is_pagination(name: str, arg: GraphQLArgument) -> bool:
    """Whether ``arg`` is one of the optional Relay pagination arguments.

    A required ``first: Int!`` is not: collapsing it would hide that the caller
    must pass it.
    """
    return str(arg.type) == _PAGINATION_ARGS.get(name)


def _signature(name: str, field: _FieldLike) -> str:
    args = _args(field)
    # The marker stands for the three cursor arguments exactly as the legend
    # spells them, so one with a default of its own is written out.
    collapsed = all(a in args and _is_pagination(a, args[a]) for a in _PAGINATION_ARGS) and all(
        args[a].default_value is Undefined and args[a].deprecation_reason is None
        for a in ("last", "after", "before")
    )
    rendered: list[str] = []
    for a, arg in args.items():
        if collapsed and a in _PAGINATION_ARGS and a != "first":
            if _PAGINATION not in rendered:
                rendered.append(_PAGINATION)
            continue
        rendered.append(f"{a}: {arg.type}{_default(arg)}{_deprecation(arg)}")
    joined = ", ".join(rendered)
    suffix = _default(field) if isinstance(field, GraphQLInputField) else ""
    suffix += _deprecation(field)
    return f"{name}({joined}): {field.type}{suffix}" if joined else f"{name}: {field.type}{suffix}"


def _deprecation(member: Union[_FieldLike, GraphQLArgument, GraphQLEnumValue]) -> str:
    """The ``@deprecated`` directive of a field, argument, or enum value, or nothing."""
    reason = member.deprecation_reason
    return f" @deprecated(reason: {json.dumps(reason)})" if reason is not None else ""


def _uses_pagination(text: str) -> bool:
    return f"({_PAGINATION}" in text or f", {_PAGINATION}" in text


def _with_legend(text: str) -> str:
    """Append the key to the pagination marker when the text uses it."""
    return f"{text}\n{_PAGINATION_LEGEND}" if _uses_pagination(text) else text


def _unit(
    kind: str,
    parent: str,
    name: str,
    signature: str,
    return_type: str,
    description: Optional[str],
    *,
    extra_ident: Iterable[str] = (),
) -> Unit:
    return Unit(
        kind=kind,
        parent=parent,
        name=name,
        signature=signature,
        return_type=return_type,
        description=(description or "").strip(),
        terms={
            "name": Counter([name.lower(), *_ident_terms(name)]),
            "ident": Counter([*_ident_terms(name), *extra_ident]),
            "parent": Counter(_ident_terms(parent)),
            "desc": Counter(_terms(description)),
        },
    )


def _object_fields(t: GraphQLNamedType) -> Iterator[tuple[str, GraphQLField]]:
    if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
        yield from t.fields.items()


def _returned_types(
    schema: GraphQLSchema, named: GraphQLNamedType, *, implementations: bool = False
) -> Iterator[GraphQLNamedType]:
    """The types a field of type ``named`` delivers: the collapsed type itself, each
    member of a union, and with ``implementations`` each implementation of an
    interface."""
    node = _node_type(named)
    yield node
    if isinstance(node, GraphQLUnionType):
        yield from schema.get_possible_types(node)
    elif implementations and isinstance(node, GraphQLInterfaceType):
        yield from schema.get_possible_types(node)


def _input_closure(start: Iterable[GraphQLNamedType]) -> list[GraphQLNamedType]:
    seen: dict[str, GraphQLNamedType] = {}
    queue = deque(start)
    while queue:
        t = queue.popleft()
        if t.name in seen or not isinstance(t, (GraphQLInputObjectType, GraphQLEnumType)):
            continue
        seen[t.name] = t
        if isinstance(t, GraphQLInputObjectType):
            for f in t.fields.values():
                queue.append(get_named_type(f.type))
    return list(seen.values())


def _reachable(schema: GraphQLSchema, roots: Iterable[GraphQLNamedType]) -> set[str]:
    """Every type a selection or an argument can reach from ``roots``.

    A field typed as an interface or union delivers every implementation or
    member. An interface reached only because a visible type implements it, or
    named only in such an interface's signature, delivers none: a selection on
    that type cannot become a sibling. The types those signatures name are
    themselves visible."""
    seen: set[str] = set()
    expanded: set[str] = set()  # abstract types whose members were queued
    queue: deque[tuple[GraphQLNamedType, bool]] = deque((t, True) for t in roots)
    while queue:
        t, expand = queue.popleft()
        abstract = isinstance(t, (GraphQLInterfaceType, GraphQLUnionType))
        expand = expand and abstract and t.name not in expanded
        if t.name in seen and not expand:
            continue
        seen.add(t.name)
        nxt: list[tuple[GraphQLNamedType, bool]] = []
        if isinstance(t, GraphQLInterfaceType) and not expand:
            nxt.extend((get_named_type(f.type), False) for f in t.fields.values())
        elif isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
            for f in t.fields.values():
                nxt.append((get_named_type(f.type), True))
                nxt.extend((get_named_type(a.type), True) for a in f.args.values())
            nxt.extend((i, False) for i in t.interfaces)
            if isinstance(t, GraphQLInterfaceType):
                expanded.add(t.name)
                nxt.extend((impl, True) for impl in schema.get_possible_types(t))
        elif isinstance(t, GraphQLInputObjectType):
            nxt.extend((get_named_type(f.type), True) for f in t.fields.values())
        elif isinstance(t, GraphQLUnionType) and expand:
            expanded.add(t.name)
            nxt.extend((m, True) for m in t.types)
        queue.extend(nxt)
    return seen


def _types_only_serving(
    schema: GraphQLSchema,
    hidden: Sequence[GraphQLObjectType],
    visible: Sequence[GraphQLObjectType],
) -> set[str]:
    """Types reachable from the ``hidden`` roots and from none of the ``visible`` ones."""
    if not hidden:
        return set()
    return _reachable(schema, hidden) - _reachable(schema, visible)


def build_index(
    schema: GraphQLSchema,
    roots: Sequence[str] = READ_ROOTS,
    *,
    include_mutations: bool = True,
) -> Index:
    """Index every type, field, argument, input field, and enum value of ``schema``.

    The subscription root and every type that exists only to serve it are left
    out: nothing here can run a subscription. With ``include_mutations`` false the
    mutation root and its private types are left out the same way, so a session
    that cannot run mutations is never shown one. Mutation names are kept so a
    lookup can say why they are absent.
    """
    _BUILD_EPOCH[0] += 1
    query_root = schema.query_type.name if schema.query_type is not None else "Query"
    mutation = schema.mutation_type
    mutation_root = mutation.name if mutation is not None else None
    enabled = {schema.query_type, mutation if include_mutations else None} - {None}
    hidden = [
        t
        for t in (schema.subscription_type, None if include_mutations else mutation)
        if t is not None and t not in enabled
    ]
    excluded_mutations: dict[str, frozenset[str]] = {}
    # A query that opens with a verb some mutation opens with wants a write.
    action_verbs = frozenset(
        _stem(tokens[0])
        for fname in (mutation.fields if mutation is not None else ())
        if (tokens := tokenize(fname))
    )
    visible = [t for t in (schema.query_type, mutation) if t is not None and t not in hidden]
    excluded_types = _types_only_serving(schema, hidden, visible)
    # A mutation root a query field returns is read through that field; its
    # members are then ordinary fields, whatever the session policy says.
    if mutation is not None and mutation.name in excluded_types:
        for fname in mutation.fields:
            excluded_mutations[fname.lower()] = frozenset(_ident_terms(fname))

    units: list[Unit] = []
    used_by: dict[str, list[str]] = defaultdict(list)
    returned_by: dict[str, list[str]] = defaultdict(list)
    through_interface: dict[str, list[str]] = defaultdict(list)
    for t in schema.type_map.values():
        if t.name in excluded_types:
            continue
        walk = _wrapper_walk(t, schema)
        if _skip(t, schema) and not walk:
            continue
        if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
            writes = t is mutation and include_mutations and t is not schema.query_type
            kind = "mutation" if writes else "field"
            extras = _wrapper_extras(t, schema)
            for fname, f in t.fields.items():
                if walk and fname not in walk:
                    continue
                named = get_named_type(f.type)
                if _wrapper_walk(named, schema):
                    returned_by[named.name].append(f"{t.name}.{fname}")
                if walk and fname not in extras:
                    continue
                arg_terms = [tok for a in f.args for tok in (a.lower(), *_ident_terms(a))]
                arg_desc = " ".join(a.description or "" for a in f.args.values())
                for target in _returned_types(schema, named):
                    returned_by[target.name].append(f"{t.name}.{fname}")
                if isinstance(node := _node_type(named), GraphQLInterfaceType):
                    for impl in schema.get_possible_types(node):
                        through_interface[impl.name].append(f"{t.name}.{fname}")
                if isinstance(named, GraphQLEnumType):
                    used_by[named.name].append(f"{t.name}.{fname}")
                units.append(
                    _unit(
                        kind,
                        t.name,
                        fname,
                        _signature(fname, f),
                        named.name,
                        f"{f.description or ''} {arg_desc}",
                        extra_ident=arg_terms,
                    )
                )
                for arg in f.args.values():
                    used_by[get_named_type(arg.type).name].append(f"{t.name}.{fname}")
            if walk:
                continue
        elif isinstance(t, GraphQLInputObjectType):
            for fname, input_field in t.fields.items():
                named = get_named_type(input_field.type)
                units.append(
                    _unit(
                        "input",
                        t.name,
                        fname,
                        _signature(fname, input_field),
                        named.name,
                        input_field.description,
                    )
                )
                used_by[named.name].append(f"{t.name}.{fname}")
        elif isinstance(t, GraphQLEnumType):
            for v, value in t.values.items():
                units.append(
                    _unit("enum", t.name, v, f"{v}{_deprecation(value)}", "", value.description)
                )
        units.append(_unit("type", "", t.name, t.name, "", t.description))

    # BM25F statistics: document frequency counts a term once per unit.
    df: Counter[str] = Counter()
    for u in units:
        df.update(set().union(*(set(c) for c in u.terms.values())))
    n = max(len(units), 1)
    idf = {term: math.log(1 + (n - d + 0.5) / (d + 0.5)) for term, d in df.items()}
    avg_len = {f: sum(sum(u.terms[f].values()) for u in units) / n for f in _FIELD_WEIGHTS}

    # Shortest paths from the read roots over forward edges, with connections
    # collapsed to their node type. A field typed as an interface delivers its
    # implementations too; a path is shorter first by how many interface hops
    # it takes, then by its length, so a concrete route wins where one exists.
    present_roots = [
        query_root,
        *(r for r in roots if r in schema.type_map and r != query_root and r not in excluded_types),
    ]
    nearest: dict[str, tuple[str, int, tuple[str, ...]]] = {r: (r, 0, ()) for r in present_roots}
    cost: dict[str, tuple[int, int]] = {r: (0, 0) for r in present_roots}
    order = itertools.count()
    heap = [(0, 0, next(order), r) for r in present_roots]
    while heap:
        interfaces, length, _, cur = heapq.heappop(heap)
        if (interfaces, length) != cost[cur]:
            continue
        root, _, hops = nearest[cur]
        walk = _wrapper_walk(schema.type_map[cur], schema)
        for fname, f in _object_fields(schema.type_map[cur]):
            if walk and fname not in walk:
                continue
            named = get_named_type(f.type)
            edges = [(nxt, 0) for nxt in _returned_types(schema, named)]
            if _wrapper_walk(named, schema):
                edges.append((named, 0))
            if isinstance(node := _node_type(named), GraphQLInterfaceType):
                edges.extend((impl, 1) for impl in schema.get_possible_types(node))
            for nxt, extra in edges:
                if not isinstance(nxt, (GraphQLObjectType, GraphQLInterfaceType)):
                    continue
                via = (interfaces + extra, length + 1)
                if nxt.name not in cost or via < cost[nxt.name]:
                    cost[nxt.name] = via
                    nearest[nxt.name] = (root, length + 1, (*hops, f"{cur}.{fname}"))
                    heapq.heappush(heap, (*via, next(order), nxt.name))

    # Entry points first: query-root fields, then fields on read roots, then the
    # rest; sources that deliver a type through an interface come last.
    rank = {r: i for i, r in enumerate(present_roots)}
    for sources in (*returned_by.values(), *through_interface.values()):
        sources.sort(key=lambda s: (rank.get(s.split(".")[0], len(rank)), s))
    for name, sources in through_interface.items():
        returned_by[name].extend(src for src in sources if src not in returned_by[name])

    plumbing = frozenset(
        t.name
        for t in schema.type_map.values()
        if _is_relay_plumbing(t, schema) and t.name not in excluded_types
    )
    by_key: dict[str, Unit] = {u.label: u for u in units}
    # A bare mutation name resolves to the mutation unless a schema type spells it the same.
    shared_root = mutation is not None and mutation is schema.query_type and include_mutations
    for u in units:
        runs_as_mutation = u.kind == "mutation" or (shared_root and u.parent == mutation_root)
        if runs_as_mutation and u.name not in schema.type_map:
            by_key.setdefault(u.name, u)
    folded: dict[str, Optional[Unit]] = {}
    for key, u in by_key.items():
        low = key.lower()
        folded[low] = u if folded.get(low, u) is u else None
    by_member: dict[tuple[str, str], Optional[Unit]] = {}
    for u in units:
        if u.parent:
            at = (u.parent, u.name.lower())
            by_member[at] = u if by_member.get(at, u) is u else None
    return Index(
        schema=schema,
        query_root=query_root,
        mutation_root=mutation_root,
        action_verbs=action_verbs,
        roots=frozenset(present_roots),
        includes_mutations=include_mutations,
        excluded_mutations=excluded_mutations,
        units=units,
        idf=idf,
        avg_len=avg_len,
        nearest=nearest,
        used_by=dict(used_by),
        returned_by=dict(returned_by),
        by_key=by_key,
        folded={k: u for k, u in folded.items() if u is not None},
        by_member={k: u for k, u in by_member.items() if u is not None},
        plumbing=plumbing,
        owners=frozenset(u.owner for u in units if u.owner),
        aliases=frozenset(k for k, u in by_key.items() if u.kind != "type" and "." not in k),
    )


def _by_case(names: Iterable[str], asked: str) -> Optional[str]:
    """``asked`` among ``names`` by exact spelling, else case-insensitively when unique."""
    names = list(names)
    if asked in names:
        return asked
    matches = [n for n in names if n.lower() == asked.lower()]
    return matches[0] if len(matches) == 1 else None


@functools.lru_cache(maxsize=8)
def _cached_index(schema: GraphQLSchema, include_mutations: bool) -> Index:
    return build_index(schema, include_mutations=include_mutations)


_index_lock = threading.Lock()


def cached_index(schema: GraphQLSchema, *, include_mutations: bool = True) -> Index:
    """The index for ``schema``, built once per schema object and mutation setting.

    Building is serialized so concurrent first callers share one index. The
    last few schemas stay referenced by the cache.
    """
    with _index_lock:
        return _cached_index(schema, include_mutations)


def reach_paths(index: Index, type_name: str, limit: int = _REACH_PATHS) -> list[tuple[str, ...]]:
    """Up to ``limit`` paths of ``Type.field`` hops from a read root down to ``type_name``.

    Shortest paths come first.
    """
    found: list[tuple[str, ...]] = []
    queue: deque[tuple[str, tuple[str, ...]]] = deque([(type_name, ())])
    visited = {type_name}
    while queue and len(found) < limit:
        cur, hops = queue.popleft()
        for ref in index.returned_by.get(cur, []):
            parent = ref.split(".", 1)[0]
            if parent == type_name:
                continue
            path = (ref, *hops)
            if parent in index.roots:
                found.append(path)
                if len(found) >= limit:
                    break
            elif parent not in visited:
                visited.add(parent)
                queue.append((parent, path))
    return found


# --- scoring ---------------------------------------------------------------------


def _bm25f(index: Index, u: Unit, terms: Sequence[str]) -> float:
    score = 0.0
    for term in terms:
        weighted_tf = 0.0
        for fname, weight in _FIELD_WEIGHTS.items():
            bag = u.terms[fname]
            tf = float(bag.get(term, 0))
            if not tf and len(term) >= 3:
                tf = 0.6 * sum(1 for tok in bag if tok.startswith(term))
            if tf:
                length = sum(bag.values())
                weighted_tf += weight * tf / (1 - _B + _B * length / index.avg_len[fname])
        if weighted_tf:
            idf = index.idf.get(term, math.log(len(index.units)))
            score += idf * weighted_tf * (_K1 + 1) / (weighted_tf + _K1)
    return score


def _kind_adjustment(index: Index, u: Unit, wants_mutation: bool) -> float:
    s = 0.0
    if u.kind == "mutation":
        s += 4 if wants_mutation else -3
    elif u.kind == "input":
        s += 2 if wants_mutation else -2
    elif u.kind == "type":
        s -= 2
    if u.parent == index.query_root:
        s += 1
    return s


def _rank(
    index: Index,
    terms: Sequence[str],
    wants_mutation: bool,
    only_mutations: bool = False,
    owner: Optional[str] = None,
) -> list[tuple[float, Unit]]:
    """Score every unit: BM25F, a share of the owning type's own score, a boost
    for proximity to a read root normalized over the matches, then kind adjustments.
    With ``only_mutations`` nothing but mutations is scored; with ``owner``, only
    that type's own members.
    """
    units = index.units
    if only_mutations:
        # On a root shared with the query side, every field also runs as a mutation.
        shared = index.mutation_root == index.query_root
        units = [
            u for u in units if u.kind == "mutation" or (shared and u.parent == index.query_root)
        ]
    if owner is not None:
        units = [u for u in units if u.parent == owner]
    bm25 = [(u, _bm25f(index, u, terms)) for u in units]
    type_score = {u.name: s for u, s in bm25 if u.kind == "type"}
    matched = [(u, s) for u, s in bm25 if s]
    if not matched:
        return []
    depths = [min(index.depth(u.owner), _MAX_DEPTH) for u, _ in matched]
    lo, hi = min(depths), max(depths)
    scored: list[tuple[float, Unit]] = []
    for (u, s), depth in zip(matched, depths):
        if u.kind != "type":
            s += _PARENT_SHARE * type_score.get(u.parent, 0.0)
        proximity = 1.0 - (depth - lo) / (hi - lo) if hi > lo else 1.0
        s *= 1.0 + _SHORT_PATH_BOOST * proximity
        scored.append((s + _kind_adjustment(index, u, wants_mutation), u))
    scored.sort(key=lambda x: (-x[0], index.depth(x[1].owner), x[1].kind, x[1].parent, x[1].name))
    return scored


# --- rendering -------------------------------------------------------------------


_SENTENCE_END = re.compile(
    r"(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\betc\.)(?<!\bvs\.)(?<!\bcf\.)(?<=[.!?])\s", re.I
)
"""Whitespace after a sentence-ending mark that does not close an abbreviation."""


def _first_sentence(text: str, limit: int = 80) -> str:
    head = _SENTENCE_END.split(" ".join(text.split()), maxsplit=1)[0]
    return head if len(head) <= limit else head[: limit - 1] + "…"


def _line(index: Index, group: Sequence[Unit], terms: Sequence[str]) -> str:
    u = group[0]
    if u.kind == "type":
        t = index.schema.type_map[u.name]
        if isinstance(t, GraphQLInputObjectType):
            line = f"input {u.name}  input for {', '.join(index.used_by.get(u.name, [])[:2])}"
        elif isinstance(t, GraphQLEnumType):
            line = f"enum {u.name}  used by {', '.join(index.used_by.get(u.name, [])[:2])}"
        elif via := index.via(u.name):
            line = f"type {u.name}  via {via}"
        elif sources := index.returned_by.get(u.name):
            line = f"type {u.name}  returned by {', '.join(sources[:2])}"
        else:
            line = f"type {u.name}"
    elif len(group) > 1:
        line = f"{u.signature}  # on {_owners(group)}"
        if u.kind in ("enum", "input"):
            line = f"{u.kind} {line}"
    elif u.kind == "enum":
        line = f"enum {u.parent}.{u.name}  used by {', '.join(index.used_by.get(u.parent, [])[:2])}"
    elif u.kind == "input":
        owners = ", ".join(index.used_by.get(u.parent, [])[:2])
        line = f"input {u.parent}.{u.signature}  input for {owners}"
    elif u.kind == "mutation":
        line = f"mutation {u.signature}"
    else:
        line = f"{u.parent}.{u.signature}"
        if u.parent != index.query_root:
            line += f"  via {index.via(u.parent)}"
    return line + _matched_description(u, terms)


def _owners(group: Sequence[Unit]) -> str:
    on = ", ".join(x.parent for x in group[:6])
    return on + (f" +{len(group) - 6}" if len(group) > 6 else "")


def _matched_description(u: Unit, terms: Sequence[str]) -> str:
    """The description, quoted, when the query matched inside it."""
    if u.description and any(term in u.terms["desc"] for term in terms):
        return f'  "{_first_sentence(u.description)}"'
    return ""


def _entry(index: Index, group: Sequence[Unit], terms: Sequence[str]) -> tuple[Optional[str], str]:
    """A hit as ``(owner, line)``: fields with one owner are listed under it."""
    u = group[0]
    if len(group) == 1 and u.kind == "field":
        return u.parent, f"  {u.signature}{_matched_description(u, terms)}"
    return None, _line(index, group, terms)


def _owner_header(index: Index, owner: str) -> str:
    via = index.via(owner)
    if via and via != owner:
        return f"{owner}  via {via}"
    # A read root is reached from the query root; its first path is its entry point.
    paths = reach_paths(index, owner, limit=1)
    return f"{owner}  via {' > '.join(paths[0])}" if paths else owner


_MUTATIONS_DISABLED = "-- Mutations are disabled for this session and are not listed."
_TOP_HIT_BUDGET = 1500


def _names_excluded_mutation(index: Index, terms: Sequence[str]) -> bool:
    """Whether the query spells out a mutation that was left out of the index."""
    have = set(terms)
    return any(tokens and tokens <= have for tokens in index.excluded_mutations.values())


def _is_exact(index: Index, name: str) -> bool:
    """Whether ``name`` names one type, field, or mutation, listed or hidden."""
    key = name.lower()
    return (
        index.resolve(name) is not None
        or ("." not in name and _names_schema_type(index, name))
        or key in index.excluded_mutations
        or _is_hidden_mutation_root(index, name)
    )


def _names_schema_type(index: Index, name: str) -> bool:
    """Whether ``name`` spells a schema type: exactly, or case-insensitively for
    anything but a scalar, since a scalar's name is also an ordinary word."""
    exact = index.type_name(name)
    if exact is None or exact in index.aliases:
        return False
    return exact == name or not isinstance(index.schema.type_map[exact], GraphQLScalarType)


def _is_visible_type(index: Index, name: str) -> bool:
    u = index.by_key.get(name)
    return (u is not None and u.kind == "type") or name in index.plumbing


def _wrapper_guidance(index: Index, name: str) -> Optional[str]:
    """The wrapper explanation for ``name`` when it is a wrapper, or a wrapper's own
    Relay field; a member the wrapper adds beyond that shape is looked up as usual."""
    owner_part, dot, member = name.partition(".")
    wrapper = index.type_name(owner_part)
    if wrapper is None or wrapper not in index.plumbing:
        return None
    t = index.schema.type_map[wrapper]
    assert isinstance(t, GraphQLObjectType)
    core = t.fields.keys() - set(_wrapper_extras(t, index.schema))
    if dot and _by_case(core, member.strip()) is None:
        return None if wrapper in index.owners else _plumbing_miss(index, wrapper)
    return _plumbing_miss(index, wrapper)


def _plumbing_miss(index: Index, asked: str) -> Optional[str]:
    """What a Relay wrapper is and what to look up instead. They are left out of
    the index because a selection passes through them, never stops at them."""
    name = index.type_name(asked)
    if name not in index.plumbing:
        return None
    if name is None:
        return None
    t = index.schema.type_map[name]
    assert isinstance(t, GraphQLObjectType)
    node = _node_type(t)
    extras = _wrapper_extras(t, index.schema)
    also = f" It also has {', '.join(extras)}; look up {name}.{extras[0]}." if extras else ""
    if node is not t:
        page = get_named_type(t.fields["pageInfo"].type)
        assert isinstance(page, GraphQLObjectType)
        picks = [f for f in ("hasNextPage", "endCursor") if f in page.fields] or list(page.fields)[
            :1
        ]
        return (
            f"-- {name} is a connection over {node.name}: select "
            f"`edges {{ node {{ ... }} }}` and `pageInfo {{ {' '.join(picks)} }}`. "
            f"Look up {node.name}.{also}"
        )
    if "node" in t.fields:
        inner = get_named_type(t.fields["node"].type).name
        return (
            f"-- {name} is a connection edge over {inner}: select `node {{ ... }}`. "
            f"Look up {inner}.{also}"
        )
    return f"-- {name} is Relay pagination plumbing: {', '.join(t.fields)}."


def _is_hidden_mutation_root(index: Index, name: str) -> bool:
    """Whether ``name`` spells the mutation root while mutations are hidden. The
    spelling resolves like any other name, so a type that merely folds to the
    root's name is not taken for it."""
    return (
        not index.includes_mutations
        and index.mutation_root is not None
        and index.type_name(name.strip()) == index.mutation_root
        and index.mutation_root not in index.by_key
    )


def _hidden_type_note(index: Index, name: str) -> Optional[str]:
    """Why ``name`` cannot be looked up when it spells a schema type left out of the index."""
    exact = index.type_name(name)
    if exact is None or exact in index.aliases or _is_visible_type(index, exact):
        return None
    if exact.startswith("__"):
        return None
    if exact == index.mutation_root or isinstance(index.schema.type_map[exact], GraphQLScalarType):
        return None
    mutation = index.schema.mutation_type
    if (
        not index.includes_mutations
        and mutation is not None
        and exact in _reachable(index.schema, [mutation])
    ):
        return f"-- {exact} is reachable only through mutations. {_MUTATIONS_DISABLED}"
    return f"-- {exact} is reachable only through subscriptions, which cannot run here."


def _implicit_field(index: Index, name: str) -> Optional[str]:
    """The field the specification adds to every type when ``name`` asks for it:
    ``__typename`` on any visible object, interface, or union, wrappers included,
    and ``__schema`` or ``__type`` on the query root."""
    owner, dot, member = name.strip().partition(".")
    member = _by_case(("__typename", "__schema", "__type"), member.strip()) or member.strip()
    if not dot or not (member.startswith("__") or owner.startswith("__")):
        return None
    exact = index.type_name(owner)
    if exact is None or exact in index.aliases or exact not in index.schema.type_map:
        return None
    if not (_is_visible_type(index, exact) or exact in index.plumbing or exact.startswith("__")):
        return None
    t = index.schema.type_map[exact]
    if exact.startswith("__") and member != "__typename":
        # Introspection types are not indexed, so a request on one is answered
        # from the type itself: the field or value asked for, else what it has.
        if isinstance(t, GraphQLObjectType):
            if (field := _by_case(t.fields, member)) is not None:
                return f"{exact}.{_signature(field, t.fields[field])}"
            return f"-- {exact} has no field {_echo(member)!r}. Its fields: {', '.join(t.fields)}."
        if isinstance(t, GraphQLEnumType):
            if (value := _by_case(t.values, member)) is not None:
                return f"enum {exact}.{value}"
            return f"-- {exact} has no value {_echo(member)!r}. Its values: {', '.join(t.values)}."
        return None
    if member == "__typename":
        if not isinstance(t, (GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType)):
            return None
        note = "# The name of the concrete type, on every object, interface, and union."
        return f"{exact}.__typename: String!\n{note}"
    if t is index.schema.query_type and member == "__schema":
        return f"{exact}.__schema: __Schema!\n# Introspection: every type and directive."
    if t is index.schema.query_type and member == "__type":
        return f"{exact}.__type(name: String!): __Type\n# Introspection: one type by name."
    return None


def _unknown_type(index: Index, name: str) -> Optional[str]:
    """The miss for ``Word.member`` when ``Word`` is no type, with the nearest
    type names. A dotted query is scoped on purpose and is not searched at large."""
    owner, dot, member = name.strip().partition(".")
    if not dot or not member or not owner or index.owner(owner) is not None:
        return None
    if " " in owner or " " in member.strip():
        return None
    if hidden := _hidden_type_note(index, owner):
        return hidden
    exact = index.type_name(owner)
    if exact is not None and exact not in index.aliases:
        leaf = index.schema.type_map[exact]
        kind = (
            "scalar"
            if isinstance(leaf, GraphQLScalarType)
            else "union"
            if isinstance(leaf, GraphQLUnionType)
            else "enum"
            if isinstance(leaf, GraphQLEnumType)
            else None
        )
        if kind is not None:
            what = "members" if kind == "union" else "values" if kind == "enum" else "fields"
            look = f"Look up {exact}." if kind != "scalar" else ""
            retry = f"Try search('{_echo(member)}')."
            return f"-- {exact} is a {kind} and has no {what} to select. {look}{retry}"
    types = {u.name.lower(): u.name for u in index.units if u.kind == "type"}
    near = [types[k] for k in difflib.get_close_matches(owner.lower(), types, n=3, cutoff=0.6)]
    hint = f" Did you mean {', '.join(near)}?" if near else ""
    member = _echo(member)
    retry = f"search('{near[0]}.{member}')" if near else f"search('{member}')"
    return f"-- No type named {_echo(owner)!r}.{hint} Try {retry}."


def _unknown_member(index: Index, name: str) -> Optional[tuple[str, str]]:
    """``(Type, member)`` when ``name`` is ``Type.member`` for an indexed type that
    has no such member. ``member`` keeps the caller's spelling."""
    owner_key, dot, member = name.strip().partition(".")
    owner = index.owner(owner_key)
    if not dot or not member or owner is None:
        return None
    return owner, member


def search(index: Index, query: str, budget: int = 1500) -> str:
    """Ranked hits for a free-text query, within ``budget`` characters.

    Each hit is one line. Fields with a single owner are listed under a header
    naming that owner and the path that reaches it.

    A query that exactly names a type, ``Type.field``, or mutation is a lookup.
    ``Type.words`` for a type with no such field searches within that type.
    A query containing the word "mutations" on its own is answered with
    mutations only.
    """
    return _fit(_search(index, query, budget), budget)


def _search(index: Index, query: str, budget: int) -> str:
    query = _clip(query)
    if _is_exact(index, query):
        return lookup(index, query, budget)
    if implicit := _implicit_field(index, query):
        return implicit
    if _is_hidden_mutation_root(index, query.partition(".")[0]):
        return lookup(index, query, budget)
    if miss := _unknown_type(index, query):
        return miss
    if "." in query and (wrapper := _wrapper_guidance(index, query)):
        return wrapper
    if unknown := _unknown_member(index, query):
        owner, member = unknown
        terms = _query_terms(member)
        scored = _rank(index, terms, False, owner=owner) if terms else []
        shown = _echo(member)
        if not scored:
            return (
                f"-- {owner} has no field {shown!r}, and nothing on {owner} matches it. "
                f"Try search({shown!r})."
            )
        lead = [f"# On {owner}, matching {shown!r}:"]
        return _ranked_answer(index, terms, budget, scored=scored, note=[], lead=lead)
    terms = _query_terms(query)
    if not terms:
        return (
            "-- Empty query. Search for a concept ('span cost') "
            "or name a type or field ('Span.costSummary')."
        )
    only_mutations = _asks_mutations_only(query)
    if only_mutations:
        terms = [t for t in terms if t != _MUTATION_TERM]
    if only_mutations and index.mutation_root is None:
        return "-- The schema has no mutations."
    if only_mutations and not index.includes_mutations:
        return _MUTATIONS_DISABLED
    if only_mutations and not terms:
        return lookup(index, index.mutation_root or "", budget)
    wants_mutation = only_mutations or any(t in index.action_verbs for t in terms)
    note: list[str] = []
    if not index.includes_mutations and (wants_mutation or _names_excluded_mutation(index, terms)):
        note.append(_MUTATIONS_DISABLED)
    scored = _rank(index, terms, wants_mutation, only_mutations)
    if not scored:
        miss = f"-- No type, field, argument, enum value, or description matched {_echo(query)!r}."
        return "\n".join([miss, *note])
    lead = [_MUTATIONS_ONLY] if only_mutations else []
    return _ranked_answer(index, terms, budget, scored=scored, note=note, lead=lead)


_CLEAR_MARGIN = 0.1
"""Relative score gap above which the top hit alone is shown in full."""


def _ranked_answer(
    index: Index,
    terms: Sequence[str],
    budget: int,
    *,
    scored: Sequence[tuple[float, Unit]],
    note: Sequence[str],
    lead: Sequence[str],
) -> str:
    # One line per distinct signature; the parents it occurs on are listed
    # best score first, so the type the query named leads the list.
    groups: dict[tuple[str, str, str], list[Unit]] = {}
    group_score: dict[tuple[str, str, str], float] = {}
    for score, u in scored:
        # Hits share a line only when the line would read the same for each.
        key = (u.kind, u.signature, _matched_description(u, terms))
        groups.setdefault(key, []).append(u)
        group_score.setdefault(key, score)
    # Hits with one owner sit under that owner's header, which appears where the
    # owner's best hit ranks; every other hit keeps its own rank position.
    entries = [_entry(index, group, terms) for group in groups.values()]
    by_parent: dict[str, list[str]] = defaultdict(list)
    for parent, text in entries:
        if parent is not None:
            by_parent[parent].append(text)
    # A type whose fields are grouped is already named by their header.
    entries = [
        (parent, text)
        for parent, text in entries
        if parent is not None or not _names_grouped_type(text, by_parent)
    ]
    ordered: list[tuple[bool, str, Optional[str]]] = []  # (counts as a hit, line, owner)
    opened: set[str] = set()
    for parent, text in entries:
        if parent is None:
            ordered.append((True, text, None))
        elif parent not in opened:
            opened.add(parent)
            ordered.append((False, _owner_header(index, parent), parent))
            ordered.extend((True, hit, parent) for hit in by_parent[parent])
    # The best hit, when it is one field or mutation, follows the list in full so
    # a search whose top hit is right needs no second call. When the runner-up is
    # nearly as good, both follow.
    keys = list(groups)
    leaders = [k for k in keys[:1] if _expandable(groups[k])]
    if leaders and len(keys) > 1 and _expandable(groups[keys[1]]):
        top, second = group_score[keys[0]], group_score[keys[1]]
        if top > 0 and (top - second) / top < _CLEAR_MARGIN:
            leaders.append(keys[1])
    expansions: list[str] = []
    for k in leaders:
        u = groups[k][0]
        header = f"# {u.name if u.kind == 'mutation' else u.label} in full:"
        share = min(_TOP_HIT_BUDGET, budget // 3) // len(leaders)
        body = _within(_lookup_parts(index, u.label), share - len(header) - 1)
        # An expansion holding only the count of what it left out is dropped.
        if body and not body.startswith("# ..."):
            expansions.append(f"{header}\n{body}")
    lines: list[str] = list(lead)
    # Every line costs its length plus a newline; the last newline is not printed.
    budget += 1
    used = sum(len(n) + 1 for n in [*note, *lines, *expansions])
    if any(_uses_pagination(text) for _, text, _ in ordered) or any(
        map(_uses_pagination, expansions)
    ):
        used += len(_PAGINATION_LEGEND) + 1
    left: Counter[str] = Counter(owner or _SHARED for owner, _ in entries)
    if used + sum(len(line) + 1 for _, line, _ in ordered) <= budget:
        ordered, lines = [], [*lines, *(line for _, line, _ in ordered)]
    for i, (is_hit, line, owner) in enumerate(ordered):
        # A header only goes in with the hit that follows it. The last hit leaves
        # no room for a trailer unless it is the one cut.
        trailer = _trailer(left)
        last = i + (1 if is_hit else 2) >= len(ordered)
        need = len(line) + 1 if is_hit else len(line) + 1 + len(ordered[i + 1][1]) + 1
        if used + need + (0 if last else len(trailer) + 1) > budget:
            if used + len(trailer) + 1 <= budget:
                lines.append(trailer)
            break
        lines.append(line)
        used += len(line) + 1
        if is_hit:
            left[owner or _SHARED] -= 1
    lines.extend(expansions)
    return "\n".join([_with_legend("\n".join(lines)), *note])


def _expandable(group: Sequence[Unit]) -> bool:
    return len(group) == 1 and group[0].kind in ("field", "mutation")


def _names_grouped_type(line: str, by_parent: Mapping[str, list[str]]) -> bool:
    return line.startswith("type ") and line.split("  ", 1)[0].removeprefix("type ") in by_parent


_SHARED = "several types"
"""The trailer's label for hits that sit on more than one type."""


def _trailer(left: Counter[str]) -> str:
    """The count of hits not shown, with the types most of them sit on."""
    remaining = +left
    total = sum(remaining.values())
    where = ", ".join(f"{owner} {n}" for owner, n in remaining.most_common(3))
    return f"... {total} more; narrow the search ({where})"


def _member_names(t: GraphQLNamedType) -> list[str]:
    if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType, GraphQLInputObjectType)):
        return list(t.fields)
    if isinstance(t, GraphQLEnumType):
        return list(t.values)
    return []


def _stub(t: GraphQLNamedType, limit: int = 12) -> str:
    names = _member_names(t)
    if not names:
        return f"# {t.name}"
    shown = ", ".join(names[:limit])
    if len(names) > limit:
        shown += f" +{len(names) - limit}"
    return f"# {t.name}: {shown}"


_STUB_NOTE = "# +N counts members not shown; look up that type to see every one."


def _stubs(types: Iterable[GraphQLNamedType]) -> list[str]:
    """One stub per type, and the key to the ``+N`` marker when any stub is cut."""
    lines = [_stub(t) for t in types]
    if any(_stub(t) != _stub(t, limit=len(_member_names(t))) for t in types):
        lines.append(_STUB_NOTE)
    return lines


def _neighbors(index: Index, t: _ObjectLike) -> Iterator[GraphQLNamedType]:
    seen: set[str] = set()
    for f in t.fields.values():
        n = _node_type(get_named_type(f.type))
        if n.name in seen or n.name == t.name or _skip(n, index.schema) or not _member_names(n):
            continue
        seen.add(n.name)
        yield n


def _print_compact(t: GraphQLNamedType, index: Optional[Index] = None) -> str:
    """The type as SDL with one line per member and descriptions as trailing comments.
    With ``index``, a union lists only the members the index can see."""
    note = f"  # {_first_sentence(t.description)}" if t.description else ""
    if isinstance(t, GraphQLUnionType):
        shown = [m.name for m in t.types if index is None or _is_visible_type(index, m.name)]
        return f"union {t.name} = {' | '.join(shown)}{note}"
    if isinstance(t, GraphQLScalarType):
        return f"scalar {t.name}{note}"
    members: list[tuple[str, Optional[str]]]
    if isinstance(t, GraphQLEnumType):
        head = f"enum {t.name}"
        members = [
            (f"{v}{_deprecation(value)}", value.description) for v, value in t.values.items()
        ]
    elif isinstance(t, GraphQLInputObjectType):
        head = f"input {t.name}{' @oneOf' if _is_one_of(t) else ''}"
        members = [(_signature(n, f), f.description) for n, f in t.fields.items()]
    else:
        assert isinstance(t, (GraphQLObjectType, GraphQLInterfaceType))
        keyword = "interface" if isinstance(t, GraphQLInterfaceType) else "type"
        implements = ""
        if t.interfaces:
            implements = " implements " + " & ".join(i.name for i in t.interfaces)
        head = f"{keyword} {t.name}{implements}"
        members = [(_signature(n, f), f.description) for n, f in t.fields.items()]
    lines = [f"{head} {{{note}"]
    lines.extend(f"  {sig}" + (f"  # {_first_sentence(d)}" if d else "") for sig, d in members)
    lines.append("}")
    return "\n".join(lines)


def _is_one_of(t: GraphQLInputObjectType) -> bool:
    """Whether the input takes exactly one field: by graphql-core's flag, by the
    definition strawberry attaches, or by the ``@oneOf`` directive in SDL."""
    if getattr(t, "is_one_of", False):
        return True
    if getattr(t.extensions.get("strawberry-definition"), "is_one_of", False):
        return True
    directives = (t.ast_node.directives or ()) if t.ast_node is not None else ()
    return any(d.name.value == "oneOf" for d in directives)


_NEIGHBOR_STUBS = 8


def _field_dependencies(index: Index, u: Unit) -> list[str]:
    """What a caller needs beside the signature: every input type and enum the
    arguments take, in full, and the members of what the field returns, one
    level deep."""
    parent = index.schema.type_map[u.parent]
    assert isinstance(parent, (GraphQLObjectType, GraphQLInterfaceType))
    f = parent.fields[u.name]
    parts = [
        _print_compact(t) for t in _input_closure(get_named_type(a.type) for a in f.args.values())
    ]
    returned = _node_type(get_named_type(f.type))
    if _member_names(returned):
        stubbed = [returned]
        if isinstance(returned, (GraphQLObjectType, GraphQLInterfaceType)):
            stubbed.extend(itertools.islice(_neighbors(index, returned), _NEIGHBOR_STUBS))
        parts.extend(_stubs(stubbed))
    return parts


def _commented(text: str) -> str:
    """``text`` as comment lines; a carriage return ends a line like a newline does."""
    lines = text.strip().replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return "\n".join(f"# {line}" if line else "#" for line in lines)


def _path_lines(paths: Iterable[tuple[str, ...]]) -> list[str]:
    """One ``# via`` line per path of ``Type.field`` hops."""
    return [f"# via {' > '.join(path)}" for path in paths]


def _within(parts: Sequence[str], budget: int) -> str:
    """Join ``parts`` up to ``budget`` characters, cutting only at whole parts or, for
    the first part, at whole lines with the block kept closed. A cut always leaves
    room for the note that names what was cut; when not even that fits, the
    answer is the bare count, or nothing."""
    if sum(len(part) + 1 for part in parts) <= budget + 1:
        return "\n".join(parts)
    out: list[str] = []
    used = 0  # every line costs its length plus a newline; the last newline is not printed
    for i, part in enumerate(parts):
        after = parts[i + 1 :]
        # Accept a whole part only if the note for whatever follows still fits.
        reserve = len(_omitted(after, limit=0)) + 1 if after else 0
        if used + len(part) + 1 + reserve <= budget + 1:
            out.append(part)
            used += len(part) + 1
            continue
        if i > 0:
            out.append(_fitting_note(parts[i:], budget - used))
            break
        cut = _cut(part, after, budget)
        if cut is not None:
            return cut
        count = _omitted(parts, limit=0)
        return count if len(count) <= budget else ""
    return "\n".join(out)


def _cut(part: str, after: Sequence[str], budget: int) -> Optional[str]:
    """The head of ``part`` that fits ``budget`` beside its own trailer: the
    omitted-lines note, the closing brace, and the note naming ``after``. None
    when not even the first line fits."""
    lines = part.split("\n")
    closing = ["}"] if part.rstrip().endswith("}") else []
    body = lines[: len(lines) - len(closing)]
    sections = [_fitting_note(after, budget // 4)] if after else []
    trailer = len(f"  # ... {len(body)} more lines omitted") + 1
    trailer += sum(len(line) + 1 for line in (*closing, *sections))
    room = budget + 1 - trailer
    kept: list[str] = []
    for line in body:
        if sum(len(k) + 1 for k in kept) + len(line) + 1 > room:
            break
        kept.append(line)
    if not kept:
        return None
    if len(kept) < len(body):
        kept.append(f"  # ... {len(body) - len(kept)} more lines omitted")
    return "\n".join([*kept, *closing, *sections])


def _fitting_note(parts: Sequence[str], room: int) -> str:
    """The omitted-sections note with names when they fit in ``room``, else the count."""
    named = _omitted(parts)
    return named if len(named) + 1 <= room else _omitted(parts, limit=0)


def _omitted(parts: Sequence[str], limit: int = 8) -> str:
    """The note for sections a budget cut, naming the types they describe."""
    names = [n for n in (_section_name(part) for part in parts) if n][:limit]
    hidden = len(parts) - len(names)
    shown = ", ".join(names) + (f" +{hidden}" if names and hidden else "")
    return f"# ... {len(parts)} more sections omitted" + (f": {shown}" if shown else "")


def _section_name(part: str) -> Optional[str]:
    first = part.split("\n", 1)[0]
    if m := re.match(r"#\s+([A-Za-z_]\w*):", first):
        return m.group(1)
    if m := re.match(r"(?:type|interface|input|enum|union)\s+([A-Za-z_]\w*)", first):
        return m.group(1)
    return None


def lookup(index: Index, name: str, budget: int = 4000) -> str:
    """One type, ``Type.field``, or mutation rendered in full with the path that reaches it."""
    return _fit(_with_legend(_budgeted(_lookup_parts(index, _clip(name)), budget)), budget)


_MIN_SHARE = 400
"""Below this many characters a section holds little more than its header."""
_MAX_REQUESTS = 16
"""More requests than this in one call are omitted before any is served."""
_free_text_search = search


def describe(
    index: Index,
    *,
    search: Sequence[str] = (),
    names: Sequence[str] = (),
    budget: int = 4000,
) -> str:
    """Every name in full, then one ranked answer per search, within ``budget``.

    With neither, the query root. Sections share the budget: each takes an
    equal part of what remains, never less than a useful minimum, so a short
    definition leaves room for the next. When what remains cannot hold another
    section, the rest are counted as omitted. Fixed trailing lines appear once
    at the end.
    """
    total = len(names) + len(search)
    if not total:
        return lookup(index, index.query_root, budget)
    requests = itertools.chain((("name", n) for n in names), (("search", q) for q in search))
    trailing = (_PAGINATION_LEGEND, _MUTATIONS_DISABLED)
    labelled = len(search) > 1
    sections: list[str] = []
    seen: list[str] = []
    remaining = budget - sum(len(t) + 1 for t in trailing)
    if total > 1:
        # The notice for requests left unserved is reserved up front, so a final
        # trim never has to drop a trailing line to make room for it.
        remaining -= len(_omitted_requests(total)) + 2
    done = 0
    for kind, arg in itertools.islice(requests, _MAX_REQUESTS):
        if remaining < _MIN_SHARE:
            break
        share = max(remaining // (total - done), _MIN_SHARE)
        if kind == "name":
            text = _with_legend(_budgeted(_lookup_parts(index, arg), share))
        else:
            header = f"# search: {_echo(_clip(arg))}\n" if labelled else ""
            text = header + _free_text_search(index, arg, share - len(header))
        kept: list[str] = []
        for line in text.split("\n"):
            if line in trailing:
                if line not in seen:
                    seen.append(line)
            else:
                kept.append(line)
        sections.append("\n".join(kept))
        remaining -= len(sections[-1]) + 2
        done += 1
    if done < total:
        sections.append(_omitted_requests(total - done))
    return _fit("\n".join(["\n\n".join(sections), *seen]), budget)


def _omitted_requests(count: int) -> str:
    return f"-- {count} more requests omitted; ask for fewer at once."


def search_many(index: Index, queries: Sequence[str], budget: int = 4000) -> str:
    """One ranked answer per query, within ``budget`` overall."""
    return describe(index, search=queries, budget=budget)


def lookup_many(index: Index, names: Sequence[str], budget: int = 4000) -> str:
    """Every name in full, within ``budget`` overall."""
    return describe(index, names=names, budget=budget)


def _budgeted(parts: Sequence[str], budget: int) -> str:
    """``parts`` within ``budget``, leaving room for the pagination key if it is due."""
    if any(_uses_pagination(part) for part in parts):
        budget -= len(_PAGINATION_LEGEND) + 1
    return _within(parts, budget)


def _lookup_parts(index: Index, name: str) -> list[str]:
    name = _clip(name)
    key = name.lower()
    schema = index.schema
    u = index.resolve(name)
    if name in index.plumbing:
        u = None
    if u is None:
        if name.startswith("__") and (exact := index.type_name(name)) is not None:
            return [_print_compact(schema.type_map[exact], index)]
        if implicit := _implicit_field(index, name):
            return [implicit]
        if wrapper := _wrapper_guidance(index, name):
            return [wrapper]
        if (scalar := index.type_name(name)) and isinstance(
            schema.type_map.get(scalar), GraphQLScalarType
        ):
            return [_print_compact(schema.type_map[scalar])]
        if hidden := _hidden_type_note(index, name.partition(".")[0]):
            return [hidden]
        root_part, _, member_key = name.partition(".")
        member_key = member_key.lower()
        if key in index.excluded_mutations or (
            _is_hidden_mutation_root(index, root_part) and member_key in index.excluded_mutations
        ):
            return [f"-- {name} is a mutation. {_MUTATIONS_DISABLED}"]
        if _is_hidden_mutation_root(index, root_part):
            return [f"-- {index.mutation_root} is the mutation root. {_MUTATIONS_DISABLED}"]
        if unknown := _unknown_member(index, name):
            owner, member = unknown
            shown = _echo(member)
            return [f"-- {owner} has no field {shown!r}. Try search('{owner} {shown}')."]
        if miss := _unknown_type(index, name):
            return [miss]
        shown = _echo(name)
        return [f"-- No type, field, or mutation named {shown!r}. Try search('{shown}')."]
    parts: list[str]
    if u.kind == "type":
        t = schema.type_map[u.name]
        parts = [_print_compact(t, index)]
        if isinstance(t, GraphQLInputObjectType):
            parts.append(f"# input for {', '.join(index.used_by.get(u.name, [])[:4])}")
        elif isinstance(t, GraphQLEnumType):
            parts.append(f"# used by {', '.join(index.used_by.get(u.name, [])[:4])}")
        else:
            if isinstance(t, GraphQLInterfaceType):
                possible = ", ".join(
                    p.name for p in schema.get_possible_types(t) if _is_visible_type(index, p.name)
                )
                if possible:
                    parts.append(f"# possible types: {possible}")
            if paths := reach_paths(index, u.name):
                parts.extend(_path_lines(paths))
            elif sources := index.returned_by.get(u.name):
                parts.append(f"# returned by {', '.join(sources[:4])}")
            if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
                parts.extend(_stubs(list(_neighbors(index, t))))
    elif u.kind == "mutation":
        mutation = schema.mutation_type
        assert mutation is not None
        f = mutation.fields[u.name]
        parts = [f"mutation {u.signature}"]
        if u.description:
            parts.append(_commented(u.description))
        parts.extend(
            _print_compact(t)
            for t in _input_closure(get_named_type(a.type) for a in f.args.values())
        )
        parts.extend(_stubs([get_named_type(f.type)]))
    else:
        parts = [f"{u.parent}.{u.signature}"]
        if u.description:
            parts.append(_commented(u.description))
        if u.kind == "field":
            hop = f"{u.parent}.{u.name}"
            parts.extend(_path_lines((*p, hop) for p in reach_paths(index, u.parent)))
            parts.extend(_field_dependencies(index, u))
        else:
            parts.append(f"# {u.kind} for {', '.join(index.used_by.get(u.parent, [])[:3])}")
    return parts
