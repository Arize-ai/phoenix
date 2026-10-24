"""Build every shipped copy of the public skills from ``skills/``, or check them.

``skills/`` holds every skill Phoenix ships to users. Each one says where it goes
with ``metadata.targets``, a space-separated string:

- ``agents``: installed as files by ``npx skills add``, ``px setup`` and the
  Claude Code, Cursor and Codex plugins.
- ``mcp``: served by the Phoenix MCP server.
- ``pxi``: loaded by PXI, on top of PXI's own skills.

Run with no arguments to write every copy (``make skills``):

- ``src/phoenix/server/mcp/skills/<name>/``: a copy of each ``mcp`` skill.
- ``src/phoenix/server/agents/prompts/public_skills/<name>/``: a copy of each
  ``pxi`` skill.
- ``plugins/claude/arize-phoenix/skills/<name>`` and
  ``plugins/codex/arize-phoenix/skills/<name>``: a symlink for each ``agents``
  skill; ``.cursor-plugin/plugin.json`` lists the same skills.
- ``.agents/skills/<name>``: a symlink for every public skill, so contributors
  in the repo have them too.
- ``metadata.internal: true`` on every contributor skill in ``.agents/skills/``
  that lacks it, so the skills CLI never offers it to users.

Run with ``--check`` to change nothing and exit non-zero listing every copy that
is out of date and every rule a skill breaks (``make skills-check``). Add
``--npx`` to also run ``npx skills add . --list`` and fail unless it lists
exactly the public skills.

Never edit a copy: edit the skill in ``skills/`` and run ``make skills``.
Vendored third-party skills are listed in ``skills-lock.json`` and are left
alone; PXI-only skills live in ``src/phoenix/server/agents/prompts/skills/``
and need no labels.
"""

from __future__ import annotations

import argparse
import filecmp
import json
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from functools import partial
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPO_ROOT / "skills"
CONTRIBUTOR_ROOT = REPO_ROOT / ".agents" / "skills"
VENDORED_LOCKFILE = REPO_ROOT / "skills-lock.json"
MCP_ROOT = REPO_ROOT / "src" / "phoenix" / "server" / "mcp" / "skills"
PXI_PUBLIC_ROOT = REPO_ROOT / "src" / "phoenix" / "server" / "agents" / "prompts" / "public_skills"
PXI_ROOT = REPO_ROOT / "src" / "phoenix" / "server" / "agents" / "prompts" / "skills"
PLUGIN_SKILL_ROOTS = (
    REPO_ROOT / "plugins" / "claude" / "arize-phoenix" / "skills",
    REPO_ROOT / "plugins" / "codex" / "arize-phoenix" / "skills",
)
CURSOR_MANIFEST = REPO_ROOT / ".cursor-plugin" / "plugin.json"

TARGETS = frozenset({"agents", "mcp", "pxi"})
SKILL_FILE = "SKILL.md"

_FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
_KEY_VALUE = re.compile(r"^(?P<indent>\s*)(?P<key>[\w-]+):\s*(?P<value>.*?)\s*$")
_ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
_NPX_SKILL_LINE = re.compile(r"^[|│]\s{4}(?P<name>[a-z0-9][a-z0-9-]*)\s*$")


@dataclass(frozen=True)
class Skill:
    name: str
    path: Path
    targets: frozenset[str]


@dataclass(frozen=True)
class Change:
    """One difference between the tree and the build, and how to fix it."""

    message: str
    apply: Callable[[], None]


def _rel(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def _metadata(skill_file: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Top-level and ``metadata`` string fields of a ``SKILL.md`` frontmatter."""
    match = _FRONTMATTER.match(skill_file.read_text(encoding="utf-8"))
    top: dict[str, str] = {}
    metadata: dict[str, str] = {}
    if not match:
        return top, metadata
    in_metadata = False
    for line in match.group(1).splitlines():
        parsed = _KEY_VALUE.match(line)
        if not parsed:
            continue
        value = parsed["value"].strip("'\"")
        if not parsed["indent"]:
            in_metadata = parsed["key"] == "metadata"
            top[parsed["key"]] = value
        elif in_metadata:
            metadata[parsed["key"]] = value
    return top, metadata


def _skill_dirs(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(path for path in root.iterdir() if (path / SKILL_FILE).is_file())


def load_public_skills(errors: list[str]) -> list[Skill]:
    skills = []
    for directory in _skill_dirs(PUBLIC_ROOT):
        top, metadata = _metadata(directory / SKILL_FILE)
        where = _rel(directory / SKILL_FILE)
        if top.get("name") != directory.name:
            errors.append(f"{where}: name must match its folder, {directory.name!r}")
        targets = frozenset(metadata.get("targets", "").split())
        if not targets:
            errors.append(f'{where}: needs metadata.targets, e.g. targets: "agents mcp"')
        elif unknown := targets - TARGETS:
            errors.append(f"{where}: unknown targets {sorted(unknown)}; use {sorted(TARGETS)}")
        skills.append(Skill(name=directory.name, path=directory, targets=targets & TARGETS))
    return skills


def _files(root: Path) -> set[Path]:
    return {path.relative_to(root) for path in root.rglob("*") if path.is_file()}


def _copy_matches(source: Path, dest: Path) -> bool:
    if not dest.is_dir() or dest.is_symlink():
        return False
    files = _files(source)
    if files != _files(dest):
        return False
    return all(filecmp.cmp(source / f, dest / f, shallow=False) for f in files)


def _replace_with_copy(source: Path, dest: Path) -> Callable[[], None]:
    def apply() -> None:
        _remove(dest)
        shutil.copytree(source, dest)

    return apply


def _remove(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def copies(root: Path, skills: list[Skill]) -> Iterator[Change]:
    """``root/<name>`` is an exact copy of each skill; other skill folders go away."""
    wanted = {skill.name: skill for skill in skills}
    for directory in _skill_dirs(root):
        if directory.name not in wanted:
            yield Change(
                f"{_rel(directory)}: remove, not in skills/ for this target",
                partial(_remove, directory),
            )
    for name, skill in wanted.items():
        dest = root / name
        if not _copy_matches(skill.path, dest):
            yield Change(
                f"{_rel(dest)}: copy from {_rel(skill.path)}", _replace_with_copy(skill.path, dest)
            )


def _link_target(link: Path, skill: Skill) -> str:
    return os.path.relpath(skill.path, link.parent)


def _replace_with_link(link: Path, target: str) -> Callable[[], None]:
    def apply() -> None:
        _remove(link)
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to(target, target_is_directory=True)

    return apply


def links(root: Path, skills: list[Skill], *, prune: Callable[[Path], bool]) -> Iterator[Change]:
    """``root/<name>`` links to each skill; entries ``prune`` matches and no skill wants go."""
    wanted = {skill.name: skill for skill in skills}
    if root.is_dir():
        for entry in sorted(root.iterdir()):
            if entry.name not in wanted and prune(entry):
                yield Change(
                    f"{_rel(entry)}: remove, not a public skill for this target",
                    partial(_remove, entry),
                )
    for name, skill in wanted.items():
        link = root / name
        target = _link_target(link, skill)
        if not (link.is_symlink() and os.readlink(link) == target):
            yield Change(f"{_rel(link)}: link to {target}", _replace_with_link(link, target))


def _points_into_public_root(entry: Path) -> bool:
    if not entry.is_symlink():
        return False
    return Path(os.path.realpath(entry)).parent == PUBLIC_ROOT.resolve()


def cursor_manifest(skills: list[Skill]) -> Iterator[Change]:
    manifest = json.loads(CURSOR_MANIFEST.read_text(encoding="utf-8"))
    wanted = [_rel(skill.path) for skill in skills]
    if manifest.get("skills") != wanted:

        def apply() -> None:
            manifest["skills"] = wanted
            CURSOR_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

        yield Change(f"{_rel(CURSOR_MANIFEST)}: set skills to {wanted}", apply)


def _mark_internal(skill_file: Path) -> Callable[[], None]:
    def apply() -> None:
        text = skill_file.read_text(encoding="utf-8")
        match = _FRONTMATTER.match(text)
        assert match
        lines = match.group(1).splitlines()
        if "metadata:" in lines:
            lines.insert(lines.index("metadata:") + 1, "  internal: true")
        else:
            lines += ["metadata:", "  internal: true"]
        skill_file.write_text(
            "---\n" + "\n".join(lines) + "\n---\n" + text[match.end() :], encoding="utf-8"
        )

    return apply


def contributor_skills(public: list[Skill], errors: list[str]) -> Iterator[Change]:
    """Every real skill folder in ``.agents/skills/`` is vendored or marked internal."""
    vendored = set(json.loads(VENDORED_LOCKFILE.read_text(encoding="utf-8"))["skills"])
    public_names = {skill.name for skill in public}
    for directory in _skill_dirs(CONTRIBUTOR_ROOT):
        if directory.is_symlink():
            continue  # links to skills/, checked by links()
        if directory.name in public_names:
            errors.append(f"{_rel(directory)}: also in skills/; keep one copy")
        elif directory.name not in vendored:
            skill_file = directory / SKILL_FILE
            if _metadata(skill_file)[1].get("internal") != "true":
                yield Change(
                    f"{_rel(skill_file)}: add metadata.internal: true", _mark_internal(skill_file)
                )


def pxi_names_are_unique(public: list[Skill], errors: list[str]) -> None:
    for directory in _skill_dirs(PXI_ROOT):
        if any(skill.name == directory.name for skill in public):
            errors.append(f"{_rel(directory)}: name is also used in skills/; rename one")


def build(errors: list[str]) -> list[Change]:
    public = load_public_skills(errors)
    pxi_names_are_unique(public, errors)

    def targeted(target: str) -> list[Skill]:
        return [skill for skill in public if target in skill.targets]

    changes = [
        *copies(MCP_ROOT, targeted("mcp")),
        *copies(PXI_PUBLIC_ROOT, targeted("pxi")),
        *(
            change
            for root in PLUGIN_SKILL_ROOTS
            for change in links(root, targeted("agents"), prune=lambda entry: True)
        ),
        *cursor_manifest(targeted("agents")),
        *links(CONTRIBUTOR_ROOT, public, prune=_points_into_public_root),
        *contributor_skills(public, errors),
    ]
    return changes


def npx_listed_skills() -> set[str]:
    result = subprocess.run(
        ["npx", "--yes", "skills", "add", ".", "--list"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    lines = _ANSI.sub("", result.stdout + result.stderr).splitlines()
    return {match["name"] for line in lines if (match := _NPX_SKILL_LINE.match(line))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="change nothing; fail on drift")
    parser.add_argument("--npx", action="store_true", help="also check `npx skills add . --list`")
    args = parser.parse_args()

    errors: list[str] = []
    changes = build(errors)
    if args.check:
        errors += [f"out of date: {change.message}" for change in changes]
    else:
        for change in changes:
            change.apply()
            print(change.message)
    if args.npx:
        expected = {directory.name for directory in _skill_dirs(PUBLIC_ROOT)}
        listed = npx_listed_skills()
        if listed != expected:
            errors.append(
                "`npx skills add . --list` must list exactly skills/: "
                f"extra {sorted(listed - expected)}, missing {sorted(expected - listed)}"
            )
    for error in errors:
        print(error, file=sys.stderr)
    if errors and args.check:
        print(
            "Run `make skills` to rebuild the copies, then fix any remaining errors.",
            file=sys.stderr,
        )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
