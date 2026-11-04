"""History replay: run the checks on real past drift from git history.

Each case pairs a skill file at one commit with the API at another, so it asks whether the check
would have failed the commit that broke a skill, and passed the commit that fixed it. The cases
come from a search of every commit that touched the skills; there are only three where a working
example broke because the API changed. See ``README.md``.

Usage: ``uv run python scripts/ci/skill_checks_eval/history.py`` (the px case needs
``pnpm install`` in js/)
"""

from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path

from harness import PACKAGES, REPO_ROOT, check, errors_by_source, failing

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import test_skill_px_commands as px_check  # noqa: E402


def show(sha: str, path: str) -> str:
    return subprocess.run(
        ["git", "show", f"{sha}:{path}"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout


def extract(sha: str, path: str, destination: Path, strip: int) -> None:
    archive = subprocess.run(
        ["git", "archive", sha, path], cwd=REPO_ROOT, capture_output=True, check=True
    ).stdout
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for member in tar.getmembers():
            parts = Path(member.name).parts[strip:]
            if not parts:
                continue
            member.name = str(Path(*parts))
            tar.extract(member, destination, filter="data")


def packages_at(sha: str, destination: Path) -> Path:
    for package in PACKAGES:
        extract(
            sha,
            f"packages/phoenix-{package}/src",
            destination / "packages" / f"phoenix-{package}" / "src",
            3,
        )
    return destination


def python_blocks(text: str, name: str) -> dict[str, str]:
    blocks = {}
    for index, match in enumerate(check._PYTHON_FENCE.finditer(text)):
        example = check.Example(f"{name}#{index}", check.textwrap.dedent(match.group(1)), 0)
        blocks[example.id] = check.checkable_source(example)[0]
    return blocks


def px_tree_at(sha: str) -> dict[str, object]:
    """Dumps the CLI's command tree at ``sha``, using this checkout's node_modules."""
    replay = px_check.CLI_ROOT / f".replay-{sha[:10]}"
    shutil.rmtree(replay, ignore_errors=True)
    try:
        extract(sha, "js/packages/phoenix-cli/src", replay / "src", 4)
        result = subprocess.run(
            [str(px_check._TSX), "-e", px_check._DUMP_COMMAND_TREE],
            cwd=replay,
            capture_output=True,
            text=True,
            check=True,
        )
        tree: dict[str, object] = json.loads(result.stdout)
        return tree
    finally:
        shutil.rmtree(replay, ignore_errors=True)


def px_tree_now() -> dict[str, object]:
    result = subprocess.run(
        [str(px_check._TSX), "-e", px_check._DUMP_COMMAND_TREE],
        cwd=px_check.CLI_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    tree: dict[str, object] = json.loads(result.stdout)
    return tree


def px_commands(text: str) -> list[tuple[str, ...]]:
    """The px commands in a Markdown text, found as the check finds them."""
    commands = []
    for fence in px_check._FENCE.finditer(text):
        if fence.group(1) in px_check._SHELL_LANGUAGES:
            for _, tokens in px_check._logical_lines(fence.group(2)):
                commands.extend(tuple(a) for a in px_check._px_invocations(tokens))
    prose = px_check._FENCE.sub(lambda fence: "\n" * fence.group(0).count("\n"), text)
    for match in px_check._INLINE_PX.finditer(prose):
        invocations = px_check._px_invocations(px_check._shell_tokens(match.group(1)))
        commands.extend(tuple(a) for a in invocations)
    return commands


@dataclass(frozen=True)
class PxCase:
    name: str
    skill_path: str
    broken_skill: str  # commit whose skill text predates the fix
    fixed_skill: str
    api: str  # commit whose CLI the skill text is checked against


@dataclass(frozen=True)
class PythonCase:
    name: str
    skill_path: str
    skill: str
    broken_api: str | None  # None means this checkout's packages
    fixed_api: str | None
    marker: str  # a string only the drifted block contains


PX_CASES = (
    PxCase(
        "px noun-verb rename (#12393)",
        "skills/phoenix-cli/SKILL.md",
        broken_skill="a195055d03^",
        fixed_skill="a195055d03",
        api="a195055d03",
    ),
)

PYTHON_CASES = (
    PythonCase(
        "phoenix.otel.suppress_tracing exported later",
        ".agents/skills/phoenix-tracing/references/production-python.md",
        skill="23576da85d",
        broken_api="23576da85d^",
        fixed_api="23576da85d",
        marker="suppress_tracing",
    ),
)

PYTHON_TEXT_CASES = (
    # The API is this checkout's; the skill text changes from before the fix to after it.
    (
        "phoenix.experiments removed",
        ".agents/skills/phoenix-evals/references/evaluators-code-python.md",
        "9ce9e1859d^",
        "9ce9e1859d",
        "phoenix.experiments",
    ),
)


def run_px_case(case: PxCase) -> None:
    tree = px_tree_at(case.api)
    before = px_commands(show(case.broken_skill, case.skill_path))
    after = px_commands(show(case.fixed_skill, case.skill_path))
    changed = set(before) - set(after)
    flagged = {c for c in before if px_check.problems(c, tree)}
    flagged_after = {c for c in after if px_check.problems(c, tree)}
    print(f"{case.name}:")
    print(f"  before the fix: {len(before)} commands, {len(changed)} changed by the fix")
    print(
        f"  flagged {len(flagged & changed)}/{len(changed)} changed commands; "
        f"{len(flagged - changed)} unchanged commands flagged"
    )
    print(f"  after the fix: {len(flagged_after)}/{len(after)} commands flagged")
    for command in sorted(changed - flagged):
        print(f"    missed: px {' '.join(command)}")
    for command in sorted(flagged - changed):
        print(f"    also flagged: px {' '.join(command)}")


def _flagged_markers(blocks: dict[str, str], packages_root: Path, marker: str) -> tuple[int, int]:
    errors = errors_by_source(blocks, packages_root)
    drifted = {block_id for block_id, source in blocks.items() if marker in source}
    return len(drifted & failing(errors)), len(drifted)


def run_python_cases() -> None:
    for case in PYTHON_CASES:
        blocks = python_blocks(show(case.skill, case.skill_path), case.skill_path)
        print(f"{case.name}:")
        for label, api in (("broken API", case.broken_api), ("fixed API", case.fixed_api)):
            with tempfile.TemporaryDirectory() as directory:
                root = packages_at(api, Path(directory)) if api else REPO_ROOT
                caught, total = _flagged_markers(blocks, root, case.marker)
            print(f"  {label} ({api}): {caught}/{total} drifted blocks flagged")
    for name, path, broken, fixed, marker in PYTHON_TEXT_CASES:
        print(f"{name}:")
        for label, sha in (("skill before the fix", broken), ("skill after the fix", fixed)):
            blocks = python_blocks(show(sha, path), path)
            errors = errors_by_source(blocks)
            drifted = {i for i, s in blocks.items() if marker in s}
            print(
                f"  {label} ({sha}): {len(drifted & failing(errors))}/{len(drifted)} blocks with "
                f"{marker!r} flagged; {len(failing(errors))}/{len(blocks)} blocks fail in all"
            )


# Placeholders that stand for a subcommand. Any other whole-word placeholder, such as
# ``<trace-id>``, is a positional argument, so ``px trace <trace-id>`` fails when ``px trace``
# takes none. A partial placeholder, such as ``<entity>-annotations``, still ends the check.
SUBCOMMAND_PLACEHOLDERS = frozenset({"command", "subcommand", "resource", "action", "noun", "verb"})


def strict_placeholder(token: str) -> bool:
    if re.fullmatch(r"<[\w-]+>|\[[\w-]+\]", token):
        return token[1:-1].lower() in SUBCOMMAND_PLACEHOLDERS
    return "<" in token or token.startswith("[")


def main() -> None:
    for case in PX_CASES:
        run_px_case(case)
    print("With a placeholder rule that stops only at subcommand placeholders:")
    lenient = px_check._is_placeholder
    px_check._is_placeholder = strict_placeholder
    try:
        for case in PX_CASES:
            run_px_case(case)
        print(
            "  current skills flagged:",
            [
                " ".join(c.arguments)
                for c in px_check.COMMANDS
                if px_check.problems(c.arguments, px_tree_now())
            ],
        )
    finally:
        px_check._is_placeholder = lenient
    run_python_cases()


if __name__ == "__main__":
    main()
