"""Exhaustive checks over the function policy's decision surface.

The function allowlist decides on the parser's node *class*, not on the text a
caller typed. That surface is finite -- the parser models several hundred
functions with dedicated classes -- so it can be tested by enumeration rather
than by sampling. Doing so closes a whole category of bypass completely: a
function whose class the policy never anticipated is the exact shape of defect
that motivated checking classes in the first place.

Enumeration also turns parser upgrades into a test result instead of a review
question. A new release can add classes, rename them, or move a function from a
generic call node to a dedicated class, and each of those changes what the
policy sees without changing a line of our code.
"""

from __future__ import annotations

import inspect

import pytest
from sqlglot import exp

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.allowlist import (
    ALLOWED_FUNC_CLASSES,
    EXCLUDED_FUNC_CLASSES,
    allowed_func_classes,
)
from phoenix.server.mcp_analytics_sql.parse import AdmissionOutcome, _check_functions
from tests.unit.server.mcp_analytics_sql.admission_fixtures import minimal_admission_allowlist


def _function_classes() -> list[type[exp.Func]]:
    """Every function node class the installed parser defines."""
    return [
        obj
        for obj in vars(exp).values()
        if inspect.isclass(obj) and issubclass(obj, exp.Func) and obj is not exp.Func
    ]


FUNCTION_CLASSES = _function_classes()

DIALECTS: list[SupportedSQLDialectName] = ["postgresql", "sqlite"]

# Pinned so that widening the surface is an explicit edit rather than a side
# effect of adding a class to a set. Raise these deliberately, with fixtures and
# a case in the admission corpus for the newly permitted function.
#
# Postgres carries one more than the portable set: an ordered-set aggregate that
# depends on grammar SQLite does not have.
EXPECTED_ALLOWED_BY_DIALECT: dict[SupportedSQLDialectName, int] = {"postgresql": 42, "sqlite": 35}
EXPECTED_EXCLUDED = 6


def test_parser_still_defines_every_classified_function() -> None:
    """Catch classes that vanished or were renamed by a parser upgrade.

    A stale entry is not a security hole -- an unknown class is refused -- but it
    silently narrows what callers can write, and the resulting refusal names a
    function that looks like it should have been allowed. That is a confusing
    failure to debug from the caller's side, so it is worth failing here instead.
    """
    defined = set(FUNCTION_CLASSES)
    stale_allowed = sorted(c.__name__ for c in ALLOWED_FUNC_CLASSES if c not in defined)
    stale_excluded = sorted(c.__name__ for c in EXCLUDED_FUNC_CLASSES if c not in defined)
    assert not stale_allowed, (
        f"allowlisted classes no longer defined by the parser: {stale_allowed}"
    )
    assert not stale_excluded, f"excluded classes no longer defined by the parser: {stale_excluded}"


@pytest.mark.parametrize("sql_dialect", DIALECTS)
def test_allowlist_size_is_pinned(sql_dialect: SupportedSQLDialectName) -> None:
    """Every added function needs fixtures, so the count is asserted, not derived."""
    assert len(allowed_func_classes(sql_dialect)) == EXPECTED_ALLOWED_BY_DIALECT[sql_dialect]
    assert len(EXCLUDED_FUNC_CLASSES) == EXPECTED_EXCLUDED


@pytest.mark.parametrize("sql_dialect", DIALECTS)
def test_portable_classes_are_allowed_everywhere(sql_dialect: SupportedSQLDialectName) -> None:
    """A dialect's set may add to the portable set but must never subtract from it."""
    missing = sorted(c.__name__ for c in ALLOWED_FUNC_CLASSES - allowed_func_classes(sql_dialect))
    assert not missing, f"{sql_dialect} is missing portable classes: {missing}"


def test_allowed_and_excluded_do_not_overlap() -> None:
    """A class in both sets would be skipped before it was ever checked."""
    overlap = sorted(c.__name__ for c in set(ALLOWED_FUNC_CLASSES) & set(EXCLUDED_FUNC_CLASSES))
    assert not overlap, f"classified as both allowed and excluded: {overlap}"


def _class_decided(sql_dialect: SupportedSQLDialectName) -> list[type[exp.Func]]:
    allowed = allowed_func_classes(sql_dialect)
    return [
        c
        for c in FUNCTION_CLASSES
        if c not in allowed
        and c not in EXCLUDED_FUNC_CLASSES
        # Functions the parser could not attribute to a known class arrive as a
        # generic call node, and the policy decides those on the name the caller
        # wrote rather than on the class. They are covered by the name tests
        # below; holding them to the class rule would assert the wrong thing.
        and not issubclass(c, exp.Anonymous)
    ]


# Enumerated per dialect rather than once, so a class permitted on one backend is
# still proven refused on the other. That is the property the per-dialect split
# exists for: the parser will build the node either way, and only this check
# stops a statement the target engine cannot run from being admitted.
CLASS_CASES = [
    pytest.param(sql_dialect, cls, id=f"{sql_dialect[:2]}-{cls.__name__}")
    for sql_dialect in DIALECTS
    for cls in _class_decided(sql_dialect)
]


@pytest.mark.parametrize("sql_dialect,func_class", CLASS_CASES)
def test_unclassified_function_is_refused(
    sql_dialect: SupportedSQLDialectName, func_class: type[exp.Func]
) -> None:
    """Anything the policy has not considered must be refused, not admitted.

    The tree is handed to the check directly rather than rendered to SQL and
    reparsed. A round trip through text cannot express most of these classes: a
    node built without arguments renders to something degenerate like
    ``SELECT FROM spans``, which reparses to a statement that no longer contains
    the class under test, so the check would be asked about a function that is
    not there and would pass for the wrong reason.

    Working on the tree also matches how the policy runs in production, where it
    walks the parsed statement rather than inspecting text.
    """
    select = exp.select(func_class()).from_("spans")
    failure = _check_functions(select, allowlist=minimal_admission_allowlist(), dialect=sql_dialect)
    assert failure is not None, (
        f"{func_class.__name__} is in neither the allowed nor the excluded set for "
        f"{sql_dialect}, yet the function check accepted it. Either add it to that "
        "dialect's set deliberately, with fixtures and a corpus case, or fix the "
        "check that should have refused it."
    )
    assert failure.outcome is AdmissionOutcome.FUNCTION_NOT_ALLOWED


def test_named_generic_call_outside_the_allowlist_is_refused() -> None:
    """The name branch: functions the parser did not attribute to a known class.

    These are the ones a caller can reach simply by inventing a name, so the
    decision falls back to the name text. Anything not named in the allowlist
    must be refused.
    """
    select = exp.select(exp.Anonymous(this="pg_sleep")).from_("spans")
    failure = _check_functions(
        select, allowlist=minimal_admission_allowlist(), dialect="postgresql"
    )
    assert failure is not None
    assert failure.outcome is AdmissionOutcome.FUNCTION_NOT_ALLOWED


@pytest.mark.parametrize(
    "sql_dialect,name",
    [("postgresql", "jsonb_each"), ("sqlite", "json_each")],
)
def test_named_generic_call_inside_the_allowlist_is_accepted(
    sql_dialect: SupportedSQLDialectName, name: str
) -> None:
    """Guards the refusal above: a name rule that refused everything would pass it.

    The two backends spell JSON unnesting differently, so each is checked against
    the name its own engine understands.
    """
    select = exp.select(exp.Anonymous(this=name)).from_("spans")
    assert (
        _check_functions(select, allowlist=minimal_admission_allowlist(), dialect=sql_dialect)
        is None
    )


@pytest.mark.parametrize(
    "sql_dialect,name",
    [("postgresql", "json_each"), ("sqlite", "jsonb_each")],
)
def test_name_allowed_on_one_backend_is_refused_on_the_other(
    sql_dialect: SupportedSQLDialectName, name: str
) -> None:
    """The names above, swapped. Each is a real function -- on the other engine.

    A single shared name list would admit both everywhere, and the statement
    would then fail at execution rather than at admission.
    """
    select = exp.select(exp.Anonymous(this=name)).from_("spans")
    failure = _check_functions(select, allowlist=minimal_admission_allowlist(), dialect=sql_dialect)
    assert failure is not None
    assert failure.outcome is AdmissionOutcome.FUNCTION_NOT_ALLOWED
