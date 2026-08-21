import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any, NoReturn, cast

import httpx
from openai import OpenAI
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from scripts.datagen.generation import MatrixCell, ProfileDraw
from scripts.datagen.openai_chat_sessions import (
    OpenAIPlainChatRecorder,
    SpanCaptureExporter,
    _streaming_response,
)
from scripts.datagen.scripted import ConversationScript, ConversationTurn
from scripts.datagen.self_play import AssistantRequest


def test_plain_chat_recorder_consumes_both_lane_contracts_with_streaming_usage(
    tmp_path: Path,
) -> None:
    provider = _StreamingProvider()
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    recorder = OpenAIPlainChatRecorder(
        OpenAI(
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=cast(Any, provider.http_client()),
            max_retries=0,
        ),
        exporter,
    )
    self_play_cell_id = "a" * 64
    try:
        self_play = recorder.record(
            AssistantRequest(
                cell_id=self_play_cell_id,
                attempt_id=f"{self_play_cell_id}:generation:1",
                turn_index=0,
                model="model-exact",
                messages=({"role": "user", "content": "Question 0"},),
                tools=(),
                traces_path=tmp_path / "self-play" / "traces.jsonl",
            ),
            _unexpected_tool_call,
        )
        scripted_cell = MatrixCell(
            cell_id="b" * 64,
            lane="scripted",
            ordinal=0,
            profile=ProfileDraw(
                profile_id="customer_support/plain_chat",
                domain="customer_support",
                archetype="plain_chat",
                scenario_id="return",
                topic="returns",
                scenario_template="Ask about a return.",
                persona_id="buyer",
                persona_instructions="Ask concise questions.",
                register="neutral",
                quality_tier="high",
                turn_count=8,
                target_mode="ambient",
                targeted_seed_id=None,
                seed_intensities={},
            ),
            assistant_model="model-exact",
        )
        script = ConversationScript(
            cell_id=scripted_cell.cell_id,
            model=scripted_cell.assistant_model,
            failure_mode="none",
            failure_turn=None,
            turns=tuple(
                ConversationTurn(user=f"Question {index}", assistant=f"Answer {index}")
                for index in range(1, 9)
            ),
        )
        scripted = recorder.record_script(
            scripted_cell,
            script,
            tmp_path / "scripted" / "traces.jsonl",
        )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert self_play.messages == ({"role": "assistant", "content": "Answer 0"},)
    assert self_play.usage.to_dict() == {
        "input_tokens": 10,
        "cached_input_tokens": 2,
        "output_tokens": 4,
    }
    assert len(self_play.trace_ids) == 1
    assert scripted.turn_count == 8
    assert scripted.trace_ids == tuple(
        f"{span.context.trace_id:032x}" for span in exporter.spans_since(1)
    )
    assert scripted.usage.input_tokens == 80
    assert scripted.usage.cached_input_tokens == 16
    assert scripted.usage.output_tokens == 32
    assert all(request["stream"] is True for request in provider.requests)
    assert all(
        request["stream_options"] == {"include_usage": True} for request in provider.requests
    )
    assert all("tools" not in request for request in provider.requests)

    spans = exporter.spans_since(0)
    assert len(spans) == 9
    assert all(
        span.start_time is not None
        and span.end_time is not None
        and span.end_time > span.start_time
        for span in spans
    )
    attributes = [span.attributes for span in spans]
    assert all(attributes)
    assert {cast(Any, item)["session.id"] for item in attributes} == {
        self_play_cell_id,
        scripted_cell.cell_id,
    }
    assert all(cast(Any, item)["llm.token_count.prompt"] == 10 for item in attributes)
    assert all(cast(Any, item)["llm.token_count.completion"] == 4 for item in attributes)
    assert len((tmp_path / "self-play" / "traces.jsonl").read_text().splitlines()) == 1
    assert len((tmp_path / "scripted" / "traces.jsonl").read_text().splitlines()) == 8


class _StreamingProvider:
    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []

    def http_client(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self._handle))

    def _handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        user_content = body["messages"][-1]["content"]
        answer = user_content.replace("Question", "Answer")
        completion = {
            "id": f"chatcmpl-{len(self.requests)}",
            "object": "chat.completion",
            "created": 0,
            "model": body["model"],
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": answer},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 4,
                "total_tokens": 14,
                "prompt_tokens_details": {"cached_tokens": 2},
                "completion_tokens_details": {"reasoning_tokens": 0},
            },
        }
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=_streaming_response(completion),
            request=request,
        )


def _unexpected_tool_call(name: str, arguments: Mapping[str, Any]) -> NoReturn:
    raise AssertionError(f"plain chat unexpectedly invoked {name}: {arguments}")
