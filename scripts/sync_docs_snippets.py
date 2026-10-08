"""Keep fenced code blocks in the docs identical to runnable example files.

A fenced block in an ``.mdx`` file is pinned to a source file by a marker
comment on the line directly before the fence::

    {/* snippet: examples/quickstarts/python/observe.py#register */}
    ```python
    ...
    ```

The path is repo-relative. ``#name`` selects the lines between a
``docs:start name`` and a ``docs:end name`` comment (``#`` or ``//``) in that
file; without ``#name`` the whole file is used. The region is dedented, then
indented to match the fence, so blocks nested inside ``<Tab>`` or ``<Step>``
render correctly.

Run with no arguments to rewrite the docs from the examples (``make
sync-docs-snippets``). Run with ``--check`` to exit non-zero listing every
block that differs (``make check-docs-snippets``). The runnable files live in
``examples/quickstarts/``; edit and run them there, then sync.
"""

from __future__ import annotations

import argparse
import re
import sys
import textwrap
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DOCS_ROOT = REPO_ROOT / "docs"

MARKER = re.compile(r"^\s*\{/\*\s*snippet:\s*(?P<path>[^#\s]+)(?:#(?P<region>[\w-]+))?\s*\*/\}\s*$")
REGION_LINE = re.compile(r"^\s*(?:#|//)\s*docs:(?P<kind>start|end)\s+(?P<name>[\w-]+)\s*$")
FENCE_OPEN = re.compile(r"^(?P<indent>\s*)```\S")
FENCE_CLOSE = re.compile(r"^\s*```\s*$")


class SnippetError(Exception):
    pass


@lru_cache(maxsize=None)
def regions(path: str) -> dict[str | None, list[str]]:
    """Map each region name in the file to its lines; ``None`` is the whole file."""
    source = REPO_ROOT / path
    if not source.exists():
        raise SnippetError(f"{path}: file not found")
    lines = source.read_text().splitlines()
    found: dict[str | None, list[str]] = {None: lines}
    open_at: dict[str, int] = {}
    for index, line in enumerate(lines):
        match = REGION_LINE.match(line)
        if not match:
            continue
        name = match.group("name")
        if match.group("kind") == "start":
            open_at[name] = index + 1
        elif name in open_at:
            found[name] = lines[open_at.pop(name) : index]
    return found


def load_region(path: str, region: str | None) -> list[str]:
    body = regions(path).get(region)
    if body is None:
        raise SnippetError(f"{path}: region '{region}' needs matching docs:start and docs:end lines")
    return textwrap.dedent("\n".join(body)).strip("\n").splitlines()


def process(doc: Path, check: bool) -> tuple[int, list[str]]:
    """Return (markers seen, problems). In sync mode, also rewrite the file."""
    rel = doc.relative_to(REPO_ROOT)
    problems: list[str] = []
    lines = doc.read_text().splitlines()
    out: list[str] = []
    count = 0
    index = 0
    while index < len(lines):
        marker = MARKER.match(lines[index])
        out.append(lines[index])
        index += 1
        if not marker:
            continue
        count += 1
        fence_line = index + 1  # 1-based line the fence should be on
        opener = FENCE_OPEN.match(lines[index]) if index < len(lines) else None
        if not opener:
            problems.append(f"{rel}:{fence_line}: marker is not followed by a fenced code block")
            continue
        out.append(lines[index])
        index += 1
        body_start = index
        while index < len(lines) and not FENCE_CLOSE.match(lines[index]):
            index += 1
        if index >= len(lines):
            problems.append(f"{rel}:{fence_line}: fenced block never closes")
            break
        current = lines[body_start:index]
        try:
            region = load_region(marker.group("path"), marker.group("region"))
        except SnippetError as error:
            problems.append(f"{rel}:{fence_line}: {error}")
            out.extend(current)
            continue
        indent = opener.group("indent")
        expected = [indent + text if text.strip() else "" for text in region]
        if check and current != expected:
            problems.append(f"{rel}:{fence_line}: block differs from {marker.group('path')}")
        out.extend(expected)
    if not check and not problems and out != lines:
        doc.write_text("\n".join(out) + "\n")
    return count, problems


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--check", action="store_true", help="report drift instead of rewriting the docs")
    args = parser.parse_args()

    total = 0
    problems: list[str] = []
    for doc in sorted(DOCS_ROOT.rglob("*.mdx")):
        count, doc_problems = process(doc, check=args.check)
        total += count
        problems.extend(doc_problems)

    if problems:
        print("\n".join(problems), file=sys.stderr)
        if args.check:
            print(f"\n{len(problems)} snippet block(s) out of sync. Run `make sync-docs-snippets`.", file=sys.stderr)
        return 1
    print(f"{'checked' if args.check else 'synced'} {total} snippet block(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
