"""Skills the Phoenix MCP server serves."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Optional

import yaml
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from fastmcp.tools.base import Tool
from mcp.types import ToolAnnotations
from pydantic import Field

from phoenix.server.agents.prompts.templating import get_template

_SERVER_DIR = Path(__file__).resolve().parents[2]

GENERAL_SKILLS_ROOT = Path(__file__).resolve().parent / "general"
PXI_SKILLS_ROOT = _SERVER_DIR / "agents" / "prompts" / "skills"
PXI_SKILLS_ROOTS: tuple[Path, ...] = (
    # GENERAL_SKILLS_ROOT,  # uncomment once it holds real skills, not a placeholder
    PXI_SKILLS_ROOT,
)

SKILL_TOOLS_TAG = "phoenix-mcp-skills"

_INSTRUCTIONS_TEMPLATE = get_template("skills/SKILLS_INSTRUCTIONS.xml.j2")

_SKILL_FILE = "SKILL.md"
_REFERENCES_DIR = "references"
_SUMMARY_MAX_CHARS = 140

_READ_ONLY = ToolAnnotations(
    readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False
)


@dataclass(frozen=True)
class SkillReference:
    """A file read on demand, named by its path from the skill root (``references/...``)."""

    name: str
    path: Path

    def read(self) -> str:
        return self.path.read_text(encoding="utf-8")


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    summary: str
    text: str
    path: Path
    references: tuple[SkillReference, ...] = ()

    @classmethod
    def from_directory(cls, directory: Path) -> Skill:
        """Read a skill laid out per https://agentskills.io/specification.

        A ``SKILL.md`` whose frontmatter names the skill and describes when to
        use it, plus an optional ``references/`` directory of files read on
        demand. Phoenix also reads an optional ``summary`` field, deriving one
        from the description when it is absent, and does not read ``scripts/``
        or ``assets/``.
        """
        skill_file = directory / _SKILL_FILE
        text = skill_file.read_text(encoding="utf-8")
        frontmatter = _parse_frontmatter(text, skill_file)
        if frontmatter.name != directory.name:
            raise ValueError(
                f"{skill_file}: name {frontmatter.name!r} does not match "
                f"its directory {directory.name!r}"
            )
        return cls(
            name=frontmatter.name,
            description=frontmatter.description,
            summary=frontmatter.summary,
            text=text,
            path=directory,
            references=_scan_references(directory),
        )

    def get_reference(self, name: str) -> Optional[SkillReference]:
        return next((r for r in self.references if r.name == name), None)


@dataclass(frozen=True)
class _Frontmatter:
    """A ``SKILL.md`` frontmatter, validated and normalized."""

    name: str
    description: str
    summary: str


def _parse_frontmatter(text: str, source: Path) -> _Frontmatter:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"{source}: must open with a '---' frontmatter fence")
    closing = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if closing is None:
        raise ValueError(f"{source}: frontmatter fence is never closed")
    mapping = yaml.safe_load("\n".join(lines[1:closing])) or {}
    if not isinstance(mapping, dict):
        raise ValueError(f"{source}: frontmatter must be a mapping")
    description = " ".join(_required_string(mapping, "description", source).split())
    summary = _get_frontmatter_value_if_exists_and_is_string(mapping, "summary", source)
    return _Frontmatter(
        name=_required_string(mapping, "name", source),
        description=description,
        summary=summary.strip() if summary else _truncate(description, _SUMMARY_MAX_CHARS),
    )


def _required_string(frontmatter: dict[str, Any], key: str, source: Path) -> str:
    value = frontmatter.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{source}: frontmatter needs a non-empty {key!r}")
    return value


def _get_frontmatter_value_if_exists_and_is_string(
    frontmatter: dict[str, Any],
    key: str,
    source: Path,
) -> Optional[str]:
    value = frontmatter.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{source}: frontmatter {key!r} must be a non-empty string if given")
    return value


def _truncate(text: str, max_chars: int) -> str:
    """``text`` cut to ``max_chars`` at a word boundary, ending in an ellipsis."""
    if len(text) <= max_chars:
        return text
    cut = text.rfind(" ", 0, max_chars)
    if cut <= 0:
        cut = max_chars - 1
    return text[:cut].rstrip(" ,;:.—-") + "…"


def _scan_references(skill_dir: Path) -> tuple[SkillReference, ...]:
    directory = skill_dir / _REFERENCES_DIR
    if not directory.is_dir():
        return ()
    return tuple(
        SkillReference(name=path.relative_to(skill_dir).as_posix(), path=path)
        for path in sorted(directory.rglob("*"))
        if path.is_file()
    )


@lru_cache(maxsize=None)
def load_skills(roots: tuple[Path, ...]) -> tuple[Skill, ...]:
    """Every skill under ``roots``: root order first, name order within a root."""
    skills: dict[str, Skill] = {}
    for root in roots:
        for directory in sorted(p for p in root.iterdir() if (p / _SKILL_FILE).is_file()):
            skill = Skill.from_directory(directory)
            if skill.name in skills:
                raise ValueError(
                    f"Skill {skill.name!r} is defined in both "
                    f"{skills[skill.name].path} and {directory}"
                )
            skills[skill.name] = skill
    if roots and not skills:
        raise ValueError(f"No skills found under {', '.join(str(root) for root in roots)}")
    return tuple(skills.values())


def get_skill_instructions(skills: Sequence[Skill]) -> str:
    """The ``initialize`` instructions: what exists, and how to use it.

    A client that honors instructions folds them into the model's system prompt,
    which is the one place a skill's trigger guidance can reach a model before
    the skill is loaded.
    """
    return _INSTRUCTIONS_TEMPLATE.render(skills=skills)


def register_skill_tools(mcp: FastMCP, skills: Sequence[Skill]) -> None:
    """Add ``load_skill`` and ``load_skill_reference`` over ``skills`` to ``mcp``."""
    by_name = {skill.name: skill for skill in skills}
    reference_names = sorted({r.name for skill in skills for r in skill.references})

    def _skill(skill_name: str) -> Skill:
        skill = by_name.get(skill_name)
        if skill is None:
            raise ToolError(
                f"Unknown skill {skill_name!r}. Available skills: {', '.join(by_name)}."
            )
        return skill

    async def load_skill(
        skill_name: Annotated[str, Field(description="Exact name of the skill to load.")],
    ) -> str:
        return _skill(skill_name).text

    async def load_skill_reference(
        skill_name: Annotated[str, Field(description="Skill the reference belongs to.")],
        reference_name: Annotated[
            str, Field(description="Reference name exactly as listed by `load_skill`.")
        ],
    ) -> str:
        skill = _skill(skill_name)
        reference = skill.get_reference(reference_name)
        if reference is None:
            available = ", ".join(r.name for r in skill.references) or "none"
            raise ToolError(
                f"Skill {skill.name!r} has no reference {reference_name!r}. "
                f"Available references: {available}."
            )
        return reference.read()

    load = Tool.from_function(
        load_skill,
        description=(
            "Load a Phoenix skill's instructions. Call this before working in a skill's "
            "domain, once per skill per conversation, and follow what it returns."
        ),
        tags={SKILL_TOOLS_TAG},
        annotations=_READ_ONLY,
        output_schema=None,
    )
    read = Tool.from_function(
        load_skill_reference,
        description=(
            "Load a reference file of a skill already loaded with `load_skill`, "
            "using the exact skill and reference names that load listed."
        ),
        tags={SKILL_TOOLS_TAG},
        annotations=_READ_ONLY,
        output_schema=None,
    )
    mcp.add_tool(_set_parameter_enums(load, skill_name=list(by_name)))
    mcp.add_tool(
        _set_parameter_enums(read, skill_name=list(by_name), reference_name=reference_names)
    )


def _set_parameter_enums(tool: Tool, **values: Sequence[str]) -> Tool:
    """Constrain ``tool``'s named string parameters to ``values`` in its schema.

    A parameter with no values is left open: an empty ``enum`` is invalid.
    """
    for name, allowed in values.items():
        if allowed:
            tool.parameters["properties"][name]["enum"] = list(allowed)
    return tool


__all__ = [
    "GENERAL_SKILLS_ROOT",
    "PXI_SKILLS_ROOT",
    "PXI_SKILLS_ROOTS",
    "SKILL_TOOLS_TAG",
    "Skill",
    "SkillReference",
    "load_skills",
    "register_skill_tools",
    "get_skill_instructions",
]
