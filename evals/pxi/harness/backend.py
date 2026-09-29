"""Production backend tool definitions for next-action PXI evaluations."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Any

import strawberry
from fastapi import FastAPI
from fastmcp import FastMCP
from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.exceptions import CallDeferred
from pydantic_ai.messages import ToolCallPart
from pydantic_ai.models import ModelRequestContext
from pydantic_ai.tools import ToolDefinition
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.server.agents.types import AgentDependencies
from phoenix.server.api.context import Context
from phoenix.server.api.routers.v1 import create_v1_router
from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.mcp.skills import PXI_SKILLS_ROOTS, SKILL_TOOL_NAMES
from phoenix.server.mcp_server import build_phoenix_mcp_server
from phoenix.server.monty_runtime import MontyRuntime
from phoenix.server.types import DbSessionFactory


@lru_cache(maxsize=1)
def eval_graphql_schema() -> strawberry.Schema:
    return build_graphql_schema()


def unavailable_graphql_context() -> Context:
    raise RuntimeError("PXI eval backend calls must be deferred; no application data is provided.")


@asynccontextmanager
async def _unavailable_db_session() -> AsyncIterator[AsyncSession]:
    raise RuntimeError("PXI eval backend calls must be deferred; no application data is provided.")
    yield


@lru_cache(maxsize=1)
def eval_phoenix_mcp_server() -> FastMCP:
    """Share the production read-only catalog and skill server within a worker.

    Routes supply schemas only. No app lifespan, database, or sandbox worker
    starts: ``EvalBackendCapability`` defers data execution before dispatch.
    """
    app = FastAPI()
    app.include_router(create_v1_router(authentication_enabled=False))
    server, _ = build_phoenix_mcp_server(
        app,
        monty_runtime=MontyRuntime(),
        code_mode=True,
        monty_consumer="agent",
        read_only=True,
        db=DbSessionFactory(db=_unavailable_db_session, dialect="sqlite"),
        skills_roots=PXI_SKILLS_ROOTS,
    )
    return server


class EvalBackendCapability(AbstractCapability[AgentDependencies]):
    """Load skills and discover tools, then record backend execution intent.

    Like browser actions, backend requests end the evaluated turn without
    reading or writing real data. This preserves the suite's next-action
    contract after bash and skills moved to server-side capabilities.
    """

    async def before_model_request(
        self,
        ctx: RunContext[AgentDependencies],
        request_context: ModelRequestContext,
    ) -> ModelRequestContext:
        parameters = request_context.model_request_parameters
        tools = {tool.name for tool in parameters.function_tools}
        missing = (set(SKILL_TOOL_NAMES) | {"bash", "execute"}) - tools
        if missing:
            raise RuntimeError(f"PXI eval backend tools are missing: {', '.join(sorted(missing))}")
        if not any(
            "<available_skills>" in part.content for part in parameters.instruction_parts or ()
        ):
            raise RuntimeError("PXI eval skill catalog is missing")
        return request_context

    async def before_tool_execute(
        self,
        ctx: RunContext[AgentDependencies],
        *,
        call: ToolCallPart,
        tool_def: ToolDefinition,
        args: dict[str, Any],
    ) -> dict[str, Any]:
        if tool_def.name in {"bash", "execute"}:
            raise CallDeferred()
        return args
