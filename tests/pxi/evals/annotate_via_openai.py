#!/usr/bin/env python
"""Bash-callable wrapper to get one annotation opinion from an OpenAI model.

Reads a single prompt from stdin and writes the model's response to stdout.
Loads ``OPENAI_API_KEY`` from a ``.env`` file if it is not already exported.

The ``pxi-eval-dataset`` skill fans out ground-truth annotation across
three independent opinions (typically Sonnet + Opus + o3-mini) to combat
context rot and surface low-confidence cases. The Anthropic opinions
come from the Claude Code ``Agent`` tool; this script is the third
(OpenAI) leg, invoked via the ``Bash`` tool.

Example:
    cat prompt.txt | uv run python tests/pxi/evals/annotate_via_openai.py \\
        --model o3-mini

Exit codes:
    0   success; response written to stdout
    1   user error (no API key, empty prompt) or API call failure
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

DEFAULT_MODEL = "o3-mini"
DEFAULT_ENV_FILE = Path.home() / "Projects" / "phoenix" / ".env"
DEFAULT_MAX_COMPLETION_TOKENS = 8192


def _load_env_file(env_file: Path) -> None:
    """Load env vars from a ``.env`` file using ``python-dotenv`` if it exists.

    Tolerates ``export KEY=value`` lines (the Phoenix project's convention).
    Existing env vars are not overridden.
    """
    if not env_file.is_file():
        return
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(env_file)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send stdin as a prompt to an OpenAI model; print response to stdout.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"OpenAI model name (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--env-file",
        default=str(DEFAULT_ENV_FILE),
        help=(
            "Path to a .env file with OPENAI_API_KEY. "
            "Only consulted if OPENAI_API_KEY is not already in the environment. "
            f"Default: {DEFAULT_ENV_FILE}"
        ),
    )
    parser.add_argument(
        "--max-completion-tokens",
        type=int,
        default=DEFAULT_MAX_COMPLETION_TOKENS,
        help=(
            "Max completion tokens (default: %(default)s). "
            "Reasoning models like o3-mini count reasoning tokens against this budget."
        ),
    )
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        _load_env_file(Path(args.env_file).expanduser())
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print(
            f"ERROR: OPENAI_API_KEY is not set and was not found in {args.env_file}",
            file=sys.stderr,
        )
        return 1

    prompt = sys.stdin.read().strip()
    if not prompt:
        print("ERROR: stdin was empty; supply a prompt", file=sys.stderr)
        return 1

    try:
        from openai import OpenAI
    except ImportError:
        print(
            "ERROR: openai SDK not installed; run `uv sync` or `pip install openai`",
            file=sys.stderr,
        )
        return 1

    client = OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=args.model,
            messages=[{"role": "user", "content": prompt}],
            max_completion_tokens=args.max_completion_tokens,
        )
    except Exception as exc:  # noqa: BLE001 - surface any API failure verbatim
        print(f"ERROR: OpenAI API call failed: {exc}", file=sys.stderr)
        return 1

    content = response.choices[0].message.content or ""
    sys.stdout.write(content)
    if not content.endswith("\n"):
        sys.stdout.write("\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
