"""
Guards the shape of the migration graph.

Phoenix applies migrations with ``command.upgrade(config, "head")`` — singular. A
second head makes that call raise, so the server refuses to start. Nothing in a
merge warns about it: two branches can each append a migration to the same parent
without touching the same line, so git reports no conflict and the break only
appears when a database is opened.

That makes this the failure mode most likely to survive a fork sync unnoticed,
which is why it is asserted here rather than left to a manual check.
"""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

import phoenix.db


def _script_directory() -> ScriptDirectory:
    db_directory = Path(phoenix.db.__file__).parent
    config = Config(str(db_directory / "alembic.ini"))
    config.set_main_option("script_location", str(db_directory / "migrations"))
    return ScriptDirectory.from_config(config)


def test_the_migration_graph_has_exactly_one_head() -> None:
    heads = _script_directory().get_heads()
    assert len(heads) == 1, (
        f"Expected one migration head, found {len(heads)}: {sorted(heads)}. "
        "Two heads mean `alembic upgrade head` fails and Phoenix will not start. "
        "After syncing a fork, re-point the earliest fork-local migration's "
        "`down_revision` at the new upstream head so the graph stays linear."
    )


def test_every_migration_is_reachable_from_the_head() -> None:
    """
    A revision the head cannot reach is a migration that will never run — the
    other way a merge can leave the graph broken without a text conflict.
    """
    script_directory = _script_directory()
    (head,) = script_directory.get_heads()
    reachable = {revision.revision for revision in script_directory.walk_revisions("base", head)}
    all_revisions = {revision.revision for revision in script_directory.walk_revisions()}

    assert all_revisions == reachable, (
        "These migrations are not on the path to the head and would never be "
        f"applied: {sorted(all_revisions - reachable)}"
    )
