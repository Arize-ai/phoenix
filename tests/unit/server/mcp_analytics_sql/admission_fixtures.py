"""Fixtures for SQL admission regression tests."""

from __future__ import annotations

from phoenix.server.mcp_analytics_sql.allowlist import Allowlist, TableSpec, load_allowlist

_TEST_TABLES = frozenset({"spans", "traces", "projects"})


def minimal_admission_allowlist() -> Allowlist:
    """A three-table allowlist that keeps the real function policy.

    Only the table set is narrowed, so corpus statements stay short and their
    outcomes turn on the rule being tested rather than on which of sixteen tables
    happens to be named.

    The function policy is deliberately *not* overridden. Leaving it unset makes
    the allowlist fall through to the shipped per-dialect lists, so the corpus
    exercises the policy that actually runs. A hand-maintained copy here would
    drift from the real one, and the corpus would then certify a policy nothing
    uses -- with the failure showing up as tests passing, which is the worst
    direction for it to fail in.

    Physical and virtual columns are taken from the real specs so the corpus
    exercises the DDL-derived schema used in production. A hand-maintained
    substitute would make column validation tests certify a different surface.
    """
    real = load_allowlist("sqlite").table_specs
    specs = {
        name: TableSpec(
            name=name,
            area="test",
            grain="",
            columns=real[name].columns,
            # Advertised and not stored, so absent from `columns`. Dropping them
            # here made the column policy refuse `latency_ms`, which is a column
            # the schema teaches -- the fixture's omission, not the policy's.
            virtual_columns=real[name].virtual_columns,
        )
        for name in _TEST_TABLES
    }
    return Allowlist(
        tables=_TEST_TABLES,
        table_specs=specs,
        areas={"test": _TEST_TABLES},
        pg_schema="public",
    )
