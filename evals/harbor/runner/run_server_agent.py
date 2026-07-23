#!/usr/bin/env python3
"""Run Phoenix's production ServerAgent against a local Phoenix database."""

import argparse
import asyncio
import json
import os
import re
from contextlib import nullcontext
from pathlib import Path
from typing import Any, Sequence
from uuid import uuid4

from asgi_lifespan import LifespanManager
from openinference.instrumentation import OITracer, TraceConfig, get_span_kind_attributes
from opentelemetry.sdk.trace import TracerProvider
from phoenix.otel import register, using_attributes
from pydantic_ai.messages import ModelMessagesTypeAdapter
from pydantic_ai.models import infer_model
from pydantic_ai.models.test import TestModel

from phoenix.db.engines import create_engine
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.agents.server_agents import build_server_agent
from phoenix.server.app import _db, create_app
from phoenix.server.types import DbSessionFactory

_DEFAULT_TRACE_PROJECT_NAME = "harbor-server-agent-evals"
_TRACE_ENDPOINT_ENV_VAR = "HARBOR_PHOENIX_COLLECTOR_ENDPOINT"
_TRACE_API_KEY_ENV_VAR = "HARBOR_PHOENIX_API_KEY"
_TRACE_PROJECT_NAME_ENV_VAR = "HARBOR_PHOENIX_PROJECT_NAME"


def _build_tracer_provider() -> TracerProvider | None:
    if not (endpoint := os.getenv(_TRACE_ENDPOINT_ENV_VAR)):
        return None
    endpoint = endpoint.rstrip("/")
    if not endpoint.endswith("/v1/traces"):
        endpoint = f"{endpoint}/v1/traces"
    return register(
        endpoint=endpoint,
        api_key=os.getenv(_TRACE_API_KEY_ENV_VAR) or None,
        project_name=os.getenv(_TRACE_PROJECT_NAME_ENV_VAR) or _DEFAULT_TRACE_PROJECT_NAME,
        batch=True,
        set_global_tracer_provider=False,
        verbose=False,
        protocol="http/protobuf",
    )


def _load_or_create_session_id(session_id_file: Path | None) -> str:
    if session_id_file is not None and session_id_file.is_file():
        if session_id := session_id_file.read_text().strip():
            return session_id
    session_id = str(uuid4())
    if session_id_file is not None:
        session_id_file.parent.mkdir(parents=True, exist_ok=True)
        session_id_file.write_text(session_id + "\n")
    return session_id


def _text_of(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, (list, tuple)):
        texts = [c if isinstance(c, str) else getattr(c, "text", None) for c in content]
        if any(texts):
            return "\n".join(t for t in texts if t)
    return json.dumps(content, default=str)


def _tool_args(part: object) -> dict[str, Any]:
    args = getattr(part, "args", None)
    if isinstance(args, dict):
        return args
    if isinstance(args, str):
        try:
            parsed = json.loads(args)
        except json.JSONDecodeError:
            return {"value": args}
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    return {}


def _timestamp_of(obj: object) -> str | None:
    timestamp = getattr(obj, "timestamp", None)
    return timestamp.isoformat() if timestamp is not None else None


def _usage_metrics(usage: object) -> dict[str, Any] | None:
    metrics = {
        "prompt_tokens": getattr(usage, "input_tokens", None),
        "completion_tokens": getattr(usage, "output_tokens", None),
        "cached_tokens": getattr(usage, "cache_read_tokens", None),
    }
    metrics = {k: v for k, v in metrics.items() if v}
    return metrics or None


def build_trajectory(
    messages: Sequence[Any], history_count: int, model_name: str, session_id: str
) -> dict[str, Any] | None:
    """Convert pydantic-ai messages to Harbor's ATIF v1.7 trajectory format."""
    steps: list[dict[str, Any]] = []
    last_agent_step: dict[str, Any] | None = None

    def add_step(source: str, is_history: bool, **fields: object) -> dict[str, Any]:
        step = {"step_id": len(steps) + 1, "source": source, **fields}
        if is_history:
            step["is_copied_context"] = True
        steps.append({k: v for k, v in step.items() if v is not None})
        return steps[-1]

    for index, message in enumerate(messages):
        is_history = index < history_count
        if getattr(message, "kind", None) == "response":
            texts, thoughts, tool_calls = [], [], []
            for part in message.parts:
                kind = getattr(part, "part_kind", "")
                if kind == "text":
                    texts.append(part.content)
                elif kind == "thinking":
                    thoughts.append(part.content)
                elif kind == "tool-call":
                    tool_calls.append(
                        {
                            "tool_call_id": part.tool_call_id,
                            "function_name": part.tool_name,
                            "arguments": _tool_args(part),
                        }
                    )
            last_agent_step = add_step(
                "agent",
                is_history,
                timestamp=_timestamp_of(message),
                model_name=getattr(message, "model_name", None),
                message="\n\n".join(texts),
                reasoning_content="\n\n".join(thoughts) or None,
                tool_calls=tool_calls or None,
                metrics=_usage_metrics(getattr(message, "usage", None)),
                llm_call_count=1,
            )
            continue
        for part in getattr(message, "parts", []):
            kind = getattr(part, "part_kind", "")
            if kind == "system-prompt":
                add_step("system", is_history, message=_text_of(part.content))
            elif kind == "user-prompt":
                add_step(
                    "user",
                    is_history,
                    timestamp=_timestamp_of(part),
                    message=_text_of(part.content),
                )
            elif kind in ("tool-return", "retry-prompt") and last_agent_step is not None:
                call_id = getattr(part, "tool_call_id", None)
                known_ids = {c["tool_call_id"] for c in last_agent_step.get("tool_calls", [])}
                result: dict[str, Any] = {"content": _text_of(part.content)}
                if call_id in known_ids:
                    result["source_call_id"] = call_id
                observation = last_agent_step.setdefault("observation", {"results": []})
                observation["results"].append(result)
            else:
                add_step("user", is_history, message=_text_of(part.content))

    if not steps:
        return None
    totals = {
        "total_prompt_tokens": sum(s.get("metrics", {}).get("prompt_tokens", 0) for s in steps),
        "total_completion_tokens": sum(
            s.get("metrics", {}).get("completion_tokens", 0) for s in steps
        ),
        "total_steps": len(steps),
    }
    try:
        from phoenix import __version__

        phoenix_version = str(__version__ or "unknown")
    except ImportError:
        phoenix_version = "unknown"
    return {
        "schema_version": "ATIF-v1.7",
        "session_id": session_id,
        "agent": {
            "name": "phoenix-server-agent",
            "version": phoenix_version,
            "model_name": model_name,
        },
        "steps": steps,
        "final_metrics": totals,
    }


async def run(args: argparse.Namespace) -> None:
    engine = create_engine(f"sqlite:///{args.db_path}")
    db = DbSessionFactory(db=_db(engine), dialect="sqlite")
    app = create_app(db=db, authentication_enabled=False, serve_ui=False)
    session_id = _load_or_create_session_id(args.session_id_file)
    model = TestModel(call_tools=[]) if args.model == "test" else infer_model(args.model)
    tracer_provider = _build_tracer_provider()
    tracer = None
    if tracer_provider is not None:
        tracer = OITracer(
            tracer_provider.get_tracer("phoenix.server.agents"),
            config=TraceConfig(),
        )
        model = OpenInferenceModelWrapper(
            model,
            tracer=tracer,
        )
    history = None
    if args.history_file and args.history_file.is_file():
        history = ModelMessagesTypeAdapter.validate_json(args.history_file.read_bytes())
    try:
        # App startup takes ~6s in the eval container; asgi-lifespan defaults to 5s.
        async with LifespanManager(app, startup_timeout=120, shutdown_timeout=120):
            agent = build_server_agent(
                model=model,
                schema=app.state.graphql_schema,
                build_graphql_context=lambda: app.state.build_graphql_context(None),
                db=db,
                event_queue=app.state.build_graphql_context(None).event_queue,
                allow_mutations=args.allow_mutations,
                tracer_provider=tracer_provider,
            )
            trace_context = (
                tracer.start_as_current_span(
                    "harbor.trajectory.step",
                    attributes=get_span_kind_attributes("chain"),
                )
                if tracer is not None
                else nullcontext()
            )
            with (
                using_attributes(
                    session_id=session_id,
                    metadata={"task_name": args.task_name},
                ),
                trace_context,
            ):
                result = await agent.run(args.instruction_file.read_text(), message_history=history)
    finally:
        if tracer_provider is not None:
            tracer_provider.force_flush()
            tracer_provider.shutdown()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    answer = result.output
    blocks = re.findall(r"```json\s*(.*?)```", answer, flags=re.DOTALL | re.IGNORECASE)
    parsed = json.loads(blocks[-1]) if blocks else {}
    args.out_dir.joinpath("answer.md").write_text(answer)
    args.out_dir.joinpath("answer.json").write_text(json.dumps(parsed, indent=2) + "\n")
    args.out_dir.joinpath("messages.json").write_bytes(
        ModelMessagesTypeAdapter.dump_json(result.all_messages())
    )
    args.out_dir.joinpath("new_messages.json").write_bytes(
        ModelMessagesTypeAdapter.dump_json(result.new_messages())
    )
    usage_attribute = result.usage
    usage = usage_attribute() if callable(usage_attribute) else usage_attribute
    usage_payload = (
        usage.model_dump(mode="json") if hasattr(usage, "model_dump") else usage.__dict__
    )
    args.out_dir.joinpath("usage.json").write_text(
        json.dumps(usage_payload, indent=2, default=str) + "\n"
    )
    if args.trajectory_file:
        trajectory = build_trajectory(
            result.all_messages(),
            history_count=len(history or []),
            model_name=args.model,
            session_id=session_id,
        )
        if trajectory is not None:
            args.trajectory_file.parent.mkdir(parents=True, exist_ok=True)
            args.trajectory_file.write_text(json.dumps(trajectory, indent=2) + "\n")
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, required=True)
    parser.add_argument("--instruction-file", type=Path, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--task-name", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--history-file", type=Path, default=None)
    parser.add_argument("--trajectory-file", type=Path, default=None)
    parser.add_argument("--session-id-file", type=Path, default=None)
    parser.add_argument("--allow-mutations", action="store_true")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
