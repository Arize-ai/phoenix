# /// script
# dependencies = [
#   "anyio",
#   "asyncpg",
#   "greenlet",
#   "rich",
#   "sqlalchemy",
#   "sqlparse",
#   "tqdm",
# ]
# ///
"""
PostgreSQL Query Runtime Summarizer

A performance analysis tool that executes EXPLAIN ANALYZE on PostgreSQL queries and provides
detailed execution statistics. This tool helps identify performance bottlenecks and compare
query execution times across multiple runs.

Features:
    - Runs EXPLAIN ANALYZE on multiple queries in random order to avoid caching effects
    - Collects execution times, row counts, and other performance metrics
    - Calculates statistical measures (median, p90) for execution times
    - Generates a formatted markdown table comparing query performance
    - Supports multiple runs per query for more reliable measurements
    - Handles query parsing and error reporting

Usage:
    1. Create a SQL file with your queries (separated by semicolons)
    2. Run the script with appropriate database connection parameters
    3. Review the generated performance comparison table

Example:
    uv run postgres_explain_analyze.py
"""

from __future__ import annotations

import argparse
import random
import re
import statistics
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from types import TracebackType
from typing import Any, Optional

import anyio
import sqlalchemy.exc
import sqlparse
from rich.console import Console
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
from tqdm import tqdm

# Configuration
DEFAULT_RUNS: int = 20
DEFAULT_DELAY_BETWEEN_RUNS: float = 0.1
QUERY_TIMEOUT_SECONDS: int = 10

# Database configuration
DEFAULT_DB_HOST: str = "localhost"
DEFAULT_DB_PORT: int = 5432
DEFAULT_DB_NAME: str = "postgres"
DEFAULT_DB_USER: str = "postgres"
DEFAULT_DB_PASSWORD: str = "phoenix"

# Regex patterns for extracting metrics
EXECUTION_TIME_PATTERN: str = r"Execution Time: (\d+\.\d+) ms"
ROW_COUNT_PATTERN: str = r"\(actual(?:\s+[^)]*?)?\s+rows=(\d+)"


# Type definitions for better code readability
@dataclass(frozen=True)
class RegexPatterns:
    """Compiled regex patterns for extracting metrics from EXPLAIN ANALYZE output."""

    execution_time: re.Pattern[str]
    row_count: re.Pattern[str]


# Compiled regex patterns
COMPILED_PATTERNS = RegexPatterns(
    execution_time=re.compile(EXECUTION_TIME_PATTERN),
    row_count=re.compile(ROW_COUNT_PATTERN),
)


@dataclass(frozen=True)
class QueryInfo:
    """Information about a query to be analyzed."""

    name: str
    query: str


@dataclass(frozen=True)
class QueryStats:
    """Statistics for a query's performance metrics."""

    median: Optional[float] = None
    p90: Optional[float] = None
    ratio: Optional[float] = None
    n_runs: int = 0


@dataclass(frozen=True)
class ColumnWidths:
    """Widths of columns in the output table."""

    query_number: int = 10
    median_ms: int = 12
    ratio: int = 8
    p90_ms: int = 10
    n_runs: int = 8
    rows_returned: int = 13

    def get_width(self, column: str) -> int:
        """Get the width for a specific column."""
        width_map = {
            "Query #": self.query_number,
            "Median (ms)": self.median_ms,
            "Ratio": self.ratio,
            "P90 (ms)": self.p90_ms,
            "N Runs": self.n_runs,
            "Rows Returned": self.rows_returned,
        }
        return width_map[column]


@dataclass
class ExecutionPlan:
    """Stores an execution plan with its associated execution time."""

    execution_time_ms: float
    plan: str


@dataclass
class QueryResult:
    """Stores the results of running a query multiple times."""

    query_name: str
    query: str
    execution_times_ms: list[float]
    row_count: Optional[int]
    timestamp: str
    execution_plans: list[ExecutionPlan]  # List of execution plans with their times
    error: Optional[str] = None

    @property
    def is_successful(self) -> bool:
        """Check if the query executed successfully."""
        return self.error is None

    def get_statistics(self) -> tuple[Optional[float], Optional[float]]:
        """Get median and p90 execution times."""
        if not self.execution_times_ms:
            return None, None
        try:
            return (
                statistics.median(self.execution_times_ms),
                statistics.quantiles(self.execution_times_ms, n=10)[-1],
            )
        except statistics.StatisticsError:
            return None, None

    def get_plan_closest_to_median(self) -> Optional[str]:
        """Get the execution plan from the run closest to the median execution time."""
        if not self.execution_plans:
            return None

        try:
            median_time = statistics.median(self.execution_times_ms)
            # Find the plan with execution time closest to median
            closest_plan = min(
                self.execution_plans,
                key=lambda x: abs(x.execution_time_ms - median_time),
            )
            return closest_plan.plan
        except statistics.StatisticsError:
            return None


class PostgresQueryError(Exception):
    """Base exception for PostgreSQL query errors."""

    def __init__(self, message: str, query_name: Optional[str] = None) -> None:
        """Initialize the error with a message and optional query name."""
        super().__init__(message)
        self.query_name = query_name


class QueryTimeoutError(PostgresQueryError):
    """Raised when a query exceeds the timeout limit."""

    def __init__(self, timeout_seconds: int, query_name: Optional[str] = None) -> None:
        """Initialize the timeout error with the timeout duration."""
        super().__init__(f"Query exceeded timeout of {timeout_seconds} seconds", query_name)


class QueryExecutionError(PostgresQueryError):
    """Raised when a query fails to execute."""

    def __init__(self, message: str, query_name: Optional[str] = None) -> None:
        """Initialize the execution error with a message."""
        super().__init__(message, query_name)


class QueryParseError(PostgresQueryError):
    """Raised when a query cannot be parsed."""

    def __init__(self, message: str, query_name: Optional[str] = None) -> None:
        """Initialize the parse error with a message."""
        super().__init__(message, query_name)


class PostgresQueryAnalyzer:
    """Analyzes PostgreSQL query performance using EXPLAIN ANALYZE."""

    def __init__(self, connection_string: str) -> None:
        """Initialize the analyzer with a database connection string."""
        self.connection_string = connection_string
        self.engine: Optional[AsyncEngine] = None
        self.results: dict[str, QueryResult] = {}
        self.console = Console()
        self._compiled_patterns = COMPILED_PATTERNS

    async def __aenter__(self) -> "PostgresQueryAnalyzer":
        """Set up the database engine when entering the context manager."""
        self.engine = create_async_engine(
            self.connection_string,
            pool_pre_ping=True,  # Enable connection health checks
            pool_size=1,  # Single connection since we're running sequentially
            max_overflow=0,  # No overflow needed
        )
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> None:
        """Clean up the database engine when exiting the context manager."""
        if self.engine:
            await self.engine.dispose()
            self.engine = None

    async def analyze_queries(
        self,
        queries: list[QueryInfo],
        runs: int = DEFAULT_RUNS,
    ) -> list[QueryResult]:
        """Run EXPLAIN ANALYZE on multiple queries in randomized sequential order."""
        if not self.engine:
            raise RuntimeError("Database engine not initialized. Use async with context manager.")

        # Create and randomize all runs
        all_runs = [(query_info, run_num) for query_info in queries for run_num in range(runs)]
        random.shuffle(all_runs)

        with tqdm(total=len(all_runs), desc="Analyzing queries", unit="run") as pbar:
            for query_info, _ in all_runs:
                await self._analyze_query_with_connection(
                    query_info.name,
                    query_info.query,
                    pbar,
                )
                await anyio.sleep(DEFAULT_DELAY_BETWEEN_RUNS)

        return list(self.results.values())

    async def _analyze_query_with_connection(
        self,
        query_name: str,
        query: str,
        pbar: Optional[tqdm[Any]] = None,
    ) -> QueryResult:
        """Run EXPLAIN ANALYZE on a single query with its own connection."""
        if not self.engine:
            raise RuntimeError("Database engine not initialized")

        try:
            async with self.engine.connect() as conn:
                async with conn.begin():  # Start a transaction
                    with anyio.move_on_after(QUERY_TIMEOUT_SECONDS):
                        (
                            execution_time,
                            row_count,
                            execution_plan,
                        ) = await self._execute_and_extract_metrics(
                            conn, f"EXPLAIN ANALYZE {query}"
                        )
                        self._update_results(
                            query_name, query, execution_time, row_count, execution_plan
                        )
        except anyio.get_cancelled_exc_class():
            # Handle timeout errors
            self._handle_query_error(
                query_name,
                query,
                f"Timeout after {QUERY_TIMEOUT_SECONDS} seconds",
                "Query Timeout",
                "exceeded the timeout limit",
            )
        except sqlalchemy.exc.SQLAlchemyError as e:
            # Handle database-specific errors
            self._handle_query_error(
                query_name,
                query,
                str(e),
                "Database Error",
                "failed to execute",
            )
        except Exception as e:
            # Handle any other unexpected errors
            self._handle_query_error(
                query_name,
                query,
                str(e),
                "Unexpected Error",
                "failed with an unexpected error",
            )
        finally:
            if pbar:
                pbar.update(1)
            return self.results[query_name]

    def _get_or_create_result(
        self,
        query_name: str,
        query: str,
        error: Optional[str] = None,
    ) -> QueryResult:
        """Get an existing query result or create a new one."""
        if query_name not in self.results:
            self.results[query_name] = QueryResult(
                query_name=query_name,
                query=query,
                execution_times_ms=[],
                row_count=None,
                timestamp=datetime.now().isoformat(),
                execution_plans=[],
                error=error,
            )
        return self.results[query_name]

    def _handle_query_error(
        self,
        query_name: str,
        query: str,
        error_details: str,
        error_type: str,
        error_message: str,
    ) -> None:
        """Handle query errors with consistent formatting."""
        error_msg = (
            f"\n[bold red]{error_type}:[/bold red] Query '{query_name}' {error_message}.\n"
            f"[yellow]Error Details:[/yellow] {error_details}\n\n"
            f"[bold]Query:[/bold]\n{query}\n"
        )
        self.console.print(error_msg)
        self._get_or_create_result(query_name, query, f"{error_type}: {error_details}")

    async def _execute_and_extract_metrics(
        self, conn: AsyncConnection, explain_query: str
    ) -> tuple[float, Optional[int], Optional[str]]:
        """Run the EXPLAIN ANALYZE query and extract timing information."""
        try:
            # Set statement timeout in PostgreSQL
            await conn.execute(text(f"SET statement_timeout = '{QUERY_TIMEOUT_SECONDS}s'"))
            result = await conn.execute(text(explain_query))
            explain_output = "\n".join(row[0] for row in result)

            execution_time = self._extract_execution_time(explain_output)
            if execution_time is None:
                raise QueryExecutionError("No execution time found in EXPLAIN ANALYZE output")

            row_count = self._extract_row_count(explain_output)
            execution_plan = self._extract_execution_plan(explain_output)

            return execution_time, row_count, execution_plan
        except sqlalchemy.exc.SQLAlchemyError:
            raise
        except Exception as e:
            raise RuntimeError(f"Failed to execute EXPLAIN ANALYZE: {str(e)}") from e
        finally:
            try:
                await conn.execute(text("SET statement_timeout = '0'"))
            except Exception as e:
                self.console.print(
                    f"[yellow]Warning: Failed to reset statement timeout: {str(e)}[/yellow]"
                )

    def _extract_execution_time(self, explain_output: str) -> Optional[float]:
        """Extract execution time from EXPLAIN ANALYZE output."""
        if match := self._compiled_patterns.execution_time.search(explain_output):
            return float(match.group(1))
        return None

    def _extract_row_count(self, explain_output: str) -> Optional[int]:
        """Extract actual row count from EXPLAIN ANALYZE output."""
        if match := self._compiled_patterns.row_count.search(explain_output):
            return int(match.group(1))
        return None

    def _extract_execution_plan(self, explain_output: str) -> Optional[str]:
        """Extract the execution plan from EXPLAIN ANALYZE output."""
        # Include all lines including the execution time line
        lines = explain_output.split("\n")
        plan_lines = []
        for line in lines:
            plan_lines.append(line)
            if line.strip().startswith("Execution Time:"):
                break
        return "\n".join(plan_lines) if plan_lines else None

    def _update_results(
        self,
        query_name: str,
        query: str,
        execution_time: Optional[float],
        row_count: Optional[int],
        execution_plan: Optional[str],
    ) -> None:
        """Store the results of running a query."""
        if execution_time is None:
            raise ValueError("No execution time found in EXPLAIN ANALYZE output")

        if query_name not in self.results:
            self.results[query_name] = QueryResult(
                query_name=query_name,
                query=query,
                execution_times_ms=[round(execution_time, 1)],
                row_count=row_count,
                timestamp=datetime.now().isoformat(),
                execution_plans=[ExecutionPlan(execution_time, execution_plan)]
                if execution_plan is not None
                else [],
            )
        else:
            self.results[query_name].execution_times_ms.append(round(execution_time, 1))
            if execution_plan is not None:
                self.results[query_name].execution_plans.append(
                    ExecutionPlan(execution_time, execution_plan)
                )

    def _format_table_row(
        self,
        result: QueryResult,
        col_widths: ColumnWidths,
        median_time: Optional[float],
        p90_time: Optional[float],
        ratio: Optional[float],
    ) -> str:
        """Format a row for the results table."""

        def format_col(
            value: Any, width: int, right_align: bool = True, is_ratio: bool = False
        ) -> str:
            if value is None:
                return "N/A".rjust(width) if right_align else "N/A".ljust(width)
            if isinstance(value, float):
                if is_ratio and value > 100:
                    return ">100".rjust(width)
                return f"{value:.1f}".rjust(width)
            return str(value).rjust(width)

        return (
            f"| {result.query_name.ljust(col_widths.query_number)} | "
            f"{format_col(median_time, col_widths.median_ms)} | "
            f"{format_col(ratio, col_widths.ratio, is_ratio=True)} | "
            f"{format_col(p90_time, col_widths.p90_ms)} | "
            f"{str(len(result.execution_times_ms)).rjust(col_widths.n_runs)} | "
            f"{format_col(result.row_count, col_widths.rows_returned)} |"
        )

    def print_results_table(self) -> None:
        """Print a formatted table showing query performance results."""
        if not self.results:
            self.console.print("[yellow]No results to display.[/yellow]")
            return

        # First show the execution plans
        self.console.print("\n[bold blue]## Representative Execution Plans[/bold blue]")
        self.console.print(
            "[dim](Showing plans from runs closest to median execution time)[/dim]\n"
        )

        for result in self._get_sorted_results():
            if result.execution_plans:
                median_plan = result.get_plan_closest_to_median()
                if median_plan:
                    self.console.print(f"\n[bold]{result.query_name}[/bold]")
                    self.console.print("[dim]Original Query:[/dim]")
                    self.console.print(f"[dim]{result.query}[/dim]\n")
                    self.console.print("[bold]Execution Plan:[/bold]")
                    self.console.print(median_plan)
                    self.console.print("\n" + "─" * 80 + "\n")
            elif result.error:
                self.console.print(
                    f"[bold red]{result.query_name} failed:[/bold red] {result.error}\n"
                )

        # Then show the performance comparison table
        self.console.print("\n[bold blue]## Query Performance Comparison[/bold blue]\n")

        query_stats = self._calculate_query_statistics()
        if not query_stats:
            self.console.print("[red]No valid statistics to display.[/red]")
            return

        col_widths = self._get_column_widths()
        self._print_table_header(col_widths)

        for result in self._get_sorted_results():
            stats = query_stats.get(result.query_name)
            row = self._format_table_row(
                result=result,
                col_widths=col_widths,
                median_time=stats.median if stats else None,
                p90_time=stats.p90 if stats else None,
                ratio=stats.ratio if stats else None,
            )
            self.console.print(row)

        self.console.print("\n")

    def _calculate_query_statistics(self) -> dict[str, QueryStats]:
        """Calculate statistical measures for all queries."""
        stats: dict[str, QueryStats] = {}
        min_median = float("inf")

        # First pass: calculate medians and find minimum
        for query_name, result in self.results.items():
            if not result.is_successful:
                continue

            # Include any query that has execution times
            if result.execution_times_ms:
                median_time, p90_time = result.get_statistics()
                if median_time is not None and p90_time is not None:
                    stats[query_name] = QueryStats(
                        median=median_time,
                        p90=p90_time,
                        ratio=None,  # Will be calculated in second pass
                        n_runs=len(result.execution_times_ms),
                    )
                    min_median = min(min_median, median_time)

        # Second pass: calculate ratios
        updated_stats: dict[str, QueryStats] = {}
        for query_name, stat in stats.items():
            if stat.median is not None and min_median > 0:
                ratio = stat.median / min_median
            else:
                ratio = None
            updated_stats[query_name] = QueryStats(
                median=stat.median, p90=stat.p90, ratio=ratio, n_runs=stat.n_runs
            )

        return updated_stats

    def _get_column_widths(self) -> ColumnWidths:
        """Get the width for each column in the results table."""
        return ColumnWidths()

    def _print_table_header(self, col_widths: ColumnWidths) -> None:
        """Print the table header and separator line."""
        columns = [
            "Query #",
            "Median (ms)",
            "Ratio",
            "P90 (ms)",
            "N Runs",
            "Rows Returned",
        ]
        header = "| " + " | ".join(col.ljust(col_widths.get_width(col)) for col in columns) + " |"
        separator = (
            "|"
            + "|".join(
                "-" * (col_widths.get_width(col) + 1) + ":"
                if col != "Query #"
                else "-" * (col_widths.get_width(col) + 2)
                for col in columns
            )
            + "|"
        )
        self.console.print(header)
        self.console.print(separator)

    def _get_sorted_results(self) -> list[QueryResult]:
        """Get results sorted by query number."""
        return sorted(
            self.results.values(),
            key=lambda x: int(x.query_name.split()[-1])
            if x.query_name.split()[-1].isdigit()
            else float("inf"),
        )


def read_queries_from_file(file_path: Path, console: Console) -> list[QueryInfo]:
    """Read and parse SQL queries from a text file."""
    try:
        # Read and filter comments
        all_lines = file_path.read_text().splitlines()
        filtered_lines = [line for line in all_lines if not line.strip().startswith("--")]
        all_queries_text = "\n".join(filtered_lines)

        # Parse and format queries
        parsed_queries = sqlparse.split(all_queries_text)
        queries = [
            QueryInfo(name=f"Query {i}", query=formatted_query)
            for i, query in enumerate(parsed_queries, 1)
            if (formatted_query := sqlparse.format(query, strip_comments=True).strip())
        ]

        if queries:
            console.print(
                f"\n[bold green]Successfully parsed {len(queries)} "
                f"queries from {file_path}[/bold green]\n"
            )
        else:
            console.print(
                f"\n[yellow]Warning: No valid queries found in {file_path}. "
                "Make sure each query ends with a semicolon (;).[/yellow]\n"
            )
        return queries

    except FileNotFoundError:
        console.print(f"[bold red]Error: Query file '{file_path}' does not exist.[/bold red]")
        return []
    except PermissionError:
        console.print(
            f"[bold red]Error: No permission to read query file '{file_path}'.[/bold red]"
        )
        return []
    except Exception as e:
        console.print(f"[bold red]Error reading query file:[/bold red] {str(e)}")
        return []


@dataclass(frozen=True)
class AnalyzerConfig:
    """Configuration for the PostgreSQL query analyzer."""

    host: str = DEFAULT_DB_HOST
    port: int = DEFAULT_DB_PORT
    dbname: str = DEFAULT_DB_NAME
    user: str = DEFAULT_DB_USER
    password: str = DEFAULT_DB_PASSWORD
    runs: int = DEFAULT_RUNS
    query_file: Path = field(
        default_factory=lambda: Path(__file__).parent.absolute() / "paste_queries_here.sql"
    )

    def get_connection_string(self) -> str:
        """Get the database connection string."""
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.dbname}"

    def print_config(self, console: Console) -> None:
        """Display the current configuration."""
        console.print("\n[bold blue]Configuration:[/bold blue]")
        console.print(f"  Database: {self.host}:{self.port}/{self.dbname}")
        console.print(f"  User: {self.user}")
        console.print(f"  Number of runs per query: {self.runs}")
        console.print(f"  Query file: {self.query_file}\n")


def parse_args() -> AnalyzerConfig:
    """Parse command line arguments and return configuration."""
    parser = argparse.ArgumentParser(description="PostgreSQL Query Performance Analyzer")
    script_dir = Path(__file__).parent.absolute()
    default_query_file = script_dir / "paste_queries_here.sql"

    # Add command line options
    parser.add_argument("--host", default=DEFAULT_DB_HOST, help="PostgreSQL host")
    parser.add_argument("--port", type=int, default=DEFAULT_DB_PORT, help="PostgreSQL port")
    parser.add_argument("--dbname", default=DEFAULT_DB_NAME, help="PostgreSQL database name")
    parser.add_argument("--user", default=DEFAULT_DB_USER, help="PostgreSQL username")
    parser.add_argument("--password", default=DEFAULT_DB_PASSWORD, help="PostgreSQL password")
    parser.add_argument(
        "--runs",
        type=int,
        default=DEFAULT_RUNS,
        help="Number of runs per query for averaging",
    )
    parser.add_argument(
        "--file",
        default=str(default_query_file),
        help="Path to file containing SQL queries",
    )

    args = parser.parse_args()
    return AnalyzerConfig(
        host=str(args.host),
        port=int(args.port),
        dbname=str(args.dbname),
        user=str(args.user),
        password=str(args.password),
        runs=int(args.runs),
        query_file=Path(str(args.file)),
    )


async def main() -> None:
    """Main program entry point."""
    try:
        config = parse_args()
        console = Console()

        # Show configuration
        config.print_config(console)

        # Read queries from file
        queries = read_queries_from_file(config.query_file, console)
        if not queries:
            console.print(
                "[bold yellow]No queries to analyze. Please add your "
                "SQL queries to the file and run again. Each query must end "
                "with a semicolon (;).[/bold yellow]\n"
            )
            return

        # Run the analysis
        async with PostgresQueryAnalyzer(config.get_connection_string()) as analyzer:
            await analyzer.analyze_queries(queries, config.runs)
            analyzer.print_results_table()
    except sqlalchemy.exc.SQLAlchemyError as e:
        console = Console()
        console.print(f"[bold red]Database connection error:[/bold red] {str(e)}")
        sys.exit(1)
    except PostgresQueryError as e:
        console = Console()
        console.print(f"[bold red]Query error:[/bold red] {str(e)}")
        sys.exit(1)
    except Exception as e:
        console = Console()
        console.print(f"[bold red]Unexpected error during analysis:[/bold red] {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        anyio.run(main)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        console = Console()
        console.print(f"[bold red]Fatal error:[/bold red] {str(e)}")
        sys.exit(1)
