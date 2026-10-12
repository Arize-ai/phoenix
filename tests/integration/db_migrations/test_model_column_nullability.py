"""The models and the schema the migrations build agree on which columns are nullable.

Tests build their databases from the models, and production builds its database from the
migrations, so a column that is NOT NULL in one and nullable in the other is invisible to
every other test. Only nullability is compared: Alembic's compare_metadata also reports type
and server-default differences that are known and harmless.
"""

from alembic.config import Config
from sqlalchemy import Connection, inspect
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.db import models

from . import _run_async, _up


async def test_model_column_nullability_matches_migrated_schema(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, "head", _schema)

    def _mismatches(conn: Connection) -> list[str]:
        inspector = inspect(conn)
        schema = _schema or None
        migrated_tables = set(inspector.get_table_names(schema=schema))
        mismatches: list[str] = []
        for table in models.Base.metadata.sorted_tables:
            if table.name not in migrated_tables:
                mismatches.append(f"{table.name}: not created by the migrations")
                continue
            migrated = {c["name"]: c["nullable"] for c in inspector.get_columns(table.name, schema)}
            for column in table.columns:
                if column.name not in migrated:
                    mismatches.append(f"{table.name}.{column.name}: not created by the migrations")
                elif not column.primary_key and column.nullable != migrated[column.name]:
                    mismatches.append(
                        f"{table.name}.{column.name}: model nullable={column.nullable}, "
                        f"migrated nullable={migrated[column.name]}"
                    )
        return mismatches

    mismatches = await _run_async(_engine, _mismatches)
    assert not mismatches, "\n".join(mismatches)
