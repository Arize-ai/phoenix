from __future__ import annotations

import os
import re
from typing import Literal, Optional, TypedDict

import pytest
from alembic import command
from alembic.config import Config
from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA, get_env_database_schema
from sqlalchemy import Connection, Engine, Row, text
from typing_extensions import TypeAlias, assert_never

_DBBackend: TypeAlias = Literal["sqlite", "postgresql"]


def _up(engine: Engine, alembic_config: Config, revision: str) -> None:
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.upgrade(alembic_config, revision)
    engine.dispose()
    actual = _version_num(engine)
    assert actual == (revision,)


def _down(engine: Engine, alembic_config: Config, revision: str) -> None:
    with engine.connect() as conn:
        alembic_config.attributes["connection"] = conn
        command.downgrade(alembic_config, revision)
    engine.dispose()
    assert _version_num(engine) == (None if revision == "base" else (revision,))


def _version_num(engine: Engine) -> Optional[Row[tuple[str]]]:
    schema_prefix = ""
    if engine.url.get_backend_name().startswith("postgresql"):
        assert (schema := os.environ[ENV_PHOENIX_SQL_DATABASE_SCHEMA])
        schema_prefix = f"{schema}."
    table, column = "alembic_version", "version_num"
    stmt = text(f"SELECT {column} FROM {schema_prefix}{table}")
    with engine.connect() as conn:
        return conn.execute(stmt).first()


class _TableSchemaInfo(TypedDict):
    """Schema information for a database table.

    This class encapsulates all schema-related information for a database table,
    including its name, columns, indices, and constraints. It is used to compare
    schema states before and after migrations.

    Attributes:
        table_name: Name of the table being described
        column_names: Set of column names in the table
        index_names: Set of index names defined on the table
        constraint_names: Set of constraint names (excluding NOT NULL constraints)
    """

    table_name: str
    column_names: frozenset[str]
    index_names: frozenset[str]
    constraint_names: frozenset[str]


def _get_table_schema_info(
    conn: Connection,
    table_name: str,
    db_backend: Literal["sqlite", "postgresql"],
) -> Optional[_TableSchemaInfo]:
    """Get schema information for a database table.

    Retrieves comprehensive schema information for a table, including its columns,
    indices, and constraints. The implementation is database-specific to handle
    differences between SQLite and PostgreSQL.

    For PostgreSQL:
    - Gets column names from pg_attribute, excluding dropped columns
    - Gets index names from pg_class and pg_index
    - Gets constraint names from pg_constraint, excluding NOT NULL constraints

    For SQLite:
    - Gets column names and primary key info from PRAGMA table_info
    - Gets index names from PRAGMA index_list and auto-generated primary key indices
    - Gets constraint names from table definition, including CHECK, UNIQUE, and FOREIGN KEY

    Args:
        conn: Database connection to use for queries
        table_name: Name of the table to inspect
        db_backend: Type of database backend ('sqlite' or 'postgresql')

    Returns:
        _TableSchemaInfo object containing all schema information for the table, or None if the table doesn't exist

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database queries fail
        AssertionError: If table definition parsing fails
    """  # noqa: E501
    if db_backend == "postgresql":
        assert (schema := get_env_database_schema())
        # Check if table exists
        table_exists = conn.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relname = :table_name
                    AND n.nspname = :schema
                )
                """
            ),
            {"table_name": table_name, "schema": schema},
        ).scalar_one()
        if not table_exists:
            return None

        # Get column names
        columns_result = conn.execute(
            text(
                """
                SELECT a.attname
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = :table_name
                AND n.nspname = :schema
                AND a.attnum > 0
                AND NOT a.attisdropped
                ORDER BY a.attnum
                """
            ),
            {"table_name": table_name, "schema": schema},
        ).fetchall()
        column_names = {col[0] for col in columns_result}

        # Get index names
        indices_result = conn.execute(
            text(
                """
                SELECT c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_index i ON i.indexrelid = c.oid
                JOIN pg_class t ON t.oid = i.indrelid
                WHERE t.relname = :table_name
                AND n.nspname = :schema
                """
            ),
            {"table_name": table_name, "schema": schema},
        ).fetchall()
        index_names = {idx[0] for idx in indices_result}

        # Get constraint names, excluding NOT NULL constraints
        constraints_result = conn.execute(
            text(
                """
                SELECT c.conname
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE t.relname = :table_name
                AND n.nspname = :schema
                AND c.contype != 'n'  -- Exclude NOT NULL constraints
                """
            ),
            {"table_name": table_name, "schema": schema},
        ).fetchall()
        constraint_names = {con[0] for con in constraints_result}
    elif db_backend == "sqlite":
        # Check if table exists
        table_exists = conn.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT 1 FROM sqlite_master
                    WHERE type = 'table' AND name = :table_name
                )
                """
            ),
            {"table_name": table_name},
        ).scalar_one()
        if not table_exists:
            return None

        # Get column names and primary key info
        columns_result = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
        column_names = {col[1] for col in columns_result}

        # Get primary key columns
        pk_columns = [col[1] for col in columns_result if col[5] == 1]
        if pk_columns:
            # SQLite auto-generates an index for primary keys
            index_names = {f"sqlite_autoindex_{table_name}_1"}
        else:
            index_names = set()

        # Get index names
        indices_result = conn.execute(text(f"PRAGMA index_list({table_name})")).fetchall()
        index_names.update(idx[1] for idx in indices_result)

        constraint_names = set()

        # Add primary key constraint if it exists
        if pk_columns:
            constraint_names.add(f"pk_{table_name}")

        # Get table definition to identify CHECK constraints
        table_def = conn.execute(
            text(
                """
                SELECT sql FROM sqlite_master
                WHERE type = 'table' AND name = :table_name;
                """
            ),
            {"table_name": table_name},
        ).scalar_one()
        assert isinstance(table_def, str)

        # Split table definition by comma and process each part
        parts = [part.strip() for part in table_def.split(",")]
        for part in parts:
            # Look for CONSTRAINT definitions
            if "CONSTRAINT" in part:
                # Extract the constraint name, handling both quoted and unquoted names
                match = re.search(
                    r'CONSTRAINT\s+"?([^"\s,]+)"?\s+(?:CHECK|UNIQUE|FOREIGN KEY)', part
                )
                if match:
                    constraint_name = match.group(1)
                    if constraint_name:
                        constraint_names.add(constraint_name)
    else:
        assert_never(db_backend)

    return _TableSchemaInfo(
        table_name=table_name,
        column_names=frozenset(column_names),
        index_names=frozenset(index_names),
        constraint_names=frozenset(constraint_names),
    )


def _verify_clean_state(engine: Engine) -> None:
    """Verify that the database is in a clean state before running migrations.

    This function checks that the alembic_version table does not exist, indicating
    that no migrations have been run yet. It does this by attempting to query the
    version number and expecting a BaseException to be raised.

    Args:
        engine: Database engine to check

    Raises:
        AssertionError: If the database is not in a clean state (i.e., if the
            alembic_version table exists)
    """
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(engine)
