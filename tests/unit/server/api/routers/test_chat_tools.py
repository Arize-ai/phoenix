from phoenix.server.api.routers.chat_context import (
    ProjectContext,
    ResolvedContexts,
    SpanContext,
)
from phoenix.server.api.routers.chat_tools import (
    ToolExecutionEnv,
    resolve_contextual_tools,
)


def _env() -> ToolExecutionEnv:
    return ToolExecutionEnv(user=None, db=None)


class TestResolveContextualTools:
    def test_no_tools_when_project_missing(self) -> None:
        resolved = ResolvedContexts(span=SpanContext(type="span", project_id=None, span_id="S1"))
        defs, dispatch = resolve_contextual_tools(resolved, _env())
        assert defs == []
        assert dispatch == {}

    def test_search_project_tool_registered_with_project_context(self) -> None:
        resolved = ResolvedContexts(project=ProjectContext(type="project", project_id="P1"))
        defs, dispatch = resolve_contextual_tools(resolved, _env())
        names = [td.name for td in defs]
        assert "search_project" in names
        assert "search_project" in dispatch

    def test_search_project_schema_does_not_leak_project_id(self) -> None:
        resolved = ResolvedContexts(project=ProjectContext(type="project", project_id="P1"))
        defs, _ = resolve_contextual_tools(resolved, _env())
        search = next(td for td in defs if td.name == "search_project")
        schema = search.parameters_json_schema
        # `projectId` must stay inside the closure, not in the schema the
        # model sees.
        assert "projectId" not in schema.get("properties", {})
        assert "project_id" not in schema.get("properties", {})
        assert schema["properties"].keys() == {"query"}

    async def test_search_project_callable_closes_over_project_id(self) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(type="project", project_id="PROJECT-XYZ")
        )
        _, dispatch = resolve_contextual_tools(resolved, _env())
        result = await dispatch["search_project"]({"query": "hello"})
        assert "PROJECT-XYZ" in result
        assert "hello" in result
