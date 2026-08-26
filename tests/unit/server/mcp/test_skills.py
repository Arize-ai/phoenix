"""Tests for the skills the MCP server publishes as ``skill://`` resources.

Which skills a consumer sees is decided by the roots its server is built with:
the mount receives the general root alone, the in-process agent adds its own.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastmcp import Client

from phoenix.server.mcp.skills import GENERAL_SKILLS_ROOT, PXI_SKILLS_ROOT
from phoenix.server.mcp_server import build_phoenix_mcp_server
from phoenix.server.types import DbSessionFactory


def _unused_db() -> DbSessionFactory:
    def _never(*_: object, **__: object) -> Any:
        raise AssertionError("this test must not open a database session")

    return DbSessionFactory(db=_never, dialect="sqlite")


async def _skill_uris(*roots: Path) -> set[str]:
    mcp, _ = build_phoenix_mcp_server(
        FastAPI(), code_mode=False, read_only=True, db=_unused_db(), skills_roots=roots
    )
    async with Client(mcp) as client:
        return {str(r.uri) for r in await client.list_resources() if r.uri.scheme == "skill"}


async def test_the_pxi_root_publishes_the_graphql_skill_and_its_supporting_files() -> None:
    uris = await _skill_uris(GENERAL_SKILLS_ROOT, PXI_SKILLS_ROOT)

    assert "skill://phoenix-graphql/SKILL.md" in uris
    assert "skill://phoenix-graphql/resources/datasets.md" in uris


async def test_the_default_roots_withhold_pxi_skills() -> None:
    uris = await _skill_uris(GENERAL_SKILLS_ROOT)

    assert not {u for u in uris if u.startswith("skill://phoenix-graphql/")}


async def test_reading_a_skill_returns_its_skill_md() -> None:
    mcp, _ = build_phoenix_mcp_server(
        FastAPI(),
        code_mode=False,
        read_only=True,
        db=_unused_db(),
        skills_roots=(PXI_SKILLS_ROOT,),
    )
    async with Client(mcp) as client:
        contents = await client.read_resource("skill://phoenix-graphql/SKILL.md")

    expected = (PXI_SKILLS_ROOT / "phoenix-graphql" / "SKILL.md").read_text(encoding="utf-8")
    assert getattr(contents[0], "text", None) == expected


async def test_the_handshake_tells_clients_where_skills_live() -> None:
    mcp, _ = build_phoenix_mcp_server(FastAPI(), code_mode=False, read_only=True, db=_unused_db())
    async with Client(mcp) as client:
        assert client.initialize_result is not None
        assert "skill://<name>/SKILL.md" in (client.initialize_result.instructions or "")
