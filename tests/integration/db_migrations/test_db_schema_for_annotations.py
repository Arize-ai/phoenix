"""
Database schema validation tests for annotation tables.

This module validates that all *_annotations tables share common structural elements
and follow consistent naming patterns across different database backends (PostgreSQL and SQLite).

The tests verify:
- Common columns across all annotation tables
- Consistent constraint naming patterns
- Proper foreign key relationships
- Database-specific differences (e.g., PostgreSQL name truncation with hash suffixes)

Supported annotation tables:
- span_annotations: Annotations for individual spans
- trace_annotations: Annotations for entire traces
- project_session_annotations: Annotations for project sessions
- document_annotations: Annotations for document positions (includes additional document_position column)
"""

from typing import Literal, Sequence

import pytest
from alembic.config import Config
from sqlalchemy import Engine
from typing_extensions import assert_never

from . import _DBBackend, _get_table_schema_info, _TableSchemaInfo, _up

# Define the supported annotation table names as a Literal type for type safety
AnnotationTableName = Literal[
    "span_annotations",  # Annotations on individual spans
    "trace_annotations",  # Annotations on entire traces
    "project_session_annotations",  # Annotations on project sessions
    "document_annotations",  # Annotations on document positions within spans
]


def _get_common_annotation_columns() -> set[str]:
    """
    Get the set of columns that are common to all annotation tables.

    These columns represent the core annotation schema that is shared across
    span_annotations, trace_annotations, project_session_annotations, and
    document_annotations tables.

    Returns:
        Set of column names that appear in all annotation tables:
        - id: Primary key
        - name: Annotation name/type
        - label: Human-readable label
        - score: Numeric score (nullable)
        - explanation: Textual explanation (nullable)
        - metadata: JSON metadata
        - annotator_kind: Type of annotator (HUMAN, LLM, CODE)
        - user_id: Foreign key to users table (nullable)
        - identifier: Additional identifier for grouping
        - source: Source of annotation (API, APP)
        - created_at: Timestamp when created
        - updated_at: Timestamp when last updated
    """
    return {
        "annotator_kind",  # ENUM: HUMAN, LLM, CODE
        "created_at",  # TIMESTAMP WITH TIME ZONE
        "explanation",  # VARCHAR (nullable)
        "id",  # SERIAL PRIMARY KEY
        "label",  # VARCHAR (nullable)
        "metadata",  # JSONB
        "name",  # VARCHAR (required)
        "score",  # DOUBLE PRECISION (nullable)
        "updated_at",  # TIMESTAMP WITH TIME ZONE
        "user_id",  # INTEGER FK to users (nullable)
        "identifier",  # VARCHAR (for grouping/batching)
        "source",  # ENUM: API, APP
    }


def _get_common_nullable_columns() -> set[str]:
    """
    Get the set of columns that are nullable in all annotation tables.

    These are the columns that allow NULL values according to the annotation schema.

    Returns:
        Set of nullable column names:
        - score: Numeric score (nullable)
        - explanation: Textual explanation (nullable)
        - label: Human-readable label (nullable)
        - user_id: Foreign key to users table (nullable)
    """
    return {
        "explanation",  # VARCHAR (nullable)
        "label",  # VARCHAR (nullable)
        "score",  # DOUBLE PRECISION (nullable)
        "user_id",  # INTEGER FK to users (nullable)
    }


def _get_common_constraint_names(
    table_name: AnnotationTableName,
) -> set[str]:
    """
    Get the set of constraint names that are common to all annotation tables.

    Args:
        table_name: The annotation table name

    Returns:
        Set of constraint names that follow standard patterns:
        - Primary key constraint
        - Check constraint for valid annotator_kind values
        - Check constraint for valid source values
        - Foreign key constraint to users table
    """
    return {
        f"ck_{table_name}_`valid_annotator_kind`",  # CHECK: annotator_kind IN ('HUMAN', 'LLM', 'CODE')
        f"pk_{table_name}",  # PRIMARY KEY on id column
        f"ck_{table_name}_`valid_source`",  # CHECK: source IN ('API', 'APP')
        f"fk_{table_name}_user_id_users",  # FOREIGN KEY user_id REFERENCES users(id)
    }


def _get_foreign_key_constraint_name(
    table_name: AnnotationTableName,
    db_backend: _DBBackend,
) -> str:
    """
    Generate the foreign key constraint name for the main reference column.

    Each annotation table has a primary foreign key that references the entity being annotated:
    - span_annotations -> spans table
    - trace_annotations -> traces table
    - project_session_annotations -> project_sessions table
    - document_annotations -> spans table

    Args:
        table_name: The annotation table name
        db_backend: Database backend ('postgresql' or 'sqlite')

    Returns:
        The foreign key constraint name. For PostgreSQL, long names are truncated
        and have hash suffixes to stay within the 63-character identifier limit.
    """
    if table_name == "project_session_annotations":
        # PostgreSQL truncates long names and adds hash suffixes due to 63-char limit
        if db_backend == "postgresql":
            return "fk_project_session_annotations_project_session_id_proje_ea96"
        else:
            return "fk_project_session_annotations_project_session_id_project_sessions"
    if table_name == "span_annotations":
        return "fk_span_annotations_span_rowid_spans"
    if table_name == "trace_annotations":
        return "fk_trace_annotations_trace_rowid_traces"
    if table_name == "document_annotations":
        return "fk_document_annotations_span_rowid_spans"
    assert_never(table_name)


def _get_unique_constraint_name(
    table_name: AnnotationTableName,
    db_backend: _DBBackend,
) -> str:
    """
    Generate the unique constraint name for annotation tables.

    Each annotation table has a unique constraint to prevent duplicate annotations
    on the same entity with the same name and identifier. The constraint pattern is:
    UNIQUE(name, <entity_reference>, [additional_columns], identifier)

    Args:
        table_name: The annotation table name
        db_backend: Database backend ('postgresql' or 'sqlite')

    Returns:
        The unique constraint name. For PostgreSQL, long names are truncated
        and have hash suffixes to stay within the 63-character identifier limit.
    """
    if table_name == "project_session_annotations":
        # PostgreSQL truncates long names and adds hash suffixes due to 63-char limit
        if db_backend == "postgresql":
            return "uq_project_session_annotations_name_project_session_id__6b58"
        else:
            return "uq_project_session_annotations_name_project_session_id_identifier"
    if table_name == "span_annotations":
        return "uq_span_annotations_name_span_rowid_identifier"
    if table_name == "trace_annotations":
        return "uq_trace_annotations_name_trace_rowid_identifier"
    if table_name == "document_annotations":
        # Includes document_position to allow multiple annotations per span at different positions
        return "uq_document_annotations_name_span_rowid_document_pos_identifier"
    assert_never(table_name)


def _get_foreign_key_index_name(table_name: AnnotationTableName, foreign_key_column: str) -> str:
    """
    Generate the foreign key index name.

    Creates an index on the foreign key column to optimize JOIN performance.

    Args:
        table_name: The annotation table name
        foreign_key_column: The foreign key column name

    Returns:
        Standard index name pattern: ix_{table_name}_{column_name}
    """
    return f"ix_{table_name}_{foreign_key_column}"


def _get_database_specific_index_names(
    table_name: AnnotationTableName, db_backend: _DBBackend, unique_constraint_name: str
) -> set[str]:
    """
    Get database-specific index names that are automatically created.

    Different databases automatically create indexes for certain constraints:
    - PostgreSQL: Creates indexes for PRIMARY KEY and UNIQUE constraints
    - SQLite: Creates automatic indexes for UNIQUE constraints

    Args:
        table_name: The annotation table name
        db_backend: Database backend ('postgresql' or 'sqlite')
        unique_constraint_name: Name of the unique constraint

    Returns:
        Set of index names automatically created by the database engine
    """
    if db_backend == "postgresql":
        return {
            f"pk_{table_name}",  # Index for PRIMARY KEY constraint
            unique_constraint_name,  # Index for UNIQUE constraint
        }
    elif db_backend == "sqlite":
        return {
            f"sqlite_autoindex_{table_name}_1",  # SQLite automatic index for UNIQUE constraint
        }
    else:
        assert_never(db_backend)


def _get_expected_schema_info(
    table_name: AnnotationTableName,
    foreign_key_column: str,
    db_backend: _DBBackend,
    additional_columns: Sequence[str] = (),
    additional_nullable_columns: Sequence[str] = (),
) -> _TableSchemaInfo:
    """
    Build complete schema info for an annotation table.

    This function constructs the expected database schema by combining:
    - Common annotation columns shared across all tables
    - Table-specific foreign key column
    - Any additional columns unique to the table
    - All constraint names (common + table-specific)
    - All index names (foreign key + database-specific auto-indexes)
    - Nullable column information

    Args:
        table_name: Name of the annotation table (must be one of the supported types)
        foreign_key_column: Name of the foreign key column (e.g., 'span_rowid', 'trace_rowid', 'project_session_id')
        db_backend: Database backend type ('postgresql' or 'sqlite')
        additional_columns: Any additional columns specific to this table (e.g., ['document_position'] for document_annotations)
        additional_nullable_columns: Any additional nullable columns specific to this table

    Returns:
        Complete schema information including all columns, indexes, constraints, and nullable columns
        that should exist for the specified annotation table in the given database backend.
    """
    # Start with common columns and add the foreign key column
    column_names = _get_common_annotation_columns()
    column_names.add(foreign_key_column)

    # Add any additional columns specific to this table
    if additional_columns:
        column_names.update(additional_columns)

    # Build nullable column names
    nullable_column_names = _get_common_nullable_columns()
    if additional_nullable_columns:
        nullable_column_names.update(additional_nullable_columns)

    # Build index names
    foreign_key_index = _get_foreign_key_index_name(table_name, foreign_key_column)
    index_names = {foreign_key_index}

    # Build constraint names
    constraint_names = _get_common_constraint_names(table_name)

    # Add the main foreign key constraint
    fk_constraint = _get_foreign_key_constraint_name(table_name, db_backend)
    constraint_names.add(fk_constraint)

    # Add the unique constraint
    unique_constraint = _get_unique_constraint_name(table_name, db_backend)
    constraint_names.add(unique_constraint)

    # Add database-specific index names
    db_specific_indexes = _get_database_specific_index_names(
        table_name, db_backend, unique_constraint
    )
    index_names.update(db_specific_indexes)

    return _TableSchemaInfo(
        table_name=table_name,
        column_names=frozenset(column_names),
        index_names=frozenset(index_names),
        constraint_names=frozenset(constraint_names),
        nullable_column_names=frozenset(nullable_column_names),
    )


class TestDBSchema:
    """
    Test class for validating annotation table database schemas.

    This test suite uses parametrized tests to validate that all annotation tables
    have the expected schema structure after database migrations are applied.
    Each annotation table is tested independently with its specific configuration.
    """

    @pytest.mark.parametrize(
        "table_name,foreign_key_column,additional_columns,additional_nullable_columns",
        [
            pytest.param(
                "span_annotations",
                "span_rowid",
                [],
                [],
                id="span_annotations",
            ),
            pytest.param(
                "trace_annotations",
                "trace_rowid",
                [],
                [],
                id="trace_annotations",
            ),
            pytest.param(
                "project_session_annotations",
                "project_session_id",
                [],
                [],  # no additional nullable columns - uses same as other annotation tables
                id="project_session_annotations",
            ),
            pytest.param(
                "document_annotations",
                "span_rowid",
                ["document_position"],  # Additional column for document position within spans
                [],
                id="document_annotations",
            ),
        ],
    )
    def test_annotation_table_schema(
        self,
        table_name: AnnotationTableName,
        foreign_key_column: str,
        additional_columns: list[str],
        additional_nullable_columns: list[str],
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        """
        Test that annotation table schema matches expected structure.

        This test:
        1. Runs database migrations to 'head'
        2. Builds expected schema using helper functions
        3. Retrieves actual schema from database
        4. Compares expected vs actual schemas

        Args:
            table_name: Name of annotation table to test
            foreign_key_column: Foreign key column name for this table
            additional_columns: Any table-specific additional columns
            _engine: SQLAlchemy database engine (pytest fixture)
            _alembic_config: Alembic configuration (pytest fixture)
            _db_backend: Database backend type (pytest fixture)
            _schema: Database schema name (pytest fixture)
        """
        # Apply all migrations to get the final schema
        _up(_engine, _alembic_config, "head", _schema)

        # Build expected schema using helper functions
        expected = _get_expected_schema_info(
            table_name=table_name,
            foreign_key_column=foreign_key_column,
            db_backend=_db_backend,
            additional_columns=additional_columns,
            additional_nullable_columns=additional_nullable_columns,
        )

        # Get actual schema from database
        with _engine.connect() as conn:
            actual = _get_table_schema_info(conn, table_name, _db_backend, _schema)

        # Verify schemas match exactly
        assert actual == expected
