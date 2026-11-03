"""Reads and validates routing files, as specified in ``evals/skills/README.md``."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Literal, Optional

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

REPO_ROOT = Path(__file__).resolve().parents[3]
SKILLS_ROOT = REPO_ROOT / "skills"
ROUTING_ROOT = REPO_ROOT / "evals" / "skills"
ROUTING_FILE = "routing.yaml"

Channel = Literal["claude-code", "codex", "mcp", "pxi"]

# ``metadata.targets`` in a SKILL.md names where the skill ships. ``agents`` covers the
# coding-agent plugins; only Claude Code has a routing adapter among them.
_TARGET_CHANNELS: dict[str, tuple[Channel, ...]] = {
    "agents": ("claude-code",),
    "mcp": ("mcp",),
    "pxi": ("pxi",),
}

_LOAD_KINDS = frozenset({"explicit", "implicit", "contextual"})
_NO_LOAD_KINDS = frozenset({"sibling", "near-miss"})


class Thresholds(BaseModel):
    model_config = ConfigDict(extra="forbid")

    min_recall: float = Field(default=0.8, ge=0, le=1)
    max_false_load_rate: float = Field(default=0.1, ge=0, le=1)


class Case(BaseModel):
    """One query and whether it loads the skill."""

    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1)
    expect: Literal["load", "no-load"]
    kind: Literal["explicit", "implicit", "contextual", "sibling", "near-miss"]
    sibling: Optional[str] = None
    files: list[str] = Field(default_factory=list)
    split: Literal["train", "validation"] = "train"

    @model_validator(mode="after")
    def _check_kind(self) -> Case:
        kinds = _LOAD_KINDS if self.expect == "load" else _NO_LOAD_KINDS
        if self.kind not in kinds:
            raise ValueError(f"kind {self.kind!r} isn't valid with expect {self.expect!r}")
        if (self.kind == "sibling") != (self.sibling is not None):
            raise ValueError("set sibling exactly when kind is 'sibling'")
        return self

    @property
    def id(self) -> str:
        """A stable ID for the case, so re-recording a dataset updates it in place."""
        return hashlib.sha256(self.query.encode()).hexdigest()[:16]


class RoutingFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill: str
    channels: Optional[list[Channel]] = None
    thresholds: Thresholds = Field(default_factory=Thresholds)
    cases: list[Case] = Field(min_length=1)
    path: Path = Field(default=Path(), exclude=True)

    def resolved_channels(self) -> list[Channel]:
        """Returns the listed channels, or the channels from the skill's targets."""
        if self.channels is not None:
            return list(self.channels)
        channels: list[Channel] = []
        for target in skill_targets(self.skill):
            channels.extend(c for c in _TARGET_CHANNELS.get(target, ()) if c not in channels)
        return channels

    def case_files(self, case: Case) -> list[Path]:
        return [self.path.parent / name for name in case.files]


def skill_frontmatter(skill: str) -> dict[str, object]:
    text = (SKILLS_ROOT / skill / "SKILL.md").read_text(encoding="utf-8")
    _, frontmatter, _ = text.split("---", 2)
    loaded = yaml.safe_load(frontmatter)
    return loaded if isinstance(loaded, dict) else {}


def skill_targets(skill: str) -> list[str]:
    metadata = skill_frontmatter(skill).get("metadata") or {}
    targets = metadata.get("targets", "") if isinstance(metadata, dict) else ""
    return str(targets).split()


def load_routing_file(path: Path) -> RoutingFile:
    """Reads a routing file and checks it against the README's rules.

    Raises:
        ValueError: If the file breaks the format, names the wrong skill for its folder,
            or names a sibling that isn't a public skill.
    """
    routing = RoutingFile.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
    routing.path = path
    if routing.skill != path.parent.name:
        raise ValueError(f"{path}: skill {routing.skill!r} doesn't match its folder")
    if not (SKILLS_ROOT / routing.skill / "SKILL.md").is_file():
        raise ValueError(f"{path}: {routing.skill!r} isn't a skill in skills/")
    for case in routing.cases:
        if case.sibling and not (SKILLS_ROOT / case.sibling / "SKILL.md").is_file():
            raise ValueError(f"{path}: sibling {case.sibling!r} isn't a skill in skills/")
        for file in routing.case_files(case):
            if not file.exists():
                raise ValueError(f"{path}: case file {file} doesn't exist")
    return routing


def routing_files(skills: Optional[list[str]] = None) -> list[RoutingFile]:
    """Returns the routing files for the named skills, or for every skill that has one.

    Raises:
        FileNotFoundError: If a named skill has no routing file.
    """
    if skills is None:
        paths = sorted(ROUTING_ROOT.glob(f"*/{ROUTING_FILE}"))
    else:
        paths = [ROUTING_ROOT / skill / ROUTING_FILE for skill in skills]
        missing = [str(p) for p in paths if not p.is_file()]
        if missing:
            raise FileNotFoundError(f"no routing file: {', '.join(missing)}")
    return [load_routing_file(path) for path in paths]
