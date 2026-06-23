from __future__ import annotations

from pydantic_ai.ui.vercel_ai.response_types import (
    TextDeltaChunk,
    TextEndChunk,
    TextStartChunk,
    ToolInputAvailableChunk,
    ToolInputStartChunk,
    ToolOutputAvailableChunk,
)

from phoenix.server.agents.subagent_progress import (
    SubagentProgressEmitter,
    SubagentUIMessageAccumulator,
    build_subagent_tool_output,
    replace_subagent_final_output,
)


def test_accumulates_subagent_text_and_tool_parts() -> None:
    accumulator = SubagentUIMessageAccumulator(message_id="subagent-message")

    assert accumulator.ingest(TextStartChunk(id="text-1"))
    assert accumulator.ingest(TextDeltaChunk(id="text-1", delta="hello"))
    assert accumulator.ingest(TextDeltaChunk(id="text-1", delta=" world"))
    assert accumulator.ingest(TextEndChunk(id="text-1"))
    assert accumulator.ingest(
        ToolInputStartChunk(
            tool_call_id="tool-1",
            tool_name="bash",
        )
    )
    assert accumulator.ingest(
        ToolInputAvailableChunk(
            tool_call_id="tool-1",
            tool_name="bash",
            input={"cmd": "pwd"},
        )
    )
    assert accumulator.ingest(
        ToolOutputAvailableChunk(
            tool_call_id="tool-1",
            output={"stdout": "/tmp"},
            preliminary=True,
        )
    )

    output = build_subagent_tool_output(accumulator=accumulator, summary="done")

    assert output == {
        "summary": "done",
        "message": {
            "id": "subagent-message",
            "role": "assistant",
            "parts": [
                {"type": "text", "text": "hello world", "state": "done"},
                {
                    "type": "tool-bash",
                    "toolCallId": "tool-1",
                    "state": "output-available",
                    "input": {"cmd": "pwd"},
                    "output": {"stdout": "/tmp"},
                    "preliminary": True,
                },
            ],
        },
    }


def test_replace_subagent_final_output_uses_cached_ui_output() -> None:
    emitter = SubagentProgressEmitter()
    final_output = {"summary": "done", "message": {"id": "m", "role": "assistant", "parts": []}}
    emitter.set_final_output(tool_call_id="tool-1", output=final_output)

    replaced = replace_subagent_final_output(
        emitter=emitter,
        chunk=ToolOutputAvailableChunk(
            tool_call_id="tool-1",
            output="done",
            preliminary=True,
        ),
    )

    assert replaced.output == final_output
    assert replaced.preliminary is None


def test_replace_subagent_final_output_leaves_other_tools_unchanged() -> None:
    emitter = SubagentProgressEmitter()
    chunk = ToolOutputAvailableChunk(tool_call_id="tool-1", output="done")

    assert replace_subagent_final_output(emitter=emitter, chunk=chunk) is chunk
