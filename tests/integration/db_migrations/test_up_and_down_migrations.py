"""
Database migration up/down test module.

Tests that all database migrations can be safely applied and rolled back.
Validates linear migration history, bidirectional capability, and repeatability
across SQLite and PostgreSQL backends using Alembic.
"""

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine

from . import _down, _up, _verify_clean_state


def test_up_and_down_migrations(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """
    Test complete migration lifecycle - all migrations can be applied and rolled back.

    Validates:
    1. Clean database state before migrations
    2. Full migration cycle: base -> head -> base
    3. Individual migration steps with bidirectional testing
    4. Linear migration history (no branches)
    5. Migration repeatability (up/down cycles work reliably)

    Args:
        _engine: Database engine fixture
        _alembic_config: Alembic configuration fixture
        _schema: Database schema name fixture

    Raises:
        AssertionError: If migrations fail or history is non-linear
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    # Verify clean state and test full migration cycle
    _verify_clean_state(_engine, _schema)
    _up(_engine, _alembic_config, "head", _schema)
    _down(_engine, _alembic_config, "base", _schema)

    # Get migration history and test each step individually
    script = ScriptDirectory.from_config(_alembic_config)
    revisions = list(reversed(list(script.walk_revisions())))

    for a, b in zip(revisions, revisions[1:]):
        # Ensure linear history
        assert b.down_revision == a.revision, (
            f"Non-linear migration history: {b.revision} -> {b.down_revision}, expected {a.revision}"
        )

        # Test each migration step twice for reliability
        for _ in range(2):
            _up(_engine, _alembic_config, b.revision, _schema)
            _down(_engine, _alembic_config, a.revision, _schema)
