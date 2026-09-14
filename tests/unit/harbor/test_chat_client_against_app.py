"""Drive the real agent session routes with the Harbor client over an ASGI transport."""

import httpx
import pytest
from pydantic_ai.models.test import TestModel
from sqlalchemy import select
from starlette.types import ASGIApp

from evals.harbor.container_assets.chat_client import (
    AgentSessionChatClient,
    answer_text,
    builtin_model_selection,
)
from phoenix.db import models
from phoenix.server.types import DbSessionFactory


async def test_two_turns_persist_one_transcript(
    asgi_app: ASGIApp,
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_build_model(*args: object, **kwargs: object) -> TestModel:
        return TestModel(call_tools=[])

    monkeypatch.setattr("phoenix.server.api.routers.agents.build_model", _fake_build_model)
    client = AgentSessionChatClient(
        "http://test",
        model=builtin_model_selection("anthropic/claude-sonnet-4-5"),
        transport=httpx.ASGITransport(app=asgi_app),
    )
    try:
        session_id = await client.create_session()
        turns = [
            await client.run_turn(
                session_id,
                instruction,
                edit_permission="manual",
                mutations_enabled=False,
                approve=lambda _: False,
            )
            for instruction in ("What datasets exist?", "And experiments?")
        ]
        transcript = await client.list_messages(session_id)
    finally:
        await client.aclose()

    assert [message["role"] for message in transcript] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    for turn, persisted in zip(turns, transcript[1::2]):
        assert turn.final_message["id"] == persisted["id"]
        assert answer_text(turn.final_message) == answer_text(persisted)
        assert answer_text(persisted)
        assert turn.usage is not None

    async with db() as session:
        stored_ids = list(
            await session.scalars(
                select(models.AgentSessionMessage.message_id).order_by(
                    models.AgentSessionMessage.id
                )
            )
        )
    assert stored_ids == [message["id"] for message in transcript]
