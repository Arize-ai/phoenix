"""Build OpenInference spans for synthetic support-agent traces.

Task fixture builders (`tasks/phoenix-evals/<task>/fixture/build.py`) use this module to
write `fixture/spec.json` for the seeder and the hidden traces in `tests/`. IDs derive
from a case key, so rebuilding a fixture gives the same IDs.

Example:

    trace = Trace("refund-17", start=BASE + timedelta(hours=3), session_id="sess-17")
    trace.tool("get_order", {"order_id": "A-1001"}, {"status": "delivered"})
    trace.llm(messages, reply)
    trace.finish(user_message, reply)
    spans = trace.spans
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any

BASE = datetime(2026, 11, 3, 9, 0, tzinfo=timezone.utc)
MODEL = "gpt-5.6-mini"


def hex_id(key: str, length: int) -> str:
    return hashlib.sha256(key.encode()).hexdigest()[:length]


def _json(value: Any) -> str:
    return value if isinstance(value, str) else json.dumps(value)


class Trace:
    """One agent request: a root span with LLM, tool, and retriever children."""

    def __init__(
        self,
        key: str,
        *,
        start: datetime,
        root_name: str = "support-agent",
        root_kind: str = "AGENT",
        session_id: str | None = None,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.key = key
        self.trace_id = hex_id(f"trace:{key}", 32)
        self.root_id = hex_id(f"span:{key}:root", 16)
        self.start = start
        self.clock = start
        self.root_name = root_name
        self.root_kind = root_kind
        self.session_id = session_id
        self.user_id = user_id
        self.metadata = metadata or {}
        self.children: list[dict[str, Any]] = []
        self.root: dict[str, Any] | None = None

    def _span(
        self, name: str, kind: str, attributes: dict[str, Any], seconds: float, error: str | None
    ) -> dict[str, Any]:
        start = self.clock
        self.clock = start + timedelta(seconds=seconds)
        span: dict[str, Any] = {
            "name": name,
            "context": {
                "trace_id": self.trace_id,
                "span_id": hex_id(f"span:{self.key}:{len(self.children)}", 16),
            },
            "parent_id": self.root_id,
            "span_kind": kind,
            "start_time": start.isoformat(),
            "end_time": self.clock.isoformat(),
            "status_code": "ERROR" if error else "OK",
            "attributes": attributes,
        }
        if error:
            span["status_message"] = error
        self.children.append(span)
        return span

    def llm(
        self,
        messages: list[dict[str, str]],
        output: str,
        *,
        model: str = MODEL,
        seconds: float = 1.6,
        error: str | None = None,
    ) -> dict[str, Any]:
        """Adds an LLM call. `messages` are `{"role", "content"}` dicts."""
        attributes: dict[str, Any] = {
            "llm.model_name": model,
            "llm.provider": "openai",
            "input.value": json.dumps({"messages": messages}),
            "input.mime_type": "application/json",
            "output.value": output,
            "llm.token_count.prompt": sum(len(m["content"]) // 4 for m in messages),
            "llm.token_count.completion": len(output) // 4,
        }
        for index, message in enumerate(messages):
            attributes[f"llm.input_messages.{index}.message.role"] = message["role"]
            attributes[f"llm.input_messages.{index}.message.content"] = message["content"]
        attributes["llm.output_messages.0.message.role"] = "assistant"
        attributes["llm.output_messages.0.message.content"] = output
        return self._span("ChatCompletion", "LLM", attributes, seconds, error)

    def tool(
        self,
        name: str,
        arguments: dict[str, Any],
        result: Any,
        *,
        seconds: float = 0.3,
        error: str | None = None,
    ) -> dict[str, Any]:
        """Adds a tool call with JSON arguments and result."""
        attributes = {
            "tool.name": name,
            "tool.parameters": json.dumps(arguments),
            "input.value": json.dumps(arguments),
            "input.mime_type": "application/json",
            "output.value": _json(result),
            "output.mime_type": "application/json",
        }
        return self._span(name, "TOOL", attributes, seconds, error)

    def retrieve(
        self, query: str, documents: list[dict[str, Any]], *, name: str = "search_policies"
    ) -> dict[str, Any]:
        """Adds a retriever call. Documents are `{"id", "content", "score"}` dicts."""
        attributes: dict[str, Any] = {"input.value": query}
        for index, document in enumerate(documents):
            prefix = f"retrieval.documents.{index}.document"
            attributes[f"{prefix}.id"] = document["id"]
            attributes[f"{prefix}.content"] = document["content"]
            if "score" in document:
                attributes[f"{prefix}.score"] = document["score"]
        return self._span(name, "RETRIEVER", attributes, 0.4, None)

    def finish(self, user_input: Any, output: Any, *, error: str | None = None) -> None:
        """Adds the root span, which covers every child span."""
        attributes: dict[str, Any] = {
            "input.value": _json(user_input),
            "output.value": _json(output),
        }
        if self.session_id:
            attributes["session.id"] = self.session_id
        if self.user_id:
            attributes["user.id"] = self.user_id
        if self.metadata:
            attributes["metadata"] = json.dumps(self.metadata)
        self.clock += timedelta(seconds=0.2)
        self.root = {
            "name": self.root_name,
            "context": {"trace_id": self.trace_id, "span_id": self.root_id},
            "span_kind": self.root_kind,
            "start_time": self.start.isoformat(),
            "end_time": self.clock.isoformat(),
            "status_code": "ERROR" if error else "OK",
            "attributes": attributes,
        }
        if error:
            self.root["status_message"] = error

    @property
    def spans(self) -> list[dict[str, Any]]:
        if self.root is None:
            raise ValueError(f"{self.key}: call finish() first")
        return [self.root, *self.children]


def write_json(path: Any, value: Any) -> None:
    """Writes stable, readable JSON so fixture diffs stay reviewable."""
    from pathlib import Path

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, indent=1, sort_keys=False) + "\n")
