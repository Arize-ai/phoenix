"""Searchable sub-graph of the GraphQL schema for agents.

``build_index`` runs once per schema. ``search`` ranks hits for free text,
``lookup`` renders one type, field, or mutation in full with the path that
reaches it, and ``describe`` answers several of either within one budget.
Every renderer works to a character budget.
"""

from __future__ import annotations

import difflib
import functools
import heapq
import itertools
import math
import re
import threading
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from typing import Iterable, Iterator, Mapping, Optional, Sequence, Union

import snowballstemmer
from graphql import (
    GraphQLArgument,
    GraphQLEnumType,
    GraphQLField,
    GraphQLInputField,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
    GraphQLScalarType,
    GraphQLSchema,
    GraphQLUnionType,
    get_named_type,
    is_introspection_type,
)
from graphql.language import print_ast
from graphql.pyutils import Undefined
from graphql.utilities import ast_from_value

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
    """Caller text bounded before any of it is scanned, stemmed, or echoed."""
    return text.strip()[:_MAX_QUERY_CHARS]


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
    return [_stem(t) for w in words for t in _expand(w)][:_MAX_QUERY_TERMS]


_MUTATION_TERM = _stem("mutation")
"""The query word that restricts a search to mutations."""
_MUTATIONS_ONLY = "# mutations only"


def _asks_mutations_only(query: str) -> bool:
    """Whether ``query`` contains "mutation" or "mutations" as a word of its own.

    The word inside an identifier such as ``DatasetMutationPayload`` names a
    type and does not filter.
    """
    return any(_stem(w.lower()) == _MUTATION_TERM for w in _WORD.findall(query))


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
    plumbing: Mapping[str, str]  # lowercase name -> Relay wrapper type left out of the index

    def resolve(self, name: str) -> Optional[Unit]:
        """The unit ``name`` denotes: by exact spelling, else case-insensitively when unique."""
        return self.by_key.get(name) or self.folded.get(name.lower())

    def depth(self, type_name: str) -> int:
        return self.nearest.get(type_name, ("", _MAX_DEPTH, ()))[1]

    def via(self, type_name: str) -> str:
        root, _, hops = self.nearest.get(type_name, ("", _MAX_DEPTH, ()))
        if not root:
            return ""
        return " > ".join(hops) if hops else root


# --- index -----------------------------------------------------------------------


def _node_type(named: GraphQLNamedType) -> GraphQLNamedType:
    """Collapse a Relay connection to its node type by structure, not by name."""
    if isinstance(named, GraphQLObjectType) and "edges" in named.fields:
        edge = get_named_type(named.fields["edges"].type)
        if isinstance(edge, GraphQLObjectType) and "node" in edge.fields:
            node: GraphQLNamedType = get_named_type(edge.fields["node"].type)
            return node
    return named


def _is_relay_plumbing(t: GraphQLNamedType, schema: GraphQLSchema) -> bool:
    """Whether ``t`` is a connection, edge, or page-info type. A root never is."""
    if not isinstance(t, GraphQLObjectType) or t in (schema.query_type, schema.mutation_type):
        return False
    keys = t.fields.keys()
    return t.name == "PageInfo" or {"edges", "pageInfo"} <= keys or {"node", "cursor"} <= keys


def _skip(t: GraphQLNamedType, schema: GraphQLSchema) -> bool:
    return (
        is_introspection_type(t)
        or isinstance(t, GraphQLScalarType)
        or t is schema.subscription_type
        or _is_relay_plumbing(t, schema)
    )


def _args(field: _FieldLike) -> Mapping[str, GraphQLArgument]:
    return field.args if isinstance(field, GraphQLField) else {}


def _default(value_def: _ValueDef) -> str:
    if value_def.default_value is Undefined:
        return ""
    node = ast_from_value(value_def.default_value, value_def.type)
    return f" = {print_ast(node)}" if node is not None else ""


_PAGINATION = "\u2026"
_PAGINATION_ARGS: Mapping[str, str] = {
    "first": "Int",
    "last": "Int",
    "after": "String",
    "before": "String",
}
_PAGINATION_LEGEND = f"# {_PAGINATION} = first: Int, last: Int, after: String, before: String"


def _is_pagination(name: str, arg: GraphQLArgument) -> bool:
    """Whether ``arg`` is one of the optional Relay pagination arguments.

    A required ``first: Int!`` is not: collapsing it would hide that the caller
    must pass it.
    """
    return str(arg.type) == _PAGINATION_ARGS.get(name)


def _signature(name: str, field: _FieldLike) -> str:
    args = _args(field)
    collapsed = all(a in args and _is_pagination(a, args[a]) for a in _PAGINATION_ARGS)
    rendered: list[str] = []
    for a, arg in args.items():
        if collapsed and a in _PAGINATION_ARGS:
            if _PAGINATION not in rendered:
                rendered.append(_PAGINATION)
            continue
        rendered.append(f"{a}: {arg.type}{_default(arg)}")
    joined = ", ".join(rendered)
    suffix = _default(field) if isinstance(field, GraphQLInputField) else ""
    return f"{name}({joined}): {field.type}{suffix}" if joined else f"{name}: {field.type}{suffix}"


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
    """Every type a selection or an argument can reach from ``roots``."""
    seen: set[str] = set()
    queue = deque(roots)
    while queue:
        t = queue.popleft()
        if t.name in seen:
            continue
        seen.add(t.name)
        nxt: list[GraphQLNamedType] = []
        if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
            for f in t.fields.values():
                nxt.append(get_named_type(f.type))
                nxt.extend(get_named_type(a.type) for a in f.args.values())
            nxt.extend(t.interfaces)
            if isinstance(t, GraphQLInterfaceType):
                nxt.extend(schema.get_possible_types(t))
        elif isinstance(t, GraphQLInputObjectType):
            nxt.extend(get_named_type(f.type) for f in t.fields.values())
        elif isinstance(t, GraphQLUnionType):
            nxt.extend(t.types)
        queue.extend(n for n in nxt if n.name not in seen)
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
    query_root = schema.query_type.name if schema.query_type is not None else "Query"
    mutation = schema.mutation_type
    mutation_root = mutation.name if mutation is not None else None
    hidden = [t for t in (schema.subscription_type,) if t is not None]
    excluded_mutations: dict[str, frozenset[str]] = {}
    # A query that opens with a verb some mutation opens with wants a write.
    action_verbs = frozenset(
        _stem(tokens[0])
        for fname in (mutation.fields if mutation is not None else ())
        if (tokens := tokenize(fname))
    )
    if mutation is not None and not include_mutations:
        hidden.append(mutation)
        for fname in mutation.fields:
            excluded_mutations[fname.lower()] = frozenset(_ident_terms(fname))
    visible = [t for t in (schema.query_type, mutation) if t is not None and t not in hidden]
    excluded_types = _types_only_serving(schema, hidden, visible) | {t.name for t in hidden}

    units: list[Unit] = []
    used_by: dict[str, list[str]] = defaultdict(list)
    returned_by: dict[str, list[str]] = defaultdict(list)
    through_interface: dict[str, list[str]] = defaultdict(list)
    for t in schema.type_map.values():
        if _skip(t, schema) or t.name in excluded_types:
            continue
        if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
            kind = "mutation" if t is mutation else "field"
            for fname, f in t.fields.items():
                arg_terms = [tok for a in f.args for tok in (a.lower(), *_ident_terms(a))]
                arg_desc = " ".join(a.description or "" for a in f.args.values())
                named = get_named_type(f.type)
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
                units.append(_unit("enum", t.name, v, v, "", value.description))
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
        for fname, f in _object_fields(schema.type_map[cur]):
            named = get_named_type(f.type)
            edges = [(nxt, 0) for nxt in _returned_types(schema, named)]
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

    plumbing = {
        t.name.lower(): t.name for t in schema.type_map.values() if _is_relay_plumbing(t, schema)
    }
    by_key: dict[str, Unit] = {u.label: u for u in units}
    # A bare mutation name resolves to the mutation unless a type spells it the same.
    for u in units:
        if u.kind == "mutation":
            by_key.setdefault(u.name, u)
    folded: dict[str, Optional[Unit]] = {}
    for key, u in by_key.items():
        low = key.lower()
        folded[low] = u if folded.get(low, u) is u else None
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
        plumbing=plumbing,
    )


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

    Shortest paths come first; among equals, paths from earlier roots come first.
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
        units = [u for u in units if u.kind == "mutation"]
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


def _first_sentence(text: str, limit: int = 80) -> str:
    head = re.split(r"(?<=[.!?])\s", text.strip(), maxsplit=1)[0]
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
        or key in index.excluded_mutations
        or key in index.plumbing
        or _is_hidden_mutation_root(index, key)
    )


def _plumbing_miss(index: Index, key: str) -> Optional[str]:
    """What a Relay wrapper is and what to look up instead. They are left out of
    the index because a selection passes through them, never stops at them."""
    name = index.plumbing.get(key)
    if name is None:
        return None
    t = index.schema.type_map[name]
    assert isinstance(t, GraphQLObjectType)
    node = _node_type(t)
    if node is not t:
        return (
            f"-- {name} is a connection over {node.name}: select "
            f"`edges {{ node {{ ... }} }}` and `pageInfo`. Look up {node.name}."
        )
    if "node" in t.fields:
        inner = get_named_type(t.fields["node"].type).name
        return (
            f"-- {name} is a connection edge over {inner}: select `node {{ ... }}`. "
            f"Look up {inner}."
        )
    return f"-- {name} is Relay pagination plumbing: {', '.join(t.fields)}."


def _is_hidden_mutation_root(index: Index, key: str) -> bool:
    return (
        not index.includes_mutations
        and index.mutation_root is not None
        and key == index.mutation_root.lower()
    )


def _unknown_type(index: Index, name: str) -> Optional[str]:
    """The miss for ``Word.member`` when ``Word`` is no type, with the nearest
    type names. A dotted query is scoped on purpose and is not searched at large."""
    owner, dot, member = name.strip().partition(".")
    if not dot or not member or not owner or index.resolve(owner) is not None:
        return None
    if " " in owner or " " in member.strip():
        return None
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
    owner = index.resolve(owner_key)
    if not dot or not member or owner is None or owner.kind != "type":
        return None
    return owner.name, member


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
    if miss := _unknown_type(index, query):
        return miss
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
    groups: dict[tuple[str, str], list[Unit]] = {}
    group_score: dict[tuple[str, str], float] = {}
    for score, u in scored:
        groups.setdefault((u.kind, u.signature), []).append(u)
        group_score.setdefault((u.kind, u.signature), score)
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
    used = sum(len(n) + 1 for n in [*note, *lines, *expansions])
    if any(_uses_pagination(text) for _, text, _ in ordered) or any(
        map(_uses_pagination, expansions)
    ):
        used += len(_PAGINATION_LEGEND) + 1
    left: Counter[str] = Counter(owner or _SHARED for owner, _ in entries)
    for i, (is_hit, line, owner) in enumerate(ordered):
        # A header only goes in with the hit that follows it; the last hit needs no trailer.
        last = i + (1 if is_hit else 2) >= len(ordered)
        trailer = "" if last else _trailer(left)
        need = len(line) + 1 if is_hit else len(line) + 1 + len(ordered[i + 1][1]) + 1
        if used + need + len(trailer) > budget:
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


def _print_compact(t: GraphQLNamedType) -> str:
    """The type as SDL with one line per member and descriptions as trailing comments."""
    note = f"  # {_first_sentence(t.description)}" if t.description else ""
    if isinstance(t, GraphQLUnionType):
        return f"union {t.name} = {' | '.join(m.name for m in t.types)}{note}"
    if isinstance(t, GraphQLScalarType):
        return f"scalar {t.name}{note}"
    members: list[tuple[str, Optional[str]]]
    if isinstance(t, GraphQLEnumType):
        head = f"enum {t.name}"
        members = [(v, value.description) for v, value in t.values.items()]
    elif isinstance(t, GraphQLInputObjectType):
        head = f"input {t.name}"
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


def _path_lines(paths: Iterable[tuple[str, ...]]) -> list[str]:
    """One ``# via`` line per path of ``Type.field`` hops."""
    return [f"# via {' > '.join(path)}" for path in paths]


def _within(parts: Sequence[str], budget: int) -> str:
    """Join ``parts`` up to ``budget`` characters, cutting only at whole parts or, for
    the first part, at whole lines with the block kept closed. A cut always leaves
    room for the note that names what was cut; when not even that fits, the
    answer is the bare count, or nothing."""
    out: list[str] = []
    used = 0
    for i, part in enumerate(parts):
        after = parts[i + 1 :]
        # Accept a whole part only if the note for whatever follows still fits.
        reserve = len(_omitted(after, limit=0)) + 1 if after else 0
        if used + len(part) + 1 + reserve <= budget:
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
    lines = part.splitlines()
    closing = ["}"] if part.rstrip().endswith("}") else []
    body = lines[: len(lines) - len(closing)]
    sections = [_fitting_note(after, budget // 4)] if after else []
    trailer = len(f"  # ... {len(body)} more lines omitted") + 1
    trailer += sum(len(line) + 1 for line in (*closing, *sections))
    room = budget - trailer
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
    first = part.splitlines()[0] if part else ""
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
    section, the rest are named as omitted. Fixed trailing lines appear once
    at the end.
    """
    requests = [("name", n) for n in names] + [("search", q) for q in search]
    if not requests:
        return lookup(index, index.query_root, budget)
    trailing = (_PAGINATION_LEGEND, _MUTATIONS_DISABLED)
    labelled = len(search) > 1
    sections: list[str] = []
    seen: list[str] = []
    remaining = budget - sum(len(t) + 1 for t in trailing)
    for i, (kind, arg) in enumerate(requests):
        left = len(requests) - i
        if remaining < _MIN_SHARE:
            sections.append(f"-- {left} more requests omitted; ask for fewer at once.")
            break
        share = max(remaining // left, _MIN_SHARE)
        if kind == "name":
            text = _with_legend(_budgeted(_lookup_parts(index, arg), share))
        else:
            header = f"# search: {_echo(_clip(arg))}\n" if labelled else ""
            text = header + _free_text_search(index, arg, share - len(header))
        kept: list[str] = []
        for line in text.splitlines():
            if line in trailing:
                if line not in seen:
                    seen.append(line)
            else:
                kept.append(line)
        sections.append("\n".join(kept))
        remaining -= len(sections[-1]) + 2
    return _fit("\n".join(["\n\n".join(sections), *seen]), budget)


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
    u = index.resolve(name)
    if u is None:
        if key in index.excluded_mutations:
            return [f"-- {name} is a mutation. {_MUTATIONS_DISABLED}"]
        if _is_hidden_mutation_root(index, key):
            return [f"-- {index.mutation_root} is the mutation root. {_MUTATIONS_DISABLED}"]
        if wrapper := _plumbing_miss(index, key.partition(".")[0]):
            return [wrapper]
        if unknown := _unknown_member(index, name):
            owner, member = unknown
            shown = _echo(member)
            return [f"-- {owner} has no field {shown!r}. Try search('{owner} {shown}')."]
        if miss := _unknown_type(index, name):
            return [miss]
        shown = _echo(name)
        return [f"-- No type, field, or mutation named {shown!r}. Try search('{shown}')."]
    schema = index.schema
    parts: list[str]
    if u.kind == "type":
        t = schema.type_map[u.name]
        parts = [_print_compact(t)]
        if isinstance(t, GraphQLInputObjectType):
            parts.append(f"# input for {', '.join(index.used_by.get(u.name, [])[:4])}")
        elif isinstance(t, GraphQLEnumType):
            parts.append(f"# used by {', '.join(index.used_by.get(u.name, [])[:4])}")
        else:
            if isinstance(t, GraphQLInterfaceType):
                possible = ", ".join(p.name for p in schema.get_possible_types(t))
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
            parts.append(f"# {u.description}")
        parts.extend(
            _print_compact(t)
            for t in _input_closure(get_named_type(a.type) for a in f.args.values())
        )
        parts.extend(_stubs([get_named_type(f.type)]))
    else:
        parts = [f"{u.parent}.{u.signature}"]
        if u.description:
            parts.append(f"# {u.description}")
        if u.kind == "field":
            hop = f"{u.parent}.{u.name}"
            parts.extend(_path_lines((*p, hop) for p in reach_paths(index, u.parent)))
            parts.extend(_field_dependencies(index, u))
        else:
            parts.append(f"# {u.kind} for {', '.join(index.used_by.get(u.parent, [])[:3])}")
    return parts
