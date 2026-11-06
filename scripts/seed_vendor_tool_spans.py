"""
Seed vendor tool test spans into a Phoenix database.

Inserts one trace per vendor tool example covering vendor-specific tools across providers:
  - OpenAI Responses API: namespace + tool_search (deferred function tools)
  - Google: google_search grounding
  - AWS Bedrock: systemTool / nova_grounding
  - Anthropic server tools: web_search, web_fetch, code_execution, tool_search_tool_regex
  - Anthropic client tools: bash, text_editor, memory

Usage:
    PHOENIX_SQL_DATABASE_URL=postgresql+asyncpg://postgres:phoenix@localhost:5432/postgres \
        python scripts/seed_vendor_tool_spans.py
"""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, TypedDict

from sqlalchemy import insert, select

from phoenix.config import get_env_database_connection_str
from phoenix.db.engines import create_engine
from phoenix.db.models import Project, Span, Trace


class SpanData(TypedDict):
    name: str
    span_kind: str
    duration: timedelta
    status_code: str
    status_message: str
    cumulative_error_count: int
    cumulative_llm_token_count_prompt: int
    cumulative_llm_token_count_completion: int
    llm_token_count_prompt: int
    llm_token_count_completion: int
    events: list[dict[str, Any]]
    attributes: dict[str, Any]


def _tool(schema: dict[str, Any]) -> dict[str, Any]:
    """Wrap a vendor tool JSON schema in Phoenix's tool envelope."""
    return {"tool": {"json_schema": json.dumps(schema)}}


def _llm_attrs(
    *,
    tools: list[dict[str, Any]],
    provider: str,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    user_message: str,
    assistant_message: str,
    raw_input: dict[str, Any],
    assistant_role: str = "assistant",
) -> dict[str, Any]:
    return {
        "llm": {
            "tools": tools,
            "provider": provider,
            "model_name": model_name,
            "token_count": {
                "total": prompt_tokens + completion_tokens,
                "prompt": prompt_tokens,
                "completion": completion_tokens,
            },
            "input_messages": [
                {"message": {"role": "user", "content": user_message}},
            ],
            "output_messages": [
                {"message": {"role": assistant_role, "content": assistant_message}},
            ],
        },
        "input": {
            "value": json.dumps(raw_input),
            "mime_type": "application/json",
        },
        "output": {"value": assistant_message, "mime_type": "text/plain"},
        "openinference": {"span": {"kind": "LLM"}},
    }


# -------- OpenAI Responses: tool_search + deferred function tools in a namespace --------
# spec: https://developers.openai.com/api/docs/guides/tools-tool-search

_OPENAI_USER = "List open orders for customer CUST-12345."
_OPENAI_REPLY = "Here are the open orders for customer CUST-12345."
_OPENAI_TOOLS = [
    _tool({"type": "tool_search"}),
    _tool(
        {
            "type": "namespace",
            "name": "crm",
            "description": "CRM tools for customer lookup and order management.",
            "tools": [
                {
                    "type": "function",
                    "name": "get_customer_profile",
                    "description": "Fetch a customer profile by customer ID.",
                    "parameters": {
                        "type": "object",
                        "properties": {"customer_id": {"type": "string"}},
                        "required": ["customer_id"],
                        "additionalProperties": False,
                    },
                },
                {
                    "type": "function",
                    "name": "list_open_orders",
                    "description": "List open orders for a customer ID.",
                    "defer_loading": True,
                    "parameters": {
                        "type": "object",
                        "properties": {"customer_id": {"type": "string"}},
                        "required": ["customer_id"],
                        "additionalProperties": False,
                    },
                },
            ],
        }
    ),
]

# -------- Google Gemini: google_search grounding --------
# spec: https://ai.google.dev/gemini-api/docs/google-search

_GOOGLE_USER = "Who won the euro 2024?"
_GOOGLE_REPLY = "Spain won the UEFA Euro 2024 tournament."

# -------- AWS Bedrock: nova_grounding via systemTool --------
# spec: https://docs.aws.amazon.com/nova/latest/nova2-userguide/web-grounding.html

_BEDROCK_USER = "What are the latest developments in quantum computing?"
_BEDROCK_REPLY = "Recent developments in quantum computing include..."

# -------- Anthropic server: web_search --------
# spec: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

_ANTHROPIC_WEB_SEARCH_USER = "What's the latest on the Mars rover?"
_ANTHROPIC_WEB_SEARCH_REPLY = "Mars rovers continue to make groundbreaking discoveries..."

# -------- Anthropic server: web_fetch --------
# spec: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool

_ANTHROPIC_WEB_FETCH_USER = (
    "Summarize the changelog at https://example.com/changelog for the latest release."
)
_ANTHROPIC_WEB_FETCH_REPLY = (
    "The latest release fixes a memory leak in the worker pool and adds a new "
    "/health/ready endpoint."
)

# -------- Anthropic server: code_execution --------
# spec: https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool

_ANTHROPIC_CODE_EXEC_USER = (
    "Compute the standard deviation of [4, 8, 15, 16, 23, 42] and show your work."
)
_ANTHROPIC_CODE_EXEC_REPLY = (
    "The standard deviation is approximately 12.79 (population) / 14.01 (sample)."
)

# -------- Anthropic server: tool_search_tool_regex with deferred function tools --------
# spec: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
# Note: the search tool's `name` MUST equal the type minus the date suffix
# (e.g. "tool_search_tool_regex"); deferred user tools have NO `type` field.

_ANTHROPIC_TOOL_SEARCH_USER = (
    "Find the tool that lists open invoices and call it for customer ACME-42."
)
_ANTHROPIC_TOOL_SEARCH_REPLY = "Found list_open_invoices and called it for customer ACME-42."
_ANTHROPIC_TOOL_SEARCH_TOOLS = [
    _tool(
        {"type": "tool_search_tool_regex_20251119", "name": "tool_search_tool_regex"},
    ),
    _tool(
        {
            "name": "get_invoice",
            "description": "Look up an invoice by ID.",
            "defer_loading": True,
            "input_schema": {
                "type": "object",
                "properties": {"invoice_id": {"type": "string"}},
                "required": ["invoice_id"],
            },
        }
    ),
    _tool(
        {
            "name": "list_open_invoices",
            "description": "List open invoices for a customer.",
            "defer_loading": True,
            "input_schema": {
                "type": "object",
                "properties": {"customer_id": {"type": "string"}},
                "required": ["customer_id"],
            },
        }
    ),
]

# -------- Anthropic client: bash --------
# spec: https://platform.claude.com/docs/en/agents-and-tools/tool-use/bash-tool

_ANTHROPIC_BASH_USER = "List the files in /var/log sorted by modification time."
_ANTHROPIC_BASH_REPLY = (
    "I ran `ls -lt /var/log` and the most recently modified files are syslog and auth.log."
)

# -------- Anthropic client: text_editor --------
# spec: https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool

_ANTHROPIC_TEXT_EDITOR_USER = "Update the version in pyproject.toml to 1.0.0."
_ANTHROPIC_TEXT_EDITOR_REPLY = "I opened pyproject.toml and replaced the version field with 1.0.0."

# -------- Anthropic client: memory --------
# spec: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool

_ANTHROPIC_MEMORY_USER = "Remember that my preferred deployment region is us-west-2."
_ANTHROPIC_MEMORY_REPLY = "Got it — I've stored your preferred region as us-west-2."


SPANS_DATA: list[SpanData] = [
    {
        "name": "Response",
        "span_kind": "LLM",
        "duration": timedelta(seconds=2.522244),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 676,
        "cumulative_llm_token_count_completion": 43,
        "llm_token_count_prompt": 676,
        "llm_token_count_completion": 43,
        "events": [],
        "attributes": _llm_attrs(
            tools=_OPENAI_TOOLS,
            provider="openai",
            model_name="gpt-5.4-2026-03-05",
            prompt_tokens=676,
            completion_tokens=43,
            user_message=_OPENAI_USER,
            assistant_message=_OPENAI_REPLY,
            raw_input={"input": _OPENAI_USER, "model": "gpt-5.4"},
        ),
    },
    {
        "name": "GenerateContent",
        "span_kind": "LLM",
        "duration": timedelta(seconds=4.235029),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 10,
        "cumulative_llm_token_count_completion": 74,
        "llm_token_count_prompt": 10,
        "llm_token_count_completion": 74,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"google_search": {}})],
            provider="google",
            model_name="gemini-2.5-flash-lite",
            prompt_tokens=10,
            completion_tokens=74,
            user_message=_GOOGLE_USER,
            assistant_message=_GOOGLE_REPLY,
            assistant_role="model",
            raw_input={
                "contents": [{"parts": [{"text": _GOOGLE_USER}], "role": "user"}],
                "tools": [{"google_search": {}}],
            },
        ),
    },
    {
        "name": "bedrock.converse",
        "span_kind": "LLM",
        "duration": timedelta(seconds=6.193924),
        "status_code": "UNSET",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 134,
        "cumulative_llm_token_count_completion": 607,
        "llm_token_count_prompt": 134,
        "llm_token_count_completion": 607,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"systemTool": {"name": "nova_grounding"}})],
            provider="aws_bedrock",
            model_name="us.amazon.nova-2-lite-v1:0",
            prompt_tokens=134,
            completion_tokens=607,
            user_message=_BEDROCK_USER,
            assistant_message=_BEDROCK_REPLY,
            raw_input={
                "modelId": "us.amazon.nova-2-lite-v1:0",
                "messages": [
                    {"role": "user", "content": [{"text": _BEDROCK_USER}]},
                ],
                "toolConfig": {"tools": [{"systemTool": {"name": "nova_grounding"}}]},
            },
        ),
    },
    {
        "name": "messages.create",
        "span_kind": "LLM",
        "duration": timedelta(seconds=27.790893),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 24842,
        "cumulative_llm_token_count_completion": 1023,
        "llm_token_count_prompt": 24842,
        "llm_token_count_completion": 1023,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"type": "web_search_20250305", "name": "web_search"})],
            provider="anthropic",
            model_name="claude-opus-4-6",
            prompt_tokens=24842,
            completion_tokens=1023,
            user_message=_ANTHROPIC_WEB_SEARCH_USER,
            assistant_message=_ANTHROPIC_WEB_SEARCH_REPLY,
            raw_input={
                "model": "claude-opus-4-6",
                "messages": [{"role": "user", "content": _ANTHROPIC_WEB_SEARCH_USER}],
                "tools": [{"type": "web_search_20250305", "name": "web_search"}],
            },
        ),
    },
    {
        "name": "messages.create",
        "span_kind": "LLM",
        "duration": timedelta(seconds=8.412331),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 18213,
        "cumulative_llm_token_count_completion": 412,
        "llm_token_count_prompt": 18213,
        "llm_token_count_completion": 412,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"type": "web_fetch_20250910", "name": "web_fetch"})],
            provider="anthropic",
            model_name="claude-opus-4-6",
            prompt_tokens=18213,
            completion_tokens=412,
            user_message=_ANTHROPIC_WEB_FETCH_USER,
            assistant_message=_ANTHROPIC_WEB_FETCH_REPLY,
            raw_input={
                "model": "claude-opus-4-6",
                "messages": [{"role": "user", "content": _ANTHROPIC_WEB_FETCH_USER}],
                "tools": [{"type": "web_fetch_20250910", "name": "web_fetch"}],
            },
        ),
    },
    {
        "name": "messages.create",
        "span_kind": "LLM",
        "duration": timedelta(seconds=5.174556),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 1842,
        "cumulative_llm_token_count_completion": 287,
        "llm_token_count_prompt": 1842,
        "llm_token_count_completion": 287,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"type": "code_execution_20250825", "name": "code_execution"})],
            provider="anthropic",
            model_name="claude-opus-4-6",
            prompt_tokens=1842,
            completion_tokens=287,
            user_message=_ANTHROPIC_CODE_EXEC_USER,
            assistant_message=_ANTHROPIC_CODE_EXEC_REPLY,
            raw_input={
                "model": "claude-opus-4-6",
                "messages": [{"role": "user", "content": _ANTHROPIC_CODE_EXEC_USER}],
                "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
            },
        ),
    },
    {
        "name": "messages.create",
        "span_kind": "LLM",
        "duration": timedelta(seconds=3.881204),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 612,
        "cumulative_llm_token_count_completion": 96,
        "llm_token_count_prompt": 612,
        "llm_token_count_completion": 96,
        "events": [],
        "attributes": _llm_attrs(
            tools=_ANTHROPIC_TOOL_SEARCH_TOOLS,
            provider="anthropic",
            model_name="claude-opus-4-6",
            prompt_tokens=612,
            completion_tokens=96,
            user_message=_ANTHROPIC_TOOL_SEARCH_USER,
            assistant_message=_ANTHROPIC_TOOL_SEARCH_REPLY,
            raw_input={
                "model": "claude-opus-4-6",
                "messages": [{"role": "user", "content": _ANTHROPIC_TOOL_SEARCH_USER}],
                "tools": [
                    {
                        "type": "tool_search_tool_regex_20251119",
                        "name": "tool_search_tool_regex",
                    },
                    {
                        "name": "get_invoice",
                        "description": "Look up an invoice by ID.",
                        "defer_loading": True,
                        "input_schema": {
                            "type": "object",
                            "properties": {"invoice_id": {"type": "string"}},
                            "required": ["invoice_id"],
                        },
                    },
                    {
                        "name": "list_open_invoices",
                        "description": "List open invoices for a customer.",
                        "defer_loading": True,
                        "input_schema": {
                            "type": "object",
                            "properties": {"customer_id": {"type": "string"}},
                            "required": ["customer_id"],
                        },
                    },
                ],
            },
        ),
    },
    {
        "name": "messages.create",
        "span_kind": "LLM",
        "duration": timedelta(seconds=2.345120),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 821,
        "cumulative_llm_token_count_completion": 134,
        "llm_token_count_prompt": 821,
        "llm_token_count_completion": 134,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"type": "bash_20250124", "name": "bash"})],
            provider="anthropic",
            model_name="claude-sonnet-4-6",
            prompt_tokens=821,
            completion_tokens=134,
            user_message=_ANTHROPIC_BASH_USER,
            assistant_message=_ANTHROPIC_BASH_REPLY,
            raw_input={
                "model": "claude-sonnet-4-6",
                "messages": [{"role": "user", "content": _ANTHROPIC_BASH_USER}],
                "tools": [{"type": "bash_20250124", "name": "bash"}],
            },
        ),
    },
    {
        "name": "messages.create",
        "span_kind": "LLM",
        "duration": timedelta(seconds=4.918002),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 1456,
        "cumulative_llm_token_count_completion": 218,
        "llm_token_count_prompt": 1456,
        "llm_token_count_completion": 218,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"})],
            provider="anthropic",
            model_name="claude-opus-4-6",
            prompt_tokens=1456,
            completion_tokens=218,
            user_message=_ANTHROPIC_TEXT_EDITOR_USER,
            assistant_message=_ANTHROPIC_TEXT_EDITOR_REPLY,
            raw_input={
                "model": "claude-opus-4-6",
                "messages": [{"role": "user", "content": _ANTHROPIC_TEXT_EDITOR_USER}],
                "tools": [
                    {
                        "type": "text_editor_20250728",
                        "name": "str_replace_based_edit_tool",
                    },
                ],
            },
        ),
    },
    {
        "name": "messages.create",
        "span_kind": "LLM",
        "duration": timedelta(seconds=1.732894),
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 542,
        "cumulative_llm_token_count_completion": 47,
        "llm_token_count_prompt": 542,
        "llm_token_count_completion": 47,
        "events": [],
        "attributes": _llm_attrs(
            tools=[_tool({"type": "memory_20250818", "name": "memory"})],
            provider="anthropic",
            model_name="claude-sonnet-4-6",
            prompt_tokens=542,
            completion_tokens=47,
            user_message=_ANTHROPIC_MEMORY_USER,
            assistant_message=_ANTHROPIC_MEMORY_REPLY,
            raw_input={
                "model": "claude-sonnet-4-6",
                "messages": [{"role": "user", "content": _ANTHROPIC_MEMORY_USER}],
                "tools": [{"type": "memory_20250818", "name": "memory"}],
            },
        ),
    },
]


async def main() -> None:
    connection_str = get_env_database_connection_str()
    engine = create_engine(connection_str, migrate=False)

    async with engine.begin() as conn:
        result = await conn.execute(select(Project.id).where(Project.name == "default"))
        project_id = result.scalar_one_or_none()
        if project_id is None:
            raise SystemExit("No project named 'default' found")

        inserted_span_ids: list[tuple[int, str, str, str]] = []
        for span_data in SPANS_DATA:
            start_time = datetime.now(timezone.utc)
            end_time = start_time + span_data["duration"]

            trace_id = token_hex(16)
            trace_result = await conn.execute(
                insert(Trace)
                .values(
                    project_rowid=project_id,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
                .returning(Trace.id)
            )
            trace_rowid = trace_result.scalar_one()

            span_id = token_hex(8)
            result = await conn.execute(
                insert(Span)
                .values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=None,
                    name=span_data["name"],
                    span_kind=span_data["span_kind"],
                    start_time=start_time,
                    end_time=end_time,
                    attributes=span_data["attributes"],
                    events=span_data["events"],
                    status_code=span_data["status_code"],
                    status_message=span_data["status_message"],
                    cumulative_error_count=span_data["cumulative_error_count"],
                    cumulative_llm_token_count_prompt=span_data[
                        "cumulative_llm_token_count_prompt"
                    ],
                    cumulative_llm_token_count_completion=span_data[
                        "cumulative_llm_token_count_completion"
                    ],
                    llm_token_count_prompt=span_data["llm_token_count_prompt"],
                    llm_token_count_completion=span_data["llm_token_count_completion"],
                )
                .returning(Span.id)
            )
            db_id = result.scalar_one()
            inserted_span_ids.append((db_id, span_id, span_data["name"], trace_id))
            print(
                f"  Inserted trace_id={trace_id} span id={db_id} "
                f"span_id={span_id} ({span_data['name']})"
            )

    print("\nTrace IDs (one per span):")
    for _, _, _, tid in inserted_span_ids:
        print(f"  {tid}")
    print("Verifying spans exist...")
    async with engine.begin() as conn:
        for db_id, span_id, name, _ in inserted_span_ids:
            result = await conn.execute(
                select(Span.id, Span.span_id, Span.name).where(Span.id == db_id)
            )
            row = result.one_or_none()
            if row:
                print(f"  OK  id={row[0]} span_id={row[1]} name={row[2]}")
            else:
                print(f"  MISSING  id={db_id} span_id={span_id} name={name}")

    print(f"\nDone. {len(SPANS_DATA)} spans inserted.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
