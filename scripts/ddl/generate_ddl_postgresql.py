# /// script
# dependencies = [
#   "psycopg[binary]",
#   "testing.postgresql",
#   "arize-phoenix",
#   "pglast",
# ]
# ///
# ruff: noqa: E501
"""PostgreSQL DDL Extractor.

Extracts DDL from a PostgreSQL database and outputs it to a file,
grouped by table and sorted deterministically. The generated schema
is automatically validated for syntax correctness using pglast.

Supports both ephemeral and external PostgreSQL connections:
- Ephemeral mode: Creates temporary PostgreSQL instance with migrations (default)
- External mode: Connects to existing PostgreSQL database (no migrations)

Usage:
    # Create ephemeral PostgreSQL, run migrations, extract DDL (default behavior)
    python generate_ddl_postgresql.py

    # Connect to external PostgreSQL database (no migrations run)
    python generate_ddl_postgresql.py --external --host localhost --port 5432 --user postgres --database mydb

    # Specify custom output file with ephemeral mode (default)
    python generate_ddl_postgresql.py --output /path/to/schema.sql

    # External database with custom password (no migrations run)
    python generate_ddl_postgresql.py --external --host prod.db.com --user readonly --password mypass --database phoenix

    # Using PostgreSQL environment variables (for external mode)
    PGHOST=dbhost PGDATABASE=dbname python generate_ddl_postgresql.py --external

Requirements:
    pip install psycopg[binary] pglast testing.postgresql arize-phoenix
"""

from __future__ import annotations

import argparse
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Iterator

import pglast
import psycopg
import testing.postgresql
from alembic import command
from alembic.config import Config
from psycopg import sql
from psycopg.rows import dict_row
from sqlalchemy import URL, create_engine

import phoenix.db

# Configuration constants
DEFAULT_SCHEMA = "public"
DEFAULT_PORT = 5432
DEFAULT_HOST = "localhost"
DEFAULT_USER = "postgres"
DEFAULT_DATABASE = "postgres"
TABLE_INDENT = "    "  # Consistent 4-space indentation for readability
STATEMENT_PREVIEW_LENGTH = 200  # Limit error message length for console output


@dataclass
class ConnectionParams:
    """Database connection parameters."""

    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    database: str = DEFAULT_DATABASE
    user: str = DEFAULT_USER
    password: str = DEFAULT_USER  # Default password same as user for simplicity


@dataclass
class TableInfo:
    """Complete table DDL information."""

    table_name: str
    schema: str
    columns: list[dict[str, Any]]
    constraints: list[dict[str, Any]]
    foreign_keys: list[dict[str, Any]]
    indexes: list[dict[str, Any]]
    triggers: list[dict[str, Any]]


@dataclass
class TypeInfo:
    """User-defined type (enum) information."""

    type_name: str
    type_type: str  # 'e' for enum, etc.
    enum_values: list[str]


class PostgreSQLDDLExtractor:
    """Extract DDL from PostgreSQL databases."""

    def __init__(self, connection_params: ConnectionParams) -> None:
        self.conn_params = connection_params
        self.conn: psycopg.Connection[Any] | None = None

    def __enter__(self) -> PostgreSQLDDLExtractor:
        """Context manager entry."""
        if not self.connect():
            raise ConnectionError("Failed to connect to database")
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc_val: BaseException | None, exc_tb: Any
    ) -> None:
        """Context manager exit."""
        self.close()

    def connect(self) -> bool:
        """Establish database connection."""
        try:
            self.conn = psycopg.connect(
                host=self.conn_params.host,
                port=self.conn_params.port,
                dbname=self.conn_params.database,
                user=self.conn_params.user,
                password=self.conn_params.password,
            )
            return True
        except psycopg.Error as e:
            print(f"Error connecting to database: {e}", file=sys.stderr)
            return False

    def close(self) -> None:
        """Close database connection."""
        if self.conn:
            self.conn.close()

    def _execute_query(
        self, query: sql.SQL | sql.Composed, params: tuple[Any, ...], operation_name: str
    ) -> list[dict[str, Any]]:
        """Execute a catalog query, letting database errors fail the run.

        Converting an error into an empty result would silently omit schema
        objects from the reference DDL — and once the transaction is aborted,
        every subsequent catalog query would fail and hollow out the rest of
        the output while the run still exits 0.
        """
        if not self.conn:
            raise RuntimeError("No database connection")

        try:
            with self.conn.cursor(row_factory=dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchall()
        except psycopg.Error as e:
            raise RuntimeError(f"Error {operation_name}: {e}") from e

    def extract_all_types_ddl(self, schema: str = DEFAULT_SCHEMA) -> list[TypeInfo]:
        """Extract DDL for all user-defined types (enums, etc.) in the specified schema."""
        query = sql.SQL("""
            SELECT
                t.typname as type_name,
                t.typtype as type_type,
                array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
            FROM pg_type t
            LEFT JOIN pg_enum e ON t.oid = e.enumtypid
            LEFT JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE t.typtype = 'e'  -- enum types
            AND n.nspname = %s
            AND t.typname NOT LIKE 'pg_%%'  -- exclude system types
            GROUP BY t.typname, t.typtype
            ORDER BY t.typname
        """)
        results = self._execute_query(
            query, (schema,), f"getting user-defined types for schema {schema}"
        )

        type_infos: list[TypeInfo] = []
        for result in results:
            type_infos.append(
                TypeInfo(
                    type_name=result["type_name"],
                    type_type=result["type_type"],
                    enum_values=[str(val) for val in result["enum_values"] if val is not None],
                )
            )

        return type_infos

    def extract_all_tables_ddl(self, schema: str = DEFAULT_SCHEMA) -> list[TableInfo]:
        """Extract DDL for all tables in the specified schema."""
        tables = self._get_all_tables(schema)
        table_ddls: list[TableInfo] = []

        for table_name in tables:
            # Let extraction failures propagate: swallowing them into a warning
            # would silently omit an entire table from the reference DDL.
            table_ddls.append(self._extract_single_table_ddl(schema, table_name))

        # Sort tables based on foreign key dependencies (topological sort)
        return self._topological_sort_tables(table_ddls)

    def _topological_sort_tables(self, table_ddls: list[TableInfo]) -> list[TableInfo]:
        """Sort tables in dependency order using topological sort.

        Uses Kahn's algorithm to ensure referenced tables are created before
        referencing tables, preventing foreign key constraint errors during DDL execution.

        Example: If table A references table B, B will come before A in the result.
        """
        # Build dependency graph: table_name -> set of tables it depends on
        # This creates a directed graph where edges point from dependent to dependency
        dependencies: dict[str, set[str]] = {}
        table_map: dict[str, TableInfo] = {}

        for table_info in table_ddls:
            table_name = table_info.table_name
            table_map[table_name] = table_info
            dependencies[table_name] = set()

            # Add dependencies from foreign keys (A depends on B if A has FK to B)
            for fk in table_info.foreign_keys:
                referenced_table = fk["foreign_table_name"]
                # Only add dependency if it's not a self-reference and the table exists
                if referenced_table != table_name and referenced_table in [
                    t.table_name for t in table_ddls
                ]:
                    dependencies[table_name].add(referenced_table)

        # Apply Kahn's algorithm for topological sort
        sorted_tables: list[TableInfo] = []
        in_degree = {table: len(deps) for table, deps in dependencies.items()}
        queue = [table for table, degree in in_degree.items() if degree == 0]  # Independent tables

        while queue:
            # Sort queue to ensure deterministic output across runs
            queue.sort()
            current_table = queue.pop(0)
            sorted_tables.append(table_map[current_table])

            # Update in-degrees for tables that depend on current table
            # (simulates "removing" the current table from the graph)
            for table_name, deps in dependencies.items():
                if current_table in deps:
                    in_degree[table_name] -= 1
                    if in_degree[table_name] == 0:
                        queue.append(table_name)

        # Check for circular dependencies (if we couldn't process all tables)
        if len(sorted_tables) != len(table_ddls):
            remaining_tables = [
                table_map[name]
                for name in dependencies.keys()
                if name not in [t.table_name for t in sorted_tables]
            ]
            print(
                "Warning: Circular dependencies detected, adding remaining tables in alphabetical order",
                file=sys.stderr,
            )
            # Add remaining tables in alphabetical order (best effort for circular refs)
            remaining_tables.sort(key=lambda t: t.table_name)
            sorted_tables.extend(remaining_tables)

        return sorted_tables

    def _get_all_tables(self, schema: str) -> list[str]:
        """Get list of all tables in the schema."""
        if not self.conn:
            raise RuntimeError("No database connection")

        with self.conn.cursor() as cur:
            cur.execute(
                """
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = %s AND table_type = 'BASE TABLE'
                        ORDER BY table_name
                        """,
                (schema,),
            )
            rows = cur.fetchall()
            return [str(row[0]) for row in rows]

    def _extract_single_table_ddl(self, schema: str, table_name: str) -> TableInfo:
        """Extract complete DDL information for a single table."""
        columns = self._get_columns(schema, table_name)
        constraints = self._get_constraints(schema, table_name)
        foreign_keys = self._get_foreign_keys(schema, table_name)
        indexes = self._get_indexes(schema, table_name)
        triggers = self._get_triggers(schema, table_name)

        return TableInfo(
            table_name=table_name,
            schema=schema,
            columns=columns,
            constraints=constraints,
            foreign_keys=foreign_keys,
            indexes=indexes,
            triggers=triggers,
        )

    def _get_columns(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get column information for a table."""
        query = sql.SQL("""
            SELECT
                c.column_name,
                CASE
                    WHEN c.data_type = 'ARRAY' THEN
                        -- Handle array types: _text -> TEXT[]
                        UPPER(SUBSTRING(c.udt_name FROM 2)) || '[]'
                    WHEN c.data_type = 'USER-DEFINED' THEN
                        -- Regular user-defined types (enums, etc.)
                        c.udt_name
                    ELSE c.data_type
                END as data_type,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                c.is_nullable,
                c.column_default,
                c.is_identity,
                c.identity_generation,
                c.ordinal_position,
                c.udt_name
            FROM information_schema.columns c
            WHERE c.table_schema = %s AND c.table_name = %s
            ORDER BY c.ordinal_position
        """)
        return self._execute_query(
            query, (schema, table_name), f"getting columns for {schema}.{table_name}"
        )

    def _get_constraints(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get table constraints (PRIMARY KEY, UNIQUE, CHECK)."""
        query = sql.SQL("""
            SELECT
                tc.constraint_name,
                tc.constraint_type,
                array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns,
                pg_get_constraintdef(pgc.oid) as constraint_definition
            FROM information_schema.table_constraints tc
                     LEFT JOIN information_schema.key_column_usage kcu
                               ON tc.constraint_name = kcu.constraint_name
                                   AND tc.table_schema = kcu.table_schema
                                   AND tc.table_name = kcu.table_name
                     -- Constraint names are unique per TABLE, not per schema: joining
                     -- pg_constraint by name alone matches same-named constraints on
                     -- other tables and cross-contaminates their definitions, so the
                     -- join must also pin the constrained table's oid.
                     LEFT JOIN pg_constraint pgc
                               ON pgc.conname = tc.constraint_name
                                   AND pgc.conrelid = to_regclass(
                                       quote_ident(tc.table_schema) || '.' || quote_ident(tc.table_name)
                                   )
            WHERE tc.table_schema = %s
              AND tc.table_name = %s
              AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
            GROUP BY tc.constraint_name, tc.constraint_type, pgc.oid
            ORDER BY tc.constraint_type, tc.constraint_name
        """)
        return self._execute_query(
            query, (schema, table_name), f"getting constraints for {schema}.{table_name}"
        )

    def _get_foreign_keys(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get foreign key constraints with full details.

        PostgreSQL permits the same constraint name on different tables, so
        information_schema.referential_constraints cannot be joined safely by
        constraint name and schema alone. Use pg_constraint's relation OIDs and
        pair conkey/confkey by ordinality to preserve composite-FK mappings.
        """
        query = sql.SQL("""
            SELECT
                con.conname AS constraint_name,
                array_agg(source_column.attname ORDER BY key_map.position) AS columns,
                target_namespace.nspname AS foreign_table_schema,
                target_table.relname AS foreign_table_name,
                array_agg(target_column.attname ORDER BY key_map.position) AS foreign_columns,
                CASE con.confupdtype
                    WHEN 'a' THEN 'NO ACTION'
                    WHEN 'r' THEN 'RESTRICT'
                    WHEN 'c' THEN 'CASCADE'
                    WHEN 'n' THEN 'SET NULL'
                    WHEN 'd' THEN 'SET DEFAULT'
                END AS update_rule,
                CASE con.confdeltype
                    WHEN 'a' THEN 'NO ACTION'
                    WHEN 'r' THEN 'RESTRICT'
                    WHEN 'c' THEN 'CASCADE'
                    WHEN 'n' THEN 'SET NULL'
                    WHEN 'd' THEN 'SET DEFAULT'
                END AS delete_rule
            FROM pg_constraint AS con
                     JOIN pg_class AS source_table
                          ON source_table.oid = con.conrelid
                     JOIN pg_namespace AS source_namespace
                          ON source_namespace.oid = source_table.relnamespace
                     JOIN pg_class AS target_table
                          ON target_table.oid = con.confrelid
                     JOIN pg_namespace AS target_namespace
                          ON target_namespace.oid = target_table.relnamespace
                     JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY
                          AS key_map(source_attnum, target_attnum, position)
                          ON TRUE
                     JOIN pg_attribute AS source_column
                          ON source_column.attrelid = source_table.oid
                              AND source_column.attnum = key_map.source_attnum
                     JOIN pg_attribute AS target_column
                          ON target_column.attrelid = target_table.oid
                              AND target_column.attnum = key_map.target_attnum
            WHERE con.contype = 'f'
              AND source_namespace.nspname = %s
              AND source_table.relname = %s
            GROUP BY con.oid, con.conname, target_namespace.nspname, target_table.relname,
                     con.confupdtype, con.confdeltype
            ORDER BY con.conname
        """)
        return self._execute_query(
            query, (schema, table_name), f"getting foreign keys for {schema}.{table_name}"
        )

    def _get_indexes(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get standalone indexes for a table.

        Excludes constraint-created indexes to avoid DDL duplication:
        - PRIMARY KEY indexes (automatically created)
        - UNIQUE constraint indexes (handled separately)

        Returns index metadata including name, uniqueness, and definition. The
        full definition comes from pg_get_indexdef, which renders columns,
        expressions, operator classes, and predicates — so no join to
        pg_attribute is needed. (An earlier version joined pg_attribute on
        indkey to aggregate column names, which silently dropped pure
        expression indexes: their indkey entries are 0 and match no attribute.)
        """
        query = sql.SQL("""
            SELECT
                i.relname as index_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                pg_get_indexdef(i.oid) as index_definition
            FROM pg_class t                              -- Target table
                     JOIN pg_index ix ON t.oid = ix.indrelid      -- Index metadata
                     JOIN pg_class i ON i.oid = ix.indexrelid     -- Index object
                     JOIN pg_namespace n ON t.relnamespace = n.oid -- Schema info
            WHERE t.relname = %s
              AND n.nspname = %s
              AND NOT ix.indisprimary                 -- Skip PRIMARY KEY indexes (handled as constraints)
              AND NOT EXISTS (                       -- Skip UNIQUE constraint indexes
                SELECT 1 FROM pg_constraint c
                WHERE c.conindid = i.oid AND c.contype = 'u'
              )
            ORDER BY i.relname
        """)
        return self._execute_query(
            query, (table_name, schema), f"getting indexes for {schema}.{table_name}"
        )

    def _get_triggers(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get triggers for a table."""
        query = sql.SQL("""
            SELECT
                trigger_name,
                action_timing,
                event_manipulation,
                action_statement
            FROM information_schema.triggers
            WHERE event_object_schema = %s
              AND event_object_table = %s
            ORDER BY trigger_name
        """)
        return self._execute_query(
            query, (schema, table_name), f"getting triggers for {schema}.{table_name}"
        )

    def generate_ddl(self, table_info: TableInfo) -> str:
        """Generate DDL string for a single table."""
        ddl_parts: list[str] = []
        table_name = table_info.table_name
        schema = table_info.schema

        # === Table Definition ===
        quoted_table_name = self._quote_identifier_if_needed(table_name)
        full_name_for_header = (
            f"{schema}.{quoted_table_name}" if schema != "public" else quoted_table_name
        )
        header_line = f"Table: {full_name_for_header}"
        ddl_parts.append(f"-- {header_line}")
        ddl_parts.append(f"-- {'-' * len(header_line)}")

        create_table = self._build_create_table(table_info)
        ddl_parts.append(create_table)

        # === Indexes ===
        sorted_indexes = sorted(table_info.indexes, key=lambda x: x["index_name"])
        if sorted_indexes:
            ddl_parts.append("")
            for index in sorted_indexes:
                index_def = f"{index['index_definition']};"
                wrapped_index = self._wrap_index_definition(index_def)
                ddl_parts.append(wrapped_index)

        # === Triggers ===
        # information_schema.triggers.action_statement is only the action clause
        # (e.g. "EXECUTE FUNCTION f()"), not a CREATE TRIGGER statement, and the
        # trigger's function is not extracted at all — so triggers cannot be
        # rendered faithfully. Fail loudly instead of emitting invalid DDL.
        if table_info.triggers:
            trigger_names = ", ".join(
                t["trigger_name"]
                for t in sorted(table_info.triggers, key=lambda x: x["trigger_name"])
            )
            raise NotImplementedError(
                f"Table {table_name} has triggers ({trigger_names}), which this generator "
                "cannot render (use pg_get_triggerdef and extract the trigger function to "
                "add support)."
            )

        return "\n".join(ddl_parts)

    def generate_type_ddl(self, type_info: TypeInfo) -> str:
        """Generate DDL string for a user-defined type (enum)."""
        if type_info.type_type == "e":  # enum type
            values = "', '".join(type_info.enum_values)
            return f"CREATE TYPE {type_info.type_name} AS ENUM ('{values}');"
        else:
            # Future: handle other user-defined types
            return f"-- Unsupported type: {type_info.type_name} (type: {type_info.type_type})"

    def _build_create_table(self, table_info: TableInfo) -> str:
        """Build the CREATE TABLE statement."""
        table_name = table_info.table_name
        schema = table_info.schema

        # Quote table name if it contains mixed case or special characters
        quoted_table_name = self._quote_identifier_if_needed(table_name)
        full_table_name = (
            f"public.{quoted_table_name}" if schema == "public" else f"{schema}.{quoted_table_name}"
        )

        ddl_parts = [f"CREATE TABLE {full_table_name} ("]

        # Column definitions
        column_defs: list[str] = []
        for col in table_info.columns:
            col_def = self._format_column(col)
            column_defs.append(f"{TABLE_INDENT}{col_def}")

        # Table-level constraints - sorted by type priority, then name
        constraint_defs: list[str] = []

        # Process constraints in priority order
        constraint_order = ["PRIMARY KEY", "UNIQUE", "CHECK"]
        for constraint_type in constraint_order:
            matching_constraints = [
                c for c in table_info.constraints if c["constraint_type"] == constraint_type
            ]
            constraint_defs.extend(self._process_constraints(matching_constraints))

        # Foreign key constraints last (sorted by constraint name)
        fk_defs = [
            self._add_table_indentation(self._format_foreign_key(fk))
            for fk in sorted(table_info.foreign_keys, key=lambda x: x["constraint_name"])
        ]
        constraint_defs.extend(fk_defs)

        # Combine all definitions
        all_definitions = column_defs + constraint_defs
        ddl_parts.append(",\n".join(all_definitions))
        ddl_parts.append(");")

        return "\n".join(ddl_parts)

    def _process_constraints(self, constraints: list[dict[str, Any]]) -> list[str]:
        """Process a list of constraints, formatting and indenting them."""
        result = []
        for constraint in sorted(constraints, key=lambda x: x["constraint_name"]):
            constraint_def = self._format_constraint(constraint)
            if constraint_def:
                indented_def = self._add_table_indentation(constraint_def)
                result.append(indented_def)
        return result

    def _wrap_line(self, line: str | None) -> str:
        """Apply consistent formatting to constraints for visual consistency."""
        if not line:
            return ""

        # Apply specific formatting based on constraint type
        constraint_formatters = [
            ("FOREIGN KEY", "REFERENCES", self._wrap_foreign_key_constraint),
            ("UNIQUE (", "CONSTRAINT ", self._wrap_unique_constraint),
            ("ARRAY[", "CHECK (", self._wrap_check_constraint),
            ("ARRAY[", "])::text[]", self._wrap_check_constraint),
        ]

        for pattern1, pattern2, formatter in constraint_formatters:
            if pattern1 in line and pattern2 in line:
                return formatter(line)

        return line

    def _wrap_foreign_key_constraint(self, line: str) -> str:
        """Format foreign key constraints with consistent line breaks."""
        parts = []
        remaining = line

        if " FOREIGN KEY " in remaining:
            fk_split = remaining.split(" FOREIGN KEY ", 1)
            constraint_part = fk_split[0] + " FOREIGN KEY"

            # Always break long constraint names
            if len(constraint_part) > 70 and "CONSTRAINT " in constraint_part:
                constraint_name_split = constraint_part.split(" FOREIGN KEY", 1)
                parts.append(constraint_name_split[0])
                parts.append("    FOREIGN KEY")
            else:
                parts.append(constraint_part)

            remaining = fk_split[1]

        if " REFERENCES " in remaining:
            ref_split = remaining.split(" REFERENCES ", 1)
            column_part = ref_split[0].strip()
            parts.append(f"    {column_part}")
            remaining = ref_split[1]

            # Handle the REFERENCES clause and any ON DELETE/UPDATE
            if " ON " in remaining:
                # Split on first ON keyword
                on_split = remaining.split(" ON ", 1)
                parts.append(f"    REFERENCES {on_split[0].strip()}")

                # Add the ON clause
                parts.append(f"    ON {on_split[1]}")
            else:
                parts.append(f"    REFERENCES {remaining}")

        return "\n".join(parts)

    def _wrap_unique_constraint(self, line: str) -> str:
        """Format UNIQUE constraints with consistent line breaks."""
        constraint_split = line.split(" UNIQUE (", 1)
        return constraint_split[0] + "\n    UNIQUE (" + constraint_split[1]

    def _wrap_check_constraint(self, line: str) -> str:
        """Format CHECK constraints with ARRAY values for better git diff readability.

        Puts each array element on its own line so git diffs clearly show
        which specific values were added/removed/changed.
        """
        prefix, check_part = self._parse_check_constraint_parts(line)

        if self._has_array_pattern(check_part):
            formatted_array = self._format_array_in_check_constraint(check_part, prefix)
            if formatted_array:
                return formatted_array

        return self._wrap_long_check_constraint(line, prefix, check_part)

    def _parse_check_constraint_parts(self, line: str) -> tuple[str, str]:
        """Split CHECK constraint into prefix and constraint body."""
        if " CHECK (" in line:
            constraint_split = line.split(" CHECK (", 1)
            return f"{constraint_split[0]}\n    CHECK (", constraint_split[1]
        else:
            # Raw constraint definition (like from pg_get_constraintdef)
            return "", line

    def _has_array_pattern(self, check_part: str) -> bool:
        """Check if constraint contains PostgreSQL ARRAY pattern."""
        return "ARRAY[" in check_part and "])::text[]" in check_part

    def _format_array_in_check_constraint(self, check_part: str, prefix: str) -> str | None:
        """Format ARRAY elements in CHECK constraints for git diff readability."""
        array_start = check_part.find("ARRAY[")
        array_end = check_part.find("])::text[]")

        if array_start == -1 or array_end == -1 or array_end <= array_start:
            return None

        before_array = check_part[:array_start]
        array_content = check_part[array_start + 6 : array_end]  # Skip "ARRAY["
        after_array = check_part[array_end + 1 :]  # Everything after "]": )::text[]

        if ", " not in array_content:
            return None

        elements = [elem.strip() for elem in array_content.split(", ")]
        if len(elements) <= 1:
            return None

        formatted_elements = ",\n        ".join(elements)
        array_definition = f"ARRAY[\n        {formatted_elements}\n    ]"

        if prefix:
            return f"{prefix}{before_array}{array_definition}{after_array}"
        else:
            return f"{before_array}{array_definition}{after_array}"

    def _wrap_long_check_constraint(self, line: str, prefix: str, check_part: str) -> str:
        """Wrap long CHECK constraints for readability."""
        if len(line) > 90:
            return f"{prefix}{check_part}" if prefix else line
        else:
            return line

    def _wrap_index_definition(self, index_def: str, max_length: int = 90) -> str:
        """Apply consistent formatting to CREATE INDEX statements."""
        # For CREATE INDEX statements, always break before USING for consistency
        if "CREATE " in index_def and " ON " in index_def and " USING " in index_def:
            # Break before USING clause for consistent formatting
            using_split = index_def.split(" USING ", 1)
            if len(using_split) == 2:
                before_using = using_split[0]
                after_using = using_split[1]
                return before_using + "\n    USING " + after_using

        return index_def

    def _add_table_indentation(self, definition: str) -> str:
        """Add proper indentation to constraint definitions, preserving line wrapping."""
        lines = definition.split("\n")
        indented_lines = []

        for i, line in enumerate(lines):
            if i == 0:
                # First line gets base table indentation (4 spaces)
                indented_lines.append(f"    {line}")
            else:
                # Continuation lines already have their proper indentation from _wrap_line
                # Just add the base table indentation (4 spaces)
                indented_lines.append(f"    {line}")

        return "\n".join(indented_lines)

    def _normalize_column_array(self, columns: Any) -> list[str]:
        """Normalize column arrays from PostgreSQL into Python lists.

        PostgreSQL returns arrays in various formats:
        - String: "{col1,col2}" or "{\"quoted col\",col2}"
        - List: ['col1', 'col2'] (from some drivers)
        - None: for empty arrays
        """
        if isinstance(columns, list):
            return [str(col).strip() for col in columns if col]
        elif isinstance(columns, str):
            return self._parse_postgresql_array_string(columns)
        elif columns is None:
            return []
        else:
            return [str(columns).strip()]

    def _parse_postgresql_array_string(self, array_str: str) -> list[str]:
        """Parse PostgreSQL array string format into Python list.

        PostgreSQL arrays can contain quoted elements with embedded commas,
        requiring careful parsing to avoid incorrect splits.

        Examples:
        - "{col1,col2}" -> ["col1", "col2"]
        - "{\"user id\",name}" -> ["user id", "name"]
        """
        if not (array_str.startswith("{") and array_str.endswith("}")):
            return [array_str.strip()]

        inner = array_str[1:-1]  # Remove outer braces
        if not inner:
            return []

        # Simple parser for PostgreSQL array format
        result = []
        current_item = ""
        in_quotes = False

        for i, char in enumerate(inner):
            if char == '"' and (i == 0 or inner[i - 1] != "\\"):
                in_quotes = not in_quotes
            elif char == "," and not in_quotes:
                if current_item.strip():
                    result.append(current_item.strip().strip('"'))
                current_item = ""
            else:
                current_item += char

        # Add final element
        if current_item.strip():
            result.append(current_item.strip().strip('"'))

        return result

    def _format_column(self, col: dict[str, Any]) -> str:
        """Format a single column definition.

        Raises NotImplementedError for column features this generator cannot
        render (identity columns, non-int/bigint serials) rather than silently
        emitting valid-looking DDL that loses semantics.
        """
        # Quote column name if it contains mixed case or special characters
        column_name = self._quote_identifier_if_needed(col["column_name"])
        parts: list[str] = [column_name]

        if col.get("is_identity") == "YES":
            raise NotImplementedError(
                f"Column {col['column_name']} is a GENERATED ... AS IDENTITY column. "
                "This generator does not render identity clauses, so the column would "
                "silently lose its identity default. Add identity support before using "
                "identity columns in the schema."
            )

        # === Data Type Processing ===
        # Keep original case for user-defined types, lowercase for system types
        original_data_type = col["data_type"]
        data_type_lower = original_data_type.lower()

        # Handle PostgreSQL serial types
        if col.get("column_default") and "nextval(" in col["column_default"]:
            if data_type_lower == "integer":
                parts.append("serial")
            elif data_type_lower == "bigint":
                parts.append("bigserial")
            else:
                raise NotImplementedError(
                    f"Column {col['column_name']} ({original_data_type}) has a nextval() "
                    "default, but only integer/bigint serial folding is supported. "
                    "Passing it through would silently drop the sequence default."
                )
        else:
            parts.append(self._format_data_type(col, original_data_type))

        # === Column Attributes ===
        if col["is_nullable"] == "NO":
            parts.append("NOT NULL")

        # Add default for non-serial columns
        if col["column_default"] and "nextval(" not in col["column_default"]:
            default_val = self._format_default_value(col["column_default"], original_data_type)
            parts.append(f"DEFAULT {default_val}")

        return " ".join(parts)

    def _format_data_type(self, col: dict[str, Any], data_type: str) -> str:
        """Format column data type with proper casing and parameters.

        Handles arrays, user-defined types, and standard SQL types.
        Preserves custom type names while normalizing built-in types.
        """
        # Handle array types first
        if data_type.endswith("[]"):
            base_type = data_type[:-2]  # Remove '[]' suffix
            formatted_base = self._format_single_data_type(col, base_type)
            return f"{formatted_base}[]"

        return self._format_single_data_type(col, data_type)

    def _format_single_data_type(self, col: dict[str, Any], data_type: str) -> str:
        """Format a single (non-array) data type with proper length/precision."""
        # Handle user-defined types (enums, custom types) first
        udt_name = col.get("udt_name", "")
        standard_types = {
            "character varying",
            "timestamp with time zone",
            "timestamp without time zone",
            "double precision",
            "integer",
            "bigint",
            "smallint",
            "boolean",
            "bytea",
            "text",
            "varchar",
            "char",
            "numeric",
            "decimal",
            "real",
            "json",
            "jsonb",
            "uuid",
            "date",
            "time",
            "interval",
        }

        if data_type.lower() not in standard_types and udt_name and data_type == udt_name:
            # This is likely a user-defined type (enum, etc.) - return as-is
            return data_type

        # Format base type name
        formatted_type = self._format_base_type(data_type)

        # Add length/precision parameters for standard types
        # PostgreSQL integer types don't accept precision/scale parameters
        if formatted_type in (
            "INTEGER",
            "BIGINT",
            "SMALLINT",
            "DOUBLE PRECISION",
            "BOOLEAN",
            "BYTEA",
        ):
            return formatted_type
        elif col["character_maximum_length"]:
            # Character types: VARCHAR(255), CHAR(10)
            return f"{formatted_type}({col['character_maximum_length']})"
        elif col["numeric_precision"] and col["numeric_scale"] is not None:
            # Decimal types: NUMERIC(10,2), DECIMAL(5,0)
            return f"{formatted_type}({col['numeric_precision']},{col['numeric_scale']})"
        elif col["numeric_precision"] and formatted_type not in (
            "INTEGER",
            "BIGINT",
            "SMALLINT",
            "DOUBLE PRECISION",
            "BOOLEAN",
            "BYTEA",
        ):
            # Other numeric types that take precision: FLOAT(7)
            return f"{formatted_type}({col['numeric_precision']})"
        else:
            return formatted_type

    def _format_base_type(self, data_type: str) -> str:
        """Format base PostgreSQL data types with proper length/precision handling."""
        # This method should only be called with the base type name
        # Length and precision handling is done in the calling method

        # Normalize PostgreSQL type names to SQL standard equivalents
        if data_type == "character varying":
            return "VARCHAR"
        elif data_type == "timestamp with time zone":
            return "TIMESTAMP WITH TIME ZONE"
        elif data_type == "timestamp without time zone":
            return "TIMESTAMP"
        elif data_type == "double precision":
            return "DOUBLE PRECISION"
        else:
            return data_type.upper()

    def _format_default_value(self, default_value: str, data_type: str) -> str:
        """Format default values, handling special cases for arrays and enums."""
        if not default_value:
            return default_value

        # Handle array defaults like "ARRAY[]::text[]" -> "'{}'"
        if "ARRAY[]" in default_value and "::" in default_value:
            return "'{}'"

        # Handle enum defaults that may have improper casting
        # e.g., 'PENDING'::"AnnotationQueueItemStatus" -> 'PENDING'
        if "::" in default_value and '"' in default_value:
            # Extract the value part before the cast
            value_part = default_value.split("::")[0].strip()
            if value_part.startswith("'") and value_part.endswith("'"):
                return value_part

        return default_value

    def _format_constraint(self, constraint: dict[str, Any]) -> str | None:
        """Format table-level constraints."""
        constraint_type = constraint["constraint_type"]
        constraint_name = constraint["constraint_name"]

        if constraint_type in ("PRIMARY KEY", "UNIQUE"):
            columns = self._normalize_column_array(constraint["columns"])
            column_list = ", ".join(columns)
            constraint_def = f"CONSTRAINT {constraint_name} {constraint_type} ({column_list})"
            return self._wrap_line(constraint_def)
        elif constraint_type == "CHECK":
            constraint_def = constraint.get("constraint_definition")
            if constraint_def:
                return self._wrap_line(constraint_def)
            return None

        return None

    def _format_foreign_key(self, fk: dict[str, Any]) -> str:
        """Format foreign key constraint."""
        constraint_name = fk["constraint_name"]
        columns = self._normalize_column_array(fk["columns"])
        ref_table = fk["foreign_table_name"]
        ref_schema = fk["foreign_table_schema"]
        ref_columns = self._normalize_column_array(fk["foreign_columns"])

        # Quote referenced table name if needed
        quoted_ref_table = self._quote_identifier_if_needed(ref_table)
        full_ref_table = (
            f"public.{quoted_ref_table}"
            if ref_schema == "public"
            else f"{ref_schema}.{quoted_ref_table}"
        )
        column_list = ", ".join(columns)
        ref_column_list = ", ".join(ref_columns)

        fk_def = f"CONSTRAINT {constraint_name} FOREIGN KEY ({column_list}) REFERENCES {full_ref_table} ({ref_column_list})"

        # Referential actions (if not default NO ACTION)
        if fk["update_rule"] != "NO ACTION":
            fk_def += f" ON UPDATE {fk['update_rule']}"
        if fk["delete_rule"] != "NO ACTION":
            fk_def += f" ON DELETE {fk['delete_rule']}"

        return self._wrap_line(fk_def)

    def _quote_identifier_if_needed(self, identifier: str) -> str:
        """Quote PostgreSQL identifier if it contains mixed case or special characters."""
        # Check if identifier needs quotes to preserve case/special chars
        if (
            identifier != identifier.lower()  # Contains uppercase
            or not identifier.replace("_", "").isalnum()  # Contains special chars beyond underscore
            or identifier in self._get_postgresql_keywords()
        ):  # Is a reserved keyword
            return f'"{identifier}"'
        return identifier

    def _get_postgresql_keywords(self) -> set[str]:
        """Get PostgreSQL reserved keywords that require quoting.

        Based on PostgreSQL 15+ reserved keywords that would conflict with identifiers.
        """
        return {
            # SQL standard reserved keywords
            "all",
            "analyse",
            "analyze",
            "and",
            "any",
            "array",
            "as",
            "asc",
            "asymmetric",
            "both",
            "case",
            "cast",
            "check",
            "collate",
            "column",
            "constraint",
            "create",
            "current_catalog",
            "current_date",
            "current_role",
            "current_time",
            "current_timestamp",
            "current_user",
            "default",
            "deferrable",
            "desc",
            "distinct",
            "do",
            "else",
            "end",
            "except",
            "false",
            "fetch",
            "for",
            "foreign",
            "from",
            "grant",
            "group",
            "having",
            "in",
            "initially",
            "intersect",
            "into",
            "lateral",
            "leading",
            "limit",
            "localtime",
            "localtimestamp",
            "not",
            "null",
            "only",
            "or",
            "order",
            "placing",
            "primary",
            "references",
            "returning",
            "select",
            "session_user",
            "some",
            "symmetric",
            "table",
            "then",
            "to",
            "trailing",
            "true",
            "union",
            "unique",
            "user",
            "using",
            "variadic",
            "when",
            "where",
            "window",
            "with",
            # PostgreSQL-specific reserved keywords
            "authorization",
            "binary",
            "concurrently",
            "cross",
            "freeze",
            "full",
            "ilike",
            "inner",
            "is",
            "isnull",
            "join",
            "left",
            "like",
            "natural",
            "notnull",
            "outer",
            "overlaps",
            "right",
            "similar",
            "verbose",
        }


def validate_schema_syntax(schema_file: Path) -> bool:
    """Validate the syntax of the generated schema file using pglast.

    Returns True if all statements are syntactically valid, False otherwise.
    Prints detailed error information for any invalid statements.
    """
    try:
        with schema_file.open("r", encoding="utf-8") as f:
            content = f.read()
    except (OSError, IOError) as e:
        print(f"Error reading schema file {schema_file}: {e}", file=sys.stderr)
        return False

    if not content.strip():
        print("Warning: Schema file is empty", file=sys.stderr)
        return True

    # Split content into individual statements
    # Remove comments and empty lines for parsing
    statements = []
    current_statement = []

    for line in content.split("\n"):
        line = line.strip()
        # Skip comment lines and empty lines
        if not line or line.startswith("--"):
            continue

        current_statement.append(line)

        # Check if line ends with semicolon (end of statement)
        if line.endswith(";"):
            statement = " ".join(current_statement).strip()
            if statement:
                statements.append(statement)
            current_statement = []

    # Add any remaining statement without semicolon
    if current_statement:
        statement = " ".join(current_statement).strip()
        if statement:
            statements.append(statement)

    if not statements:
        print("Warning: No SQL statements found in schema file", file=sys.stderr)
        return True

    print(f"Validating {len(statements)} SQL statements...")

    validation_errors = []
    for i, statement in enumerate(statements, 1):
        try:
            # Parse statement for syntax validation
            pglast.parse_sql(statement)
        except pglast.Error as e:
            error_msg = f"Statement {i} syntax error: {e}"
            validation_errors.append(error_msg)
            print(f"ERROR: {error_msg}", file=sys.stderr)

            # Show the problematic statement (truncated if too long)
            if len(statement) > STATEMENT_PREVIEW_LENGTH:
                preview = statement[:STATEMENT_PREVIEW_LENGTH] + "..."
            else:
                preview = statement
            print(f"Statement: {preview}", file=sys.stderr)
        except Exception as e:
            error_msg = f"Statement {i} unexpected error: {e}"
            validation_errors.append(error_msg)
            print(f"ERROR: {error_msg}", file=sys.stderr)

    if validation_errors:
        print(
            f"\n❌ Schema validation failed with {len(validation_errors)} errors", file=sys.stderr
        )
        return False
    else:
        print("✅ Schema validation passed - all statements are syntactically valid")
        return True


@contextmanager
def ephemeral_postgresql() -> Iterator[URL]:
    """Create an ephemeral PostgreSQL instance for DDL extraction.

    Creates a temporary PostgreSQL server that automatically cleans up when done.
    Returns a SQLAlchemy URL object.
    """
    # Create ephemeral PostgreSQL server
    with testing.postgresql.Postgresql() as postgresql:
        # Build SQLAlchemy URL (testing.postgresql doesn't use passwords)
        dsn = postgresql.dsn()
        url = URL.create(
            drivername="postgresql+psycopg",
            username=dsn["user"],
            host=dsn["host"],
            port=dsn["port"],
            database=dsn["database"],
        )
        yield url


def create_external_url(host: str, port: int, user: str, database: str, password: str) -> URL:
    """Create SQLAlchemy URL for external PostgreSQL connection.

    Args:
        host: Database host
        port: Database port
        user: Database username
        database: Database name
        password: Database password

    Returns:
        SQLAlchemy URL object
    """
    return URL.create(
        drivername="postgresql+psycopg",
        username=user,
        password=password,
        host=host,
        port=port,
        database=database,
    )


def run_alembic_migrations(url: URL, skip_if_failed: bool = False) -> bool:
    """Run Alembic migrations against the database.

    Uses the same pattern as Phoenix's integration tests - pass connection directly to Alembic.

    Args:
        url: SQLAlchemy URL for the database
        skip_if_failed: If True, return False on failure instead of printing warnings

    Returns:
        True if migrations succeeded, False otherwise
    """
    try:
        # Set up Alembic config
        phoenix_db_path = Path(phoenix.db.__path__[0])
        alembic_ini = phoenix_db_path / "alembic.ini"

        if not alembic_ini.exists():
            if not skip_if_failed:
                print(
                    f"Warning: Alembic config not found at {alembic_ini}, skipping migrations",
                    file=sys.stderr,
                )
            return False

        config = Config(str(alembic_ini))
        config.set_main_option("script_location", str(phoenix_db_path / "migrations"))

        # Create engine directly from URL (already has psycopg driver)
        engine = create_engine(url)

        # Run migrations using Phoenix's integration test pattern
        print("Running Alembic migrations...")
        with engine.connect() as conn:
            config.attributes["connection"] = conn  # Pass connection directly like Phoenix tests
            command.upgrade(config, "head")
        engine.dispose()
        print("Migrations completed successfully")
        return True

    except Exception as e:
        if not skip_if_failed:
            print(f"Error: Failed to run migrations: {e}", file=sys.stderr)
        return False


def main() -> int:
    """Main entry point."""
    # Default output file in the same directory as this script
    script_dir = Path(__file__).parent
    default_output = script_dir / "postgresql_schema.sql"

    parser = argparse.ArgumentParser(
        description="Extract DDL from PostgreSQL database (ephemeral by default, --external for existing database)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    # Connection mode
    parser.add_argument(
        "--external",
        action="store_true",
        help="Connect to external PostgreSQL database (default: create ephemeral instance)",
    )

    # External database connection options
    parser.add_argument("--host", default="localhost", help="Database host (external mode)")
    parser.add_argument("--port", type=int, default=5432, help="Database port (external mode)")
    parser.add_argument("--user", default="postgres", help="Database username (external mode)")
    parser.add_argument("--password", default="postgres", help="Database password (external mode)")
    parser.add_argument("--database", default="postgres", help="Database name (external mode)")

    # Common options
    parser.add_argument("--output", type=Path, default=default_output, help="Output file path")
    parser.add_argument("--schema", default="public", help="Database schema to extract")

    args = parser.parse_args()

    # Validate external mode arguments (when using external)
    if args.external and not all([args.host, args.user, args.database]):
        print("Error: External mode requires --host, --user, and --database", file=sys.stderr)
        return 1

    try:
        if args.external:
            return _extract_ddl_external(args)
        else:
            return _extract_ddl_ephemeral(args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def _extract_ddl_ephemeral(args: argparse.Namespace) -> int:
    """Extract DDL using ephemeral PostgreSQL instance."""
    print("Creating ephemeral PostgreSQL instance...")

    with ephemeral_postgresql() as url:
        print(f"Connection: {url}")

        # Always run migrations for ephemeral instances
        if not run_alembic_migrations(url):
            return 1

        # Extract DDL using URL directly
        return _extract_ddl_with_url(url, args)


def _extract_ddl_external(args: argparse.Namespace) -> int:
    """Extract DDL from external PostgreSQL database."""
    print(f"Connecting to external PostgreSQL: {args.user}@{args.host}:{args.port}/{args.database}")

    # Create connection URL
    url = create_external_url(
        host=args.host,
        port=args.port,
        user=args.user,
        database=args.database,
        password=args.password,
    )

    # Test connection
    try:
        conn_params = ConnectionParams(
            host=args.host,
            port=args.port,
            database=args.database,
            user=args.user,
            password=args.password,
        )
        with PostgreSQLDDLExtractor(conn_params) as _:
            pass  # Just test the connection
        print("Connection successful")
    except Exception as e:
        print(f"Failed to connect to database: {e}", file=sys.stderr)
        return 1

    # Extract DDL (no migrations for external databases)
    return _extract_ddl_with_url(url, args)


def _extract_ddl_with_url(url: URL, args: argparse.Namespace) -> int:
    """Extract DDL using the provided database URL."""
    # Convert URL to ConnectionParams for the extractor
    conn_params = ConnectionParams(
        host=url.host or "localhost",
        port=url.port or 5432,
        database=url.database or "postgres",
        user=url.username or "postgres",
        password=url.password or "postgres",
    )

    with PostgreSQLDDLExtractor(conn_params) as extractor:
        print(f"Extracting DDL for schema: {args.schema}")

        # Extract user-defined types (enums, etc.)
        types_ddl = extractor.extract_all_types_ddl(args.schema)

        # Extract tables
        tables_ddl = extractor.extract_all_tables_ddl(args.schema)

        # Render the complete artifact before touching the destination. Generation
        # can fail for unsupported schema features, and must not truncate the last
        # valid checked-in DDL.
        output = StringIO()
        if types_ddl:
            output.write("-- User-Defined Types (Enums)\n")
            output.write("-- " + "=" * 30 + "\n\n")

            for type_info in types_ddl:
                output.write(extractor.generate_type_ddl(type_info))
                output.write("\n")

            output.write("\n\n")

        for i, table_info in enumerate(tables_ddl):
            if i > 0:
                output.write("\n\n")
            output.write(extractor.generate_ddl(table_info))
            output.write("\n")

        # Write and validate a temporary file in the destination directory, then
        # atomically replace the destination only after validation succeeds.
        temporary_output: Path | None = None
        try:
            with NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=args.output.parent,
                prefix=f".{args.output.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary_file:
                temporary_file.write(output.getvalue())
                temporary_output = Path(temporary_file.name)

            print("\nValidating schema syntax...")
            if not validate_schema_syntax(temporary_output):
                print(
                    "Error: Schema contains syntax errors - destination was not changed",
                    file=sys.stderr,
                )
                return 1

            temporary_output.replace(args.output)
            temporary_output = None
        except OSError as e:
            print(f"Error writing to {args.output}: {e}", file=sys.stderr)
            return 1
        finally:
            if temporary_output is not None:
                temporary_output.unlink(missing_ok=True)

        print(f"DDL exported to: {args.output}")
        print(f"Processed {len(types_ddl)} user-defined types and {len(tables_ddl)} tables")

    return 0


if __name__ == "__main__":
    sys.exit(main())
