"""Xan command implementation - CSV toolkit.

A Python port of the xan CSV toolkit for data manipulation.

Usage: xan <COMMAND> [OPTIONS] [FILE]

Implemented Commands:
  headers     Show column names
  count       Count rows
  head        Show first N rows
  tail        Show last N rows
  slice       Extract row range
  select      Select columns
  drop        Drop columns (inverse of select)
  rename      Rename columns (old:new syntax)
  filter      Filter rows by expression
  search      Filter rows by regex
  sort        Sort rows
  reverse     Reverse row order
  behead      Output without header
  enum        Add index column
  shuffle     Randomly reorder rows
  sample      Random sample of N rows
  dedup       Remove duplicate rows
  top         Top N rows by column value
  cat         Concatenate CSV files
  transpose   Swap rows and columns
  fixlengths  Fix ragged CSV
  flatten/f   Display records vertically
  explode     Split column values to rows
  implode     Combine rows by grouping
  split       Split into multiple files
  view        Pretty print as table
  stats       Show column statistics
  frequency   Count value occurrences
  to json     Convert CSV to JSON
  from json   Convert JSON to CSV

Not Yet Implemented (require expression evaluation):
  join        Join two CSVs on a key column
  agg         Aggregate column values with expressions
  groupby     Group rows and aggregate
  map         Add computed columns via expressions
  transform   Transform column values via expressions
  pivot       Reshape data (pivot table)

These commands are stubbed and will return a "not implemented" error.
The TypeScript xan uses a custom expression language for these operations
that would need to be ported to Python.
"""

import csv
import io
import json
import random
import re
from typing import Any

from ...types import CommandContext, ExecResult


def parse_csv(content: str) -> tuple[list[str], list[dict[str, str]]]:
    """Parse CSV content into headers and data rows."""
    if not content.strip():
        return [], []

    reader = csv.DictReader(io.StringIO(content))
    headers = reader.fieldnames or []
    data = list(reader)
    return list(headers), data


def format_csv(headers: list[str], data: list[dict[str, Any]]) -> str:
    """Format data as CSV."""
    if not headers:
        return ""

    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=headers, lineterminator="\n")
    writer.writeheader()
    for row in data:
        writer.writerow({h: row.get(h, "") for h in headers})
    return output.getvalue()


def format_value(v: Any) -> str:
    """Format a value for CSV output."""
    if v is None:
        return ""
    s = str(v)
    if "," in s or '"' in s or "\n" in s:
        escaped = s.replace('"', '""')
        return f'"{escaped}"'
    return s


async def read_csv_input(
    file_args: list[str], ctx: CommandContext
) -> tuple[list[str], list[dict[str, str]], ExecResult | None]:
    """Read CSV from file or stdin."""
    if not file_args or file_args[0] == "-":
        content = ctx.stdin
    else:
        try:
            path = ctx.fs.resolve_path(ctx.cwd, file_args[0])
            content = await ctx.fs.read_file(path)
        except FileNotFoundError:
            return [], [], ExecResult(
                stdout="",
                stderr=f"xan: {file_args[0]}: No such file or directory\n",
                exit_code=2,
            )

    headers, data = parse_csv(content)
    return headers, data, None


async def cmd_headers(args: list[str], ctx: CommandContext) -> ExecResult:
    """Show column names."""
    just_names = "-j" in args or "--just-names" in args
    file_args = [a for a in args if not a.startswith("-")]

    headers, _, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if just_names:
        output = "\n".join(headers) + "\n" if headers else ""
    else:
        output = "\n".join(f"{i}\t{h}" for i, h in enumerate(headers)) + "\n" if headers else ""

    return ExecResult(stdout=output, stderr="", exit_code=0)


async def cmd_count(args: list[str], ctx: CommandContext) -> ExecResult:
    """Count rows."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    return ExecResult(stdout=f"{len(data)}\n", stderr="", exit_code=0)


async def cmd_head(args: list[str], ctx: CommandContext) -> ExecResult:
    """Show first N rows."""
    n = 10
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "-n" and i + 1 < len(args):
            try:
                n = int(args[i + 1])
            except ValueError:
                pass
            i += 2
            continue
        elif arg.startswith("-n"):
            try:
                n = int(arg[2:])
            except ValueError:
                pass
        elif not arg.startswith("-"):
            file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    return ExecResult(stdout=format_csv(headers, data[:n]), stderr="", exit_code=0)


async def cmd_tail(args: list[str], ctx: CommandContext) -> ExecResult:
    """Show last N rows."""
    n = 10
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "-n" and i + 1 < len(args):
            try:
                n = int(args[i + 1])
            except ValueError:
                pass
            i += 2
            continue
        elif arg.startswith("-n"):
            try:
                n = int(arg[2:])
            except ValueError:
                pass
        elif not arg.startswith("-"):
            file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    return ExecResult(stdout=format_csv(headers, data[-n:]), stderr="", exit_code=0)


async def cmd_slice(args: list[str], ctx: CommandContext) -> ExecResult:
    """Extract row range."""
    start = 0
    end = None
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "-s" or arg == "--start":
            if i + 1 < len(args):
                try:
                    start = int(args[i + 1])
                except ValueError:
                    pass
                i += 2
                continue
        elif arg == "-e" or arg == "--end":
            if i + 1 < len(args):
                try:
                    end = int(args[i + 1])
                except ValueError:
                    pass
                i += 2
                continue
        elif not arg.startswith("-"):
            file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    return ExecResult(stdout=format_csv(headers, data[start:end]), stderr="", exit_code=0)


async def cmd_select(args: list[str], ctx: CommandContext) -> ExecResult:
    """Select columns."""
    cols_spec = ""
    file_args = []

    for arg in args:
        if not arg.startswith("-"):
            if not cols_spec:
                cols_spec = arg
            else:
                file_args.append(arg)

    if not cols_spec:
        return ExecResult(
            stdout="",
            stderr="xan select: no columns specified\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Parse column specification (comma-separated names or indices)
    selected_headers = []
    for col in cols_spec.split(","):
        col = col.strip()
        if not col:
            continue

        # Check if it's an index
        try:
            idx = int(col)
            if 0 <= idx < len(headers):
                selected_headers.append(headers[idx])
            continue
        except ValueError:
            pass

        # Check for glob pattern
        if "*" in col:
            pattern = col.replace("*", ".*")
            for h in headers:
                if re.match(f"^{pattern}$", h) and h not in selected_headers:
                    selected_headers.append(h)
            continue

        # Direct column name
        if col in headers:
            selected_headers.append(col)

    # Filter data to selected columns
    selected_data = []
    for row in data:
        selected_data.append({h: row.get(h, "") for h in selected_headers})

    return ExecResult(stdout=format_csv(selected_headers, selected_data), stderr="", exit_code=0)


async def cmd_filter(args: list[str], ctx: CommandContext) -> ExecResult:
    """Filter rows by expression."""
    expr = ""
    invert = False
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-v", "--invert"):
            invert = True
        elif not arg.startswith("-"):
            if not expr:
                expr = arg
            else:
                file_args.append(arg)
        i += 1

    if not expr:
        return ExecResult(
            stdout="",
            stderr="xan filter: no expression specified\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Parse simple expressions: col op value
    # Supported: ==, !=, <, <=, >, >=, contains, startswith, endswith
    filtered = []
    for row in data:
        match = evaluate_filter_expr(expr, row)
        if (match and not invert) or (not match and invert):
            filtered.append(row)

    return ExecResult(stdout=format_csv(headers, filtered), stderr="", exit_code=0)


def evaluate_filter_expr(expr: str, row: dict[str, str]) -> bool:
    """Evaluate a filter expression against a row."""
    expr = expr.strip()

    # Try different operators
    for op, op_func in [
        ("==", lambda a, b: str(a) == str(b)),
        ("!=", lambda a, b: str(a) != str(b)),
        (">=", lambda a, b: try_compare(a, b, "ge")),
        ("<=", lambda a, b: try_compare(a, b, "le")),
        (">", lambda a, b: try_compare(a, b, "gt")),
        ("<", lambda a, b: try_compare(a, b, "lt")),
    ]:
        if f" {op} " in expr:
            parts = expr.split(f" {op} ", 1)
            col = parts[0].strip()
            val = parts[1].strip().strip('"').strip("'")
            if col in row:
                return op_func(row[col], val)
            return False

    # Check for function-style expressions
    if "contains(" in expr.lower():
        match = re.match(r"(\w+)\s+contains\s*\(([^)]+)\)", expr, re.IGNORECASE)
        if match:
            col, val = match.groups()
            val = val.strip('"').strip("'")
            if col in row:
                return val in str(row[col])
        return False

    if "startswith(" in expr.lower():
        match = re.match(r"(\w+)\s+startswith\s*\(([^)]+)\)", expr, re.IGNORECASE)
        if match:
            col, val = match.groups()
            val = val.strip('"').strip("'")
            if col in row:
                return str(row[col]).startswith(val)
        return False

    if "endswith(" in expr.lower():
        match = re.match(r"(\w+)\s+endswith\s*\(([^)]+)\)", expr, re.IGNORECASE)
        if match:
            col, val = match.groups()
            val = val.strip('"').strip("'")
            if col in row:
                return str(row[col]).endswith(val)
        return False

    return False


def try_compare(a: str, b: str, op: str) -> bool:
    """Try to compare values, first as numbers, then as strings."""
    try:
        a_num = float(a) if a else 0
        b_num = float(b) if b else 0
        if op == "gt":
            return a_num > b_num
        elif op == "ge":
            return a_num >= b_num
        elif op == "lt":
            return a_num < b_num
        elif op == "le":
            return a_num <= b_num
    except ValueError:
        pass

    if op == "gt":
        return str(a) > str(b)
    elif op == "ge":
        return str(a) >= str(b)
    elif op == "lt":
        return str(a) < str(b)
    elif op == "le":
        return str(a) <= str(b)
    return False


async def cmd_search(args: list[str], ctx: CommandContext) -> ExecResult:
    """Filter rows by regex."""
    pattern = ""
    select_cols: list[str] = []
    invert = False
    ignore_case = False
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-s", "--select") and i + 1 < len(args):
            select_cols = args[i + 1].split(",")
            i += 2
            continue
        elif arg in ("-v", "--invert"):
            invert = True
        elif arg in ("-i", "--ignore-case"):
            ignore_case = True
        elif not arg.startswith("-"):
            if not pattern:
                pattern = arg
            else:
                file_args.append(arg)
        i += 1

    if not pattern:
        return ExecResult(
            stdout="",
            stderr="xan search: no pattern specified\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    search_cols = select_cols if select_cols else headers

    try:
        regex = re.compile(pattern, re.IGNORECASE if ignore_case else 0)
    except re.error:
        return ExecResult(
            stdout="",
            stderr=f"xan search: invalid regex pattern '{pattern}'\n",
            exit_code=1,
        )

    filtered = []
    for row in data:
        matches = any(
            regex.search(str(row.get(col, "")))
            for col in search_cols
            if col in row
        )
        if (matches and not invert) or (not matches and invert):
            filtered.append(row)

    return ExecResult(stdout=format_csv(headers, filtered), stderr="", exit_code=0)


async def cmd_sort(args: list[str], ctx: CommandContext) -> ExecResult:
    """Sort rows."""
    sort_col = ""
    numeric = False
    reverse = False
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-N", "--numeric"):
            numeric = True
        elif arg in ("-r", "--reverse", "-R"):
            reverse = True
        elif arg in ("-s", "--select") and i + 1 < len(args):
            sort_col = args[i + 1]
            i += 2
            continue
        elif not arg.startswith("-"):
            if not sort_col:
                sort_col = arg
            else:
                file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if not sort_col:
        return ExecResult(
            stdout="",
            stderr="xan sort: no sort column specified\n",
            exit_code=1,
        )

    if sort_col not in headers:
        return ExecResult(
            stdout="",
            stderr=f"xan sort: column '{sort_col}' not found\n",
            exit_code=1,
        )

    def sort_key(row: dict) -> Any:
        val = row.get(sort_col, "")
        if numeric:
            try:
                return float(val) if val else 0
            except ValueError:
                return 0
        return str(val)

    sorted_data = sorted(data, key=sort_key, reverse=reverse)
    return ExecResult(stdout=format_csv(headers, sorted_data), stderr="", exit_code=0)


async def cmd_view(args: list[str], ctx: CommandContext) -> ExecResult:
    """Pretty print as table."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if not headers:
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Calculate column widths
    widths = {h: len(h) for h in headers}
    for row in data:
        for h in headers:
            widths[h] = max(widths[h], len(str(row.get(h, ""))))

    # Build table
    lines = []

    # Header
    header_line = " | ".join(h.ljust(widths[h]) for h in headers)
    lines.append(header_line)

    # Separator
    sep_line = "-+-".join("-" * widths[h] for h in headers)
    lines.append(sep_line)

    # Data rows
    for row in data:
        row_line = " | ".join(str(row.get(h, "")).ljust(widths[h]) for h in headers)
        lines.append(row_line)

    return ExecResult(stdout="\n".join(lines) + "\n", stderr="", exit_code=0)


async def cmd_stats(args: list[str], ctx: CommandContext) -> ExecResult:
    """Show column statistics."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if not headers:
        return ExecResult(stdout="", stderr="", exit_code=0)

    lines = []
    for col in headers:
        values = [row.get(col, "") for row in data]
        non_empty = [v for v in values if v]

        # Try to parse as numbers
        nums = []
        for v in non_empty:
            try:
                nums.append(float(v))
            except ValueError:
                pass

        lines.append(f"Column: {col}")
        lines.append(f"  Count: {len(values)}")
        lines.append(f"  Non-empty: {len(non_empty)}")
        lines.append(f"  Unique: {len(set(non_empty))}")

        if nums:
            lines.append(f"  Min: {min(nums)}")
            lines.append(f"  Max: {max(nums)}")
            lines.append(f"  Sum: {sum(nums)}")
            lines.append(f"  Mean: {sum(nums) / len(nums):.2f}")

        lines.append("")

    return ExecResult(stdout="\n".join(lines), stderr="", exit_code=0)


async def cmd_frequency(args: list[str], ctx: CommandContext) -> ExecResult:
    """Count value occurrences."""
    col = ""
    file_args = []

    for arg in args:
        if not arg.startswith("-"):
            if not col:
                col = arg
            else:
                file_args.append(arg)

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if not col:
        # Default to first column
        col = headers[0] if headers else ""

    if col not in headers:
        return ExecResult(
            stdout="",
            stderr=f"xan frequency: column '{col}' not found\n",
            exit_code=1,
        )

    # Count occurrences
    counts: dict[str, int] = {}
    for row in data:
        val = str(row.get(col, ""))
        counts[val] = counts.get(val, 0) + 1

    # Sort by count descending
    sorted_counts = sorted(counts.items(), key=lambda x: -x[1])

    # Output as CSV
    output = "value,count\n"
    for val, count in sorted_counts:
        output += f"{format_value(val)},{count}\n"

    return ExecResult(stdout=output, stderr="", exit_code=0)


async def cmd_reverse(args: list[str], ctx: CommandContext) -> ExecResult:
    """Reverse row order."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    return ExecResult(stdout=format_csv(headers, data[::-1]), stderr="", exit_code=0)


async def cmd_behead(args: list[str], ctx: CommandContext) -> ExecResult:
    """Output data without header row."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if not headers or not data:
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Output data rows without header
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    for row in data:
        writer.writerow([row.get(h, "") for h in headers])
    return ExecResult(stdout=output.getvalue(), stderr="", exit_code=0)


async def cmd_enum(args: list[str], ctx: CommandContext) -> ExecResult:
    """Add index column to CSV."""
    col_name = "index"
    start = 0
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-c", "--column") and i + 1 < len(args):
            col_name = args[i + 1]
            i += 2
            continue
        elif arg == "--start" and i + 1 < len(args):
            try:
                start = int(args[i + 1])
            except ValueError:
                pass
            i += 2
            continue
        elif not arg.startswith("-"):
            file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Create new headers with index column first
    new_headers = [col_name] + headers

    # Add index to each row
    new_data = []
    for idx, row in enumerate(data, start=start):
        new_row = {col_name: str(idx)}
        new_row.update(row)
        new_data.append(new_row)

    return ExecResult(stdout=format_csv(new_headers, new_data), stderr="", exit_code=0)


def _looks_like_file_path(arg: str) -> bool:
    """Check if argument looks like a file path rather than a column spec."""
    return arg.startswith("/") or arg.startswith("./") or arg.endswith(".csv")


async def cmd_drop(args: list[str], ctx: CommandContext) -> ExecResult:
    """Drop columns (inverse of select)."""
    cols_spec = ""
    file_args = []

    for arg in args:
        if not arg.startswith("-"):
            if not cols_spec:
                # Check if this looks like a file path
                if _looks_like_file_path(arg):
                    # This is likely a file path, not a column spec
                    file_args.append(arg)
                else:
                    cols_spec = arg
            else:
                file_args.append(arg)

    if not cols_spec:
        return ExecResult(
            stdout="",
            stderr="xan drop: no columns specified\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Parse columns to drop
    drop_cols: set[str] = set()
    for col in cols_spec.split(","):
        col = col.strip()
        if not col:
            continue

        # Check if it's an index
        try:
            idx = int(col)
            if 0 <= idx < len(headers):
                drop_cols.add(headers[idx])
            continue
        except ValueError:
            pass

        # Direct column name
        if col in headers:
            drop_cols.add(col)

    # Keep columns not in drop list
    remaining_headers = [h for h in headers if h not in drop_cols]

    # Filter data to remaining columns
    new_data = []
    for row in data:
        new_data.append({h: row.get(h, "") for h in remaining_headers})

    return ExecResult(stdout=format_csv(remaining_headers, new_data), stderr="", exit_code=0)


async def cmd_shuffle(args: list[str], ctx: CommandContext) -> ExecResult:
    """Randomly reorder rows."""
    seed: int | None = None
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--seed" and i + 1 < len(args):
            try:
                seed = int(args[i + 1])
            except ValueError:
                pass
            i += 2
            continue
        elif not arg.startswith("-"):
            file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Shuffle with optional seed
    if seed is not None:
        rng = random.Random(seed)
        rng.shuffle(data)
    else:
        random.shuffle(data)

    return ExecResult(stdout=format_csv(headers, data), stderr="", exit_code=0)


async def cmd_cat(args: list[str], ctx: CommandContext) -> ExecResult:
    """Concatenate CSV files."""
    file_args = [a for a in args if not a.startswith("-")]

    if not file_args:
        return ExecResult(
            stdout="",
            stderr="xan cat: no files specified\n",
            exit_code=1,
        )

    all_headers: list[str] | None = None
    all_data: list[dict[str, str]] = []

    for file_path in file_args:
        try:
            path = ctx.fs.resolve_path(ctx.cwd, file_path)
            content = await ctx.fs.read_file(path)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"xan: {file_path}: No such file or directory\n",
                exit_code=2,
            )

        headers, data = parse_csv(content)

        if all_headers is None:
            all_headers = headers
        elif headers != all_headers:
            return ExecResult(
                stdout="",
                stderr=f"xan cat: headers in '{file_path}' do not match\n",
                exit_code=1,
            )

        all_data.extend(data)

    if all_headers is None:
        return ExecResult(stdout="", stderr="", exit_code=0)

    return ExecResult(stdout=format_csv(all_headers, all_data), stderr="", exit_code=0)


async def cmd_to(args: list[str], ctx: CommandContext) -> ExecResult:
    """Convert CSV to other formats."""
    if not args:
        return ExecResult(
            stdout="",
            stderr="xan to: no format specified\n",
            exit_code=1,
        )

    fmt = args[0]
    sub_args = args[1:]

    if fmt == "json":
        return await cmd_to_json(sub_args, ctx)
    else:
        return ExecResult(
            stdout="",
            stderr=f"xan to: unknown format '{fmt}'\n",
            exit_code=1,
        )


async def cmd_to_json(args: list[str], ctx: CommandContext) -> ExecResult:
    """Convert CSV to JSON."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Convert to list of dicts
    result = [dict(row) for row in data]
    output = json.dumps(result, ensure_ascii=False)
    return ExecResult(stdout=output + "\n", stderr="", exit_code=0)


async def cmd_from(args: list[str], ctx: CommandContext) -> ExecResult:
    """Convert other formats to CSV."""
    if not args:
        return ExecResult(
            stdout="",
            stderr="xan from: no format specified\n",
            exit_code=1,
        )

    fmt = args[0]
    sub_args = args[1:]

    if fmt == "json":
        return await cmd_from_json(sub_args, ctx)
    else:
        return ExecResult(
            stdout="",
            stderr=f"xan from: unknown format '{fmt}'\n",
            exit_code=1,
        )


async def cmd_from_json(args: list[str], ctx: CommandContext) -> ExecResult:
    """Convert JSON to CSV."""
    file_args = [a for a in args if not a.startswith("-")]

    # Read input
    if not file_args or file_args[0] == "-":
        content = ctx.stdin
    else:
        try:
            path = ctx.fs.resolve_path(ctx.cwd, file_args[0])
            content = await ctx.fs.read_file(path)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"xan: {file_args[0]}: No such file or directory\n",
                exit_code=2,
            )

    # Parse JSON
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return ExecResult(
            stdout="",
            stderr="xan from json: invalid JSON\n",
            exit_code=1,
        )

    if not isinstance(data, list):
        return ExecResult(
            stdout="",
            stderr="xan from json: expected JSON array\n",
            exit_code=1,
        )

    if not data:
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Collect all keys from all objects
    all_keys: list[str] = []
    for item in data:
        if isinstance(item, dict):
            for key in item.keys():
                if key not in all_keys:
                    all_keys.append(key)

    # Create CSV output
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=all_keys, lineterminator="\n")
    writer.writeheader()
    for item in data:
        if isinstance(item, dict):
            writer.writerow({k: str(item.get(k, "")) for k in all_keys})

    return ExecResult(stdout=output.getvalue(), stderr="", exit_code=0)


async def cmd_rename(args: list[str], ctx: CommandContext) -> ExecResult:
    """Rename columns."""
    rename_spec = ""
    file_args = []

    for arg in args:
        if not arg.startswith("-"):
            if not rename_spec:
                if _looks_like_file_path(arg):
                    file_args.append(arg)
                else:
                    rename_spec = arg
            else:
                file_args.append(arg)

    if not rename_spec:
        return ExecResult(
            stdout="",
            stderr="xan rename: no rename specification provided\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Parse rename specification: old:new,old2:new2
    renames: dict[str, str] = {}
    for pair in rename_spec.split(","):
        if ":" in pair:
            old, new = pair.split(":", 1)
            renames[old.strip()] = new.strip()

    # Apply renames to headers
    new_headers = [renames.get(h, h) for h in headers]

    # Update data keys
    new_data = []
    for row in data:
        new_row = {}
        for h in headers:
            new_key = renames.get(h, h)
            new_row[new_key] = row.get(h, "")
        new_data.append(new_row)

    return ExecResult(stdout=format_csv(new_headers, new_data), stderr="", exit_code=0)


async def cmd_sample(args: list[str], ctx: CommandContext) -> ExecResult:
    """Random sample of N rows."""
    n = 10
    seed: int | None = None
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--seed" and i + 1 < len(args):
            try:
                seed = int(args[i + 1])
            except ValueError:
                pass
            i += 2
            continue
        elif not arg.startswith("-"):
            # First non-flag arg is the count
            try:
                n = int(arg)
            except ValueError:
                file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Sample with optional seed
    if seed is not None:
        rng = random.Random(seed)
        sampled = rng.sample(data, min(n, len(data)))
    else:
        sampled = random.sample(data, min(n, len(data)))

    return ExecResult(stdout=format_csv(headers, sampled), stderr="", exit_code=0)


async def cmd_dedup(args: list[str], ctx: CommandContext) -> ExecResult:
    """Remove duplicate rows."""
    select_col = ""
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-s", "--select") and i + 1 < len(args):
            select_col = args[i + 1]
            i += 2
            continue
        elif not arg.startswith("-"):
            file_args.append(arg)
        i += 1

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    seen: set[str] = set()
    unique_data = []

    for row in data:
        if select_col:
            key = str(row.get(select_col, ""))
        else:
            key = tuple(row.get(h, "") for h in headers).__str__()

        if key not in seen:
            seen.add(key)
            unique_data.append(row)

    return ExecResult(stdout=format_csv(headers, unique_data), stderr="", exit_code=0)


async def cmd_top(args: list[str], ctx: CommandContext) -> ExecResult:
    """Get top N rows by column value."""
    n = 10
    reverse = False
    sort_col = ""
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-r", "--reverse"):
            reverse = True
        elif not arg.startswith("-"):
            # First non-flag is n, second is column, third is file
            try:
                n = int(arg)
            except ValueError:
                if not sort_col:
                    sort_col = arg
                else:
                    file_args.append(arg)
        i += 1

    if not sort_col:
        return ExecResult(
            stdout="",
            stderr="xan top: no column specified\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if sort_col not in headers:
        return ExecResult(
            stdout="",
            stderr=f"xan top: column '{sort_col}' not found\n",
            exit_code=1,
        )

    def sort_key(row: dict) -> float:
        val = row.get(sort_col, "")
        try:
            return float(val) if val else 0
        except ValueError:
            return 0

    # Sort descending by default (top = highest), ascending if reverse
    sorted_data = sorted(data, key=sort_key, reverse=not reverse)
    return ExecResult(stdout=format_csv(headers, sorted_data[:n]), stderr="", exit_code=0)


async def cmd_transpose(args: list[str], ctx: CommandContext) -> ExecResult:
    """Transpose rows and columns."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if not headers:
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Build transposed data
    # Original headers become first column
    # Each data row becomes a new column
    new_headers = ["field"] + [str(i) for i in range(len(data))]
    new_data = []

    for h in headers:
        row = {"field": h}
        for i, d in enumerate(data):
            row[str(i)] = d.get(h, "")
        new_data.append(row)

    return ExecResult(stdout=format_csv(new_headers, new_data), stderr="", exit_code=0)


async def cmd_fixlengths(args: list[str], ctx: CommandContext) -> ExecResult:
    """Fix ragged CSV by padding/truncating rows."""
    file_args = [a for a in args if not a.startswith("-")]

    # Read raw CSV to handle ragged data
    if not file_args or file_args[0] == "-":
        content = ctx.stdin
    else:
        try:
            path = ctx.fs.resolve_path(ctx.cwd, file_args[0])
            content = await ctx.fs.read_file(path)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"xan: {file_args[0]}: No such file or directory\n",
                exit_code=2,
            )

    if not content.strip():
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Parse manually to handle ragged rows
    lines = content.strip().split("\n")
    reader = csv.reader(lines)
    rows = list(reader)

    if not rows:
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Use header row length as the target
    target_len = len(rows[0])

    # Fix each row
    fixed_rows = []
    for row in rows:
        if len(row) < target_len:
            row = row + [""] * (target_len - len(row))
        elif len(row) > target_len:
            row = row[:target_len]
        fixed_rows.append(row)

    # Output
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    for row in fixed_rows:
        writer.writerow(row)

    return ExecResult(stdout=output.getvalue(), stderr="", exit_code=0)


async def cmd_flatten(args: list[str], ctx: CommandContext) -> ExecResult:
    """Display records vertically (one field per line)."""
    file_args = [a for a in args if not a.startswith("-")]

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if not headers or not data:
        return ExecResult(stdout="", stderr="", exit_code=0)

    lines = []
    for i, row in enumerate(data):
        if i > 0:
            lines.append("")  # Blank line between records
        for h in headers:
            lines.append(f"{h}: {row.get(h, '')}")

    return ExecResult(stdout="\n".join(lines) + "\n", stderr="", exit_code=0)


async def cmd_explode(args: list[str], ctx: CommandContext) -> ExecResult:
    """Split column values into multiple rows."""
    col = ""
    delimiter = ","
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-d", "--delimiter") and i + 1 < len(args):
            delimiter = args[i + 1]
            i += 2
            continue
        elif not arg.startswith("-"):
            if not col:
                if _looks_like_file_path(arg):
                    file_args.append(arg)
                else:
                    col = arg
            else:
                file_args.append(arg)
        i += 1

    if not col:
        return ExecResult(
            stdout="",
            stderr="xan explode: no column specified\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    if col not in headers:
        return ExecResult(
            stdout="",
            stderr=f"xan explode: column '{col}' not found\n",
            exit_code=1,
        )

    # Explode rows
    new_data = []
    for row in data:
        val = row.get(col, "")
        parts = val.split(delimiter) if val else [""]
        for part in parts:
            new_row = dict(row)
            new_row[col] = part.strip()
            new_data.append(new_row)

    return ExecResult(stdout=format_csv(headers, new_data), stderr="", exit_code=0)


async def cmd_implode(args: list[str], ctx: CommandContext) -> ExecResult:
    """Combine rows by grouping, joining values."""
    col = ""
    group_col = ""
    delimiter = ","
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-g", "--group") and i + 1 < len(args):
            group_col = args[i + 1]
            i += 2
            continue
        elif arg in ("-d", "--delimiter") and i + 1 < len(args):
            delimiter = args[i + 1]
            i += 2
            continue
        elif not arg.startswith("-"):
            if not col:
                if _looks_like_file_path(arg):
                    file_args.append(arg)
                else:
                    col = arg
            else:
                file_args.append(arg)
        i += 1

    if not col:
        return ExecResult(
            stdout="",
            stderr="xan implode: no column specified\n",
            exit_code=1,
        )

    if not group_col:
        return ExecResult(
            stdout="",
            stderr="xan implode: no group column specified (use -g)\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Group rows
    groups: dict[str, list[dict[str, str]]] = {}
    for row in data:
        key = row.get(group_col, "")
        if key not in groups:
            groups[key] = []
        groups[key].append(row)

    # Implode
    new_data = []
    for key, rows in groups.items():
        # Take first row as base, combine the implode column
        base = dict(rows[0])
        values = [r.get(col, "") for r in rows]
        base[col] = delimiter.join(values)
        new_data.append(base)

    return ExecResult(stdout=format_csv(headers, new_data), stderr="", exit_code=0)


async def cmd_split(args: list[str], ctx: CommandContext) -> ExecResult:
    """Split CSV into multiple files."""
    chunk_size = 0
    output_dir = "/tmp/xan_split"
    file_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-o", "--output") and i + 1 < len(args):
            output_dir = args[i + 1]
            i += 2
            continue
        elif not arg.startswith("-"):
            try:
                chunk_size = int(arg)
            except ValueError:
                file_args.append(arg)
        i += 1

    if chunk_size <= 0:
        return ExecResult(
            stdout="",
            stderr="xan split: no chunk size specified\n",
            exit_code=1,
        )

    headers, data, error = await read_csv_input(file_args, ctx)
    if error:
        return error

    # Create output directory
    output_path = ctx.fs.resolve_path(ctx.cwd, output_dir)
    try:
        await ctx.fs.mkdir(output_path, recursive=True)
    except FileExistsError:
        pass

    # Split data into chunks
    file_num = 0
    for i in range(0, len(data), chunk_size):
        chunk = data[i : i + chunk_size]
        chunk_content = format_csv(headers, chunk)
        chunk_path = f"{output_path}/{file_num}.csv"
        await ctx.fs.write_file(chunk_path, chunk_content)
        file_num += 1

    return ExecResult(stdout=f"Split into {file_num} files in {output_dir}\n", stderr="", exit_code=0)


# =============================================================================
# Phase 3 Commands - Stubs (Not Yet Implemented)
# These commands require expression evaluation which is not yet ported.
# =============================================================================


def _not_implemented(cmd: str) -> ExecResult:
    """Return a not-implemented error for stubbed commands."""
    return ExecResult(
        stdout="",
        stderr=(
            f"xan {cmd}: not yet implemented\n"
            f"This command requires expression evaluation which is not yet ported from TypeScript.\n"
        ),
        exit_code=1,
    )


async def cmd_join(args: list[str], ctx: CommandContext) -> ExecResult:
    """Join two CSVs on a key column.

    Not yet implemented. Requires:
    - Multiple input file handling
    - Key column matching
    - Join types (inner, left, right, full outer)

    Usage would be: xan join <LEFT_COL> <LEFT_FILE> <RIGHT_COL> <RIGHT_FILE>
    """
    return _not_implemented("join")


async def cmd_agg(args: list[str], ctx: CommandContext) -> ExecResult:
    """Aggregate column values.

    Not yet implemented. Requires:
    - Expression parser for aggregation functions (sum, count, avg, min, max, etc.)
    - Column selection

    Usage would be: xan agg 'sum(price), count()' data.csv
    """
    return _not_implemented("agg")


async def cmd_groupby(args: list[str], ctx: CommandContext) -> ExecResult:
    """Group rows and aggregate.

    Not yet implemented. Requires:
    - Expression parser for aggregation functions
    - Group key handling

    Usage would be: xan groupby category 'sum(price), count()' data.csv
    """
    return _not_implemented("groupby")


async def cmd_map(args: list[str], ctx: CommandContext) -> ExecResult:
    """Add computed columns via expressions.

    Not yet implemented. Requires:
    - Expression parser for column computations
    - Support for arithmetic, string ops, conditionals

    Usage would be: xan map 'total = price * quantity' data.csv
    """
    return _not_implemented("map")


async def cmd_transform(args: list[str], ctx: CommandContext) -> ExecResult:
    """Transform column values via expressions.

    Not yet implemented. Requires:
    - Expression parser for transformations
    - In-place column modification

    Usage would be: xan transform 'price = price * 1.1' data.csv
    """
    return _not_implemented("transform")


async def cmd_pivot(args: list[str], ctx: CommandContext) -> ExecResult:
    """Reshape data (pivot table).

    Not yet implemented. Requires:
    - Row key, column key, and value columns
    - Aggregation for duplicate keys

    Usage would be: xan pivot <ROW_COL> <COL_COL> <VAL_COL> data.csv
    """
    return _not_implemented("pivot")


class XanCommand:
    """The xan command - CSV toolkit."""

    name = "xan"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the xan command."""
        if not args or "--help" in args or "-h" in args:
            return ExecResult(
                stdout=(
                    "Usage: xan <COMMAND> [OPTIONS] [FILE]\n"
                    "CSV toolkit for data manipulation.\n\n"
                    "Commands:\n"
                    "  headers     Show column names\n"
                    "  count       Count rows\n"
                    "  head        Show first N rows\n"
                    "  tail        Show last N rows\n"
                    "  slice       Extract row range\n"
                    "  select      Select columns\n"
                    "  drop        Drop columns (inverse of select)\n"
                    "  rename      Rename columns (old:new)\n"
                    "  filter      Filter rows by expression\n"
                    "  search      Filter rows by regex\n"
                    "  sort        Sort rows\n"
                    "  reverse     Reverse row order\n"
                    "  behead      Output without header\n"
                    "  enum        Add index column\n"
                    "  shuffle     Randomly reorder rows\n"
                    "  sample      Random sample of N rows\n"
                    "  dedup       Remove duplicate rows\n"
                    "  top         Top N rows by column value\n"
                    "  cat         Concatenate CSV files\n"
                    "  transpose   Swap rows and columns\n"
                    "  fixlengths  Fix ragged CSV\n"
                    "  flatten     Display records vertically\n"
                    "  explode     Split column to rows\n"
                    "  implode     Combine rows by grouping\n"
                    "  split       Split into multiple files\n"
                    "  view        Pretty print as table\n"
                    "  stats       Show column statistics\n"
                    "  frequency   Count value occurrences\n"
                    "  to          Convert to other formats (json)\n"
                    "  from        Convert from other formats (json)\n\n"
                    "Not Yet Implemented (require expression evaluation):\n"
                    "  join        Join two CSVs on key\n"
                    "  agg         Aggregate values\n"
                    "  groupby     Group and aggregate\n"
                    "  map         Add computed columns\n"
                    "  transform   Transform column values\n"
                    "  pivot       Reshape data (pivot table)\n\n"
                    "Examples:\n"
                    "  xan headers data.csv\n"
                    "  xan count data.csv\n"
                    "  xan head -n 5 data.csv\n"
                    "  xan select name,email data.csv\n"
                    "  xan filter 'age > 30' data.csv\n"
                    "  xan sort -N price data.csv\n"
                    "  xan to json data.csv\n"
                ),
                stderr="",
                exit_code=0,
            )

        subcommand = args[0]
        sub_args = args[1:]

        if subcommand == "headers":
            return await cmd_headers(sub_args, ctx)
        elif subcommand == "count":
            return await cmd_count(sub_args, ctx)
        elif subcommand == "head":
            return await cmd_head(sub_args, ctx)
        elif subcommand == "tail":
            return await cmd_tail(sub_args, ctx)
        elif subcommand == "slice":
            return await cmd_slice(sub_args, ctx)
        elif subcommand == "select":
            return await cmd_select(sub_args, ctx)
        elif subcommand == "drop":
            return await cmd_drop(sub_args, ctx)
        elif subcommand == "rename":
            return await cmd_rename(sub_args, ctx)
        elif subcommand == "filter":
            return await cmd_filter(sub_args, ctx)
        elif subcommand == "search":
            return await cmd_search(sub_args, ctx)
        elif subcommand == "sort":
            return await cmd_sort(sub_args, ctx)
        elif subcommand == "reverse":
            return await cmd_reverse(sub_args, ctx)
        elif subcommand == "behead":
            return await cmd_behead(sub_args, ctx)
        elif subcommand == "enum":
            return await cmd_enum(sub_args, ctx)
        elif subcommand == "shuffle":
            return await cmd_shuffle(sub_args, ctx)
        elif subcommand == "sample":
            return await cmd_sample(sub_args, ctx)
        elif subcommand == "dedup":
            return await cmd_dedup(sub_args, ctx)
        elif subcommand == "top":
            return await cmd_top(sub_args, ctx)
        elif subcommand == "cat":
            return await cmd_cat(sub_args, ctx)
        elif subcommand == "transpose":
            return await cmd_transpose(sub_args, ctx)
        elif subcommand == "fixlengths":
            return await cmd_fixlengths(sub_args, ctx)
        elif subcommand in ("flatten", "f"):
            return await cmd_flatten(sub_args, ctx)
        elif subcommand == "explode":
            return await cmd_explode(sub_args, ctx)
        elif subcommand == "implode":
            return await cmd_implode(sub_args, ctx)
        elif subcommand == "split":
            return await cmd_split(sub_args, ctx)
        elif subcommand == "view":
            return await cmd_view(sub_args, ctx)
        elif subcommand == "stats":
            return await cmd_stats(sub_args, ctx)
        elif subcommand in ("frequency", "freq"):
            return await cmd_frequency(sub_args, ctx)
        elif subcommand == "to":
            return await cmd_to(sub_args, ctx)
        elif subcommand == "from":
            return await cmd_from(sub_args, ctx)
        # Stubbed commands (not yet implemented)
        elif subcommand == "join":
            return await cmd_join(sub_args, ctx)
        elif subcommand == "agg":
            return await cmd_agg(sub_args, ctx)
        elif subcommand == "groupby":
            return await cmd_groupby(sub_args, ctx)
        elif subcommand == "map":
            return await cmd_map(sub_args, ctx)
        elif subcommand == "transform":
            return await cmd_transform(sub_args, ctx)
        elif subcommand == "pivot":
            return await cmd_pivot(sub_args, ctx)
        else:
            return ExecResult(
                stdout="",
                stderr=f"xan: unknown command '{subcommand}'\nRun 'xan --help' for usage.\n",
                exit_code=1,
            )
