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

        assert "<available_skills>" in instructions
        for skill in load_skills(PXI_SKILLS_ROOTS):
            assert f"<name>{skill.name}</name>" in instructions
            assert f"<description>{skill.description}</description>" in instructions
        assert "`load_skill`" in instructions
        assert "`load_skill_reference`" in instructions

    async def test_no_roots_means_no_skills(self) -> None:
        mcp, _ = build_phoenix_mcp_server(
            FastAPI(), code_mode=False, read_only=True, db=_unused_db()
        )
        async with Client(mcp) as client:
            assert client.initialize_result is not None
            assert client.initialize_result.instructions is None
            names = {tool.name for tool in await client.list_tools()}
            assert names.isdisjoint({"load_skill", "load_skill_reference"})


class TestTools:
    async def test_load_skill_returns_the_file_verbatim(self) -> None:
        async with Client(_server(PXI_SKILLS_ROOT)) as client:
            loaded = await _text(client, "load_skill", skill_name="phoenix-graphql")

        assert loaded == (_GRAPHQL_SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")

    async def test_load_skill_reference_returns_the_file(self) -> None:
        async with Client(_server(PXI_SKILLS_ROOT)) as client:
            content = await _text(
                client,
                "load_skill_reference",
                skill_name="phoenix-graphql",
                reference_name="references/datasets.md",
            )

        expected = (_GRAPHQL_SKILL_DIR / "references" / "datasets.md").read_text(encoding="utf-8")
        assert content == expected

    async def test_unknown_names_are_errors_that_say_what_exists(self) -> None:
        async with Client(_server(PXI_SKILLS_ROOT)) as client:
            with pytest.raises(ToolError, match="phoenix-graphql"):
                await client.call_tool("load_skill", {"skill_name": "nope"})
            with pytest.raises(ToolError, match="references/datasets.md"):
                await client.call_tool(
                    "load_skill_reference",
                    {"skill_name": "phoenix-graphql", "reference_name": "nope"},
                )

    async def test_the_parameter_schemas_enumerate_the_catalog(self) -> None:
        async with Client(_server(*PXI_SKILLS_ROOTS)) as client:
            tools = {tool.name: tool for tool in await client.list_tools()}

        skills = load_skills(PXI_SKILLS_ROOTS)
        skill_names = [skill.name for skill in skills]
        load_params = tools["load_skill"].inputSchema["properties"]
        read_params = tools["load_skill_reference"].inputSchema["properties"]
        assert load_params["skill_name"]["enum"] == skill_names
        assert read_params["skill_name"]["enum"] == skill_names
        assert read_params["reference_name"]["enum"] == sorted(
            {r.name for skill in skills for r in skill.references}
        )
        assert "references/datasets.md" in read_params["reference_name"]["enum"]
        for tool in ("load_skill", "load_skill_reference"):
            assert tools[tool].annotations is not None
            assert tools[tool].annotations.readOnlyHint is True

    async def test_a_catalog_without_references_leaves_the_reference_name_open(
        self, tmp_path: Path
    ) -> None:
        _write_skill(tmp_path / "a-skill")
        async with Client(_server(tmp_path)) as client:
            tools = {tool.name: tool for tool in await client.list_tools()}

        read_params = tools["load_skill_reference"].inputSchema["properties"]
        assert read_params["skill_name"]["enum"] == ["a-skill"]
        assert "enum" not in read_params["reference_name"]

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

        assert {"execute", "search", "load_skill", "load_skill_reference"} <= names
        assert "load_skill" not in catalog
        assert "load_skill_reference" not in catalog
        assert loaded.startswith("---\nname: datasets")


class TestLoadSkills:
    def test_pxi_skills_are_by_name_and_exclude_the_general_root(self) -> None:
        names = [skill.name for skill in load_skills(PXI_SKILLS_ROOTS)]
        general = [skill.name for skill in load_skills((GENERAL_SKILLS_ROOT,))]
        pxi = [skill.name for skill in load_skills((PXI_SKILLS_ROOT,))]

        assert names == pxi
        assert names == sorted(names)
        assert {"phoenix-graphql", "datasets"} <= set(names)
        assert general == ["project-overview"]
        assert not set(general) & set(names)

    def test_references_are_named_by_their_path_from_the_skill_root(self, tmp_path: Path) -> None:
        _write_skill(tmp_path / "a-skill")
        (tmp_path / "a-skill" / "references" / "nested").mkdir(parents=True)
        (tmp_path / "a-skill" / "references" / "top.md").write_text("top")
        (tmp_path / "a-skill" / "references" / "nested" / "deep.md").write_text("deep")
        (tmp_path / "a-skill" / "scripts").mkdir()
        (tmp_path / "a-skill" / "scripts" / "run.py").write_text("print()")

        skill = Skill.from_directory(tmp_path / "a-skill")

        assert [reference.name for reference in skill.references] == [
            "references/nested/deep.md",
            "references/top.md",
        ]
        assert skill.get_reference("references/nested/deep.md") is not None
        assert skill.get_reference("references/nested/deep.md").read() == "deep"  # type: ignore[union-attr]

    def test_a_directory_without_a_skill_file_is_not_a_skill(self, tmp_path: Path) -> None:
        _write_skill(tmp_path / "a-skill")
        (tmp_path / "notes").mkdir()
        (tmp_path / "README.md").write_text("about these skills")

        assert [skill.name for skill in load_skills((tmp_path,))] == ["a-skill"]

    def test_roots_with_no_skills_are_refused(self, tmp_path: Path) -> None:
        (tmp_path / "notes").mkdir()

        with pytest.raises(ValueError, match="No skills found under"):
            load_skills((tmp_path,))

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
                "---\nname: a-skill\ndescription: d\nsummary: ''\n---\n",
                "'summary' must be a non-empty string",
                id="blank-summary",
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

    def test_summary_is_the_description_when_it_fits(self, tmp_path: Path) -> None:
        directory = tmp_path / "a-skill"
        directory.mkdir()
        (directory / "SKILL.md").write_text(
            "---\nname: a-skill\ndescription: Short enough to stand as its own summary.\n---\n"
        )

        skill = Skill.from_directory(directory)

        assert skill.summary == "Short enough to stand as its own summary."

    def test_summary_truncates_a_long_description_at_a_word(self, tmp_path: Path) -> None:
        directory = tmp_path / "a-skill"
        directory.mkdir()
        description = " ".join(f"word{i}," for i in range(40))
        (directory / "SKILL.md").write_text(
            f"---\nname: a-skill\ndescription: {description}\n---\n"
        )

        skill = Skill.from_directory(directory)

        assert len(skill.summary) <= 140
        assert skill.summary.endswith("…")
        assert not skill.summary.endswith(",…")
        assert skill.summary[:-1] in description
        assert skill.description == description

    def test_an_explicit_summary_wins_over_the_derived_one(self, tmp_path: Path) -> None:
        _write_skill(tmp_path / "a-skill")

        assert Skill.from_directory(tmp_path / "a-skill").summary == "s"

    def test_a_folded_description_collapses_to_one_line(self, tmp_path: Path) -> None:
        directory = tmp_path / "a-skill"
        directory.mkdir()
        (directory / "SKILL.md").write_text(
            "---\nname: a-skill\ndescription: >\n  first line\n  second line\n"
            "summary: s\n---\n\nbody\n"
        )

        skill = Skill.from_directory(directory)

        assert skill.description == "first line second line"


def _write_skill(directory: Path) -> None:
    directory.mkdir(parents=True)
    (directory / "SKILL.md").write_text(
        f"---\nname: {directory.name}\ndescription: d\nsummary: s\n---\n\nbody\n"
    )
