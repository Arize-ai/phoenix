from __future__ import annotations

from typing import Any, AsyncGenerator, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

from phoenix.server.api.subscriptions import _stream_single_chat_completion


class TestStreamSingleChatCompletionReleasesItsTracer:
    """The playground stream is the owner that previously tore its tracer down
    on no path at all, so it is the one most worth pinning.

    A `Tracer` holds every span it captured, message histories included, and one
    is built per stream.
    """

    @staticmethod
    def _tracer() -> MagicMock:
        tracer = MagicMock()
        tracer.get_db_traces.return_value = []
        tracer.__aenter__ = AsyncMock(return_value=tracer)
        tracer.__aexit__ = AsyncMock(return_value=None)
        return tracer

    @staticmethod
    def _db() -> MagicMock:
        session = MagicMock()
        session.flush = AsyncMock()
        db = MagicMock()
        db.return_value.__aenter__ = AsyncMock(return_value=session)
        db.return_value.__aexit__ = AsyncMock(return_value=None)
        return db

    def _stream(self, llm_client: MagicMock) -> AsyncGenerator[Any, None]:
        return _stream_single_chat_completion(
            input=MagicMock(),
            llm_client=llm_client,
            repetition_number=1,
            db=self._db(),
            project_id=1,
            on_span_insertion=MagicMock(),
            span_cost_calculator=MagicMock(),
            otel_context=MagicMock(),
        )

    @staticmethod
    def _client_yielding_one_chunk() -> MagicMock:
        async def _chat_completion_create(**_: Any) -> AsyncIterator[MagicMock]:
            yield MagicMock()

        client = MagicMock()
        client.chat_completion_create = _chat_completion_create
        return client

    async def test_the_tracer_is_released_when_the_stream_finishes(self) -> None:
        tracer = self._tracer()
        with patch("phoenix.server.api.subscriptions.Tracer", return_value=tracer):
            stream = self._stream(self._client_yielding_one_chunk())
            async for _ in stream:
                pass
        tracer.__aexit__.assert_awaited_once()

    async def test_the_tracer_is_released_when_the_stream_fails(self) -> None:
        """The failure is caught and turned into an error chunk, so the release
        cannot rely on the exception reaching the caller.
        """
        tracer = self._tracer()
        with (
            patch("phoenix.server.api.subscriptions.Tracer", return_value=tracer),
            patch(
                "phoenix.server.api.subscriptions.prompt_chat_template_to_playground_messages",
                side_effect=RuntimeError("the template is malformed"),
            ),
        ):
            stream = self._stream(MagicMock())
            async for _ in stream:
                pass
        tracer.__aexit__.assert_awaited_once()

    async def test_the_tracer_is_released_when_the_consumer_abandons_the_stream(self) -> None:
        """A playground client that navigates away leaves the stream part-read.
        Closing it has to unwind the block rather than strand the tracer.
        """
        tracer = self._tracer()
        with patch("phoenix.server.api.subscriptions.Tracer", return_value=tracer):
            stream = self._stream(self._client_yielding_one_chunk())
            await stream.__anext__()
            tracer.__aexit__.assert_not_awaited()
            await stream.aclose()
        tracer.__aexit__.assert_awaited_once()
