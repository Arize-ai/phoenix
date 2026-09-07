"""Searchable sub-graph of the GraphQL schema for agents.

The full schema is far too large for a model's context. ``build_index`` runs
once per schema; ``search`` returns ranked one-line hits for a free-text
query and ``lookup`` renders one type, field, or mutation in full with the
path that reaches it. Every renderer works to a character budget.
"""

from __future__ import annotations

import functools
import math
import re
import threading
import weakref
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
from graphql.utilities.print_schema import print_type

__all__ = [
    "READ_ROOTS",
    "Index",
    "Unit",
    "build_index",
    "cached_index",
    "lookup",
    "reach_paths",
    "search",
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


@functools.lru_cache(maxsize=65536)
def _stem(word: str) -> str:
    if len(word) > _MAX_STEM_CHARS:
        return word
    with _stemmer_lock:
        return str(_stemmer.stemWord(word))


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
    return [_stem(t) for w in words[:_MAX_QUERY_TERMS] for t in _expand(w)]


_ACTION_VERBS = frozenset(
    _stem(v)
    for v in ("create", "add", "delete", "patch", "set", "update", "clear", "remove", "revoke")
)


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
    roots: frozenset[str]
    includes_mutations: bool
    excluded_mutations: Mapping[str, frozenset[str]]  # lowercase name -> its stemmed tokens
    units: list[Unit]
    idf: Mapping[str, float]
    avg_len: Mapping[str, float]
    nearest: Mapping[str, tuple[str, int, tuple[str, ...]]]  # type -> (root, depth, hops)
    used_by: Mapping[str, list[str]]  # input or enum type -> referencing "Type.field"
    returned_by: Mapping[str, list[str]]  # object type -> "Type.field" returning it
    by_key: Mapping[str, Unit]  # lowercase "Type", "Type.field", "mutationName"

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


def _is_relay_plumbing(t: GraphQLNamedType) -> bool:
    if not isinstance(t, GraphQLObjectType):
        return False
    keys = t.fields.keys()
    return t.name == "PageInfo" or {"edges", "pageInfo"} <= keys or {"node", "cursor"} <= keys


def _skip(t: GraphQLNamedType, schema: GraphQLSchema) -> bool:
    return (
        is_introspection_type(t)
        or isinstance(t, GraphQLScalarType)
        or t is schema.subscription_type
        or _is_relay_plumbing(t)
    )


def _args(field: _FieldLike) -> Mapping[str, GraphQLArgument]:
    return field.args if isinstance(field, GraphQLField) else {}


def _default(value_def: _ValueDef) -> str:
    if value_def.default_value is Undefined:
        return ""
    node = ast_from_value(value_def.default_value, value_def.type)
    return f" = {print_ast(node)}" if node is not None else ""


def _signature(name: str, field: _FieldLike) -> str:
    args = ", ".join(f"{a}: {arg.type}{_default(arg)}" for a, arg in _args(field).items())
    suffix = _default(field) if isinstance(field, GraphQLInputField) else ""
    return f"{name}({args}): {field.type}{suffix}" if args else f"{name}: {field.type}{suffix}"


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


def _mutation_only_types(schema: GraphQLSchema) -> set[str]:
    """Types that exist only to serve mutations: their input closures and payloads."""
    mutation = schema.mutation_type
    if mutation is None:
        return set()
    others = [
        t
        for t in schema.type_map.values()
        if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType))
        and t is not mutation
        and not is_introspection_type(t)
    ]
    from_mutation = _input_closure(
        get_named_type(a.type) for f in mutation.fields.values() for a in f.args.values()
    )
    elsewhere = _input_closure(
        get_named_type(a.type) for t in others for f in t.fields.values() for a in f.args.values()
    )
    only = {t.name for t in from_mutation} - {t.name for t in elsewhere}
    # Payloads: object types returned only by mutation fields or by other payloads.
    returned: dict[str, set[str]] = defaultdict(set)
    for t in (*others, mutation):
        for f in t.fields.values():
            returned[_node_type(get_named_type(f.type)).name].add(t.name)
    changed = True
    while changed:
        changed = False
        for name, parents in returned.items():
            if name not in only and parents <= only | {mutation.name}:
                only.add(name)
                changed = True
    return only


def build_index(
    schema: GraphQLSchema,
    roots: Sequence[str] = READ_ROOTS,
    *,
    include_mutations: bool = True,
) -> Index:
    """Index every type, field, argument, input field, and enum value of ``schema``.

    With ``include_mutations`` false the mutation root and every type that exists
    only to serve it are left out, so a session that cannot run mutations is
    never shown one. Their names are kept so a lookup can say why they are absent.
    """
    query_root = schema.query_type.name if schema.query_type is not None else "Query"
    mutation = schema.mutation_type
    mutation_root = mutation.name if mutation is not None else None
    excluded_types: set[str] = set()
    excluded_mutations: dict[str, frozenset[str]] = {}
    if mutation is not None and not include_mutations:
        excluded_types = _mutation_only_types(schema) | {mutation.name}
        for fname in mutation.fields:
            excluded_mutations[fname.lower()] = frozenset(_ident_terms(fname))

    units: list[Unit] = []
    used_by: dict[str, list[str]] = defaultdict(list)
    returned_by: dict[str, list[str]] = defaultdict(list)
    for t in schema.type_map.values():
        if _skip(t, schema) or t.name in excluded_types:
            continue
        if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
            kind = "mutation" if t is mutation else "field"
            for fname, f in t.fields.items():
                arg_terms = [tok for a in f.args for tok in (a.lower(), *_ident_terms(a))]
                arg_desc = " ".join(a.description or "" for a in f.args.values())
                named = get_named_type(f.type)
                returned_by[_node_type(named).name].append(f"{t.name}.{fname}")
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
    n = len(units)
    idf = {term: math.log(1 + (n - d + 0.5) / (d + 0.5)) for term, d in df.items()}
    avg_len = {f: sum(sum(u.terms[f].values()) for u in units) / n for f in _FIELD_WEIGHTS}

    # Multi-source breadth-first search from the read roots over forward edges,
    # with connections collapsed to their node type.
    present_roots = [query_root, *(r for r in roots if r in schema.type_map and r != query_root)]
    nearest: dict[str, tuple[str, int, tuple[str, ...]]] = {r: (r, 0, ()) for r in present_roots}
    queue = deque(nearest)
    while queue:
        cur = queue.popleft()
        root, depth, hops = nearest[cur]
        for fname, f in _object_fields(schema.type_map[cur]):
            nxt = _node_type(get_named_type(f.type))
            if nxt.name not in nearest and isinstance(
                nxt, (GraphQLObjectType, GraphQLInterfaceType)
            ):
                nearest[nxt.name] = (root, depth + 1, (*hops, f"{cur}.{fname}"))
                queue.append(nxt.name)

    # Entry points first: query-root fields, then fields on read roots, then the rest.
    rank = {r: i for i, r in enumerate(present_roots)}
    for sources in returned_by.values():
        sources.sort(key=lambda s: (rank.get(s.split(".")[0], len(rank)), s))

    by_key: dict[str, Unit] = {}
    for u in units:
        if u.kind == "type":
            by_key[u.name.lower()] = u
        elif u.kind == "mutation":
            by_key[u.name.lower()] = u
            by_key[f"{u.parent.lower()}.{u.name.lower()}"] = u
        else:
            by_key[f"{u.parent.lower()}.{u.name.lower()}"] = u
    return Index(
        schema=schema,
        query_root=query_root,
        mutation_root=mutation_root,
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
    )


_INDEX_CACHE: weakref.WeakKeyDictionary[GraphQLSchema, dict[bool, Index]] = (
    weakref.WeakKeyDictionary()
)


def cached_index(schema: GraphQLSchema, *, include_mutations: bool = True) -> Index:
    """The index for ``schema``, built once per schema object and mutation setting."""
    variants = _INDEX_CACHE.setdefault(schema, {})
    if include_mutations not in variants:
        variants[include_mutations] = build_index(schema, include_mutations=include_mutations)
    return variants[include_mutations]


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


def _rank(index: Index, terms: Sequence[str], wants_mutation: bool) -> list[tuple[float, Unit]]:
    """Score every unit: BM25F, a share of the owning type's own score, a boost
    for proximity to a read root normalized over the matches, then kind adjustments.
    """
    bm25 = [(u, _bm25f(index, u, terms)) for u in index.units]
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
    elif u.kind == "enum":
        line = f"enum {u.parent}.{u.name}  used by {', '.join(index.used_by.get(u.parent, [])[:2])}"
    elif u.kind == "input":
        owners = ", ".join(index.used_by.get(u.parent, [])[:2])
        line = f"input {u.parent}.{u.signature}  input for {owners}"
    elif u.kind == "mutation":
        line = f"mutation {u.signature}"
    elif len(group) == 1:
        line = f"{u.parent}.{u.signature}"
        if u.parent != index.query_root:
            line += f"  via {index.via(u.parent)}"
    else:
        on = ", ".join(x.parent for x in group[:6])
        if len(group) > 6:
            on += f" +{len(group) - 6}"
        line = f"{u.signature}  # on {on}"
    if u.description and any(term in u.terms["desc"] for term in terms):
        line += f'  "{_first_sentence(u.description)}"'
    return line


_MUTATIONS_DISABLED = "-- Mutations are disabled for this session and are not listed."


def _names_excluded_mutation(index: Index, terms: Sequence[str]) -> bool:
    """Whether the query spells out a mutation that was left out of the index."""
    have = set(terms)
    return any(tokens <= have for tokens in index.excluded_mutations.values())


def search(index: Index, query: str, budget: int = 1500) -> str:
    """Ranked one-line hits for a free-text query, within ``budget`` characters.

    A query that exactly names a type, ``Type.field``, or mutation is a lookup.
    """
    key = query.strip().lower()
    if key in index.by_key or key in index.excluded_mutations:
        return lookup(index, query)
    terms = _query_terms(query)
    if not terms:
        return (
            "-- Empty query. Search for a concept ('span cost') "
            "or name a type or field ('Span.costSummary')."
        )
    wants_mutation = any(t in _ACTION_VERBS for t in terms)
    note: list[str] = []
    if not index.includes_mutations and (wants_mutation or _names_excluded_mutation(index, terms)):
        note.append(_MUTATIONS_DISABLED)
    scored = _rank(index, terms, wants_mutation)
    # One line per distinct signature; the parents it occurs on are listed
    # best score first, so the type the query named leads the list.
    groups: dict[tuple[str, str], list[Unit]] = {}
    for _, u in scored:
        groups.setdefault((u.kind, u.signature), []).append(u)
    if not groups:
        miss = f"-- No type, field, argument, enum value, or description matched {query!r}."
        return "\n".join([miss, *note])
    lines: list[str] = []
    used = sum(len(n) + 1 for n in note)
    for i, group in enumerate(groups.values()):
        line = _line(index, group, terms)
        trailer = f"... {len(groups) - i} more; narrow the search"
        if used + len(line) + 1 + len(trailer) > budget:
            lines.append(trailer)
            break
        lines.append(line)
        used += len(line) + 1
    return "\n".join([*lines, *note])


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


def _neighbors(index: Index, t: _ObjectLike) -> Iterator[GraphQLNamedType]:
    seen: set[str] = set()
    for f in t.fields.values():
        n = _node_type(get_named_type(f.type))
        if n.name in seen or n.name == t.name or _skip(n, index.schema) or not _member_names(n):
            continue
        seen.add(n.name)
        yield n


def _print_pruned(t: _ObjectLike, field_names: Sequence[str]) -> str:
    """The type with only the named fields, as SDL an agent can copy from."""
    keyword = "interface" if isinstance(t, GraphQLInterfaceType) else "type"
    implements = ""
    if t.interfaces:
        implements = " implements " + " & ".join(i.name for i in t.interfaces)
    body = "\n".join(f"  {_signature(f, t.fields[f])}" for f in field_names)
    return f"{keyword} {t.name}{implements} {{\n{body}\n}}"


def _pruned_path_types(index: Index, paths: Iterable[tuple[str, ...]]) -> list[str]:
    """Every type on the paths, pruned to the fields the paths use, root first."""
    fields_by_type: dict[str, list[str]] = {}
    for path in paths:
        for hop in path:
            type_name, field_name = hop.split(".", 1)
            fields = fields_by_type.setdefault(type_name, [])
            if field_name not in fields:
                fields.append(field_name)
    parts: list[str] = []
    for type_name, fields in fields_by_type.items():
        t = index.schema.type_map[type_name]
        if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
            parts.append(_print_pruned(t, fields))
    return parts


def _within(parts: Sequence[str], budget: int) -> str:
    """Join ``parts`` up to ``budget`` characters, cutting only at whole parts or, for
    the first part, at whole lines with the block kept closed."""
    out: list[str] = []
    used = 0
    for i, part in enumerate(parts):
        if used + len(part) + 1 <= budget:
            out.append(part)
            used += len(part) + 1
            continue
        room = budget - used - 40
        if i == 0 and room > 0:
            kept: list[str] = []
            for line in part.splitlines():
                if sum(len(k) + 1 for k in kept) + len(line) + 1 > room:
                    break
                kept.append(line)
            kept.append(f"  # ... {len(part.splitlines()) - len(kept)} more lines omitted")
            if part.rstrip().endswith("}"):
                kept.append("}")
            out.append("\n".join(kept))
            if len(parts) > 1:
                out.append(f"# ... {len(parts) - 1} more sections omitted")
        else:
            out.append(f"# ... {len(parts) - i} more sections omitted")
        break
    return "\n".join(out)


def lookup(index: Index, name: str, budget: int = 4000) -> str:
    """One type, ``Type.field``, or mutation rendered in full with the path that reaches it."""
    key = name.strip().lower()
    u = index.by_key.get(key)
    if u is None:
        if key in index.excluded_mutations:
            return f"-- {name.strip()} is a mutation. {_MUTATIONS_DISABLED}"
        return f"-- No type, field, or mutation named {name!r}. Try search('{name}')."
    schema = index.schema
    parts: list[str]
    if u.kind == "type":
        t = schema.type_map[u.name]
        parts = [print_type(t)]
        if isinstance(t, GraphQLInputObjectType):
            parts.append(f"# input for {', '.join(index.used_by.get(u.name, [])[:4])}")
        elif isinstance(t, GraphQLEnumType):
            parts.append(f"# used by {', '.join(index.used_by.get(u.name, [])[:4])}")
        else:
            if isinstance(t, (GraphQLInterfaceType, GraphQLUnionType)):
                possible = ", ".join(p.name for p in schema.get_possible_types(t))
                if possible:
                    parts.append(f"# possible types: {possible}")
            if paths := reach_paths(index, u.name):
                parts.append("# reached through:")
                parts.extend(_pruned_path_types(index, paths))
            elif sources := index.returned_by.get(u.name):
                parts.append(f"# returned by {', '.join(sources[:4])}")
            if isinstance(t, (GraphQLObjectType, GraphQLInterfaceType)):
                parts.extend(_stub(n) for n in _neighbors(index, t))
    elif u.kind == "mutation":
        mutation = schema.mutation_type
        assert mutation is not None
        f = mutation.fields[u.name]
        parts = [f"mutation {u.signature}"]
        if u.description:
            parts.append(f"# {u.description}")
        parts.extend(
            print_type(t) for t in _input_closure(get_named_type(a.type) for a in f.args.values())
        )
        parts.append(_stub(get_named_type(f.type)))
    else:
        parts = [f"{u.parent}.{u.signature}"]
        if u.description:
            parts.append(f"# {u.description}")
        if u.kind == "field":
            hop = f"{u.parent}.{u.name}"
            paths = [(*p, hop) for p in reach_paths(index, u.parent)] or [(hop,)]
            parts.append("# reached through:")
            parts.extend(_pruned_path_types(index, paths))
        else:
            parts.append(f"# {u.kind} for {', '.join(index.used_by.get(u.parent, [])[:3])}")
    return _within(parts, budget)
