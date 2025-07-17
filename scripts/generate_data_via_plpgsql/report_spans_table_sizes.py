#!/usr/bin/env python3
"""
Table Size Report Script

This script runs the report_spans_table_sizes.sql script to generate a report of table sizes.

Usage:
    python report_table_sizes.py [options]

Options:
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


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate a report of table sizes")
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
):
    """Run a SQL script file.

    Args:
        db_name: Database name
        db_user: Database user
        db_host: Database host
        db_port: Database port
        db_password: Database password
        script_path: Path to SQL script file

    Returns:
        bool: True if successful
    """
    # Set up environment with password
    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

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

    # Hard-coded script path
    report_script_path = os.path.join(script_dir, "report_spans_table_sizes.sql")

    try:
        print("Generating table size report...")
        if run_sql_script(
            args.db_name,
            args.db_user,
            args.db_host,
            args.db_port,
            args.db_password,
            report_script_path,
        ):
            pass
        else:
            print("Failed to generate report")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
