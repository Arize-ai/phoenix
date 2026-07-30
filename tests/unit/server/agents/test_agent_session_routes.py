from datetime import datetime, timedelta, timezone

import httpx
from strawberry.relay import GlobalID

from phoenix.config import EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage, TextUIPart
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _message_uuid


async def _insert_agent_session(
    db: DbSessionFactory,
    *,
    title: str,
    updated_at: datetime,
    is_ephemeral: bool = False,
    messages: list[PhoenixUIMessage] | None = None,
) -> models.AgentSession:
    async with db() as session:
        agent_session = models.AgentSession(
            project_name="pxi-test",
            title=title,
            is_ephemeral=is_ephemeral,
            created_at=updated_at,
            updated_at=updated_at,
        )
        session.add(agent_session)
        await session.flush()
        for message in messages or []:
            session.add(
                models.AgentSessionMessage(
                    agent_session_id=agent_session.id,
                    message=message,
                )
            )
        await session.flush()
        session.expunge(agent_session)
    return agent_session


class TestListAgentSessions:
    async def test_lists_persisted_sessions_in_recent_order(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        older = await _insert_agent_session(
            db, title="Older", updated_at=now - timedelta(minutes=2)
        )
        newer = await _insert_agent_session(db, title="Newer", updated_at=now)
        await _insert_agent_session(
            db,
            title="Temporary",
            updated_at=now + timedelta(minutes=1),
            is_ephemeral=True,
        )

        response = await httpx_client.get("/agents/assistant/sessions")

        assert response.status_code == 200
        assert response.json() == {
            "data": [
                {
                    "id": str(GlobalID("AgentSession", str(newer.id))),
                    "title": "Newer",
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                    "is_temporary": False,
                },
                {
                    "id": str(GlobalID("AgentSession", str(older.id))),
                    "title": "Older",
                    "created_at": (now - timedelta(minutes=2)).isoformat(),
                    "updated_at": (now - timedelta(minutes=2)).isoformat(),
                    "is_temporary": False,
                },
            ],
            "next_cursor": None,
        }

    async def test_paginates_by_updated_at_and_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        sessions = [
            await _insert_agent_session(
                db,
                title=f"Session {offset}",
                updated_at=now - timedelta(minutes=offset),
            )
            for offset in range(3)
        ]

        first_response = await httpx_client.get("/agents/assistant/sessions?limit=2")
        assert first_response.status_code == 200
        first_page = first_response.json()
        assert [item["title"] for item in first_page["data"]] == ["Session 0", "Session 1"]
        assert first_page["next_cursor"]

        second_response = await httpx_client.get(
            "/agents/assistant/sessions",
            params={"limit": 2, "cursor": first_page["next_cursor"]},
        )
        assert second_response.status_code == 200
        assert [item["id"] for item in second_response.json()["data"]] == [
            str(GlobalID("AgentSession", str(sessions[2].id)))
        ]
        assert second_response.json()["next_cursor"] is None

    async def test_rejects_invalid_cursor(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.get("/agents/assistant/sessions?cursor=invalid")
        assert response.status_code == 422


class TestGetAgentSession:
    async def test_gets_session_with_ordered_messages(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        messages = [
            PhoenixUIMessage(
                id=_message_uuid("user-message"),
                role="user",
                parts=[TextUIPart(type="text", text="Hello")],
            ),
            PhoenixUIMessage(
                id=_message_uuid("assistant-message"),
                role="assistant",
                parts=[TextUIPart(type="text", text="Hi")],
            ),
        ]
        agent_session = await _insert_agent_session(
            db,
            title="Conversation",
            updated_at=now,
            messages=messages,
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        response = await httpx_client.get(f"/agents/assistant/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == session_id
        assert data["title"] == "Conversation"
        assert data["is_temporary"] is False
        assert [message["id"] for message in data["messages"]] == [
            _message_uuid("user-message"),
            _message_uuid("assistant-message"),
        ]
        assert data["messages"][0]["parts"] == [{"type": "text", "text": "Hello"}]
        assert data["messages"][1]["parts"] == [{"type": "text", "text": "Hi"}]

    async def test_gets_temporary_session(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        agent_session = await _insert_agent_session(
            db,
            title="Temporary",
            updated_at=now,
            is_ephemeral=True,
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        response = await httpx_client.get(f"/agents/assistant/sessions/{session_id}")

        assert response.status_code == 200
        assert response.json()["data"]["is_temporary"] is True

    async def test_serves_an_ephemeral_session_the_sweeper_has_not_reached_yet(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """Past the TTL but not yet swept, the session is still readable.

        Reads no longer second-guess the sweeper: with the deadline derived from
        ``updated_at`` there is no stored expiry to compare against, so the row
        stays visible to its owner for at most one sweep interval longer than
        before.
        """
        agent_session = await _insert_agent_session(
            db,
            title="Idle past its TTL",
            updated_at=datetime.now(timezone.utc)
            - timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS + 1),
            is_ephemeral=True,
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        response = await httpx_client.get(f"/agents/assistant/sessions/{session_id}")

        assert response.status_code == 200
        assert response.json()["data"]["is_temporary"] is True

    async def test_rejects_invalid_id(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.get("/agents/assistant/sessions/invalid")
        assert response.status_code == 422
