#!/usr/bin/env python3
"""Create a Hugging Face dataset PR for parity experiment uploads."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from huggingface_hub import HfApi


DEFAULT_REPO_ID = "harborframework/parity-experiments"


def _read_description(args: argparse.Namespace) -> str | None:
    if args.description and args.description_file:
        raise ValueError("Pass either --description or --description-file, not both.")
    if args.description_file:
        return Path(args.description_file).read_text()
    return args.description


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_pr = subparsers.add_parser(
        "create-pr", help="Create a dataset PR and print its discussion URL."
    )
    create_pr.add_argument("--title", required=True, help="Pull request title.")
    create_pr.add_argument(
        "--description",
        help="Pull request description text.",
    )
    create_pr.add_argument(
        "--description-file",
        help="Path to a file containing the pull request description.",
    )
    create_pr.add_argument(
        "--repo-id",
        default=DEFAULT_REPO_ID,
        help=f"Hugging Face dataset repo id. Defaults to {DEFAULT_REPO_ID}.",
    )
    return parser


def create_pr(args: argparse.Namespace) -> None:
    description = _read_description(args)
    api = HfApi()
    discussion = api.create_pull_request(
        repo_id=args.repo_id,
        title=args.title,
        description=description,
        repo_type="dataset",
    )
    output = {
        "pr_number": discussion.num,
        "discussion_url": (
            f"https://huggingface.co/datasets/{args.repo_id}/discussions/{discussion.num}"
        ),
        "repo_id": args.repo_id,
        "title": discussion.title,
    }
    print(json.dumps(output, indent=2, sort_keys=True))


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    if args.command == "create-pr":
        create_pr(args)


if __name__ == "__main__":
    main()
