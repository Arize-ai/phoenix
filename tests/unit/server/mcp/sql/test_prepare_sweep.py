"""Every statement the corpus admits must be SQL the engine can compile.

The admission corpus pins what is accepted, and acceptance is not the promise
the surface makes: what reaches the engine is not the statement the caller
wrote but the one the rewrite passes emit. A pass that renders a key list as a
row constructor, drops the escaping from a JSON key, or names a column its
relation does not expose produces a hard error that no amount of admission
testing can see, because only a database judges the emission.

Preparing rather than executing is what makes this cheap enough to run over the
whole corpus: the engine resolves names, types and syntax without touching a
row, so no statement needs fixtures, and a case added for its admission
behaviour is covered here the day it is written.

This does not check that the answer is right -- a statement can compile and
still return the wrong number. That is the other half, and it belongs with the
suites that assert values.
"""

from __future__ import annotations

import pytest

from phoenix.server.mcp.sql.allowlist import load_allowlist
from phoenix.server.mcp.sql.parse import AdmissionOutcome, admit, parse_sql, render
from phoenix.server.mcp.sql.rewrite import RewriteContext, rewrite
from phoenix.server.types import DbSessionFactory
from tests.unit.server.mcp.sql.admission_corpus import CASES, AdmissionCase

_ADMITTED = [case for case in CASES if case.expect is AdmissionOutcome.ADMIT]
POSTGRES_CASES = [
    pytest.param(case, id=case.sql[:60]) for case in _ADMITTED if case.dialect == "postgresql"
]
SQLITE_CASES = [
    pytest.param(case, id=case.sql[:60]) for case in _ADMITTED if case.dialect == "sqlite"
]


def _emitted(case: AdmissionCase) -> str:
    """What the engine is actually asked to run."""
    allowlist = load_allowlist(case.dialect)
    root = admit(
        parse_sql(case.sql, dialect=case.dialect), allowlist=allowlist, dialect=case.dialect
    )
    ctx = RewriteContext(allowlist=allowlist, dialect=case.dialect, row_limit=100)
    return render(rewrite(root, ctx), dialect=case.dialect)


@pytest.mark.postgres_only
@pytest.mark.parametrize("case", POSTGRES_CASES)
async def test_postgres_emission_compiles(
    analytics_postgres_db: DbSessionFactory, case: AdmissionCase
) -> None:
    emitted = _emitted(case)
    async with analytics_postgres_db() as session:
        # The driver, not `text()`: a colon inside a JSON literal is a bind
        # parameter to SQLAlchemy and the statement never reaches the engine.
        connection = await session.connection()
        await connection.exec_driver_sql(f"PREPARE _sweep AS {emitted}")
        await connection.exec_driver_sql("DEALLOCATE _sweep")


@pytest.mark.parametrize("case", SQLITE_CASES)
async def test_sqlite_emission_compiles(
    analytics_sqlite_db: tuple[DbSessionFactory, str], case: AdmissionCase
) -> None:
    db, _ = analytics_sqlite_db
    emitted = _emitted(case)
    async with db() as session:
        # EXPLAIN compiles the statement without producing rows from it.
        connection = await session.connection()
        await connection.exec_driver_sql(f"EXPLAIN {emitted}")
