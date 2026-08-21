from datetime import datetime, timedelta, timezone

import httpx
from strawberry.relay import GlobalID

from phoenix.config import EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage, TextUIPart
from phoenix.server.api.types.pagination import (
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
)
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _agent_session_model_kwargs, _message_uuid


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
            **_agent_session_model_kwargs(),
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

        response = await httpx_client.get("/v1/agent_sessions")

        assert response.status_code == 200
        assert response.json() == {
            "data": [
                {
                    "id": str(GlobalID("AgentSession", str(newer.id))),
                    "title": "Newer",
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                    "is_ephemeral": False,
                },
                {
                    "id": str(GlobalID("AgentSession", str(older.id))),
                    "title": "Older",
                    "created_at": (now - timedelta(minutes=2)).isoformat(),
                    "updated_at": (now - timedelta(minutes=2)).isoformat(),
                    "is_ephemeral": False,
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

        first_response = await httpx_client.get("/v1/agent_sessions?limit=2")
        assert first_response.status_code == 200
        first_page = first_response.json()
        assert [item["title"] for item in first_page["data"]] == ["Session 0", "Session 1"]
        assert first_page["next_cursor"]

        second_response = await httpx_client.get(
            "/v1/agent_sessions",
            params={"limit": 2, "cursor": first_page["next_cursor"]},
        )
        assert second_response.status_code == 200
        assert [item["id"] for item in second_response.json()["data"]] == [
            str(GlobalID("AgentSession", str(sessions[2].id)))
        ]
        assert second_response.json()["next_cursor"] is None

    async def test_rejects_invalid_cursor(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.get("/v1/agent_sessions?cursor=invalid")
        assert response.status_code == 422

    async def test_rejects_a_cursor_carrying_the_wrong_sort_type(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        """Sessions page by `updated_at`; a float belongs to a different column."""
        cursor = str(
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=1.5),
            )
        )
        response = await httpx_client.get("/v1/agent_sessions", params={"cursor": cursor})
        assert response.status_code == 422

    async def test_rejects_a_rowid_only_cursor(self, httpx_client: httpx.AsyncClient) -> None:
        """A sorted page cannot be placed from a rowid alone."""
        response = await httpx_client.get(
            "/v1/agent_sessions", params={"cursor": str(Cursor(rowid=1))}
        )
        assert response.status_code == 422


class TestGetAgentSession:
    async def test_gets_session_metadata_with_transcript_tail(
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

        response = await httpx_client.get(f"/v1/agent_sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == session_id
        assert data["title"] == "Conversation"
        assert data["is_ephemeral"] is False
        assert data["model"] == {
            "providerType": "builtin",
            "provider": "OPENAI",
            "modelName": "gpt-test",
        }
        assert data["is_active"] is False
        assert data["last_message_id"] == _message_uuid("assistant-message")
        assert "messages" not in data

    async def test_reports_null_tail_for_empty_transcript(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        agent_session = await _insert_agent_session(db, title="Empty", updated_at=now)
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        response = await httpx_client.get(f"/v1/agent_sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["last_message_id"] is None
        assert "messages" not in data

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

        response = await httpx_client.get(f"/v1/agent_sessions/{session_id}")

        assert response.status_code == 200
        assert response.json()["data"]["is_ephemeral"] is True

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

        response = await httpx_client.get(f"/v1/agent_sessions/{session_id}")

        assert response.status_code == 200
        assert response.json()["data"]["is_ephemeral"] is True

    async def test_rejects_invalid_id(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.get("/v1/agent_sessions/invalid")
        assert response.status_code == 404


class TestListAgentSessionMessages:
    async def test_returns_the_ordered_transcript(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        agent_session = await _insert_agent_session(
            db,
            title="Conversation",
            updated_at=datetime.now(timezone.utc),
            messages=[
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
            ],
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        response = await httpx_client.get(f"/v1/agent_sessions/{session_id}/messages")

        assert response.status_code == 200
        payload = response.json()
        assert [message["id"] for message in payload["data"]] == [
            _message_uuid("user-message"),
            _message_uuid("assistant-message"),
        ]
        assert payload["data"][0]["parts"] == [{"type": "text", "text": "Hello"}]
        assert payload["data"][1]["parts"] == [{"type": "text", "text": "Hi"}]
        assert payload["next_cursor"] is None

    async def test_paginates_the_transcript_by_message_order(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        message_ids = [_message_uuid(f"message-{index}") for index in range(3)]
        agent_session = await _insert_agent_session(
            db,
            title="Conversation",
            updated_at=datetime.now(timezone.utc),
            messages=[
                PhoenixUIMessage(
                    id=message_id,
                    role="user" if index % 2 == 0 else "assistant",
                    parts=[TextUIPart(type="text", text=f"Message {index}")],
                )
                for index, message_id in enumerate(message_ids)
            ],
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        fetched: list[str] = []
        cursor: str | None = None
        for _ in range(len(message_ids)):
            params: dict[str, str | int] = {"limit": 1}
            if cursor is not None:
                params["cursor"] = cursor
            response = await httpx_client.get(
                f"/v1/agent_sessions/{session_id}/messages",
                params=params,
            )
            assert response.status_code == 200
            payload = response.json()
            assert len(payload["data"]) == 1
            fetched.append(payload["data"][0]["id"])
            cursor = payload["next_cursor"]

        assert fetched == message_ids
        assert cursor is None

    async def test_returns_empty_transcript(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        agent_session = await _insert_agent_session(
            db, title="Empty", updated_at=datetime.now(timezone.utc)
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        response = await httpx_client.get(f"/v1/agent_sessions/{session_id}/messages")

        assert response.status_code == 200
        assert response.json() == {"data": [], "next_cursor": None}

    async def test_rejects_invalid_session_id(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.get("/v1/agent_sessions/invalid/messages")
        assert response.status_code == 404

    async def test_rejects_invalid_cursor(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        agent_session = await _insert_agent_session(
            db, title="Conversation", updated_at=datetime.now(timezone.utc)
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))

        response = await httpx_client.get(
            f"/v1/agent_sessions/{session_id}/messages",
            params={"cursor": "invalid"},
        )

        assert response.status_code == 422

    async def test_rejects_a_cursor_carrying_a_sort_value(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """The transcript orders by rowid alone, so a sort value is from elsewhere."""
        agent_session = await _insert_agent_session(
            db, title="Conversation", updated_at=datetime.now(timezone.utc)
        )
        session_id = str(GlobalID("AgentSession", str(agent_session.id)))
        cursor = str(
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.now(timezone.utc),
                ),
            )
        )
        response = await httpx_client.get(
            f"/v1/agent_sessions/{session_id}/messages",
            params={"cursor": cursor},
        )
        assert response.status_code == 422

    async def test_returns_not_found_for_nonexistent_session(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        session_id = str(GlobalID("AgentSession", "1000000"))

        response = await httpx_client.get(f"/v1/agent_sessions/{session_id}/messages")

        assert response.status_code == 404
