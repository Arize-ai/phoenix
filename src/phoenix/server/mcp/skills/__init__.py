"""Skills served by the Phoenix MCP server.

A skill is a directory named for the skill, holding a ``SKILL.md`` — YAML
frontmatter above Markdown instructions — and, optionally, a ``resources/``
directory of supporting files. The frontmatter carries ``name`` (the directory
name), ``description`` (when to load the skill; advertised before it is
loaded) and ``summary`` (a one-line label for the assistant's skill picker).

The server advertises every skill's name and description in its ``initialize``
instructions, so a client learns what exists during the handshake, and serves
the rest on demand through two tools: ``load_skill`` returns a skill's full
instructions and ``read_skill_resource`` returns one of its supporting files.

Skills live in two roots because the server has two kinds of consumer: coding
agents connected at the ``/mcp`` mount, and the PXI agent running in-process.
:data:`GENERAL_SKILLS_ROOT` holds skills that assume nothing beyond the MCP
surface and reach every consumer. :data:`PXI_SKILLS_ROOT` holds skills that
lean on PXI-only affordances (its bash tools, ``ui.*`` operations) and reach
only the in-process server.
"""

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

#: Skills every consumer receives.
GENERAL_SKILLS_ROOT = Path(__file__).resolve().parent / "general"

#: Skills only the in-process PXI agent receives.
PXI_SKILLS_ROOT = _SERVER_DIR / "agents" / "prompts" / "skills"

#: Roots the in-process PXI server is built from, and so the catalog PXI's
#: skill picker and forced loads draw on.
PXI_SKILLS_ROOTS: tuple[Path, ...] = (GENERAL_SKILLS_ROOT, PXI_SKILLS_ROOT)

#: Tag on the skill tools. Code mode keeps tools carrying it on ``tools/list``.
SKILL_TOOLS_TAG = "phoenix-mcp-skills"

_SKILL_FILE = "SKILL.md"
_RESOURCES_DIR = "resources"

# Both tools only read files shipped with Phoenix, so a client may auto-approve them.
_READ_ONLY = ToolAnnotations(
    readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False
)


@dataclass(frozen=True)
class SkillResource:
    """A supporting file, named by its path under the skill's ``resources/``."""

    name: str
    path: Path

    def read(self) -> str:
        return self.path.read_text(encoding="utf-8")


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    summary: str
    #: ``SKILL.md`` verbatim, frontmatter included.
    text: str
    #: The instructions below the frontmatter.
    body: str
    path: Path
    resources: tuple[SkillResource, ...] = ()

    @classmethod
    def from_directory(cls, directory: Path) -> Skill:
        skill_file = directory / _SKILL_FILE
        text = skill_file.read_text(encoding="utf-8")
        frontmatter, body = _split_frontmatter(text, skill_file)
        name = _required_string(frontmatter, "name", skill_file)
        if name != directory.name:
            raise ValueError(
                f"{skill_file}: name {name!r} does not match its directory {directory.name!r}"
            )
        return cls(
            name=name,
            description=" ".join(_required_string(frontmatter, "description", skill_file).split()),
            summary=_required_string(frontmatter, "summary", skill_file).strip(),
            text=text,
            body=body,
            path=directory,
            resources=_scan_resources(directory / _RESOURCES_DIR),
        )

    def resource(self, name: str) -> Optional[SkillResource]:
        return next((r for r in self.resources if r.name == name), None)

    def render(self) -> str:
        """What ``load_skill`` returns: the file, then the resources it may read next."""
        if not self.resources:
            return self.text
        listing = "\n".join(f"- {resource.name}" for resource in self.resources)
        return (
            f"{self.text.rstrip()}\n\n## Resources\n\n"
            f'Read one with `read_skill_resource(skill_name="{self.name}", resource_name=...)`:\n'
            f"{listing}\n"
        )


def _split_frontmatter(text: str, source: Path) -> tuple[dict[str, Any], str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"{source}: must open with a '---' frontmatter fence")
    closing = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if closing is None:
        raise ValueError(f"{source}: frontmatter fence is never closed")
    frontmatter = yaml.safe_load("\n".join(lines[1:closing])) or {}
    if not isinstance(frontmatter, dict):
        raise ValueError(f"{source}: frontmatter must be a mapping")
    return frontmatter, "\n".join(lines[closing + 1 :]).strip()


def _required_string(frontmatter: dict[str, Any], key: str, source: Path) -> str:
    value = frontmatter.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{source}: frontmatter needs a non-empty {key!r}")
    return value


def _scan_resources(directory: Path) -> tuple[SkillResource, ...]:
    if not directory.is_dir():
        return ()
    return tuple(
        SkillResource(name=path.relative_to(directory).as_posix(), path=path)
        for path in sorted(directory.rglob("*"))
        if path.is_file()
    )


@lru_cache(maxsize=None)
def load_skills(roots: tuple[Path, ...]) -> tuple[Skill, ...]:
    """Every skill under ``roots``: root order first, name order within a root.

    Read once per process, so the handshake, the forced-load path and the skill
    picker all serve the same catalog.
    """
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
    return tuple(skills.values())


def skills_instructions(skills: Sequence[Skill]) -> str:
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
        "appears in the conversation, reuse it. A loaded skill may list resources; read "
        "one with `read_skill_resource`, using the exact names the skill lists."
    )


def register_skill_tools(mcp: FastMCP, skills: Sequence[Skill]) -> None:
    """Add ``load_skill`` and ``read_skill_resource`` over ``skills`` to ``mcp``."""
    by_name = {skill.name: skill for skill in skills}

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

    async def read_skill_resource(
        skill_name: Annotated[str, Field(description="Skill the resource belongs to.")],
        resource_name: Annotated[
            str, Field(description="Resource name exactly as listed by `load_skill`.")
        ],
    ) -> str:
        skill = _skill(skill_name)
        resource = skill.resource(resource_name)
        if resource is None:
            available = ", ".join(r.name for r in skill.resources) or "none"
            raise ToolError(
                f"Skill {skill.name!r} has no resource {resource_name!r}. "
                f"Available resources: {available}."
            )
        return resource.read()

    # `output_schema=None` drops the structured mirror of a prose result; see the
    # analytics SQL tools for the reasoning.
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
    # The catalog lives in the schema rather than the description: a client can
    # validate the name before the call, and nothing is restated per request.
    load.parameters["properties"]["skill_name"]["enum"] = list(by_name)
    mcp.add_tool(load)
    mcp.add_tool(
        Tool.from_function(
            read_skill_resource,
            description=(
                "Read a supporting file of a skill already loaded with `load_skill`, "
                "using the exact skill and resource names that load listed."
            ),
            tags={SKILL_TOOLS_TAG},
            annotations=_READ_ONLY,
            output_schema=None,
        )
    )


__all__ = [
    "GENERAL_SKILLS_ROOT",
    "PXI_SKILLS_ROOT",
    "PXI_SKILLS_ROOTS",
    "SKILL_TOOLS_TAG",
    "Skill",
    "SkillResource",
    "load_skills",
    "register_skill_tools",
    "skills_instructions",
]
