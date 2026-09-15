from __future__ import annotations

from pathlib import Path

import httpx2
import pytest
from fastapi import FastAPI
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

from phoenix.db.types.data_stream_protocol import UIMessage
from phoenix.server.agents.skill_requests import inject_requested_skills
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture(params=["all", "explicit"])
def mounted_skills(
    request: pytest.FixtureRequest, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> str:
    for name, metadata in [
        ("team-visible", "metadata:\n  arize-phoenix-visibility: visible\n"),
        ("team-unmarked", ""),
    ]:
        directory = tmp_path / name
        directory.mkdir()
        (directory / "SKILL.md").write_text(
            f"---\nname: {name}\ndescription: Team instructions\n{metadata}---\nTeam workflow\n"
        )
    monkeypatch.setenv("PHOENIX_SKILLS_PATHS", str(tmp_path))
    monkeypatch.setenv("PHOENIX_SKILLS_VISIBILITY", request.param)
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    monkeypatch.setattr("phoenix.server.mcp_server.get_env_mcp_code_mode", lambda: False)
    return str(request.param)


@pytest.mark.real_agent_mcp_server
async def test_mounted_skills_reach_mcp_pxi_picker_and_requested_loads(
    mounted_skills: str, gql_client: AsyncGraphQLClient, app: FastAPI
) -> None:
    response = await gql_client.execute(query="{ availableAgentSkills { name } }")
    assert not response.errors
    assert response.data is not None
    names = {skill["name"] for skill in response.data["availableAgentSkills"]}
    assert "team-visible" in names
    assert ("team-unmarked" in names) == (mounted_skills == "all")
    assert "datasets" in names

    async with Client(app.state.pxi_mcp_server) as client:
        assert "<name>team-visible</name>" in (client.instructions or "")
        assert ("<name>team-unmarked</name>" in (client.instructions or "")) == (
            mounted_skills == "all"
        )
        result = await client.call_tool("load_skill", {"skill_name": "team-visible"})
        assert "Team workflow" in str(result.content)

    messages = inject_requested_skills(
        messages=[],
        requested_skill_names=["team-visible", "team-unmarked"],
        available_skills=app.state.pxi_skills,
        message_factory=UIMessage,
    )
    assert len(messages) == (2 if mounted_skills == "all" else 1)

    def factory(
        headers: dict[str, str] | None = None,
        timeout: httpx2.Timeout | None = None,
        auth: httpx2.Auth | None = None,
        follow_redirects: bool = True,
    ) -> httpx2.AsyncClient:
        return httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app.state.mcp_http_app),
            base_url="http://testserver",
            headers=headers,
            follow_redirects=follow_redirects,
        )

    transport = StreamableHttpTransport(url="http://testserver/", httpx_client_factory=factory)
    async with Client(transport) as client:
        assert "<name>team-visible</name>" in (client.instructions or "")
        assert ("<name>team-unmarked</name>" in (client.instructions or "")) == (
            mounted_skills == "all"
        )
        assert "<name>datasets</name>" not in (client.instructions or "")
        result = await client.call_tool("load_skill", {"skill_name": "team-visible"})
        assert "Team workflow" in str(result.content)

    app.state.pxi_skills = ()
    response = await gql_client.execute(query="{ availableAgentSkills { name } }")
    assert not response.errors
    assert response.data == {"availableAgentSkills": []}
