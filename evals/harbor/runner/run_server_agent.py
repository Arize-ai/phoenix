#!/usr/bin/env python3
"""Run Phoenix's production ServerAgent against a local Phoenix database."""

import argparse
import asyncio
import json
import re
from pathlib import Path

from asgi_lifespan import LifespanManager
from pydantic_ai.messages import ModelMessagesTypeAdapter
from pydantic_ai.models import infer_model
from pydantic_ai.models.test import TestModel

from phoenix.db.engines import create_engine
from phoenix.server.agents.server_agents import build_server_agent
from phoenix.server.app import _db, create_app
from phoenix.server.types import DbSessionFactory


async def run(args: argparse.Namespace) -> None:
    engine = create_engine(f"sqlite:///{args.db_path}", migrate=False)
    db = DbSessionFactory(db=_db(engine), dialect="sqlite")
    app = create_app(db=db, authentication_enabled=False, serve_ui=False)
    model = TestModel(call_tools=[]) if args.model == "test" else infer_model(args.model)
    history = None
    if args.history_file and args.history_file.is_file():
        history = ModelMessagesTypeAdapter.validate_json(args.history_file.read_bytes())
    async with LifespanManager(app):
        agent = build_server_agent(
            model=model,
            schema=app.state.graphql_schema,
            build_graphql_context=lambda: app.state.build_graphql_context(None),
            db=db,
            event_queue=app.state.build_graphql_context(None).event_queue,
            allow_mutations=args.allow_mutations,
        )
        result = await agent.run(args.instruction_file.read_text(), message_history=history)
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
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, required=True)
    parser.add_argument("--instruction-file", type=Path, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--history-file", type=Path, default=None)
    parser.add_argument("--allow-mutations", action="store_true")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
