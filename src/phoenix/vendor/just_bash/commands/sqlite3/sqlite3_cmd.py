"""SQLite3 command implementation (in-memory only).

Usage: sqlite3 [OPTIONS] :memory: [SQL]

SQLite database CLI. Only in-memory databases (:memory:) are supported.

Options:
  -list           output in list mode (default)
  -csv            output in CSV mode
  -json           output in JSON mode
  -line           output in line mode
  -column         output in column mode
  -header         show column headers
  -noheader       hide column headers
  -separator SEP  field separator (default: |)
  -nullvalue TEXT text for NULL values
  -bail           stop on first error
  -echo           print SQL before execution
  -version        show SQLite version
"""

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from ...types import CommandContext, ExecResult


@dataclass
class Sqlite3Options:
    """Parsed sqlite3 options."""
    mode: str = "list"
    header: bool = False
    separator: str = "|"
    newline: str = "\n"
    null_value: str = ""
    readonly: bool = False
    bail: bool = False
    echo: bool = False
    cmd: str | None = None


def format_value(val: Any, null_value: str = "") -> str:
    """Format a SQL value for output."""
    if val is None:
        return null_value
    return str(val)


def format_output(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format query results based on output mode."""
    if options.mode == "list":
        return format_list(columns, rows, options)
    elif options.mode == "csv":
        return format_csv(columns, rows, options)
    elif options.mode == "json":
        return format_json(columns, rows, options)
    elif options.mode == "line":
        return format_line(columns, rows, options)
    elif options.mode == "column":
        return format_column(columns, rows, options)
    elif options.mode == "table":
        return format_table(columns, rows, options)
    elif options.mode == "tabs":
        return format_tabs(columns, rows, options)
    elif options.mode == "markdown":
        return format_markdown(columns, rows, options)
    else:
        return format_list(columns, rows, options)


def format_list(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as pipe-separated list."""
    lines = []
    if options.header and columns:
        lines.append(options.separator.join(columns))
    for row in rows:
        lines.append(options.separator.join(format_value(v, options.null_value) for v in row))
    return options.newline.join(lines) + (options.newline if lines else "")


def format_csv(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as CSV."""
    import csv
    import io

    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    if options.header and columns:
        writer.writerow(columns)
    for row in rows:
        writer.writerow([format_value(v, options.null_value) for v in row])
    return output.getvalue()


def format_json(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as JSON array of objects."""
    result = []
    for row in rows:
        obj = {}
        for i, col in enumerate(columns):
            val = row[i] if i < len(row) else None
            obj[col] = val
        result.append(obj)
    return json.dumps(result) + "\n"


def format_line(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as column = value, one per line."""
    lines = []
    for row in rows:
        for i, col in enumerate(columns):
            val = row[i] if i < len(row) else None
            lines.append(f"{col} = {format_value(val, options.null_value)}")
        lines.append("")
    return "\n".join(lines)


def format_column(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as fixed-width columns."""
    if not columns:
        return ""

    # Calculate column widths
    widths = [len(c) for c in columns]
    for row in rows:
        for i, val in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(format_value(val, options.null_value)))

    lines = []
    if options.header:
        lines.append("  ".join(c.ljust(widths[i]) for i, c in enumerate(columns)))
        lines.append("  ".join("-" * w for w in widths))

    for row in rows:
        line_parts = []
        for i, val in enumerate(row):
            if i < len(widths):
                line_parts.append(format_value(val, options.null_value).ljust(widths[i]))
        lines.append("  ".join(line_parts))

    return "\n".join(lines) + "\n" if lines else ""


def format_table(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as ASCII table."""
    if not columns:
        return ""

    # Calculate column widths
    widths = [len(c) for c in columns]
    for row in rows:
        for i, val in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(format_value(val, options.null_value)))

    # Build table
    sep = "+" + "+".join("-" * (w + 2) for w in widths) + "+"
    lines = [sep]

    if options.header:
        header_line = "|" + "|".join(f" {c.ljust(widths[i])} " for i, c in enumerate(columns)) + "|"
        lines.append(header_line)
        lines.append(sep)

    for row in rows:
        row_parts = []
        for i, val in enumerate(row):
            if i < len(widths):
                row_parts.append(f" {format_value(val, options.null_value).ljust(widths[i])} ")
        lines.append("|" + "|".join(row_parts) + "|")

    lines.append(sep)
    return "\n".join(lines) + "\n"


def format_tabs(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as tab-separated values."""
    lines = []
    if options.header and columns:
        lines.append("\t".join(columns))
    for row in rows:
        lines.append("\t".join(format_value(v, options.null_value) for v in row))
    return "\n".join(lines) + ("\n" if lines else "")


def format_markdown(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    options: Sqlite3Options,
) -> str:
    """Format as markdown table."""
    if not columns:
        return ""

    # Calculate column widths
    widths = [len(c) for c in columns]
    for row in rows:
        for i, val in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(format_value(val, options.null_value)))

    lines = []

    # Header
    header_line = "|" + "|".join(f" {c.ljust(widths[i])} " for i, c in enumerate(columns)) + "|"
    lines.append(header_line)

    # Separator
    sep_line = "|" + "|".join("-" * (w + 2) for w in widths) + "|"
    lines.append(sep_line)

    # Rows
    for row in rows:
        row_parts = []
        for i, val in enumerate(row):
            if i < len(widths):
                row_parts.append(f" {format_value(val, options.null_value).ljust(widths[i])} ")
        lines.append("|" + "|".join(row_parts) + "|")

    return "\n".join(lines) + "\n"


def split_statements(sql: str) -> list[str]:
    """Split SQL into individual statements."""
    statements = []
    current = ""
    in_string = False
    string_char = ""

    for i, char in enumerate(sql):
        if in_string:
            current += char
            if char == string_char:
                if i + 1 < len(sql) and sql[i + 1] == string_char:
                    current += sql[i + 1]
                else:
                    in_string = False
        elif char in ("'", '"'):
            current += char
            in_string = True
            string_char = char
        elif char == ";":
            stmt = current.strip()
            if stmt:
                statements.append(stmt)
            current = ""
        else:
            current += char

    stmt = current.strip()
    if stmt:
        statements.append(stmt)

    return statements


def is_write_statement(sql: str) -> bool:
    """Check if SQL statement modifies database."""
    trimmed = sql.strip().upper()
    return any(trimmed.startswith(kw) for kw in [
        "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "REPLACE", "VACUUM"
    ])


class Sqlite3Command:
    """The sqlite3 command - SQLite database CLI."""

    name = "sqlite3"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the sqlite3 command."""
        if "--help" in args or "-help" in args or "-h" in args:
            return ExecResult(
                stdout=(
                    "Usage: sqlite3 [OPTIONS] DATABASE [SQL]\n"
                    "SQLite database CLI.\n\n"
                    "Options:\n"
                    "  -list           output in list mode (default)\n"
                    "  -csv            output in CSV mode\n"
                    "  -json           output in JSON mode\n"
                    "  -line           output in line mode\n"
                    "  -column         output in column mode\n"
                    "  -table          output as ASCII table\n"
                    "  -markdown       output as markdown table\n"
                    "  -tabs           output in tab-separated mode\n"
                    "  -header         show column headers\n"
                    "  -noheader       hide column headers\n"
                    "  -separator SEP  field separator (default: |)\n"
                    "  -nullvalue TEXT text for NULL values\n"
                    "  -readonly       open database read-only\n"
                    "  -bail           stop on first error\n"
                    "  -echo           print SQL before execution\n"
                    "  -version        show SQLite version\n"
                    "  --help          show this help\n"
                ),
                stderr="",
                exit_code=0,
            )

        # Parse arguments
        options = Sqlite3Options()
        database = None
        sql_arg = None
        show_version = False
        end_of_options = False

        i = 0
        while i < len(args):
            arg = args[i]

            if end_of_options:
                if database is None:
                    database = arg
                elif sql_arg is None:
                    sql_arg = arg
                i += 1
                continue

            if arg == "--":
                end_of_options = True
            elif arg == "-version":
                show_version = True
            elif arg == "-list":
                options.mode = "list"
            elif arg == "-csv":
                options.mode = "csv"
            elif arg == "-json":
                options.mode = "json"
            elif arg == "-line":
                options.mode = "line"
            elif arg == "-column":
                options.mode = "column"
            elif arg == "-table":
                options.mode = "table"
            elif arg == "-markdown":
                options.mode = "markdown"
            elif arg == "-tabs":
                options.mode = "tabs"
            elif arg == "-header":
                options.header = True
            elif arg == "-noheader":
                options.header = False
            elif arg == "-readonly":
                options.readonly = True
            elif arg == "-bail":
                options.bail = True
            elif arg == "-echo":
                options.echo = True
            elif arg == "-separator":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="sqlite3: Error: missing argument to -separator\n",
                        exit_code=1,
                    )
                options.separator = args[i]
            elif arg == "-nullvalue":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="sqlite3: Error: missing argument to -nullvalue\n",
                        exit_code=1,
                    )
                options.null_value = args[i]
            elif arg == "-cmd":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="sqlite3: Error: missing argument to -cmd\n",
                        exit_code=1,
                    )
                options.cmd = args[i]
            elif arg.startswith("-"):
                opt_name = arg[1:] if arg.startswith("--") else arg
                return ExecResult(
                    stdout="",
                    stderr=f"sqlite3: Error: unknown option: {opt_name}\nUse -help for a list of options.\n",
                    exit_code=1,
                )
            elif database is None:
                database = arg
            elif sql_arg is None:
                sql_arg = arg
            i += 1

        # Handle -version
        if show_version:
            version = sqlite3.sqlite_version
            return ExecResult(stdout=f"{version}\n", stderr="", exit_code=0)

        if not database:
            return ExecResult(
                stdout="",
                stderr="sqlite3: missing database argument\n",
                exit_code=1,
            )

        # Only support in-memory databases for now
        if database != ":memory:":
            return ExecResult(
                stdout="",
                stderr="sqlite3: only :memory: database is supported\n",
                exit_code=1,
            )

        # Get SQL from argument or stdin
        sql = sql_arg or ctx.stdin.strip()
        if options.cmd:
            sql = options.cmd + (";" + sql if sql else "")
        if not sql:
            return ExecResult(
                stdout="",
                stderr="sqlite3: no SQL provided\n",
                exit_code=1,
            )

        # Execute SQL in memory
        try:
            conn = sqlite3.connect(":memory:")
            cursor = conn.cursor()
            stdout = ""

            # Echo SQL if requested
            if options.echo:
                stdout += f"{sql}\n"

            # Execute statements
            statements = split_statements(sql)
            had_error = False

            for stmt in statements:
                try:
                    cursor.execute(stmt)

                    # Fetch results for non-write statements
                    if not is_write_statement(stmt):
                        columns = [desc[0] for desc in cursor.description] if cursor.description else []
                        rows = cursor.fetchall()

                        if rows or options.header:
                            stdout += format_output(columns, rows, options)

                except sqlite3.Error as e:
                    if options.bail:
                        conn.close()
                        return ExecResult(
                            stdout=stdout,
                            stderr=f"Error: {e}\n",
                            exit_code=1,
                        )
                    stdout += f"Error: {e}\n"
                    had_error = True

            conn.close()

            return ExecResult(
                stdout=stdout,
                stderr="",
                exit_code=1 if had_error and options.bail else 0,
            )

        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"sqlite3: {e}\n",
                exit_code=1,
            )
