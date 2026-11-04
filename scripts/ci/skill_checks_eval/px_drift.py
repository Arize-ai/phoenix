"""Drift injection and coverage for the ``px`` command check.

Coverage asks two questions:

- Extraction: of the lines in skills/ that mention a ``px <word>`` command, how many does the
  check find? A mention inside a fence the check skips, such as ```text or ```python, or in prose
  outside code font, is never checked.
- Depth: of the commands it finds, how many does it check all the way to their flags? A
  placeholder in a subcommand position, such as ``px <resource> list``, ends the check early.

Drift injection removes each subcommand and each flag that the skills use from the real
command tree, one at a time, and counts the commands that use it which the check then flags.

Usage: ``uv run python scripts/ci/skill_checks_eval/px_drift.py`` (needs ``pnpm install`` in js/
and the CLI's workspace dependencies built; ``make check-skill-px-commands`` builds them)
"""

from __future__ import annotations

import copy
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import test_skill_px_commands as check  # noqa: E402
from skill_examples import public_skill_dirs  # noqa: E402

Tree = dict[str, Any]
_MENTION = re.compile(r"(?<![\w./@-])px\s+[a-z][\w-]*")


def command_tree() -> Tree:
    result = subprocess.run(
        [str(check._TSX), "-e", check._DUMP_COMMAND_TREE],
        cwd=check.CLI_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    tree: Tree = json.loads(result.stdout)
    return tree


def _child(node: Tree, name: str) -> Tree | None:
    return next((c for c in node["commands"] if name in (c["name"], *c["aliases"])), None)


def depth(arguments: tuple[str, ...], tree: Tree) -> str:
    """Says how far the check gets: to the flags, or stopped at a placeholder."""
    node = tree
    for token in arguments:
        if token.startswith("-") or not node["commands"]:
            break
        if check._is_placeholder(token):
            return "stopped at a placeholder"
        child = _child(node, token)
        if child is None:
            break
        node = child
    return "checked through its flags"


def mentions() -> Counter[str]:
    """Counts lines that mention a px command, by where they appear."""
    counts: Counter[str] = Counter()
    for skill_dir in public_skill_dirs():
        for path in sorted(skill_dir.rglob("*.md")):
            text = path.read_text(encoding="utf-8")
            fenced = [(m.start(), m.end(), m.group(1)) for m in check._FENCE.finditer(text)]
            offset = 0
            for line in text.splitlines(keepends=True):
                start, offset = offset, offset + len(line)
                if not _MENTION.search(line):
                    continue
                fence = next((f for f in fenced if f[0] <= start < f[1]), None)
                if fence is not None:
                    where = (
                        "shell fence" if fence[2] in check._SHELL_LANGUAGES else f"```{fence[2]}"
                    )
                elif re.search(r"`[^`]*\bpx\s+[a-z]", line):
                    where = "inline code"
                else:
                    where = "plain prose"
                counts[where] += 1
    return counts


def _paths(node: Tree, prefix: tuple[str, ...] = ()) -> list[tuple[str, ...]]:
    paths = []
    for child in node["commands"]:
        path = (*prefix, child["name"])
        paths.append(path)
        paths.extend(_paths(child, path))
    return paths


def _node(tree: Tree, path: tuple[str, ...]) -> Tree:
    node = tree
    for name in path:
        child = _child(node, name)
        assert child is not None
        node = child
    return node


def _uses_path(arguments: tuple[str, ...], path: tuple[str, ...], tree: Tree) -> bool:
    """Checks whether the literal command names ``path``, aliases included."""
    node = tree
    for index, name in enumerate(path):
        if index >= len(arguments):
            return False
        child = _child(node, arguments[index])
        if child is None or child["name"] != name:
            return False
        node = child
    return True


def drift(tree: Tree, commands: list[check.PxCommand]) -> list[tuple[str, int, int]]:
    """Returns (mutation, affected commands, flagged among them) for each mutation."""
    baseline = {c.where: bool(check.problems(c.arguments, tree)) for c in commands}
    rows = []
    for path in _paths(tree):
        users = [c for c in commands if _uses_path(c.arguments, path, tree)]
        if users:
            mutated = copy.deepcopy(tree)
            parent = _node(mutated, path[:-1])
            parent["commands"] = [c for c in parent["commands"] if c["name"] != path[-1]]
            flagged = sum(
                1 for c in users if not baseline[c.where] and check.problems(c.arguments, mutated)
            )
            rows.append((f"remove `px {' '.join(path)}`", len(users), flagged))
        node = _node(tree, path)
        for option in node["options"]:
            flags = set(option["flags"])
            flag_users = [
                c
                for c in users
                if any(token.split("=", 1)[0] in flags for token in c.arguments)
                and not node["commands"]
            ]
            if not flag_users:
                continue
            mutated = copy.deepcopy(tree)
            target = _node(mutated, path)
            target["options"] = [o for o in target["options"] if set(o["flags"]) != flags]
            flagged = sum(
                1
                for c in flag_users
                if not baseline[c.where] and check.problems(c.arguments, mutated)
            )
            rows.append(
                (f"remove `px {' '.join(path)} {option['flags'][-1]}`", len(flag_users), flagged)
            )
    return rows


def main() -> None:
    tree = command_tree()
    commands = check.COMMANDS
    print("px mentions by where they appear:", dict(mentions()))
    print(f"commands the check extracts: {len(commands)}")
    print("depth:", dict(Counter(depth(c.arguments, tree) for c in commands)))
    rows = drift(tree, commands)
    affected = sum(r[1] for r in rows)
    flagged = sum(r[2] for r in rows)
    print(f"{len(rows)} mutations; recall {flagged}/{affected} = {flagged / affected:.0%}")
    for name, users, caught in rows:
        if caught < users:
            print(f"  missed {users - caught}/{users}: {name}")
    by_file = Counter(c.where.rsplit(":", 1)[0] for c in commands)
    print("commands by file:", dict(by_file.most_common(5)))


if __name__ == "__main__":
    main()
