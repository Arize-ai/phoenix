#!/usr/bin/env python3
"""Run Phoenix's production ServerAgent against a local Phoenix database."""

import argparse
import asyncio
import json
import os
import re
from contextlib import nullcontext
from pathlib import Path
from uuid import uuid4

from asgi_lifespan import LifespanManager
from openinference.instrumentation import OITracer, TraceConfig, get_span_kind_attributes
from opentelemetry.sdk.trace import TracerProvider
from phoenix.otel import register, using_attributes
from pydantic_ai.messages import ModelMessagesTypeAdapter
from pydantic_ai.models import infer_model
from pydantic_ai.models.test import TestModel

from phoenix.db.engines import create_engine
from phoenix.server.agents.prompts import AgentPrompts, ServerAgentPrompts
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


def _resolve_allow_mutations(args: argparse.Namespace) -> bool:
    if args.allow_mutations:
        return True
    if args.step_config is not None and args.step_config.is_file():
        config = json.loads(args.step_config.read_text())
        return bool(config.get("allow_mutations", False))
    return False


def _load_or_create_session_id(session_id_file: Path | None) -> str:
    if session_id_file is not None and session_id_file.is_file():
        if session_id := session_id_file.read_text().strip():
            return session_id
    session_id = str(uuid4())
    if session_id_file is not None:
        session_id_file.parent.mkdir(parents=True, exist_ok=True)
        session_id_file.write_text(session_id + "\n")
    return session_id


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
                # Mirror the /agents route so the eval exercises the same base
                # prompt production serves, not build_server_agent's default.
                prompts=ServerAgentPrompts(base=AgentPrompts().base),
                allow_mutations=_resolve_allow_mutations(args),
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
    if args.history_file is not None:
        # Persist the full conversation so the next step resumes where this one
        # left off. The history file lives outside /logs/agent, which Harbor
        # empties between steps.
        args.history_file.parent.mkdir(parents=True, exist_ok=True)
        args.history_file.write_bytes(ModelMessagesTypeAdapter.dump_json(result.all_messages()))
    if args.latest_symlink is not None:
        # Step verifiers locate this step's outputs via this stable symlink.
        args.latest_symlink.parent.mkdir(parents=True, exist_ok=True)
        args.latest_symlink.unlink(missing_ok=True)
        args.latest_symlink.symlink_to(args.out_dir)
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, required=True)
    parser.add_argument("--instruction-file", type=Path, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--task-name", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--history-file", type=Path, default=None)
    parser.add_argument("--session-id-file", type=Path, default=None)
    parser.add_argument("--step-config", type=Path, default=None)
    parser.add_argument("--latest-symlink", type=Path, default=None)
    parser.add_argument("--allow-mutations", action="store_true")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
