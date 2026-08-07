"""Input-mapping recipes for :class:`RetrievalRelevanceEvaluator`.

The evaluator itself is source-agnostic: it only needs an ``input`` (the request)
and a ``retrieved_context`` (the retrieved information). The generalization across
retrieval patterns lives here — helpers that pull those two fields out of a
Phoenix span, regardless of whether the retrieval happened via a RETRIEVER span,
a RERANKER, a TOOL / MCP call, or content embedded in an LLM turn.

The functions accept a *span record* in either of the two shapes Phoenix hands
back:

- a flattened row from ``client.spans.get_spans_dataframe(...).to_dict(...)``,
  where attributes are flat keys like ``"attributes.retrieval.documents"``; or
- a nested dict with an ``"attributes"`` mapping.

``build_eval_input`` is the main entry point: give it any span and it returns
``{"input": ..., "retrieved_context": ...}`` if the span is a retrieval step, or
``None`` if it is not (an action tool, a pure-LLM turn, an empty result, …) so
callers can skip it.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Mapping, Optional

EvalInput = dict[str, str]
SpanLike = Mapping[str, Any]

__all__ = [
    "build_eval_input",
    "from_retriever",
    "from_reranker",
    "from_tool",
    "from_llm_embedded",
]


# --------------------------------------------------------------------------- #
# Attribute access (works on both flattened rows and nested attribute dicts)
# --------------------------------------------------------------------------- #


def _attr(span: SpanLike, path: str) -> Any:
    """Read an OpenInference attribute by its dotted `path` (without the
    leading ``attributes.``), tolerating both the flattened-column form and the
    nested-dict form."""
    flat = f"attributes.{path}"
    if flat in span:
        return span[flat]
    if path in span:
        return span[path]
    node: Any = span.get("attributes", span)
    for part in path.split("."):
        if isinstance(node, Mapping) and part in node:
            node = node[part]
        else:
            return None
    return node


def _span_kind(span: SpanLike) -> str:
    kind = (
        span.get("span_kind")
        or span.get("openinference.span.kind")
        or _attr(span, "openinference.span.kind")
        or ""
    )
    return str(kind).upper()


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return value if isinstance(value, str) else json.dumps(value, default=str)


def _join(parts: list[str]) -> str:
    return "\n\n".join(p.strip() for p in parts if p and str(p).strip())


def _doc_content(doc: Any) -> str:
    """Pull text out of a single retrieved document, which may be flattened
    (``{"document.content": ...}``) or nested (``{"document": {"content": ...}}``)."""
    if isinstance(doc, Mapping):
        if "document.content" in doc:
            return _clean(doc["document.content"])
        inner = doc.get("document")
        if isinstance(inner, Mapping) and "content" in inner:
            return _clean(inner["content"])
    return _clean(doc)


# --------------------------------------------------------------------------- #
# Per-shape extractors
# --------------------------------------------------------------------------- #


def from_retriever(span: SpanLike) -> Optional[EvalInput]:
    """RETRIEVER span: query in ``input.value``, docs in ``retrieval.documents``."""
    docs = _attr(span, "retrieval.documents")
    context = _join([_doc_content(d) for d in docs]) if isinstance(docs, list) else ""
    if not context:
        return None
    return {"input": _clean(_attr(span, "input.value")), "retrieved_context": context}


def from_reranker(span: SpanLike) -> Optional[EvalInput]:
    """RERANKER span: judge the post-rerank set (what actually reaches the LLM)."""
    docs = _attr(span, "reranker.output_documents")
    context = _join([_doc_content(d) for d in docs]) if isinstance(docs, list) else ""
    if not context:
        return None
    query = _clean(_attr(span, "reranker.query")) or _clean(_attr(span, "input.value"))
    return {"input": query, "retrieved_context": context}


def from_tool(span: SpanLike, request: Optional[str] = None) -> Optional[EvalInput]:
    """TOOL span (knowledge base, web search, MCP, SQL): retrieved info is in
    ``output.value``.

    Pass ``request`` with the user's request — it is almost always the right
    thing to judge against, because a tool's own ``input.value`` is a
    reformulated argument (or generated SQL), not the user's question. Falls
    back to ``input.value`` when no ``request`` is given.
    """
    raw = _attr(span, "output.value")
    context = _tool_output_to_text(raw)
    if not context:
        return None
    query = request if request is not None else _clean(_attr(span, "input.value"))
    return {"input": query, "retrieved_context": context}


def from_llm_embedded(span: SpanLike, request: Optional[str] = None) -> Optional[EvalInput]:
    """LLM span whose retrieved info is embedded in the output message content
    blocks (e.g. native/server-side web search)."""
    texts: list[str] = []
    messages = _attr(span, "llm.output_messages")
    if isinstance(messages, list):
        for msg in messages:
            contents = _message_contents(msg)
            for block in contents:
                if isinstance(block, Mapping):
                    text = block.get("message_content.text")
                    if text is None and isinstance(block.get("message_content"), Mapping):
                        text = block["message_content"].get("text")
                    if text:
                        texts.append(_clean(text))
    context = _join(texts)
    if not context:
        return None
    if request is None:
        request = _first_user_message(span)
    return {"input": _clean(request), "retrieved_context": context}


# --------------------------------------------------------------------------- #
# Auto dispatch
# --------------------------------------------------------------------------- #


def build_eval_input(
    span: SpanLike,
    request: Optional[str] = None,
    include_tool: Optional[Callable[[SpanLike], bool]] = None,
) -> Optional[EvalInput]:
    """Return ``{"input", "retrieved_context"}`` for a retrieval step, or
    ``None`` if the span is not a retrieval step (skip it).

    Args:
        span: A Phoenix span record (flattened row or nested attribute dict).
        request: The user's request. Strongly recommended for TOOL / LLM spans,
            where the local query field is reformulated or absent. Typically the
            trace root's ``input.value``.
        include_tool: Optional predicate deciding whether a TOOL span is a
            *retrieval* tool (vs. an action tool like ``send_email``, which
            should be skipped). Defaults to treating any TOOL span with a
            non-empty output as retrieval.
    """
    kind = _span_kind(span)
    if kind == "RETRIEVER":
        return from_retriever(span)
    if kind == "RERANKER":
        return from_reranker(span)
    if kind == "TOOL":
        if include_tool is not None and not include_tool(span):
            return None
        return from_tool(span, request=request)
    if kind == "LLM":
        # Only counts as retrieval if information is embedded in the output.
        return from_llm_embedded(span, request=request)
    return None


# --------------------------------------------------------------------------- #
# internals
# --------------------------------------------------------------------------- #


def _message_contents(msg: Any) -> list[Any]:
    if isinstance(msg, Mapping):
        contents = msg.get("message.contents")
        if contents is None and isinstance(msg.get("message"), Mapping):
            contents = msg["message"].get("contents")
        if isinstance(contents, list):
            return contents
    return []


def _msg_field(msg: Any, field: str) -> Any:
    """Read ``message.<field>`` from a message that may be flattened or nested."""
    if not isinstance(msg, Mapping):
        return None
    flat = msg.get(f"message.{field}")
    if flat is not None:
        return flat
    inner = msg.get("message")
    if isinstance(inner, Mapping):
        return inner.get(field)
    return None


def _first_user_message(span: SpanLike) -> str:
    messages = _attr(span, "llm.input_messages")
    if isinstance(messages, list):
        for msg in messages:
            if _msg_field(msg, "role") == "user":
                content = _msg_field(msg, "content")
                if content:
                    return _clean(content)
    return ""


def _tool_output_to_text(raw: Any) -> str:
    """Turn a tool/MCP/SQL output into readable retrieved text, pulling common
    content fields out of structured payloads to reduce noise."""
    value: Any = raw
    if isinstance(raw, str):
        try:
            value = json.loads(raw)
        except (ValueError, TypeError):
            return raw.strip()

    # MCP-style envelope: {"results": [{"content": ...}, ...]}
    if isinstance(value, Mapping) and isinstance(value.get("results"), list):
        value = value["results"]

    if isinstance(value, list):
        parts = [_record_to_text(item) for item in value]
        return _join(parts)
    if isinstance(value, Mapping):
        return _record_to_text(value)
    return _clean(value)


def _record_to_text(item: Any) -> str:
    if not isinstance(item, Mapping):
        return _clean(item)
    # Prefer human-readable content fields when present.
    for key in ("content", "text", "snippet", "body"):
        if key in item and item[key]:
            title = item.get("title")
            return f"{title}: {item[key]}" if title else _clean(item[key])
    return json.dumps(item, default=str)
