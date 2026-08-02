from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

_OMIT: Any = object()
"""Distinguishes "use the default" from an explicit ``None`` meaning "omit the field"."""


def write_skill(
    root: Path,
    *,
    directory: str,
    name: str | None = _OMIT,
    description: str | None = "Use when testing.",
    summary: str | None = "A test skill.",
    body: str = "Do the thing.",
    extra_frontmatter: str = "",
) -> Path:
    """Write a SKILL.md under ``root/directory`` and return its directory.

    ``name`` defaults to ``directory``, which is the valid case. Passing ``None`` for a
    frontmatter field omits it entirely, which is how the spec-optional fields are
    exercised.
    """
    resolved_name = directory if name is _OMIT else name
    skill_dir = root / directory
    skill_dir.mkdir(parents=True, exist_ok=True)
    lines = ["---"]
    if resolved_name is not None:
        lines.append(f"name: {resolved_name}")
    if description is not None:
        lines.append(f"description: {description}")
    if summary is not None:
        lines.append(f"summary: {summary}")
    if extra_frontmatter:
        lines.append(extra_frontmatter)
    lines.extend(["---", "", body, ""])
    (skill_dir / "SKILL.md").write_text("\n".join(lines), encoding="utf-8")
    return skill_dir


@pytest.fixture
def source_root(tmp_path: Path) -> Path:
    root = tmp_path / "skills"
    root.mkdir()
    return root
