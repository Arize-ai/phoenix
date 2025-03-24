# /// script
# dependencies = [
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
import asyncio
import random
import re
import signal
import statistics
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from types import TracebackType
from typing import Any, Optional

import sqlalchemy.exc
import sqlparse
from rich.console import Console
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine
from tqdm import tqdm

# Configuration
DEFAULT_RUNS = 20
DEFAULT_DELAY_BETWEEN_RUNS = 0.1
DEFAULT_DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres",
    "password": "phoenix",
}

# Regex patterns for extracting metrics
EXECUTION_TIME_PATTERN = r"Execution Time: (\d+\.\d+) ms"
ROW_COUNT_PATTERN = r"rows=(\d+)"


@dataclass
class QueryResult:
    """Stores the results of running a query multiple times."""

    query_name: str
    query: str
    execution_times_ms: list[float]
    row_count: Optional[int]
    timestamp: str
    error: Optional[str] = None


class PostgresQueryAnalyzer:
    """Analyzes PostgreSQL query performance using EXPLAIN ANALYZE."""

    def __init__(self, connection_string: str) -> None:
        self.engine = create_async_engine(connection_string)
        self.results: dict[str, QueryResult] = {}
        self.console = Console()
        self._interrupted = False

    def set_interrupted(self) -> None:
        """Mark that the user wants to stop the analysis."""
        self._interrupted = True

    async def analyze_queries(
        self,
        queries: list[dict[str, str]],
        runs: int = DEFAULT_RUNS,
    ) -> list[QueryResult]:
        """Run EXPLAIN ANALYZE on multiple queries in random order."""
        try:
            async with self.engine.connect() as conn:
                # Create and randomize all runs
                all_runs = [
                    (query_info, run_num) for query_info in queries for run_num in range(runs)
                ]
                random.shuffle(all_runs)

                with tqdm(total=len(all_runs), desc="Analyzing queries", unit="run") as pbar:
                    for query_info, _ in all_runs:
                        if self._interrupted:
                            break
                        await self.analyze_query(
                            conn,
                            query_info["name"],
                            query_info["query"],
                            pbar,
                        )
                return list(self.results.values())
        finally:
            await self.engine.dispose()

    async def analyze_query(
        self,
        conn: AsyncConnection,
        query_name: str,
        query: str,
        pbar: Optional[tqdm[Any]] = None,
    ) -> QueryResult:
        """Run EXPLAIN ANALYZE on a single query."""
        try:
            execution_time, row_count = await self._execute_and_extract_metrics(
                conn, f"EXPLAIN ANALYZE {query}"
            )
            self._update_results(query_name, query, execution_time, row_count)
            await asyncio.sleep(DEFAULT_DELAY_BETWEEN_RUNS)
            if pbar:
                pbar.update(1)
            return self.results[query_name]
        except Exception as e:
            if pbar:
                pbar.update(1)
            return self._handle_query_error(query_name, query, e)

    async def _execute_and_extract_metrics(
        self, conn: AsyncConnection, explain_query: str
    ) -> tuple[Optional[float], Optional[int]]:
        """Run the EXPLAIN ANALYZE query and extract timing information."""
        result = await conn.execute(text(explain_query))
        explain_output = "\n".join(row[0] for row in result)
        return (
            self._extract_execution_time(explain_output),
            self._extract_row_count(explain_output),
        )

    def _extract_execution_time(self, explain_output: str) -> Optional[float]:
        """Extract execution time from EXPLAIN ANALYZE output."""
        if match := re.search(EXECUTION_TIME_PATTERN, explain_output):
            return float(match.group(1))
        return None

    def _extract_row_count(self, explain_output: str) -> Optional[int]:
        """Extract row count from EXPLAIN ANALYZE output."""
        if match := re.search(ROW_COUNT_PATTERN, explain_output):
            return int(match.group(1))
        return None

    def _update_results(
        self,
        query_name: str,
        query: str,
        execution_time: Optional[float],
        row_count: Optional[int],
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
            )
        else:
            self.results[query_name].execution_times_ms.append(round(execution_time, 1))

    def _handle_query_error(self, query_name: str, query: str, error: Exception) -> QueryResult:
        """Handle errors that occur while running a query."""
        error_msg = (
            f"Database error: {str(error)}"
            if isinstance(error, sqlalchemy.exc.SQLAlchemyError)
            else f"Query execution failed: {str(error)}"
        )
        return QueryResult(
            query_name=query_name,
            query=query,
            execution_times_ms=[],
            row_count=None,
            timestamp=datetime.now().isoformat(),
            error=error_msg,
        )

    def _format_table_row(
        self,
        result: QueryResult,
        col_widths: dict[str, int],
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

    def _calculate_query_statistics(self) -> dict[str, dict[str, float]]:
        """Calculate statistical measures for all queries."""
        stats = {}
        min_median = float("inf")

        for query_name, result in self.results.items():
            if not result.execution_times_ms:
                continue

            try:
                median_time = statistics.median(result.execution_times_ms)
                p90_time = statistics.quantiles(result.execution_times_ms, n=10)[-1]
                min_median = min(min_median, median_time)
                stats[query_name] = {"median": median_time, "p90": p90_time}
            except statistics.StatisticsError:
                self.console.print(
                    f"[yellow]Warning: Could not calculate statistics for {query_name}[/yellow]"
                )
                continue

        if min_median > 0:
            for query_stats in stats.values():
                query_stats["ratio"] = query_stats["median"] / min_median

        return stats

    def _get_column_widths(self) -> dict[str, int]:
        """Get the width for each column in the results table."""
        return {
            "Query #": 10,
            "Median (ms)": 12,
            "Ratio": 8,
            "P90 (ms)": 10,
            "N Runs": 8,
            "Rows Returned": 13,
        }

    def _print_table_header(self, col_widths: dict[str, int]) -> None:
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

    async def __aenter__(self) -> "PostgresQueryAnalyzer":
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> None:
        await self.engine.dispose()


def read_queries_from_file(file_path: Path, console: Console) -> list[dict[str, str]]:
    """Read and parse SQL queries from a text file."""
    try:
        # Read and filter comments
        all_lines = file_path.read_text().splitlines()
        filtered_lines = [line for line in all_lines if not line.strip().startswith("--")]
        all_queries_text = "\n".join(filtered_lines)

        # Parse and format queries
        parsed_queries = sqlparse.split(all_queries_text)
        queries = [
            {"name": f"Query {i}", "query": sqlparse.format(q, strip_comments=True).strip()}
            for i, q in enumerate(parsed_queries, 1)
            if sqlparse.format(q, strip_comments=True).strip()
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


async def main() -> None:
    """Main program entry point."""
    parser = argparse.ArgumentParser(description="PostgreSQL Query Performance Analyzer")
    script_dir = Path(__file__).parent.absolute()
    default_query_file = script_dir / "paste_queries_here.sql"

    # Add command line options
    parser.add_argument("--host", default=DEFAULT_DB_CONFIG["host"], help="PostgreSQL host")
    parser.add_argument(
        "--port", type=int, default=DEFAULT_DB_CONFIG["port"], help="PostgreSQL port"
    )
    parser.add_argument(
        "--dbname", default=DEFAULT_DB_CONFIG["dbname"], help="PostgreSQL database name"
    )
    parser.add_argument("--user", default=DEFAULT_DB_CONFIG["user"], help="PostgreSQL username")
    parser.add_argument(
        "--password", default=DEFAULT_DB_CONFIG["password"], help="PostgreSQL password"
    )
    parser.add_argument(
        "--runs", type=int, default=DEFAULT_RUNS, help="Number of runs per query for averaging"
    )
    parser.add_argument(
        "--file", default=str(default_query_file), help="Path to file containing SQL queries"
    )

    args = parser.parse_args()
    console = Console()
    query_file = Path(args.file)

    # Show configuration
    console.print("\n[bold blue]Configuration:[/bold blue]")
    console.print(f"  Database: {args.host}:{args.port}/{args.dbname}")
    console.print(f"  User: {args.user}")
    console.print(f"  Number of runs per query: {args.runs}")
    console.print(f"  Query file: {query_file}\n")

    # Read queries from file
    queries = read_queries_from_file(query_file, console)
    if not queries:
        console.print(
            "[bold yellow]No queries to analyze. Please add your "
            "SQL queries to the file and run again. Each query must end "
            "with a semicolon (;).[/bold yellow]\n"
        )
        return

    # Create database connection string
    connection_string = (
        f"postgresql+asyncpg://{args.user}:{args.password}@{args.host}:{args.port}/{args.dbname}"
    )

    # Set up signal handler for graceful interruption
    def signal_handler(signum: int, frame: Any) -> None:
        console.print(
            "\n[bold yellow]Interrupted by user. " "Summarizing results so far...[/bold yellow]"
        )
        if analyzer:
            analyzer.set_interrupted()

    signal.signal(signal.SIGINT, signal_handler)

    # Run the analysis
    analyzer = None
    try:
        async with PostgresQueryAnalyzer(connection_string) as analyzer:
            await analyzer.analyze_queries(queries, args.runs)
            analyzer.print_results_table()
    except sqlalchemy.exc.SQLAlchemyError as e:
        console.print(f"[bold red]Database connection error:[/bold red] {str(e)}")
        return
    except Exception as e:
        console.print(f"[bold red]Unexpected error during analysis:[/bold red] {str(e)}")
        return


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        console = Console()
        console.print(f"[bold red]Fatal error:[/bold red] {str(e)}")
        sys.exit(1)
