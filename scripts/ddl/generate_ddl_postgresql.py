# /// script
# dependencies = [
#   "psycopg[binary]",
#   "testing.postgresql",
#   "arize-phoenix",
# ]
# ///
# ruff: noqa: E501
"""PostgreSQL DDL Extractor.

Extracts DDL from a PostgreSQL database and outputs it to a file,
grouped by table and sorted deterministically.

Creates an ephemeral PostgreSQL instance, runs Alembic migrations,
extracts DDL, and cleans up automatically. No external PostgreSQL server needed.

Usage:
    # Create ephemeral PostgreSQL, run migrations, extract DDL
    python generate_ddl_postgresql.py

    # Specify custom output file
    python generate_ddl_postgresql.py --output /path/to/schema.sql

Requirements:
    pip install psycopg[binary] testing.postgresql arize-phoenix
"""

from __future__ import annotations

import argparse
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

import psycopg
import testing.postgresql
from alembic import command
from alembic.config import Config
from psycopg.rows import dict_row
from sqlalchemy import URL, create_engine

import phoenix.db


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


class PostgreSQLDDLExtractor:
    """Extract DDL from PostgreSQL databases."""

    def __init__(self, url: URL) -> None:
        self.url = url
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
            # Convert URL to plain postgresql for psycopg (remove driver suffix)
            psycopg_url = self.url.set(drivername="postgresql")
            self.conn = psycopg.connect(str(psycopg_url))
            return True
        except psycopg.Error as e:
            print(f"Error connecting to database: {e}", file=sys.stderr)
            return False

    def close(self) -> None:
        """Close database connection."""
        if self.conn:
            self.conn.close()

    def _execute_query(
        self, query: str, params: tuple[Any, ...], operation_name: str
    ) -> list[dict[str, Any]]:
        """Execute database query with standardized error handling."""
        if not self.conn:
            raise RuntimeError("No database connection")

        try:
            with self.conn.cursor(row_factory=dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchall()
        except psycopg.Error as e:
            print(f"Error {operation_name}: {e}", file=sys.stderr)
            return []

    def extract_all_tables_ddl(self, schema: str = "public") -> list[TableInfo]:
        """Extract DDL for all tables in the specified schema."""
        tables = self._get_all_tables(schema)
        table_ddls: list[TableInfo] = []

        for table_name in tables:
            try:
                ddl_info = self._extract_single_table_ddl(schema, table_name)
                table_ddls.append(ddl_info)
            except Exception as e:
                print(
                    f"Warning: Failed to extract DDL for table {table_name}: {e}", file=sys.stderr
                )

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

        # Perform topological sort using Kahn's algorithm:
        # 1. Start with nodes that have no dependencies (in-degree = 0)
        # 2. Remove each node and update in-degrees of neighbors
        # 3. Add newly independent nodes to queue
        # 4. Repeat until all nodes processed or cycle detected
        sorted_tables: list[TableInfo] = []
        in_degree = {table: len(deps) for table, deps in dependencies.items()}
        queue = [table for table, degree in in_degree.items() if degree == 0]

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
        query = """
            SELECT
                column_name,
                data_type,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                is_nullable,
                column_default,
                is_identity,
                identity_generation,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """
        return self._execute_query(
            query, (schema, table_name), f"getting columns for {schema}.{table_name}"
        )

    def _get_constraints(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get table constraints (PRIMARY KEY, UNIQUE, CHECK)."""
        query = """
            SELECT
                tc.constraint_name,
                tc.constraint_type,
                array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns,
                pg_get_constraintdef(pgc.oid) as constraint_definition
            FROM information_schema.table_constraints tc
                     LEFT JOIN information_schema.key_column_usage kcu
                               ON tc.constraint_name = kcu.constraint_name
                                   AND tc.table_schema = kcu.table_schema
                     LEFT JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
            WHERE tc.table_schema = %s
              AND tc.table_name = %s
              AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
            GROUP BY tc.constraint_name, tc.constraint_type, pgc.oid
            ORDER BY tc.constraint_type, tc.constraint_name
        """
        return self._execute_query(
            query, (schema, table_name), f"getting constraints for {schema}.{table_name}"
        )

    def _get_foreign_keys(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get foreign key constraints with full details."""
        query = """
            SELECT
                tc.constraint_name,
                array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                array_agg(ccu.column_name ORDER BY kcu.ordinal_position) as foreign_columns,
                rc.update_rule,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
                     JOIN information_schema.key_column_usage AS kcu
                          ON tc.constraint_name = kcu.constraint_name
                              AND tc.table_schema = kcu.table_schema
                     JOIN information_schema.constraint_column_usage AS ccu
                          ON ccu.constraint_name = tc.constraint_name
                     JOIN information_schema.referential_constraints AS rc
                          ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = %s
              AND tc.table_name = %s
            GROUP BY tc.constraint_name, ccu.table_schema, ccu.table_name,
                     rc.update_rule, rc.delete_rule
            ORDER BY tc.constraint_name
        """
        return self._execute_query(
            query, (schema, table_name), f"getting foreign keys for {schema}.{table_name}"
        )

    def _get_indexes(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get indexes for a table (excluding those created by constraints).

        We only want standalone indexes, not those automatically created by:
        - PRIMARY KEY constraints (ix.indisprimary = true)
        - UNIQUE constraints (linked via pg_constraint.conindid)

        This avoids duplicating constraint definitions in the DDL output.
        """
        query = """
            SELECT DISTINCT
                i.relname as index_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                pg_get_indexdef(i.oid) as index_definition
            FROM pg_class t                              -- Target table
                     JOIN pg_index ix ON t.oid = ix.indrelid      -- Index metadata
                     JOIN pg_class i ON i.oid = ix.indexrelid     -- Index object
                     JOIN pg_attribute a ON t.oid = a.attrelid    -- Column attributes
                     JOIN pg_namespace n ON t.relnamespace = n.oid -- Schema info
            WHERE t.relname = %s
              AND n.nspname = %s
              AND a.attnum = ANY(ix.indkey)           -- Match columns in index
              AND NOT ix.indisprimary                 -- Skip PRIMARY KEY indexes (handled as constraints)
              AND NOT EXISTS (                       -- Skip UNIQUE constraint indexes
                SELECT 1 FROM pg_constraint c
                WHERE c.conindid = i.oid AND c.contype = 'u'
              )
            GROUP BY i.relname, ix.indisunique, ix.indisprimary, i.oid
            ORDER BY i.relname
        """
        return self._execute_query(
            query, (table_name, schema), f"getting indexes for {schema}.{table_name}"
        )

    def _get_triggers(self, schema: str, table_name: str) -> list[dict[str, Any]]:
        """Get triggers for a table."""
        query = """
            SELECT
                trigger_name,
                action_timing,
                event_manipulation,
                action_statement
            FROM information_schema.triggers
            WHERE event_object_schema = %s
              AND event_object_table = %s
            ORDER BY trigger_name
        """
        return self._execute_query(
            query, (schema, table_name), f"getting triggers for {schema}.{table_name}"
        )

    def generate_ddl(self, table_info: TableInfo) -> str:
        """Generate DDL string for a single table."""
        ddl_parts: list[str] = []
        table_name = table_info.table_name
        schema = table_info.schema
        full_name = f"{schema}.{table_name}" if schema != "public" else table_name

        # === Table Definition ===
        header_line = f"Table: {full_name}"
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
        sorted_triggers = sorted(table_info.triggers, key=lambda x: x["trigger_name"])
        if sorted_triggers:
            ddl_parts.append("")
            for trigger in sorted_triggers:
                ddl_parts.append(f"{trigger['action_statement']};")

        return "\n".join(ddl_parts)

    def _build_create_table(self, table_info: TableInfo) -> str:
        """Build the CREATE TABLE statement."""
        table_name = table_info.table_name
        schema = table_info.schema
        full_table_name = f"public.{table_name}" if schema == "public" else f"{schema}.{table_name}"

        ddl_parts = [f"CREATE TABLE {full_table_name} ("]

        # Column definitions
        column_defs: list[str] = []
        for col in table_info.columns:
            col_def = self._format_column(col)
            column_defs.append(f"    {col_def}")

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
        if line is None:
            return ""

        # Delegate to specific formatting methods
        if "FOREIGN KEY" in line and "REFERENCES" in line:
            return self._wrap_foreign_key_constraint(line)
        elif "UNIQUE (" in line and "CONSTRAINT " in line:
            return self._wrap_unique_constraint(line)
        elif "ARRAY[" in line and ("CHECK (" in line or "])::text[]" in line):
            return self._wrap_check_constraint(line)

        return line

    def _wrap_foreign_key_constraint(self, line: str) -> str:
        """Format foreign key constraints with consistent line breaks."""
        parts = []
        remaining = line

        if " FOREIGN KEY " in remaining:
            fk_split = remaining.split(" FOREIGN KEY ", 1)
            constraint_part = fk_split[0] + " FOREIGN KEY"

            # Break long constraint names (>70 chars)
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
        after_array = check_part[array_end + 1 :]  # Skip "]" to get ")::text[]"

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
        # For CREATE INDEX statements with USING clause, break before USING for consistency
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

        Handles formats like:
        - "{col1,col2}" -> ["col1", "col2"]
        - "{\"user id\",name}" -> ["user id", "name"]
        - "{\"order,total\",qty}" -> ["order,total", "qty"]
        """
        if not (array_str.startswith("{") and array_str.endswith("}")):
            return [array_str.strip()]

        inner = array_str[1:-1]  # Remove outer braces
        if not inner:
            return []

        return self._split_quoted_array_elements(inner)

    def _split_quoted_array_elements(self, content: str) -> list[str]:
        """Split array content respecting quoted elements with commas/spaces."""
        result = []
        current_item = ""
        in_quotes = False

        for i, char in enumerate(content):
            if char == '"' and (i == 0 or content[i - 1] != "\\"):
                # Toggle quote state (ignore escaped quotes)
                in_quotes = not in_quotes
            elif char == "," and not in_quotes:
                # Split on commas outside quotes
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
        """Format a single column definition."""
        parts: list[str] = [col["column_name"]]

        # === Data Type Processing ===
        data_type = col["data_type"].lower()

        # Handle PostgreSQL serial types and identity columns
        if col.get("column_default") and "nextval(" in col["column_default"]:
            if data_type == "integer":
                parts.append("serial")
            elif data_type == "bigint":
                parts.append("bigserial")
            else:
                parts.append(self._format_data_type(col, data_type))
        else:
            parts.append(self._format_data_type(col, data_type))

        # === Column Attributes ===
        if col["is_nullable"] == "NO":
            parts.append("NOT NULL")

        # Add default for non-serial columns
        if col["column_default"] and "nextval(" not in col["column_default"]:
            default_val = col["column_default"]
            parts.append(f"DEFAULT {default_val}")

        return " ".join(parts)

    def _format_data_type(self, col: dict[str, Any], data_type: str) -> str:
        """Format the data type portion of a column definition.

        PostgreSQL stores type names in lowercase with underscores, but DDL
        convention is to use uppercase SQL standard names where possible.
        """
        # Normalize PostgreSQL type names to SQL standard equivalents
        if data_type == "character varying":
            data_type = "VARCHAR"
        elif data_type == "timestamp with time zone":
            data_type = "TIMESTAMP WITH TIME ZONE"
        elif data_type == "timestamp without time zone":
            data_type = "TIMESTAMP"
        elif data_type == "double precision":
            data_type = "DOUBLE PRECISION"
        else:
            data_type = data_type.upper()

        # PostgreSQL integer types don't accept precision/scale parameters
        # e.g., "INTEGER(10)" is invalid - PostgreSQL always uses fixed sizes:
        # - SMALLINT: 2 bytes, INTEGER: 4 bytes, BIGINT: 8 bytes
        # - DOUBLE PRECISION: IEEE 754 standard (no precision parameter)
        # - BOOLEAN, BYTEA: fixed-size types
        if data_type in ("INTEGER", "BIGINT", "SMALLINT", "DOUBLE PRECISION", "BOOLEAN", "BYTEA"):
            return data_type
        elif col["character_maximum_length"]:
            # Character types: VARCHAR(255), CHAR(10)
            return f"{data_type}({col['character_maximum_length']})"
        elif col["numeric_precision"] and col["numeric_scale"] is not None:
            # Decimal types: NUMERIC(10,2), DECIMAL(5,0)
            return f"{data_type}({col['numeric_precision']},{col['numeric_scale']})"
        elif col["numeric_precision"] and data_type not in (
            "INTEGER",
            "BIGINT",
            "SMALLINT",
            "DOUBLE PRECISION",
            "BOOLEAN",
            "BYTEA",
        ):
            # Other numeric types that take precision: FLOAT(7)
            return f"{data_type}({col['numeric_precision']})"
        else:
            return data_type

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

        full_ref_table = (
            f"public.{ref_table}" if ref_schema == "public" else f"{ref_schema}.{ref_table}"
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


def run_alembic_migrations(url: URL) -> None:
    """Run Alembic migrations against the database.

    Uses the same pattern as Phoenix's integration tests - pass connection directly to Alembic.

    Args:
        url: SQLAlchemy URL for the database
    """
    try:
        # Set up Alembic config
        phoenix_db_path = Path(phoenix.db.__path__[0])
        alembic_ini = phoenix_db_path / "alembic.ini"

        if not alembic_ini.exists():
            print(
                f"Warning: Alembic config not found at {alembic_ini}, skipping migrations",
                file=sys.stderr,
            )
            return

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

    except Exception as e:
        print(f"Warning: Failed to run migrations: {e}", file=sys.stderr)
        print("Proceeding with DDL extraction from empty database", file=sys.stderr)


def _write_ddl_to_file(
    tables_ddl: list[TableInfo], extractor: PostgreSQLDDLExtractor, output_path: Path
) -> None:
    """Write DDL to output file.

    Args:
        tables_ddl: List of table information
        extractor: DDL extractor instance
        output_path: Path to output file

    Raises:
        OSError: If file cannot be written
    """
    try:
        with output_path.open("w", encoding="utf-8") as f:
            # Write each table's DDL
            for i, table_info in enumerate(tables_ddl):
                if i > 0:  # Add extra spacing between tables
                    f.write("\n\n")

                ddl = extractor.generate_ddl(table_info)
                f.write(ddl)
                f.write("\n")
    except (OSError, IOError) as e:
        print(f"Error writing to {output_path}: {e}", file=sys.stderr)
        raise

    print(f"DDL exported to: {output_path}")
    print(f"Processed {len(tables_ddl)} tables")


def main() -> int:
    """Main entry point."""
    # Default output file in the same directory as this script
    script_dir = Path(__file__).parent
    default_output = script_dir / "postgresql_schema.sql"

    parser = argparse.ArgumentParser(
        description="Extract DDL from ephemeral PostgreSQL database with Phoenix migrations",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument("--output", type=Path, default=default_output, help="Output file path")

    args = parser.parse_args()

    # Extract DDL using ephemeral PostgreSQL
    try:
        with ephemeral_postgresql() as url:
            print("Created ephemeral PostgreSQL instance")
            print(f"Connection: {url}")

            # Always run migrations
            run_alembic_migrations(url)

            # Extract DDL
            with PostgreSQLDDLExtractor(url) as extractor:
                print("Extracting DDL for schema: public")
                tables_ddl = extractor.extract_all_tables_ddl("public")
                _write_ddl_to_file(tables_ddl, extractor, args.output)

        print("Ephemeral PostgreSQL instance cleaned up")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
