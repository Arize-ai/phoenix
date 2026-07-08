#!/usr/bin/env python3
"""
Span Generation Script

This script runs the generate_spans.sql script to generate spans in batches.

Usage:
    python generate_spans.py [options]

Options:
    --num-batches N      Number of batches to run (default: 10)
    --traces-per-batch N Number of traces per batch (default: 100)
    --db-name NAME       Database name (default: postgres)
    --db-user USER       Database user (default: postgres)
    --db-host HOST       Database host (default: localhost)
    --db-port PORT       Database port (default: 5432)
    --db-password PASS   Database password (default: phoenix)
"""

import argparse
import os
import subprocess
import sys
import time
from datetime import timedelta


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate spans in batches")
    parser.add_argument(
        "--num-batches",
        type=int,
        default=10,
        help="Number of batches to run (default: 10)",
    )
    parser.add_argument(
        "--traces-per-batch",
        type=int,
        default=100,
        help="Number of traces per batch (default: 100)",
    )
    parser.add_argument(
        "--db-name",
        type=str,
        default="postgres",
        help="Database name (default: postgres)",
    )
    parser.add_argument(
        "--db-user",
        type=str,
        default="postgres",
        help="Database user (default: postgres)",
    )
    parser.add_argument(
        "--db-host",
        type=str,
        default="localhost",
        help="Database host (default: localhost)",
    )
    parser.add_argument(
        "--db-port",
        type=int,
        default=5432,
        help="Database port (default: 5432)",
    )
    parser.add_argument(
        "--db-password",
        type=str,
        default="phoenix",
        help="Database password (default: phoenix)",
    )
    return parser.parse_args()


def run_sql_script(
    db_name,
    db_user,
    db_host,
    db_port,
    db_password,
    script_path,
    num_traces=None,
    print_output=False,
):
    """Run a SQL script file.

    Args:
        db_name: Database name
        db_user: Database user
        db_host: Database host
        db_port: Database port
        db_password: Database password
        script_path: Path to SQL script file
        num_traces: Number of traces to generate (optional)
        print_output: Whether to print the output (default: False)

    Returns:
        bool: True if successful
    """
    # Set up environment with password
    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    # Set num_traces if provided
    if num_traces is not None:
        env["num_traces"] = str(num_traces)

    # Build the command
    cmd = [
        "psql",
        "-h",
        db_host,
        "-p",
        str(db_port),
        "-d",
        db_name,
        "-U",
        db_user,
        "-f",
        script_path,
    ]

    # Execute the command
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)

    # Check if the command was successful
    if result.returncode != 0:
        print("Error executing SQL script:")
        print(result.stderr)
        return False

    # Print the output if requested
    if print_output and result.stdout:
        # Filter out unwanted messages
        lines = result.stdout.splitlines()
        filtered_lines = []
        for line in lines:
            # Skip PostgreSQL status messages
            if line.startswith("Output format is") or line.startswith("Tuples only is"):
                continue
            # Skip empty lines
            if not line.strip():
                continue
            filtered_lines.append(line)

        # Print the filtered output
        print("\n".join(filtered_lines))

    return True


def main():
    """Main function."""
    args = parse_arguments()

    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Hard-coded script paths
    sql_script_path = os.path.join(script_dir, "generate_spans.sql")
    report_script_path = os.path.join(script_dir, "report_spans_table_sizes.sql")

    try:
        # Calculate total traces
        total_traces = args.num_batches * args.traces_per_batch

        print(f"Generating {total_traces} traces in {args.num_batches} batches")

        # Record start time
        start_time = time.time()

        # Run the SQL script for each batch
        for i in range(args.num_batches):
            print(f"Batch {i + 1}/{args.num_batches}...", end="", flush=True)

            # Record batch start time
            batch_start_time = time.time()

            if not run_sql_script(
                args.db_name,
                args.db_user,
                args.db_host,
                args.db_port,
                args.db_password,
                sql_script_path,
                args.traces_per_batch,
                print_output=False,  # Don't print output for generate_spans.sql
            ):
                print(" failed")
                print(f"Error processing batch {i + 1}. Aborting.")
                sys.exit(1)

            # Calculate batch duration
            batch_duration = time.time() - batch_start_time
            batch_duration_str = str(timedelta(seconds=int(batch_duration)))
            print(f" done (took {batch_duration_str})")

        # Report completion
        total_time = time.time() - start_time
        total_time_str = str(timedelta(seconds=int(total_time)))
        print(f"Completed in {total_time_str}")

        # Run the report script to show table sizes
        print("\nGenerating table size report...")
        if run_sql_script(
            args.db_name,
            args.db_user,
            args.db_host,
            args.db_port,
            args.db_password,
            report_script_path,
            print_output=True,  # Print output for report_spans_table_sizes.sql
        ):
            pass
        else:
            print("Failed to generate report")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
