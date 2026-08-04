import logging
import sqlite3
from pathlib import Path

import pytest

from phoenix.server.mcp_analytics_sql.execute import _sqlite_authorizer


def test_sqlite_authorizer_denies_table_and_function(tmp_path: Path) -> None:
    db_path = tmp_path / "auth.db"
    conn_rw = sqlite3.connect(db_path)
    conn_rw.executescript("CREATE TABLE spans(id INTEGER); CREATE TABLE api_keys(secret TEXT);")
    conn_rw.close()

    ro = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    ro.set_authorizer(_sqlite_authorizer(frozenset({"spans"}), frozenset({"count"})))

    def denies(sql: str) -> bool:
        try:
            ro.execute(sql).fetchone()
        except sqlite3.Error:
            return True
        return False

    try:
        ro.execute("SELECT count(id) FROM spans").fetchone()
        # `api_keys` was created for this and then never queried, so the table
        # half of the name was untested: deleting the authorizer's table branch
        # left this green. It is the half that matters more -- a denied function
        # costs a query, a readable table costs the data in it.
        assert denies("SELECT secret FROM api_keys")
        assert denies("SELECT abs(id) FROM spans")
    finally:
        ro.close()


def test_denial_distinguishes_a_bypass_from_a_layering_defect(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The two causes of a denial need different reactions, so they need different logs.

    A denied name that belongs to Phoenix's schema means admission let through a
    table it should have refused, which is the case this gate exists for. A
    denied name belonging to no table means the statement or its rewrites created
    a relation the gate did not know about, which refuses a query the caller was
    entitled to run.

    Logged identically, the second drowns the first. Over one measured session
    the table check fired eleven times and every hit was the second kind, which
    was invisible until the two were separated.
    """
    import sqlite3

    for table, expect_bypass in (("api_keys", True), ("some_cte_alias", False)):
        caplog.clear()
        with caplog.at_level(logging.ERROR):
            authorizer = _sqlite_authorizer(frozenset({"spans"}), frozenset())
            verdict = authorizer(sqlite3.SQLITE_READ, table, "col", "main", None)
        assert verdict == sqlite3.SQLITE_DENY
        logged = caplog.text
        assert ("admission bypass" in logged) is expect_bypass, (
            f"{table!r} was classified wrongly: {logged!r}"
        )
        assert ("layering defect" in logged) is not expect_bypass


@pytest.mark.parametrize(
    ("sql", "allowed"),
    [
        ("SELECT (SELECT count(*) FROM users)", False),
        ("SELECT (SELECT count(*) FROM sqlite_master)", False),
        ("SELECT count(*) FROM projects", True),
        ("WITH t AS (SELECT id FROM projects GROUP BY id) SELECT count(*) FROM t", True),
    ],
    ids=["count-forbidden-table", "count-catalog", "count-allowed-table", "count-materialised-cte"],
)
def test_table_level_reads_are_judged_before_the_transient_accept(sql: str, allowed: bool) -> None:
    """`count(*)` names no column, so its read presents with no database attached.

    That is indistinguishable in shape from a materialised CTE, so an accept
    path for transient tables placed first returned OK before the catalog deny
    and before the allowlist check — and this gate stopped being a backstop for
    every count-shaped read. Admission refuses these independently, so nothing
    leaked; what was missing was the second layer, which the authorizer's own
    logging calls by name.

    The CTE case is here to keep the fix honest: reordering must not re-break
    the materialised-CTE reads that the transient accept was added for.
    """
    import sqlean

    conn = sqlean.connect(":memory:")
    try:
        conn.execute("CREATE TABLE users(id INTEGER)")
        conn.execute("INSERT INTO users VALUES(1)")
        conn.execute("CREATE TABLE projects(id INTEGER)")
        conn.execute("INSERT INTO projects VALUES(1)")
        conn.set_authorizer(
            _sqlite_authorizer(
                frozenset({"projects"}), frozenset({"count"}), None, frozenset({"t"})
            )
        )
        try:
            conn.execute(sql).fetchone()
            permitted = True
        except Exception:
            permitted = False
    finally:
        conn.close()
    assert permitted is allowed
