from __future__ import annotations

from pathlib import Path
from typing import Any, TypeAlias

from phoenix.server.agents.capabilities.skills import (
    ContentSkillResource,
    Skill,
    SkillResource,
)

ResourceSpec: TypeAlias = tuple[str, str, str]

_SKILL_DIR = Path(__file__).resolve().parent.parent / "prompts" / "skills" / "phoenix-graphql"
_SKILL_PATH = _SKILL_DIR / "SKILL.md"
_RESOURCES_DIR = _SKILL_DIR / "resources"

# Per-domain schema references, surfaced as on-demand skill resources so the
# top-level skill body stays small. Each entry is (resource name, short
# description shown in the load_skill manifest, resource markdown filename).
_RESOURCE_SPECS: tuple[ResourceSpec, ...] = (
    (
        "project-spans-traces",
        "Project aggregates and spans; Span and Trace fields. Start here for trace analysis.",
        "project-spans-traces.md",
    ),
    (
        "sessions",
        "ProjectSession: multi-turn session metrics, token/cost, and session traces.",
        "sessions.md",
    ),
    (
        "datasets",
        "Dataset and DatasetExample reads and writes: versions, examples, and span ingestion.",
        "datasets.md",
    ),
    (
        "dataset-labels-splits",
        "Instance-wide dataset label/split vocabulary, assignment, and CRUD mutations.",
        "dataset-labels-splits.md",
    ),
    (
        "experiments",
        "Experiment and ExperimentRun reads, aggregate metrics, comparison, and edits.",
        "experiments.md",
    ),
    (
        "prompts",
        "Prompt and PromptVersion: versions, templates, and tags.",
        "prompts.md",
    ),
    (
        "annotations",
        "Annotation reads, batch span writes, and annotation-config mutations.",
        "annotations.md",
    ),
)


def _load_resources() -> list[SkillResource[Any]]:
    resources: list[SkillResource[Any]] = []
    for name, description, filename in _RESOURCE_SPECS:
        content = (_RESOURCES_DIR / filename).read_text(encoding="utf-8").strip()
        resources.append(ContentSkillResource(name=name, description=description, content=content))
    return resources


PHOENIX_GRAPHQL_SKILL = Skill.from_file(_SKILL_PATH, resources=_load_resources())
