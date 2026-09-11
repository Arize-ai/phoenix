"""Normal Phoenix server with observational native-tool dispatch logging.

This entrypoint runs only in the per-trial target container. It does not rewrite
queries, filter data, disable migrations, or override authorization.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

from fastmcp.server.middleware import Middleware


class ToolMeasurements(Middleware):
    def __init__(self, log: Any):
        self.log = log

    async def on_call_tool(self, context: Any, call_next: Any) -> Any:
        name = context.message.name
        args = context.message.arguments or {}
        event = {"operation": name, "call_id": uuid.uuid4().hex}
        self.log(kind="tool_operation", **event, phase="started")
        try:
            result = await call_next(context)
        except BaseException:
            self.log(
                kind="tool_operation",
                **event,
                phase="completed",
                outcome="error",
                error_envelope=True,
            )
            raise
        content = result.structured_content
        error = result.is_error or (isinstance(content, dict) and "error" in content)
        outcome = "error" if error else "success"
        if name == "executeSql" and not isinstance(content, dict):
            outcome = "unknown"
        self.log(
            kind="tool_operation",
            **event,
            phase="completed",
            outcome=outcome,
            error_envelope=bool(error),
            validate_only=bool(args.get("validate_only", False)),
        )
        return result


def main() -> None:
    if os.environ.get("PHOENIX_WORKING_DIR") != "/data":
        raise RuntimeError("Target requires its own container working directory")
    import phoenix.server.app as application
    from phoenix.config import get_env_mcp_code_mode
    from phoenix.server.mcp_server import build_phoenix_mcp_server

    def log(**event: Any) -> None:
        with Path("/evidence/operations.jsonl").open("a") as stream:
            stream.write(json.dumps(event) + "\n")

    def build(app: Any, *, monty_runtime: Any = None, db: Any) -> Any:
        mcp, sandbox = build_phoenix_mcp_server(
            app, monty_runtime=monty_runtime, code_mode=get_env_mcp_code_mode(), db=db
        )
        mcp.add_middleware(ToolMeasurements(log))
        return mcp.http_app(path="/"), sandbox

    application.create_phoenix_mcp_app = build
    from phoenix.server.main import main as serve

    sys.argv = [
        "phoenix",
        "serve",
        "--no-ui",
        "--port",
        "6006",
        "--host",
        "0.0.0.0",
        "--grpc-port",
        "0",
    ]
    serve()


if __name__ == "__main__":
    main()
