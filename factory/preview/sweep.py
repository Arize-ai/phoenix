# /// script
# requires-python = ">=3.12"
# ///
"""Discover and remove unused Factory Preview projects."""

import argparse
import json
import subprocess
import sys
import urllib.error

from preview_project import (
    RailwayError,
    find_owned_project,
    list_workspace_projects,
    owned_pr_number,
    preview_wanted,
    railway,
    upsert_comment,
)

SWEEP_BATCH_SIZE = 256


def run_discover_cleanup(_args: argparse.Namespace) -> int:
    pr_numbers = {
        pr_number
        for project in list_workspace_projects()
        if (pr_number := owned_pr_number(project)) is not None
    }
    candidates = []
    for pr_number in sorted(pr_numbers):
        try:
            if not preview_wanted(pr_number):
                candidates.append(pr_number)
        except subprocess.CalledProcessError:
            print(f"::warning::Could not verify PR #{pr_number} for cleanup", file=sys.stderr)
    if len(candidates) > SWEEP_BATCH_SIZE:
        print(f"::warning::Deferring cleanup beyond {SWEEP_BATCH_SIZE} projects", file=sys.stderr)
    print(json.dumps(candidates[:SWEEP_BATCH_SIZE]))
    return 0


def run_cleanup(args: argparse.Namespace) -> int:
    if preview_wanted(args.pr):
        return 0
    if project := find_owned_project(args.pr):
        if preview_wanted(args.pr):
            return 0
        deleted = railway("mutation($id: String!) { projectDelete(id: $id) }", id=project["id"])
        if not deleted.get("projectDelete"):
            raise RailwayError(f"Railway did not delete the preview project for PR #{args.pr}")
        upsert_comment(pr_number=args.pr, body="The Factory Preview Railway project was removed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    discovery_parser = subparsers.add_parser("discover")
    discovery_parser.set_defaults(run=run_discover_cleanup)
    cleanup_parser = subparsers.add_parser("cleanup")
    cleanup_parser.add_argument("--pr", type=int, required=True)
    cleanup_parser.set_defaults(run=run_cleanup)
    args = parser.parse_args()
    try:
        return int(args.run(args))
    except (RailwayError, urllib.error.URLError, subprocess.CalledProcessError) as error:
        print(f"::error::Preview sweep {args.command} failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
