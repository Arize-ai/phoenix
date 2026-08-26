"""Skills served by the Phoenix MCP server.

A skill is a folder holding a ``SKILL.md`` (frontmatter plus instructions) and
any supporting files. FastMCP publishes each as ``skill://<name>/...`` resources.

Skills live in two roots because the server has two kinds of consumer: coding
agents connected at the ``/mcp`` mount, and the PXI agent running in-process.
:data:`GENERAL_SKILLS_ROOT` holds skills that assume nothing beyond the MCP
surface and reach every consumer. :data:`PXI_SKILLS_ROOT` holds skills that
lean on PXI-only affordances (its bash tools, ``ui.*`` operations) and reach
only the in-process server.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from fastmcp.server.providers.skills import SkillsDirectoryProvider

_SERVER_DIR = Path(__file__).resolve().parents[2]

#: Skills every consumer receives.
GENERAL_SKILLS_ROOT = Path(__file__).resolve().parent / "general"

#: Skills only the in-process PXI agent receives.
PXI_SKILLS_ROOT = _SERVER_DIR / "agents" / "prompts" / "skills"


def build_skills_provider(roots: Sequence[Path]) -> SkillsDirectoryProvider:
    """Publish every skill folder under ``roots``; on a name clash the earlier root wins."""
    return SkillsDirectoryProvider(
        roots=roots,
        # Coding-agent clients browse ``resources/list`` and rarely expand
        # templates, so each supporting file is listed outright.
        supporting_files="resources",
    )


__all__ = [
    "GENERAL_SKILLS_ROOT",
    "PXI_SKILLS_ROOT",
    "build_skills_provider",
]
