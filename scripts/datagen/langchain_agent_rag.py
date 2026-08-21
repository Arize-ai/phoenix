#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx==0.28.1",
#   "langchain-core==0.3.75",
#   "langchain-openai==0.3.32",
#   "openai==2.54.0",
#   "openinference-instrumentation-langchain==0.1.11",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record LangChain agent, retriever, tool, and LLM spans as OTLP JSON lines."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
from pathlib import Path
from typing import Any, Sequence

import httpx
from google.protobuf.json_format import MessageToJson
from langchain_core.documents import Document
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import RunnableLambda
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from openinference.instrumentation import get_attributes_from_context, using_session
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import (
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)

SCENARIO_NAME = "langchain_agent_rag"
SESSIONS = {
    "shipping-help": (
        "When should my standard-delivery order arrive in 10001?",
        "Would express shipping to 94107 arrive sooner?",
        "My order has no carrier scan yet. Is that always a problem?",
        "Summarize what I should tell the customer about the delivery window.",
    ),
    "returns-help": (
        "Can I return an unused backpack bought 18 days ago?",
        "When will the refund appear after I mail it back?",
        "What changes if the item was marked final sale?",
    ),
    "account-safety": (
        "I saw an account login I do not recognize. What should I do first?",
        "Does changing my password sign out my other sessions?",
        "When should support escalate an account-security case?",
    ),
}
POLICY_DOCUMENTS = (
    Document(
        page_content=(
            "Standard delivery normally takes 4–6 business days after "
            "fulfillment. Express delivery takes 1–2 business days. A carrier "
            "scan may take up to 24 hours to appear."
        ),
        metadata={"source": "shipping-policy", "section": "delivery-windows"},
    ),
    Document(
        page_content=(
            "Unused items can be returned within 30 days of purchase. Refunds "
            "are issued after the warehouse scan and usually appear within 3–5 "
            "business days. Final-sale items are ineligible."
        ),
        metadata={"source": "returns-policy", "section": "eligibility"},
    ),
    Document(
        page_content=(
            "For an unfamiliar login, reset the password, revoke other sessions, "
            "and enable multi-factor authentication. Escalate when activity "
            "continues or account ownership cannot be verified."
        ),
        metadata={"source": "account-security", "section": "unfamiliar-activity"},
    ),
)


class JsonlOtlpExporter(SpanExporter):
    def __init__(self, path: Path) -> None:
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("")

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        request = encode_spans(spans)
        payload = json.loads(MessageToJson(request, indent=None))
        with self._path.open("a") as output:
            output.write(json.dumps(payload, separators=(",", ":")) + "\n")
        return SpanExportResult.SUCCESS


class OpenInferenceContextSpanProcessor(SpanProcessor):
    def on_start(self, span: Span, parent_context: Any = None) -> None:
        span.set_attributes(dict(get_attributes_from_context()))

    def on_end(self, span: ReadableSpan) -> None:
        pass

    def shutdown(self) -> None:
        pass


class PolicyRetriever(BaseRetriever):
    documents: tuple[Document, ...]

    def _get_relevant_documents(self, query: str, *, run_manager: Any) -> list[Document]:
        query_words = set(query.lower().replace("-", " ").split())
        ranked = sorted(
            self.documents,
            key=lambda document: len(query_words & set(document.page_content.lower().split())),
            reverse=True,
        )
        return ranked[:2]


@tool
def estimate_delivery_days(postal_code: str, service_level: str) -> str:
    """Estimate an order's delivery window for a postal code and service level."""
    if service_level.lower() == "express":
        return f"in 1–2 business days to {postal_code}"
    return f"in 4–6 business days to {postal_code}"


def _iter_spans(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        span
        for resource_spans in payload.get("resourceSpans", [])
        for scope_spans in resource_spans.get("scopeSpans", [])
        for span in scope_spans.get("spans", [])
    ]


def _attribute(span: dict[str, Any], key: str) -> Any:
    for attribute in span.get("attributes", []):
        if attribute.get("key") == key:
            return next(iter(attribute.get("value", {}).values()), None)
    return None


def write_manifest(output_dir: Path) -> None:
    spans = [
        span
        for line in (output_dir / "traces.jsonl").read_text().splitlines()
        for span in _iter_spans(json.loads(line))
    ]
    manifest = {
        "scenario_name": SCENARIO_NAME,
        "instrumenter_package_versions": {
            package: importlib.metadata.version(package)
            for package in (
                "openinference-instrumentation-langchain",
                "openinference-semantic-conventions",
            )
        },
        "trace_count": len({span["traceId"] for span in spans}),
        "span_count": len(spans),
        "span_kinds": sorted(
            {kind for span in spans if (kind := _attribute(span, "openinference.span.kind"))}
        ),
        "session_structure": {
            "session_count": len(SESSIONS),
            "turns_per_session": {session_id: len(turns) for session_id, turns in SESSIONS.items()},
        },
        "encoding_notes": (
            "Each line is one protobuf-JSON ExportTraceServiceRequest. A "
            "SimpleSpanProcessor exports one completed span per request, so "
            "spans from the same trace can occupy separate lines."
        ),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def in_process_http_client() -> httpx.Client:
    from mock_openai_provider import create_chat_completion

    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=create_chat_completion(json.loads(request.content)))

    return httpx.Client(transport=httpx.MockTransport(handle))


def make_agent(base_url: str, http_client: httpx.Client | None = None) -> RunnableLambda:
    retriever = PolicyRetriever(documents=POLICY_DOCUMENTS)
    model = ChatOpenAI(
        model="gpt-4.1-mini",
        base_url=base_url,
        api_key=os.getenv("OPENAI_API_KEY", "datagen-dummy-key"),
        temperature=0,
        http_client=http_client,
    )
    model_with_tools = model.bind_tools([estimate_delivery_days])

    def run_agent(inputs: dict[str, Any]) -> dict[str, Any]:
        query = str(inputs["query"])
        history = list(inputs.get("history", []))
        documents = retriever.invoke(query)
        context = "\n\n".join(document.page_content for document in documents)
        messages: list[BaseMessage] = [
            SystemMessage(
                content=(
                    "Answer customer-support questions using the policy excerpts "
                    "below. Use the delivery "
                    f"estimator when a delivery window is requested.\n\n{context}"
                )
            ),
            *history,
            HumanMessage(content=query),
        ]
        draft = model_with_tools.invoke(messages)
        if not draft.tool_calls:
            return {"answer": draft.content, "message": draft}

        tool_messages: list[ToolMessage] = []
        for tool_call in draft.tool_calls:
            result = estimate_delivery_days.invoke(tool_call["args"])
            tool_messages.append(
                ToolMessage(content=result, tool_call_id=tool_call["id"], name=tool_call["name"])
            )
        final = model.invoke([*messages, draft, *tool_messages])
        return {"answer": final.content, "message": final}

    return RunnableLambda(run_agent).with_config({"run_name": "customer_support_agent"})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_output = (
        Path(__file__).resolve().parents[2] / "src/phoenix/datagen/assets" / SCENARIO_NAME
    )
    parser.add_argument("--output-dir", type=Path, default=default_output)
    parser.add_argument(
        "--base-url", default=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8765/v1")
    )
    parser.add_argument("--in-process-provider", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    provider = TracerProvider(
        resource=Resource.create({"service.name": f"datagen.{SCENARIO_NAME}"})
    )
    exporter = JsonlOtlpExporter(args.output_dir / "traces.jsonl")
    provider.add_span_processor(OpenInferenceContextSpanProcessor())
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    LangChainInstrumentor().instrument(tracer_provider=provider)
    agent = make_agent(
        args.base_url, in_process_http_client() if args.in_process_provider else None
    )

    for session_id, turns in SESSIONS.items():
        history: list[BaseMessage] = []
        with using_session(session_id):
            for turn in turns:
                result = agent.invoke({"query": turn, "history": history})
                history.extend(
                    [
                        HumanMessage(content=turn),
                        AIMessage(content=str(result["answer"])),
                    ]
                )

    provider.shutdown()
    write_manifest(args.output_dir)
    print(f"Recorded {SCENARIO_NAME} in {args.output_dir}")


if __name__ == "__main__":
    main()
