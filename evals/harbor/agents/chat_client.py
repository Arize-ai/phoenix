#!/usr/bin/env python3
"""Run one PXI turn against a Phoenix server and save the transcript and spans."""

import argparse
import asyncio
import json
import sys
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, cast
from uuid import uuid4

import httpx
from phoenix.client.__generated__ import v1
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk

from phoenix.server.agents.ui_message_stream import iter_chunks_with_error_parts
from phoenix.server.agents.vercel_ui_message_stream import read_ui_message_stream

EditPermission = Literal["manual", "bypass"]
Message = v1.PhoenixUIMessage
ModelSelection = v1.BuiltInProviderModelSelection | v1.CustomProviderModelSelection
ChatContext = (
    v1.AppContext
    | v1.ProjectUIContext
    | v1.TraceUIContext
    | v1.SessionUIContext
    | v1.PromptUIContext
    | v1.PromptVersionUIContext
    | v1.SpanUIContext
    | v1.PlaygroundUIContext
    | v1.CodeEvaluatorUIContext
    | v1.LlmEvaluatorUIContext
    | v1.DatasetUIContext
    | v1.GraphQLContext
    | v1.WebAccessContext
    | v1.SubagentsContext
)
ToolOutputPart = (
    v1.PhoenixDbTypesDataStreamProtocolRequestTypesToolOutputAvailablePart
    | v1.PhoenixDbTypesDataStreamProtocolRequestTypesToolOutputErrorPart
    | v1.PhoenixDbTypesDataStreamProtocolRequestTypesDynamicToolOutputAvailablePart
    | v1.PhoenixDbTypesDataStreamProtocolRequestTypesDynamicToolOutputErrorPart
)
ApprovalRequestedPart = v1.ToolApprovalRequestedPart | v1.DynamicToolApprovalRequestedPart
ApprovalPolicy = Callable[[ApprovalRequestedPart], bool]
TurnSpan = dict[str, Any]

_SSE_DATA_PREFIX = "data: "
_SSE_DONE = "data: [DONE]"
_BUSY_RETRY_DELAY_SECONDS = 2.0
_BUSY_RETRY_ATTEMPTS = 30
_SPAN_SETTLE_TIMEOUT_SECONDS = 30.0
_SPAN_SETTLE_POLL_SECONDS = 1.0
_TOKEN_COUNT_ATTRIBUTES = {
    "prompt": "llm.token_count.prompt",
    "completion": "llm.token_count.completion",
    "cache_read": "llm.token_count.prompt_details.cache_read",
    "cache_write": "llm.token_count.prompt_details.cache_write",
}

_CHUNK_TYPES: dict[str, type[BaseChunk]] = {
    default: chunk_type
    for chunk_type in BaseChunk.__subclasses__()
    if isinstance(default := chunk_type.model_fields["type"].default, str)
}


def parse_chunk(payload: dict[str, Any]) -> BaseChunk | None:
    chunk_type = payload["type"]
    if chunk_type.startswith("data-"):
        return DataChunk.model_validate(payload)
    model = _CHUNK_TYPES.get(chunk_type)
    return model.model_validate(payload) if model is not None else None


async def iter_sse_chunks(lines: AsyncIterator[str]) -> AsyncIterator[BaseChunk]:
    async for line in lines:
        line = line.rstrip("\r")
        if line == _SSE_DONE or not line.startswith(_SSE_DATA_PREFIX):
            continue
        chunk = parse_chunk(json.loads(line[len(_SSE_DATA_PREFIX) :]))
        if chunk is not None:
            yield chunk


async def accumulate_assistant_message(
    chunks: AsyncIterator[BaseChunk],
) -> tuple[Message, list[str]]:
    errors: list[str] = []
    latest: Any = None
    async for message in read_ui_message_stream(
        stream=iter_chunks_with_error_parts(chunks), on_error=lambda e: errors.append(str(e))
    ):
        latest = message
    if latest is None:
        raise RuntimeError(
            "The chat stream ended without producing an assistant message"
            + (f": {'; '.join(errors)}" if errors else "")
        )
    dumped = latest.model_dump(mode="json", by_alias=True, exclude_none=True)
    return cast(Message, dumped), errors


def builtin_model_selection(harbor_model_name: str) -> v1.BuiltInProviderModelSelection:
    """The server, not this client, rejects providers Phoenix does not know."""
    provider, separator, model_name = harbor_model_name.partition("/")
    if not separator or not model_name:
        raise ValueError(
            f"Expected a Harbor model name of the form provider/model, got {harbor_model_name!r}"
        )
    return cast(
        v1.BuiltInProviderModelSelection,
        {"providerType": "builtin", "provider": provider.upper(), "modelName": model_name},
    )


def user_message(text: str) -> Message:
    return {"id": str(uuid4()), "role": "user", "parts": [{"type": "text", "text": text}]}


def chat_contexts(*, mutations_enabled: bool, now: datetime | None = None) -> list[ChatContext]:
    now = now or datetime.now(timezone.utc)
    return [
        {"type": "app", "currentDateTime": now.isoformat(), "timeZone": "UTC"},
        {"type": "graphql", "mutationsEnabled": mutations_enabled},
        {"type": "web_access", "enabled": False},
        {"type": "subagents", "enabled": False},
    ]


def pending_approvals(message: Message) -> list[ApprovalRequestedPart]:
    return [
        cast(ApprovalRequestedPart, part)
        for part in message["parts"]
        if part.get("state") == "approval-requested"
    ]


class SessionConflict(Exception):
    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code


def _assistant_metadata(message: Message) -> v1.PhoenixAssistantMessageMetadata | None:
    phoenix = (message.get("metadata") or {}).get("phoenix")
    if phoenix is not None and phoenix["type"] == "assistant":
        return phoenix
    return None


@dataclass
class Turn:
    """Everything one turn produced, across approval continuations.

    A turn opened with tool outputs, the way the browser answers a client-executed
    tool, has no user message of its own.
    """

    user_message: Message | None
    assistant_messages: list[Message] = field(default_factory=list)
    stream_errors: list[str] = field(default_factory=list)

    @property
    def messages(self) -> list[Message]:
        prefix = [self.user_message] if self.user_message is not None else []
        return [*prefix, *self.assistant_messages]

    @property
    def final_message(self) -> Message:
        return self.assistant_messages[-1]

    @property
    def usage(self) -> v1.AssistantMessageMetadataUsage | None:
        metadata = _assistant_metadata(self.final_message)
        return metadata.get("usage") if metadata is not None else None

    @property
    def trace_contexts(self) -> list[v1.TurnTraceContext]:
        """The ``turnTraceContext`` of each assistant message: the trace PXI's own
        instrumentation wrote for that continuation, with its root span."""
        contexts: list[v1.TurnTraceContext] = []
        for message in self.assistant_messages:
            metadata = _assistant_metadata(message)
            context = metadata.get("turnTraceContext") if metadata is not None else None
            if context is not None and context.get("traceId"):
                contexts.append(context)
        return contexts


class AgentSessionChatClient:
    def __init__(
        self,
        base_url: str,
        *,
        model: ModelSelection,
        transport: httpx.AsyncBaseTransport | None = None,
        turn_timeout_seconds: float = 900.0,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url,
            transport=transport,
            timeout=httpx.Timeout(turn_timeout_seconds, connect=30.0),
        )
        self._model = model

    async def aclose(self) -> None:
        await self._http.aclose()

    async def create_session(self) -> str:
        body: v1.CreateAgentSessionRequestBody = {"model": self._model, "is_ephemeral": False}
        response = await self._http.post("/v1/agent_sessions", json=body)
        _raise_for_status(response)
        return str(response.json()["data"]["id"])

    async def list_projects(self) -> list[dict[str, Any]]:
        projects: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            params: dict[str, str | int] = {"limit": 100}
            if cursor:
                params["cursor"] = cursor
            response = await self._http.get("/v1/projects", params=params)
            _raise_for_status(response)
            payload = response.json()
            projects.extend(payload["data"])
            cursor = payload.get("next_cursor")
            if not cursor:
                return projects

    async def list_trace_spans(self, project_id: str, trace_id: str) -> list[dict[str, Any]]:
        spans: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            params: dict[str, str | int] = {"trace_id": trace_id, "limit": 1000}
            if cursor:
                params["cursor"] = cursor
            response = await self._http.get(f"/v1/projects/{project_id}/spans", params=params)
            _raise_for_status(response)
            payload = response.json()
            spans.extend(payload["data"])
            cursor = payload.get("next_cursor")
            if not cursor:
                return spans

    async def fetch_turn_spans(self, trace_contexts: list[v1.TurnTraceContext]) -> list[TurnSpan]:
        if not trace_contexts:
            return []
        deadline = asyncio.get_running_loop().time() + _SPAN_SETTLE_TIMEOUT_SECONDS
        previous: dict[str, int] = {}
        while True:
            spans_by_trace = await self._spans_by_trace(trace_contexts)
            counts = {trace_id: len(spans) for trace_id, spans in spans_by_trace.items()}
            settled = counts == previous and all(
                _root_finished(spans_by_trace.get(str(context["traceId"]), []), context)
                for context in trace_contexts
            )
            if settled or asyncio.get_running_loop().time() >= deadline:
                if not settled:
                    print(
                        "warning: the turn's traces did not settle in "
                        f"{_SPAN_SETTLE_TIMEOUT_SECONDS:.0f}s; timing may be incomplete",
                        file=sys.stderr,
                    )
                return [trim_span(span) for spans in spans_by_trace.values() for span in spans]
            previous = counts
            await asyncio.sleep(_SPAN_SETTLE_POLL_SECONDS)

    async def _spans_by_trace(
        self, trace_contexts: list[v1.TurnTraceContext]
    ) -> dict[str, list[dict[str, Any]]]:
        wanted = {str(context["traceId"]) for context in trace_contexts}
        found: dict[str, list[dict[str, Any]]] = {}
        for project in await self.list_projects():
            for trace_id in wanted - found.keys():
                spans = await self.list_trace_spans(str(project["id"]), trace_id)
                if spans:
                    found[trace_id] = spans
        return found

    async def list_messages(self, session_id: str) -> list[Message]:
        messages: list[Message] = []
        cursor: str | None = None
        while True:
            params: dict[str, str | int] = {"limit": 1000}
            if cursor:
                params["cursor"] = cursor
            response = await self._http.get(
                f"/v1/agent_sessions/{session_id}/messages", params=params
            )
            _raise_for_status(response)
            payload = response.json()
            messages.extend(payload["data"])
            cursor = payload.get("next_cursor")
            if not cursor:
                return messages

    async def last_message_id(self, session_id: str) -> str | None:
        transcript = await self.list_messages(session_id)
        return transcript[-1]["id"] if transcript else None

    async def run_turn(
        self,
        session_id: str,
        *,
        message: Message | None = None,
        tool_outputs: Sequence[ToolOutputPart] = (),
        last_message_id: str | None,
        edit_permission: EditPermission,
        contexts: Sequence[ChatContext],
        headless: bool,
        record_local_traces: bool,
        approve: ApprovalPolicy | None,
    ) -> Turn:
        """Open a turn with a user message or with the outputs of the tool calls that end
        the stored transcript, then answer approval requests with ``approve`` until the
        model finishes. With ``approve=None`` the turn ends at the first approval request,
        or when the model calls a client-executed tool, and the caller sees it pending.
        """
        if (message is None) == (not tool_outputs):
            raise ValueError("A turn opens with either a user message or tool outputs")
        base_body: v1.ChatRequestBody = {
            "id": session_id,
            "trigger": "submit-message",
            "headless": headless,
            "model": self._model,
            "editPermission": edit_permission,
            "contexts": contexts,
            "recordLocalTraces": record_local_traces,
        }
        opening: v1.ChatRequestBody = {**base_body}
        if last_message_id is not None:
            opening["lastMessageId"] = last_message_id
        if message is not None:
            opening["message"] = message
        else:
            opening["toolOutputs"] = tool_outputs
        turn = Turn(user_message=message)
        reply, errors = await self._chat(session_id, opening)
        turn.assistant_messages.append(reply)
        turn.stream_errors.extend(errors)
        while approve is not None and not errors and (approvals := pending_approvals(reply)):
            tool_approvals: list[v1.ToolApproval] = [
                {"toolCallId": part["toolCallId"], "approved": approve(part)} for part in approvals
            ]
            reply, errors = await self._chat(
                session_id,
                {**base_body, "toolApprovals": tool_approvals, "lastMessageId": reply["id"]},
            )
            turn.assistant_messages.append(reply)
            turn.stream_errors.extend(errors)
        return turn

    async def _chat(self, session_id: str, body: v1.ChatRequestBody) -> tuple[Message, list[str]]:
        for attempt in range(_BUSY_RETRY_ATTEMPTS):
            try:
                return await self._stream_chat(session_id, body)
            except SessionConflict as conflict:
                if conflict.code != "agent_session_busy" or attempt == _BUSY_RETRY_ATTEMPTS - 1:
                    raise
                await asyncio.sleep(_BUSY_RETRY_DELAY_SECONDS)
        raise AssertionError("unreachable")

    async def _stream_chat(
        self, session_id: str, body: v1.ChatRequestBody
    ) -> tuple[Message, list[str]]:
        async with self._http.stream(
            "POST",
            f"/v1/agent_sessions/{session_id}/chat",
            json=body,
            headers={"accept": "text/event-stream"},
        ) as response:
            if response.status_code >= 400:
                await response.aread()
                _raise_for_status(response)
            return await accumulate_assistant_message(iter_sse_chunks(response.aiter_lines()))


def trim_span(span: dict[str, Any]) -> TurnSpan:
    attributes = span.get("attributes") or {}
    kind = span.get("span_kind") or attributes.get("openinference.span.kind")
    output_tool_call_ids = sorted(
        {
            str(value)
            for key, value in attributes.items()
            if key.startswith("llm.output_messages.") and key.endswith(".tool_call.id")
        }
    )
    token_counts = {
        name: attributes[key]
        for name, key in _TOKEN_COUNT_ATTRIBUTES.items()
        if isinstance(attributes.get(key), int)
    }
    return {
        "span_id": span["context"]["span_id"],
        "trace_id": span["context"]["trace_id"],
        "parent_id": span.get("parent_id"),
        "name": span.get("name"),
        "kind": kind,
        "start_time": span.get("start_time"),
        "end_time": span.get("end_time"),
        "tool_call_id": attributes.get("tool_call.id"),
        "output_tool_call_ids": output_tool_call_ids,
        "token_counts": token_counts,
    }


def _root_finished(spans: list[dict[str, Any]], context: v1.TurnTraceContext) -> bool:
    root_span_id = context.get("rootSpanId")
    for span in spans:
        if span["context"]["span_id"] == root_span_id:
            return bool(span.get("end_time"))
    return False


def _raise_for_status(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    detail = (
        (payload.get("detail") or payload.get("message")) if isinstance(payload, dict) else None
    )
    message = f"HTTP {response.status_code} from {response.request.url}: {detail or response.text}"
    if response.status_code == 409 and isinstance(payload, dict) and "code" in payload:
        raise SessionConflict(str(payload["code"]), message)
    raise RuntimeError(message)


def _dump_json(value: Any) -> str:
    return json.dumps(value, indent=2) + "\n"


async def _run_seeded_turn(client: AgentSessionChatClient, seed_file: Path) -> tuple[str, Turn]:
    """Continue a session seeded by ``evals.harbor.pxi.insert_session_into_db`` as the
    browser would: non-headless so the browser tools are available, without answering
    approvals or client-executed tool calls, which the PXI evals score as they stand. The
    turn's own traces are not recorded, so the trajectory carries token counts from the
    message metadata but no per-call latencies.
    """
    seed = json.loads(seed_file.read_text())
    session_id = str(seed["session_id"])
    request = seed["client"]
    turn = await client.run_turn(
        session_id,
        message=cast(Message | None, request["message"]),
        tool_outputs=cast(list[ToolOutputPart], request["tool_outputs"]),
        last_message_id=cast(str | None, request["last_message_id"]),
        edit_permission=cast(EditPermission, request["edit_permission"]),
        contexts=cast(list[ChatContext], request["contexts"]),
        headless=False,
        record_local_traces=False,
        approve=None,
    )
    return session_id, turn


async def run(args: argparse.Namespace) -> None:
    edit_permission: EditPermission = "bypass" if args.allow_mutations else "manual"
    client = AgentSessionChatClient(
        args.base_url,
        model=builtin_model_selection(args.model),
        turn_timeout_seconds=args.turn_timeout_seconds,
    )
    try:
        if args.seed_file is not None:
            session_id, turn = await _run_seeded_turn(client, args.seed_file)
        else:
            if args.instruction_file is None:
                raise ValueError("--instruction-file is required without --seed-file")
            session_id = args.session_id or await client.create_session()
            turn = await client.run_turn(
                session_id,
                message=user_message(args.instruction_file.read_text()),
                last_message_id=await client.last_message_id(session_id),
                edit_permission=edit_permission,
                contexts=chat_contexts(mutations_enabled=args.allow_mutations),
                headless=True,
                record_local_traces=True,
                approve=lambda _part: args.approve_tool_calls,
            )
        transcript = await client.list_messages(session_id)
        turn_spans = await client.fetch_turn_spans(turn.trace_contexts)
    finally:
        await client.aclose()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.out_dir.joinpath("session_id").write_text(session_id + "\n")
    args.out_dir.joinpath("turn_messages.json").write_text(_dump_json(turn.messages))
    args.out_dir.joinpath("messages.json").write_text(_dump_json(transcript))
    args.out_dir.joinpath("usage.json").write_text(_dump_json(turn.usage))
    args.out_dir.joinpath("turn_spans.json").write_text(_dump_json(turn_spans))
    args.out_dir.joinpath("stream_errors.json").write_text(_dump_json(turn.stream_errors))
    for error in turn.stream_errors:
        print(f"warning: the server ended the turn with an error: {error}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:6006")
    parser.add_argument("--model", required=True, help="Harbor provider/model name")
    parser.add_argument("--instruction-file", type=Path, default=None)
    parser.add_argument(
        "--seed-file",
        type=Path,
        default=None,
        help="Continue the session seeded by evals.harbor.pxi.insert_session_into_db instead of a new one",
    )
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument(
        "--session-id", default=None, help="Continue this session; omit to create one"
    )
    parser.add_argument("--allow-mutations", action="store_true")
    parser.add_argument("--approve-tool-calls", action="store_true")
    parser.add_argument("--turn-timeout-seconds", type=float, default=900.0)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
