# /// script
# requires-python = ">=3.12"
# ///
"""Extract the preview seed and print GitHub Actions outputs."""

import argparse
import json
import re
import sys
from pathlib import Path

from gh import run_gh

SEED_HEADING_PATTERN = re.compile(r"^(#+)\s*Preview seed\s*$", re.IGNORECASE)
HEADING_PATTERN = re.compile(r"^(#+)\s")
FENCE_PATTERN = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")
PYTHON_INFO_PATTERN = re.compile(r"^\s*(python3?|py)\b", re.IGNORECASE)
CLOSING_FENCE_MAX_EXTRA_INDENT = 3  # CommonMark


def extract_seed(*, body: str) -> str:
    """Extract the first nonempty Python block in the Preview seed section."""

    def finish(block: list[str]) -> str:
        return "\n".join(block).strip() + "\n" if any(line.strip() for line in block) else ""

    in_section = False
    section_level = 0
    block: list[str] = []
    opening_fence = ""
    indent = 0
    in_python = False
    for line in body.splitlines():
        fence = FENCE_PATTERN.match(line)
        leading = len(line) - len(line.lstrip(" "))
        if opening_fence:
            closes = (
                fence is not None
                and fence.group(1)[0] == opening_fence[0]
                and len(fence.group(1)) >= len(opening_fence)
                and not fence.group(2).strip()
                and leading <= indent + CLOSING_FENCE_MAX_EXTRA_INDENT
            )
            if closes:
                if in_python and (seed := finish(block)):
                    return seed
                opening_fence, in_python, block = "", False, []
            elif in_python:
                block.append(line[min(leading, indent) :])
        elif fence is not None:
            opening_fence = fence.group(1)
            indent = leading
            in_python = in_section and PYTHON_INFO_PATTERN.match(fence.group(2)) is not None
        elif (seed_heading := SEED_HEADING_PATTERN.match(line)) is not None:
            in_section = True
            section_level = len(seed_heading.group(1))
        elif (heading := HEADING_PATTERN.match(line)) is not None and in_section:
            if len(heading.group(1)) <= section_level:
                return ""
    return finish(block) if opening_fence and in_python else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--head-sha", required=True, help="the commit the workflow checked out")
    parser.add_argument("--seed-dir", type=Path, required=True)
    args = parser.parse_args()

    pr = json.loads(run_gh("pr", "view", str(args.pr), "--json", "body"))
    head_sha = str(args.head_sha)
    seed = extract_seed(body=str(pr["body"] or ""))
    args.seed_dir.mkdir(parents=True, exist_ok=True)
    (args.seed_dir / "seed.py").write_text(seed)
    seed_summary = (
        f"{seed.count(chr(10))} lines from the PR body" if seed else "none in the PR body"
    )

    for name, value in {
        "short-sha": head_sha[:7],
        "seed-summary": seed_summary,
    }.items():
        print(f"{name}={value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
