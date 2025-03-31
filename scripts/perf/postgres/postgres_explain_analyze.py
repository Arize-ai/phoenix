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
from typing import Any, Optional, TypeAlias

import anyio
import sqlalchemy.exc
import sqlparse
from rich.console import Console
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
from tqdm import tqdm

# Type aliases for better code readability
QueryInfo: TypeAlias = dict[str, str]
QueryStats: TypeAlias = dict[str, dict[str, float]]
ColumnWidths: TypeAlias = dict[str, int]

# Configuration
DEFAULT_RUNS = 20
DEFAULT_DELAY_BETWEEN_RUNS = 0.1
QUERY_TIMEOUT_SECONDS = 10

# Database configuration
DEFAULT_DB_HOST: str = "localhost"
DEFAULT_DB_PORT: int = 5432
DEFAULT_DB_NAME: str = "postgres"
DEFAULT_DB_USER: str = "postgres"
DEFAULT_DB_PASSWORD: str = "phoenix"

# Regex patterns for extracting metrics
EXECUTION_TIME_PATTERN = r"Execution Time: (\d+\.\d+) ms"
ROW_COUNT_PATTERN = r"\(actual(?:\s+[^)]*?)?\s+rows=(\d+)"


@dataclass
class QueryResult:
    """Stores the results of running a query multiple times."""

    query_name: str
    query: str
    execution_times_ms: list[float]
    row_count: Optional[int]
    timestamp: str
    execution_plans: list[tuple[float, str]]  # List of (execution_time, plan) tuples
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
            closest_plan = min(self.execution_plans, key=lambda x: abs(x[0] - median_time))
            return closest_plan[1]
        except statistics.StatisticsError:
            return None


class PostgresQueryError(Exception):
    """Base exception for PostgreSQL query errors."""

    pass


class QueryTimeoutError(PostgresQueryError):
    """Raised when a query exceeds the timeout limit."""

    pass


class QueryExecutionError(PostgresQueryError):
    """Raised when a query fails to execute."""

    pass


class QueryParseError(PostgresQueryError):
    """Raised when a query cannot be parsed."""

    pass


class PostgresQueryAnalyzer:
    """Analyzes PostgreSQL query performance using EXPLAIN ANALYZE."""

    def __init__(self, connection_string: str) -> None:
        """Initialize the analyzer with a database connection string."""
        self.connection_string = connection_string
        self.engine: Optional[AsyncEngine] = None
        self.results: dict[str, QueryResult] = {}
        self.console = Console()

    async def __aenter__(self) -> "PostgresQueryAnalyzer":
        """Set up the database engine when entering the context manager."""
        self.engine = create_async_engine(self.connection_string)
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
        """Run EXPLAIN ANALYZE on multiple queries in random order."""
        if not self.engine:
            raise RuntimeError("Database engine not initialized. Use async with context manager.")

        # Create and randomize all runs
        all_runs = [(query_info, run_num) for query_info in queries for run_num in range(runs)]
        random.shuffle(all_runs)

        with tqdm(total=len(all_runs), desc="Analyzing queries", unit="run") as pbar:
            async with anyio.create_task_group() as group:
                for query_info, _ in all_runs:
                    group.start_soon(
                        self._analyze_query_with_connection,
                        query_info["name"],
                        query_info["query"],
                        pbar,
                    )
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
                        await anyio.sleep(DEFAULT_DELAY_BETWEEN_RUNS)
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
        if match := re.search(EXECUTION_TIME_PATTERN, explain_output):
            return float(match.group(1))
        return None

    def _extract_row_count(self, explain_output: str) -> Optional[int]:
        """Extract actual row count from EXPLAIN ANALYZE output.

        The method uses a regex pattern to find the actual row count in the EXPLAIN ANALYZE output.
        The pattern looks for the format: (actual ... rows=N) where ... can be any text.

        Args:
            explain_output: The raw EXPLAIN ANALYZE output string

        Returns:
            The actual row count if found, None otherwise
        """
        if match := re.search(ROW_COUNT_PATTERN, explain_output):
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
                execution_plans=[(round(execution_time, 1), execution_plan)]
                if execution_plan is not None
                else [],
            )
        else:
            self.results[query_name].execution_times_ms.append(round(execution_time, 1))
            if execution_plan is not None:
                self.results[query_name].execution_plans.append(
                    (round(execution_time, 1), execution_plan)
                )

    def _format_table_row(
        self,
        result: QueryResult,
        col_widths: ColumnWidths,
        median_time: Optional[float],
        p90_time: Optional[float],
        ratio: Optional[float],
        n_runs: str,
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
            f"| {result.query_name.ljust(col_widths['Query #'])} | "
            f"{format_col(median_time, col_widths['Median (ms)'])} | "
            f"{format_col(ratio, col_widths['Ratio'], is_ratio=True)} | "
            f"{format_col(p90_time, col_widths['P90 (ms)'])} | "
            f"{n_runs.rjust(col_widths['N Runs'])} | "
            f"{format_col(result.row_count, col_widths['Rows Returned'])} |"
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
                    self.console.print(f"\n[bold]Query {result.query_name}[/bold]")
                    self.console.print("[dim]Original Query:[/dim]")
                    self.console.print(f"[dim]{result.query}[/dim]\n")
                    self.console.print("[bold]Execution Plan:[/bold]")
                    self.console.print(median_plan)
                    self.console.print("\n" + "─" * 80 + "\n")
            elif result.error:
                self.console.print(
                    f"[bold red]Query {result.query_name} failed:[/bold red] {result.error}\n"
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
            stats = query_stats.get(result.query_name, {})
            row = self._format_table_row(
                result=result,
                col_widths=col_widths,
                median_time=stats.get("median"),
                p90_time=stats.get("p90"),
                ratio=stats.get("ratio"),
                n_runs=str(len(result.execution_times_ms)) if result.execution_times_ms else "0",
            )
            self.console.print(row)

        self.console.print("\n")

    def _calculate_query_statistics(self) -> QueryStats:
        """Calculate statistical measures for all queries."""
        stats: QueryStats = {}
        min_median = float("inf")

        for query_name, result in self.results.items():
            if not result.is_successful:
                continue

            median_time, p90_time = result.get_statistics()
            if median_time is not None:
                min_median = min(min_median, median_time)
                stats[query_name] = {
                    "median": median_time,
                    "p90": p90_time if p90_time is not None else 0.0,
                }

        if min_median > 0:
            for query_stats in stats.values():
                query_stats["ratio"] = query_stats["median"] / min_median

        return stats

    def _get_column_widths(self) -> ColumnWidths:
        """Get the width for each column in the results table."""
        return {
            "Query #": 10,
            "Median (ms)": 12,
            "Ratio": 8,
            "P90 (ms)": 10,
            "N Runs": 8,
            "Rows Returned": 13,
        }

    def _print_table_header(self, col_widths: ColumnWidths) -> None:
        """Print the table header and separator line."""
        columns = ["Query #", "Median (ms)", "Ratio", "P90 (ms)", "N Runs", "Rows Returned"]
        header = "| " + " | ".join(col.ljust(col_widths[col]) for col in columns) + " |"
        separator = (
            "|"
            + "|".join(
                "-" * (col_widths[col] + 1) + ":"
                if col != "Query #"
                else "-" * (col_widths[col] + 2)
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
        queries = []
        for i, query in enumerate(parsed_queries, 1):
            formatted_query = sqlparse.format(query, strip_comments=True).strip()
            if formatted_query:
                queries.append({"name": f"Query {i}", "query": formatted_query})

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


@dataclass
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


async def main() -> None:
    """Main program entry point."""
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
        "--runs", type=int, default=DEFAULT_RUNS, help="Number of runs per query for averaging"
    )
    parser.add_argument(
        "--file", default=str(default_query_file), help="Path to file containing SQL queries"
    )

    args = parser.parse_args()
    console = Console()

    # Create configuration
    config = AnalyzerConfig(
        host=str(args.host),
        port=int(args.port),
        dbname=str(args.dbname),
        user=str(args.user),
        password=str(args.password),
        runs=int(args.runs),
        query_file=Path(str(args.file)),
    )

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
    try:
        async with PostgresQueryAnalyzer(config.get_connection_string()) as analyzer:
            await analyzer.analyze_queries(queries, config.runs)
            analyzer.print_results_table()
    except sqlalchemy.exc.SQLAlchemyError as e:
        console.print(f"[bold red]Database connection error:[/bold red] {str(e)}")
        return
    except PostgresQueryError as e:
        console.print(f"[bold red]Query error:[/bold red] {str(e)}")
        return
    except Exception as e:
        console.print(f"[bold red]Unexpected error during analysis:[/bold red] {str(e)}")
        return


if __name__ == "__main__":
    try:
        anyio.run(main)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        console = Console()
        console.print(f"[bold red]Fatal error:[/bold red] {str(e)}")
        sys.exit(1)
