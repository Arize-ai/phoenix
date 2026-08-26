"""Tests for the skills the MCP server serves.

Which skills a consumer sees is decided by the roots its server is built with:
the mount receives the general root alone; the in-process agent adds its own.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastmcp import Client, FastMCP
from fastmcp.exceptions import ToolError

from phoenix.server.mcp.skills import (
    GENERAL_SKILLS_ROOT,
    PXI_SKILLS_ROOT,
    PXI_SKILLS_ROOTS,
    Skill,
    load_skills,
)
from phoenix.server.mcp_server import build_phoenix_mcp_server
from phoenix.server.monty_runtime import MontyRuntime
from phoenix.server.types import DbSessionFactory

_GRAPHQL_SKILL_DIR = PXI_SKILLS_ROOT / "phoenix-graphql"


def _unused_db() -> DbSessionFactory:
    def _never(*_: object, **__: object) -> Any:
        raise AssertionError("this test must not open a database session")

    return DbSessionFactory(db=_never, dialect="sqlite")


def _server(*roots: Path, **kwargs: Any) -> FastMCP:
    mcp, _ = build_phoenix_mcp_server(
        FastAPI(), code_mode=False, read_only=True, db=_unused_db(), skills_roots=roots, **kwargs
    )
    return mcp


async def _text(client: Client[Any], tool: str, **arguments: Any) -> str:
    result = await client.call_tool(tool, arguments)
    return "".join(getattr(block, "text", "") for block in result.content)


class TestHandshake:
    async def test_lists_every_skill_with_its_trigger_guidance(self) -> None:
        async with Client(_server(*PXI_SKILLS_ROOTS)) as client:
            assert client.initialize_result is not None
            instructions = client.initialize_result.instructions or ""

        assert "Available skills:" in instructions
        for skill in load_skills(PXI_SKILLS_ROOTS):
            assert f"- {skill.name}: {skill.description}" in instructions
        assert "`load_skill`" in instructions
        assert "`read_skill_resource`" in instructions

    async def test_the_default_roots_withhold_pxi_skills(self) -> None:
        mcp, _ = build_phoenix_mcp_server(
            FastAPI(), code_mode=False, read_only=True, db=_unused_db()
        )
        async with Client(mcp) as client:
            assert client.initialize_result is not None
            instructions = client.initialize_result.instructions or ""
            assert "- project-overview: " in instructions
            assert "phoenix-graphql" not in instructions
            with pytest.raises(ToolError, match="Unknown skill 'phoenix-graphql'"):
                await client.call_tool("load_skill", {"skill_name": "phoenix-graphql"})


class TestTools:
    async def test_load_skill_returns_the_file_and_names_its_resources(self) -> None:
        async with Client(_server(PXI_SKILLS_ROOT)) as client:
            loaded = await _text(client, "load_skill", skill_name="phoenix-graphql")

        skill_md = (_GRAPHQL_SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        assert loaded.startswith(skill_md.rstrip())
        assert 'read_skill_resource(skill_name="phoenix-graphql"' in loaded
        assert "- datasets.md" in loaded

    async def test_load_skill_returns_a_resourceless_skill_verbatim(self) -> None:
        async with Client(_server(PXI_SKILLS_ROOT)) as client:
            loaded = await _text(client, "load_skill", skill_name="datasets")

        assert loaded == (PXI_SKILLS_ROOT / "datasets" / "SKILL.md").read_text(encoding="utf-8")

    async def test_read_skill_resource_returns_the_file(self) -> None:
        async with Client(_server(PXI_SKILLS_ROOT)) as client:
            content = await _text(
                client,
                "read_skill_resource",
                skill_name="phoenix-graphql",
                resource_name="datasets.md",
            )

        expected = (_GRAPHQL_SKILL_DIR / "resources" / "datasets.md").read_text(encoding="utf-8")
        assert content == expected

    async def test_unknown_names_are_errors_that_say_what_exists(self) -> None:
        async with Client(_server(PXI_SKILLS_ROOT)) as client:
            with pytest.raises(ToolError, match="phoenix-graphql"):
                await client.call_tool("load_skill", {"skill_name": "nope"})
            with pytest.raises(ToolError, match="datasets.md"):
                await client.call_tool(
                    "read_skill_resource",
                    {"skill_name": "phoenix-graphql", "resource_name": "nope"},
                )

    async def test_the_skill_name_schema_enumerates_the_catalog(self) -> None:
        async with Client(_server(*PXI_SKILLS_ROOTS)) as client:
            tools = {tool.name: tool for tool in await client.list_tools()}

        load_skill = tools["load_skill"]
        assert load_skill.inputSchema["properties"]["skill_name"]["enum"] == [
            skill.name for skill in load_skills(PXI_SKILLS_ROOTS)
        ]
        assert load_skill.annotations is not None
        assert load_skill.annotations.readOnlyHint is True
        assert tools["read_skill_resource"].annotations is not None
        assert tools["read_skill_resource"].annotations.readOnlyHint is True

    async def test_the_skill_tools_stay_direct_under_code_mode(self) -> None:
        """Code mode folds the catalog behind ``execute``; the skill tools are
        the exception, and in exchange leave the catalog ``execute`` reaches."""
        runtime = MontyRuntime()
        try:
            mcp, _ = build_phoenix_mcp_server(
                FastAPI(),
                monty_runtime=runtime,
                code_mode=True,
                read_only=True,
                db=_unused_db(),
                skills_roots=PXI_SKILLS_ROOTS,
            )
            async with Client(mcp) as client:
                names = {tool.name for tool in await client.list_tools()}
                catalog = await _text(client, "list_tools")
                loaded = await _text(client, "load_skill", skill_name="datasets")
        finally:
            await runtime.aclose()

        assert {"execute", "search", "load_skill", "read_skill_resource"} <= names
        assert "load_skill" not in catalog
        assert "read_skill_resource" not in catalog
        assert loaded.startswith("---\nname: datasets")


class TestLoadSkills:
    def test_general_skills_precede_pxi_skills_and_each_root_is_by_name(self) -> None:
        names = [skill.name for skill in load_skills(PXI_SKILLS_ROOTS)]
        general = [skill.name for skill in load_skills((GENERAL_SKILLS_ROOT,))]
        pxi = [skill.name for skill in load_skills((PXI_SKILLS_ROOT,))]

        assert names == general + pxi
        assert general == sorted(general)
        assert pxi == sorted(pxi)
        assert {"phoenix-graphql", "datasets"} <= set(pxi)

    def test_resources_are_named_by_their_path_under_resources(self, tmp_path: Path) -> None:
        _write_skill(tmp_path / "a-skill")
        (tmp_path / "a-skill" / "resources" / "nested").mkdir(parents=True)
        (tmp_path / "a-skill" / "resources" / "top.md").write_text("top")
        (tmp_path / "a-skill" / "resources" / "nested" / "deep.md").write_text("deep")

        skill = Skill.from_directory(tmp_path / "a-skill")

        assert [resource.name for resource in skill.resources] == ["nested/deep.md", "top.md"]
        assert skill.resource("nested/deep.md") is not None
        assert skill.resource("nested/deep.md").read() == "deep"  # type: ignore[union-attr]

    def test_a_directory_without_a_skill_file_is_not_a_skill(self, tmp_path: Path) -> None:
        _write_skill(tmp_path / "a-skill")
        (tmp_path / "notes").mkdir()
        (tmp_path / "README.md").write_text("about these skills")

        assert [skill.name for skill in load_skills((tmp_path,))] == ["a-skill"]

    def test_a_name_defined_in_two_roots_is_refused(self, tmp_path: Path) -> None:
        _write_skill(tmp_path / "one" / "a-skill")
        _write_skill(tmp_path / "two" / "a-skill")

        with pytest.raises(ValueError, match="'a-skill' is defined in both"):
            load_skills((tmp_path / "one", tmp_path / "two"))

    @pytest.mark.parametrize(
        "text, message",
        [
            pytest.param("# no frontmatter\n", "must open with", id="no-frontmatter"),
            pytest.param("---\nname: a-skill\n", "never closed", id="unclosed-fence"),
            pytest.param("---\n- a list\n---\n", "must be a mapping", id="not-a-mapping"),
            pytest.param(
                "---\nname: other\ndescription: d\nsummary: s\n---\n",
                "does not match its directory",
                id="name-mismatch",
            ),
            pytest.param(
                "---\nname: a-skill\nsummary: s\n---\n", "non-empty 'description'", id="no-desc"
            ),
            pytest.param(
                "---\nname: a-skill\ndescription: d\n---\n", "non-empty 'summary'", id="no-summary"
            ),
        ],
    )
    def test_malformed_frontmatter_is_refused(
        self, tmp_path: Path, text: str, message: str
    ) -> None:
        directory = tmp_path / "a-skill"
        directory.mkdir()
        (directory / "SKILL.md").write_text(text)

        with pytest.raises(ValueError, match=message):
            Skill.from_directory(directory)

    def test_a_folded_description_collapses_to_one_line(self, tmp_path: Path) -> None:
        directory = tmp_path / "a-skill"
        directory.mkdir()
        (directory / "SKILL.md").write_text(
            "---\nname: a-skill\ndescription: >\n  first line\n  second line\n"
            "summary: s\n---\n\nbody\n"
        )

        skill = Skill.from_directory(directory)

        assert skill.description == "first line second line"
        assert skill.body == "body"
        assert skill.render() == skill.text


def _write_skill(directory: Path) -> None:
    directory.mkdir(parents=True)
    (directory / "SKILL.md").write_text(
        f"---\nname: {directory.name}\ndescription: d\nsummary: s\n---\n\nbody\n"
    )
