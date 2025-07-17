#!/usr/bin/env python3
"""
Span Annotations Generation Script

This script executes the generate_span_annotations.sql script to create random annotations
for spans in the database. It provides a convenient way to run the SQL script with
configurable parameters.

The script generates random annotations with the following characteristics:
- Randomly sampled spans (approximately 1% of total spans)
- Between 1 and max_annotations_per_span annotations per span
- Randomly assigned names from the provided list
- Randomly assigned labels: "YES" or "NO"
- Random scores between 0 and 1
- Empty metadata JSON objects
- Random annotator kind: "HUMAN" or "LLM"
- Random explanation text

Usage:
    python generate_span_annotations.py [options]

Options:
    --db-name NAME       Database name (default: postgres)
    --db-user USER       Database user (default: postgres)
    --db-host HOST       Database host (default: localhost)
    --db-port PORT       Database port (default: 5432)
    --db-password PASS   Database password (default: phoenix)
    --limit LIMIT        Number of spans to sample (default: 10000)
    --max-annotations-per-span MAX
                        Maximum number of annotations per span (default: 10)
    --label-missing-prob PROB
                        Probability of label being missing (default: 0.1)
    --score-missing-prob PROB
                        Probability of score being missing (default: 0.1)
    --explanation-missing-prob PROB
                        Probability of explanation being missing (default: 0.1)
    --metadata-missing-prob PROB
                        Probability of metadata being missing (default: 0.1)
    --annotation-names NAMES
                        Comma-separated list of annotation names (default: correctness,helpfulness,relevance,safety,coherence)

Example:
    # Use default parameters
    python generate_span_annotations.py

    # Specify custom parameters
    python generate_span_annotations.py \
        --db-name mydb \
        --db-user myuser \
        --db-host localhost \
        --db-port 5432 \
        --db-password mypass \
        --limit 10000 \
        --max-annotations-per-span 10 \
        --label-missing-prob 0.1 \
        --score-missing-prob 0.1 \
        --explanation-missing-prob 0.1 \
        --metadata-missing-prob 0.1 \
        --annotation-names "correctness,helpfulness,relevance,safety,coherence"

Dependencies:
    - Python 3.x
    - psql command-line tool
    - PostgreSQL database with the following tables:
        - public.spans
        - public.span_annotations

The script uses a single bulk INSERT operation for efficiency and maintains referential
integrity by using the span's id as span_rowid in the annotations.
"""  # noqa: E501

import argparse
import os
import subprocess
import sys
import time
from datetime import timedelta


def parse_arguments():
    """Parse command line arguments.

    Returns:
        argparse.Namespace: Parsed command line arguments
    """
    parser = argparse.ArgumentParser(description="Generate span annotations")
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
    parser.add_argument(
        "--limit",
        type=int,
        default=10_000,
        help="Number of spans to sample (default: 10000)",
    )
    parser.add_argument(
        "--max-annotations-per-span",
        type=int,
        default=10,
        help="Maximum number of annotations per span (default: 10)",
    )
    parser.add_argument(
        "--label-missing-prob",
        type=float,
        default=0.1,
        help="Probability of label being missing (default: 0.1)",
    )
    parser.add_argument(
        "--score-missing-prob",
        type=float,
        default=0.1,
        help="Probability of score being missing (default: 0.1)",
    )
    parser.add_argument(
        "--explanation-missing-prob",
        type=float,
        default=0.1,
        help="Probability of explanation being missing (default: 0.1)",
    )
    parser.add_argument(
        "--metadata-missing-prob",
        type=float,
        default=0.1,
        help="Probability of metadata being missing (default: 0.1)",
    )
    parser.add_argument(
        "--annotation-names",
        type=str,
        default="correctness,helpfulness,relevance,safety,coherence,note",
        help="Comma-separated list of annotation names (default: correctness,helpfulness,relevance,safety,coherence,note)",  # noqa: E501
    )
    return parser.parse_args()


def run_sql_script(
    db_name,
    db_user,
    db_host,
    db_port,
    db_password,
    script_path,
    print_output=True,
    limit=10000,
    max_annotations_per_span=10,
    label_missing_prob=0.1,
    score_missing_prob=0.1,
    explanation_missing_prob=0.1,
    metadata_missing_prob=0.1,
    annotation_names="correctness,helpfulness,relevance,safety,coherence",
):
    """Run a SQL script file using psql.

    Args:
        db_name (str): Database name
        db_user (str): Database user
        db_host (str): Database host
        db_port (int): Database port
        db_password (str): Database password
        script_path (str): Path to SQL script file
        print_output (bool): Whether to print the output (default: True)
        limit (int): Number of spans to sample and annotate (default: 10000)
        max_annotations_per_span (int): Maximum number of annotations per span (default: 10)
        label_missing_prob (float): Probability of label being missing (default: 0.1)
        score_missing_prob (float): Probability of score being missing (default: 0.1)
        explanation_missing_prob (float): Probability of explanation being missing (default: 0.1)
        metadata_missing_prob (float): Probability of metadata being missing (default: 0.1)
        annotation_names (str): Comma-separated list of annotation names (default: correctness,helpfulness,relevance,safety,coherence)

    Returns:
        bool: True if successful, False otherwise

    Raises:
        subprocess.CalledProcessError: If the psql command fails
    """  # noqa: E501
    # Set up environment with password
    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    # Escape single quotes in annotation names
    escaped_names = annotation_names.replace("'", "''")
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
        "-v",
        f"limit={limit}",
        "-v",
        f"max_annotations_per_span={max_annotations_per_span}",
        "-v",
        f"label_missing_prob={label_missing_prob}",
        "-v",
        f"score_missing_prob={score_missing_prob}",
        "-v",
        f"explanation_missing_prob={explanation_missing_prob}",
        "-v",
        f"metadata_missing_prob={metadata_missing_prob}",
        "-v",
        f"annotation_names={escaped_names}",
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
        print("\nSQL Output:")
        print(result.stdout)
    if result.stderr:
        print("\nSQL Errors:")
        print(result.stderr)

    return True


def main():
    """Main function to execute the span annotations generation.

    This function:
    1. Parses command line arguments
    2. Locates the SQL script
    3. Executes the script with the provided database connection parameters
    4. Reports success or failure with timing information
    """
    args = parse_arguments()

    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Hard-coded script paths
    sql_script_path = os.path.join(script_dir, "generate_span_annotations.sql")

    try:
        print("Generating span annotations...", end="", flush=True)

        # Record start time
        start_time = time.time()

        if not run_sql_script(
            args.db_name,
            args.db_user,
            args.db_host,
            args.db_port,
            args.db_password,
            sql_script_path,
            limit=args.limit,
            max_annotations_per_span=args.max_annotations_per_span,
            label_missing_prob=args.label_missing_prob,
            score_missing_prob=args.score_missing_prob,
            explanation_missing_prob=args.explanation_missing_prob,
            metadata_missing_prob=args.metadata_missing_prob,
            annotation_names=args.annotation_names,
        ):
            print(" failed")
            print("Error generating annotations. Aborting.")
            sys.exit(1)

        # Report completion
        total_time = time.time() - start_time
        total_time_str = str(timedelta(seconds=int(total_time)))
        print(f" done (took {total_time_str})")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
