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

    Columns are taken from the real specs for the same reason. They used to be
    `columns=()`, which left `hidden_columns` empty on every table, so
    `_check_hidden_columns` returned at its first line and the corpus could not
    express a column outcome at all -- it contained no `column_not_allowed`
    entry and structurally could not. Three of the four column bypasses this
    surface has had were therefore invisible to the one file whose job is to
    record what must stay refused.
    """
    real = load_allowlist().table_specs
    specs = {
        name: TableSpec(
            name=name,
            area="test",
            grain="",
            columns=real[name].columns,
            hidden_columns=real[name].hidden_columns,
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
