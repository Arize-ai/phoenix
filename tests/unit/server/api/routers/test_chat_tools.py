from datetime import datetime, timezone

from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.routers.chat_context import (
    ProjectContext,
    ResolvedContexts,
    ToolExecutionEnv,
)
from phoenix.server.api.routers.chat_tools import resolve_contextual_tools
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.types import DbSessionFactory


class TestResolveContextualTools:
    def test_no_tools_when_project_missing(self, db: DbSessionFactory) -> None:
        defs, dispatch = resolve_contextual_tools(
            ResolvedContexts(), ToolExecutionEnv(user=None, db=db)
        )
        assert defs == []
        assert dispatch == {}

    async def test_search_project_schema_hides_project_id(
        self,
        db: DbSessionFactory,
    ) -> None:
        resolved = ResolvedContexts(project=ProjectContext(type="project", project_id="P1"))
        defs, dispatch = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))
        assert "search_project" in dispatch
        search = next(tool for tool in defs if tool.name == "search_project")
        assert "projectId" not in search.parameters_json_schema.get("properties", {})

    async def test_search_project_callable_closes_over_project_id(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project = models.Project(name="search-project")
            session.add(project)
            await session.flush()

            trace = models.Trace(
                project_rowid=project.id,
                trace_id="trace-1",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
            )
            session.add(trace)
            await session.flush()

            span = models.Span(
                trace_rowid=trace.id,
                span_id="span-1",
                name="CheckoutAgent",
                span_kind="CHAIN",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
                attributes={
                    "input": {"value": "checkout question"},
                    "output": {"value": "checkout answer"},
                },
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            await session.commit()

        project_id = str(GlobalID(ProjectNodeType.__name__, str(project.id)))
        defs, dispatch = resolve_contextual_tools(
            ResolvedContexts(project=ProjectContext(type="project", project_id=project_id)),
            ToolExecutionEnv(user=None, db=db),
        )

        result = await dispatch["search_project"]({"query": "checkout", "limit": 3})
        assert 'Project "search-project"' in result
        assert 'Search query: "checkout"' in result
        assert "trace-1" in result
        assert "CheckoutAgent" in result
