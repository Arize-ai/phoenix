"""
project_sessions and traces have composite indexes with an explicit DESC column
(e.g. ``(project_id, start_time DESC)``, see models.py). SQLite has no native ALTER
for most schema changes, so Alembic's batch mode rebuilds the table instead: reflect
it, build a new one from the reflection, copy rows, swap. SQLAlchemy's reflection
does not preserve DESC on indexes, so a rebuilt table's indexes silently come back
ascending -- no error, row data intact, only the sort order is gone.

Passing ``copy_from=`` avoids reflection entirely: batch mode builds the new table
from the given Table object (the real ORM metadata, which does carry the DESC), not
from what it reads back off the database. That's the only thing separating a
migration that's safe on these two tables from one that quietly isn't.

No current migration batch-alters project_sessions or traces, so this isn't a fix for
existing corruption -- it's a guard against the next one that does. The last test
here is the actual guard: it fails if a future migration adds a batch_alter_table
call on either table without copy_from.
"""

import re
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.db import models

from . import _run_async, _up

_DESC_INDEXED_TABLES = ("project_sessions", "traces")


def _desc_columns(conn: Connection, table_name: str, index_name: str) -> list[str]:
    """Return the column names sorted DESC in an index, per PRAGMA index_xinfo.

    Reflection-free: reads what SQLite actually built the index with, so this
    can't be fooled by the same reflection blind spot the test is checking for.
    """
    rows = conn.execute(text(f"PRAGMA index_xinfo({index_name})")).fetchall()
    # index_xinfo columns: seqno, cid, name, desc, coll, key
    return [row[2] for row in rows if row[2] is not None and row[3] == 1]


async def test_batch_alter_table_without_copy_from_drops_desc_order(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
    _db_backend: str,
) -> None:
    if _db_backend != "sqlite":
        return  # PostgreSQL ALTERs in place and never reflects/rebuilds.

    await _up(_engine, _alembic_config, "head", _schema)

    def _do(conn: Connection) -> None:
        before = _desc_columns(
            conn, "project_sessions", "ix_project_sessions_project_id_start_time"
        )
        assert before == ["start_time"], (
            "sanity check: the index should be DESC before any batch op touches it"
        )

        ctx = MigrationContext.configure(conn)
        op = Operations(ctx)
        with op.batch_alter_table("project_sessions", recreate="always"):
            pass  # any batch op forces the same reflect-rebuild-swap; an empty
            # one isolates the DESC loss from unrelated column-diffing behavior

        after = _desc_columns(conn, "project_sessions", "ix_project_sessions_project_id_start_time")
        assert after == [], (
            "expected the naive batch rebuild to have dropped the DESC ordering -- "
            "if this fails, either SQLAlchemy reflection started preserving index "
            "sort order (great, this whole file can go), or something else changed"
        )

    await _run_async(_engine, _do)


async def test_batch_alter_table_with_copy_from_preserves_desc_order(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
    _db_backend: str,
) -> None:
    if _db_backend != "sqlite":
        return

    await _up(_engine, _alembic_config, "head", _schema)

    def _do(conn: Connection) -> None:
        ctx = MigrationContext.configure(conn)
        op = Operations(ctx)
        with op.batch_alter_table(
            "project_sessions",
            recreate="always",
            copy_from=models.Base.metadata.tables["project_sessions"],
        ):
            pass

        for index_name, column in (
            ("ix_project_sessions_project_id_start_time", "start_time"),
            ("ix_project_sessions_project_id_end_time", "end_time"),
        ):
            assert _desc_columns(conn, "project_sessions", index_name) == [column], (
                f"copy_from should have kept {index_name} sorted DESC through the rebuild"
            )

    await _run_async(_engine, _do)


# First revision where either table has a DESC index at all (both start_time DESC
# indexes are added here, on traces and project_sessions together). A batch_alter_table
# call on one of these tables in an earlier revision predates the DESC index and has
# nothing to lose -- 4ded9e43755f (the table's own creation) is exactly that case.
_FIRST_DESC_INDEX_REVISION = "735d3d93c33e"


def test_no_migration_batch_alters_a_desc_indexed_table_without_copy_from(
    _alembic_config: Config,
) -> None:
    """Guard against a future migration reintroducing the bug above.

    Scans every migration at or after _FIRST_DESC_INDEX_REVISION for
    batch_alter_table("project_sessions" | "traces") calls and fails if one doesn't
    pass copy_from. This is a source scan, not an AST parse, so it only needs the
    table name and copy_from to appear between the call's opening and closing parens
    -- good enough for how these calls are actually written, and it fails loud (with
    the file) if that stops being true.
    """
    script = ScriptDirectory.from_config(_alembic_config)
    ordered_revisions = [r.revision for r in reversed(list(script.walk_revisions()))]
    cutoff = ordered_revisions.index(_FIRST_DESC_INDEX_REVISION)
    revision_by_file = {rev.path: rev.revision for rev in script.walk_revisions()}

    offenders: list[str] = []
    versions_dir = Path(models.__file__).parent / "migrations" / "versions"
    for path in sorted(versions_dir.glob("*.py")):
        revision = revision_by_file.get(str(path))
        if revision is None or ordered_revisions.index(revision) < cutoff:
            continue  # ran before either table had a DESC index; nothing to lose
        source = path.read_text()
        for table in _DESC_INDEXED_TABLES:
            for match in re.finditer(
                rf'batch_alter_table\(\s*["\']({table})["\'].*?\)',
                source,
                re.DOTALL,
            ):
                if "copy_from" not in match.group(0):
                    offenders.append(
                        f"{path.name}: batch_alter_table({table!r}, ...) without copy_from"
                    )
    assert not offenders, (
        "batch_alter_table on a table with a DESC index must pass copy_from= (the "
        "table's own ORM metadata) or SQLite's reflection-based rebuild silently "
        "drops the DESC ordering. See test_batch_alter_table_without_copy_from_drops_"
        "desc_order in this file for why.\n" + "\n".join(offenders)
    )
