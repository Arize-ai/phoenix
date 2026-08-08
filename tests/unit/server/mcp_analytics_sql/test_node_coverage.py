"""Which node classes a statement can contain, and whether anything decides.

Admission is built from two allowlists that are each closed over their own base
class. The function policy enumerates every ``exp.Func`` subclass and refuses
anything unlisted. ``_check_base_tables`` does the same over ``exp.Table``
sources. Between them sits everything else the parser can build, and for those
there is only ``_REFUSED_NODE_CLASSES``, which is a denylist.

That seam is where three defects were found in one night, all with the same
signature: a node that looks like a function call or a table modifier but is not
the class the check expects. ``exp.Lambda`` is how ``->`` parses inside an
argument list, and it made ``MIN`` return the maximum. ``exp.Operator`` let
``OPERATOR(pg_catalog.~)`` through while the same operator's ordinary spelling
was refused. ``exp.TableSample`` was accepted and then silently discarded.

None of the three was found by a check. They were found by looking, which does
not scale and does not run in CI.

What this file closes, and what it does not
-------------------------------------------
The installed parser defines roughly a thousand expression classes, of which
about 560 are functions. The remaining several hundred are the seam. Reviewing
all of them is the right thing and is not what this does.

This pins the classes actually reachable from the admission corpus. A parser
upgrade that changes how existing SQL parses, or a corpus entry that introduces
a shape nobody classified, fails here and asks for one review. That is strictly
weaker than enumerating the whole seam -- it covers what the corpus reaches, not
what is possible -- and the gap between those two is the remaining work.
"""

from __future__ import annotations

import inspect
import json
from pathlib import Path

import pytest
from sqlglot import exp, parse_one

from phoenix.server.mcp_analytics_sql.parse import _REFUSED_NODE_CLASSES

CORPUS = Path(__file__).with_name("admission_corpus.jsonl")

# Structural classes a SELECT legitimately contains: clauses, literals,
# identifiers, operators and the set-operation forms. Reviewed as a set rather
# than one at a time, because their meaning comes from the statement shape that
# admission already validates rather than from the class itself.
REVIEWED_STRUCTURAL: frozenset[str] = frozenset(
    Path(__file__).with_name("structural_nodes.txt").read_text().split()
)


# The third bucket the docstring names and the code did not have: classes that
# are neither innocuous nor refused outright, because a dedicated check decides
# per occurrence. Listing them here rather than calling them structural keeps
# the claim honest -- something *has* reviewed them -- while recording where the
# decision lives, so a reviewer can find it when the class next appears.
GOVERNED_BY_CHECK: dict[str, str] = {
    # Refused when the left side is a relation (the row-valued escape) or a
    # schema qualifier; a function result is left alone, because
    # `(jsonb_each(x)).key` is the idiomatic way to project one field of a
    # set-returning function on PostgreSQL.
    "Dot": "parse._check_hidden_columns",
    # `regclass` and its siblings, refused as cast targets: they consult the
    # system catalogs for any relation, role or function and never appear as a
    # scanned relation, so the plan gate cannot see them.
    "ObjectIdentifier": "parse._refused_cast_target",
}


def _corpus_statements() -> list[str]:
    return [json.loads(line)["sql"] for line in CORPUS.read_text().splitlines() if line.strip()]


def _non_function_classes(sql: str) -> set[str]:
    found: set[str] = set()
    for dialect in ("sqlite", "postgres"):
        try:
            tree = parse_one(sql, read=dialect)
        except Exception:
            continue
        for node in tree.walk():
            if not isinstance(node, exp.Func):
                found.add(type(node).__name__)
    return found


def test_every_reachable_node_class_is_classified() -> None:
    """No statement in the corpus may contain a node nobody has decided about.

    A new class appearing here means either the parser changed under us or the
    corpus grew a shape that was never reviewed. Both want a human to say which
    of the three buckets it belongs in, and neither should pass silently.
    """
    refused = {cls.__name__ for cls in _REFUSED_NODE_CLASSES}
    unclassified: dict[str, str] = {}
    for sql in _corpus_statements():
        for name in _non_function_classes(sql):
            if (
                name not in REVIEWED_STRUCTURAL
                and name not in refused
                and name not in GOVERNED_BY_CHECK
            ):
                unclassified.setdefault(name, sql)
    assert not unclassified, (
        "node classes reachable from the corpus that nothing classifies:\n"
        + "\n".join(f"  {name}  first seen in: {sql}" for name, sql in sorted(unclassified.items()))
        + "\n\nClassify each into one of the three buckets: structural "
        "(structural_nodes.txt), refused outright (_REFUSED_NODE_CLASSES, with a "
        "message), or governed by a dedicated check (GOVERNED_BY_CHECK, naming it)."
    )


def _refused_classes() -> list[type[exp.Expr]]:
    classes = list(_REFUSED_NODE_CLASSES)
    classes.sort(key=lambda c: c.__name__)
    return classes


@pytest.mark.parametrize("cls", _refused_classes())
def test_refused_classes_still_exist_in_the_parser(cls: type[exp.Expr]) -> None:
    """A renamed class turns its refusal into a silent no-op.

    The denylist is matched by identity, so a class the parser has dropped or
    renamed stops matching anything and the hole it was closing reopens with no
    test failing anywhere else.
    """
    assert inspect.isclass(cls)
    assert getattr(exp, cls.__name__, None) is cls, (
        f"{cls.__name__} is no longer the parser's class of that name; "
        "its entry in _REFUSED_NODE_CLASSES now refuses nothing."
    )


@pytest.mark.parametrize("name,check", sorted(GOVERNED_BY_CHECK.items()))
def test_governed_classes_still_exist_and_are_still_governed(name: str, check: str) -> None:
    """A class in the third bucket must exist, and its check must still be there.

    The bucket records that something reviewed the class, which is only true
    while the named check exists. A rename on either side turns a decision into
    a silent omission -- the class stops being flagged as unclassified, and
    nothing refuses it.
    """
    assert hasattr(exp, name), f"{name} no longer exists in the parser"
    module, attr = check.split(".")
    import phoenix.server.mcp_analytics_sql.parse as parse_module

    assert module == "parse"
    assert hasattr(parse_module, attr), f"{check} no longer exists, so {name} is ungoverned"
