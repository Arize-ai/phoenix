from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, cast

from phoenix.server.agents.advertised_tools import resolve_advertised_tools
from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.context import ProjectContext, ResolvedContexts
from phoenix.server.agents.dependencies import ChatDependencies


class _DocsToolset:
    tool_prefix = ""

    async def list_tools(self) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(name="search_phoenix"),
            SimpleNamespace(name="query_docs_filesystem_phoenix"),
        ]


def test_resolve_advertised_tools_marks_docs_tools_as_server_executed() -> None:
    deps = ChatDependencies(
        contexts=ResolvedContexts(
            project=ProjectContext(
                type="project",
                projectNodeId="UHJvamVjdDox",
                spanFilter="",
                rootSpansOnly=False,
            )
        ),
        capabilities=AgentCapabilities(),
        docs_mcp_toolset=cast(Any, _DocsToolset()),
    )

    tools = asyncio.run(resolve_advertised_tools(deps))

    tools_by_name = {tool.name: tool for tool in tools}
    assert tools_by_name["bash"].execution == "browser"
    assert tools_by_name["set_spans_filter"].execution == "browser"
    assert tools_by_name["search_phoenix"].execution == "server"
    assert tools_by_name["query_docs_filesystem_phoenix"].execution == "server"
    assert tools_by_name["query_docs_filesystem_phoenix"].family == "docs"
