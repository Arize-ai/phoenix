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

_SERVER_DIR = Path(__file__).resolve().parents[2]

GENERAL_SKILLS_ROOT = Path(__file__).resolve().parent / "general"
PXI_SKILLS_ROOT = _SERVER_DIR / "agents" / "prompts" / "skills"
PXI_SKILLS_ROOTS: tuple[Path, ...] = (GENERAL_SKILLS_ROOT, PXI_SKILLS_ROOT)

SKILL_TOOLS_TAG = "phoenix-mcp-skills"

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
        name = _required_string(frontmatter, "name", skill_file)
        if name != directory.name:
            raise ValueError(
                f"{skill_file}: name {name!r} does not match its directory {directory.name!r}"
            )
        description = " ".join(_required_string(frontmatter, "description", skill_file).split())
        summary = _get_frontmatter_value_if_exists_and_is_string(frontmatter, "summary", skill_file)
        return cls(
            name=name,
            description=description,
            summary=summary.strip() if summary else _truncate(description, _SUMMARY_MAX_CHARS),
            text=text,
            path=directory,
            references=_scan_references(directory),
        )

    def reference(self, name: str) -> Optional[SkillReference]:
        return next((r for r in self.references if r.name == name), None)

    def render(self) -> str:
        if not self.references:
            return self.text
        listing = "\n".join(f"- {reference.name}" for reference in self.references)
        return (
            f"{self.text.rstrip()}\n\n## References\n\n"
            f'Load one with `load_skill_reference(skill_name="{self.name}", reference_name=...)`:\n'
            f"{listing}\n"
        )


def _parse_frontmatter(text: str, source: Path) -> dict[str, Any]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"{source}: must open with a '---' frontmatter fence")
    closing = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if closing is None:
        raise ValueError(f"{source}: frontmatter fence is never closed")
    frontmatter = yaml.safe_load("\n".join(lines[1:closing])) or {}
    if not isinstance(frontmatter, dict):
        raise ValueError(f"{source}: frontmatter must be a mapping")
    return frontmatter


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
    listing = "\n".join(f"- {skill.name}: {skill.description}" for skill in skills)
    return (
        "Phoenix skills are instructions for working in a domain. Before working in a "
        "skill's domain, call `load_skill` with its name and follow what it returns.\n\n"
        f"Available skills:\n{listing}\n\n"
        "Load each skill at most once per conversation: if a successful load already "
        "appears in the conversation, reuse it. A loaded skill may list reference files; "
        "load one with `load_skill_reference`, using the exact names the skill lists."
    )


def register_skill_tools(mcp: FastMCP, skills: Sequence[Skill]) -> None:
    """Add ``load_skill`` and ``load_skill_reference`` over ``skills`` to ``mcp``.

    Both tools enumerate their parameters in the schema rather than listing
    them in a description, so a client can validate a call before making it.
    ``reference_name`` enumerates every skill's references at once: a
    per-skill conditional schema is not portable across the model providers
    clients hand tool schemas to, so a mismatched pair is caught at call time.
    """
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
        return _skill(skill_name).render()

    async def load_skill_reference(
        skill_name: Annotated[str, Field(description="Skill the reference belongs to.")],
        reference_name: Annotated[
            str, Field(description="Reference name exactly as listed by `load_skill`.")
        ],
    ) -> str:
        skill = _skill(skill_name)
        reference = skill.reference(reference_name)
        if reference is None:
            available = ", ".join(r.name for r in skill.references) or "none"
            raise ToolError(
                f"Skill {skill.name!r} has no reference {reference_name!r}. "
                f"Available references: {available}."
            )
        return reference.read()

    # `output_schema=None`: see `register_analytics_sql_tools` for the reasoning.
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
    mcp.add_tool(_enumerate(load, skill_name=list(by_name)))
    mcp.add_tool(_enumerate(read, skill_name=list(by_name), reference_name=reference_names))


def _enumerate(tool: Tool, **values: Sequence[str]) -> Tool:
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
