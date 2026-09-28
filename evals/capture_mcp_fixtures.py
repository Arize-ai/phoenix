"""Capture the real code-mode tools/list and skill responses without a live database.

Uses the checked-in REST schema and the production MCP builder. Only discovery and
skill reads are called; application data used by cases is separately hand-authored.
Run with ``make skill-evals-capture-mcp`` after changing the MCP surface or shared skill.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, NoReturn, cast

import yaml
from fastapi import FastAPI
from fastmcp import Client

from phoenix.server.mcp.skills import SHARED_SKILLS_ROOT
from phoenix.server.mcp_server import build_phoenix_mcp_server
from phoenix.server.monty_runtime import MontyRuntime
from phoenix.server.types import DbSessionFactory

ROOT = Path(__file__).resolve().parents[1]
MOCKS = ROOT / "plugins/claude/arize-phoenix/evals/mocks/phoenix"


def _unused_db() -> NoReturn:
    raise AssertionError("Fixture capture must not access a database")


async def capture() -> None:
    class SchemaApp(FastAPI):
        def openapi(self) -> dict[str, Any]:
            schema: dict[str, Any] = json.loads(
                (ROOT / "schemas/openapi.json").read_text(encoding="utf-8")
            )
            return schema

    app = SchemaApp()
    async with MontyRuntime() as runtime:
        server, _ = build_phoenix_mcp_server(
            app,
            monty_runtime=runtime,
            code_mode=True,
            db=cast(DbSessionFactory, _unused_db),
            skills_roots=(SHARED_SKILLS_ROOT,),
        )
        async with Client(server) as client:
            tools = await client.list_tools()
            payload = {
                "tools": [
                    tool.model_dump(mode="json", by_alias=True, exclude_none=True) for tool in tools
                ]
            }
            (MOCKS / "_tools.json").write_text(
                json.dumps(payload, indent=2) + "\n", encoding="utf-8"
            )
            result = await client.call_tool("load_skill", {"skill_name": "phoenix-error-analysis"})
            text = "\n".join(part.text for part in result.content if part.type == "text")
            frontmatter = yaml.safe_dump({"expect": {"skill_name": ["phoenix-error-analysis"]}})
            (MOCKS / "load_skill.md").write_text(
                f"---\n{frontmatter}---\n{text.rstrip()}\n", encoding="utf-8"
            )
            # Keep discovery grounded in the same REST schema as the server.
            result = await client.call_tool(
                "get_schema", {"tools": ["getProjects"], "detail": "full"}
            )
            text = "\n".join(part.text for part in result.content if part.type == "text")
            if "Tools not found" in text:
                raise RuntimeError(text)
            frontmatter = yaml.safe_dump({"expect": {"tools.0": ["getProjects"]}})
            (MOCKS / "get_schema.md").write_text(
                f"---\n{frontmatter}---\n{text.rstrip()}\n", encoding="utf-8"
            )
    print(f"Captured {len(tools)} MCP tools and the shared skill into {MOCKS}")


if __name__ == "__main__":
    asyncio.run(capture())
