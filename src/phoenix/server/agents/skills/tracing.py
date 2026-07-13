from __future__ import annotations

from pathlib import Path
from typing import Any, TypeAlias

from phoenix.server.agents.capabilities.skills import (
    ContentSkillResource,
    Skill,
    SkillResource,
)

ResourceSpec: TypeAlias = tuple[str, str, str]

_SKILL_DIR = Path(__file__).resolve().parent.parent / "prompts" / "skills" / "tracing"
_SKILL_PATH = _SKILL_DIR / "SKILL.md"
_RESOURCES_DIR = _SKILL_DIR / "resources"

# Conceptual references for the Phoenix tracing data model, surfaced as on-demand
# skill resources so the top-level skill body stays small. Each entry is
# (resource name, short description shown in the load_skill manifest, filename).
_RESOURCE_SPECS: tuple[ResourceSpec, ...] = (
    (
        "span-kinds",
        "The span-kind taxonomy: what each OpenInference kind represents and when it appears.",
        "span-kinds.md",
    ),
    (
        "semantic-conventions",
        "Look up the attribute that carries a value: namespaces, flattening, and per-kind keys.",
        "semantic-conventions.md",
    ),
    (
        "token-cost-and-context",
        "Read token counts, cost, cumulative rollups, and reason about context-window usage.",
        "token-cost-and-context.md",
    ),
    (
        "annotations-and-notes",
        "Annotations as a source of truth (annotatorKind) and notes as open-coding.",
        "annotations-and-notes.md",
    ),
)


def _load_resources() -> list[SkillResource[Any]]:
    resources: list[SkillResource[Any]] = []
    for name, description, filename in _RESOURCE_SPECS:
        content = (_RESOURCES_DIR / filename).read_text(encoding="utf-8").strip()
        resources.append(ContentSkillResource(name=name, description=description, content=content))
    return resources


TRACING_SKILL = Skill.from_file(_SKILL_PATH, resources=_load_resources())
