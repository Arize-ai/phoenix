from phoenix.server.agents.context import ProjectContext, ResolvedContexts, ToolExecutionEnv
from phoenix.server.agents.tools import resolve_contextual_tools, resolve_tools
from phoenix.server.types import DbSessionFactory


class TestResolveContextualTools:
    def test_no_tools_when_span_filter_missing(self, db: DbSessionFactory) -> None:
        defs, dispatch = resolve_contextual_tools(
            ResolvedContexts(), ToolExecutionEnv(user=None, db=db)
        )
        assert defs == []
        assert dispatch == {}

    def test_no_tools_when_project_lacks_span_filter(self, db: DbSessionFactory) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(type="project", project_node_id="UHJvamVjdDox")
        )
        defs, dispatch = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))
        assert defs == []
        assert dispatch == {}

    def test_apply_span_filter_condition_advertised_when_project_carries_span_filter(
        self, db: DbSessionFactory
    ) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                span_filter="",
            )
        )
        defs, dispatch = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))

        names = [tool.name for tool in defs]
        assert "apply_span_filter_condition" in names
        assert dispatch == {}

    def test_apply_span_filter_condition_schema_requires_condition(
        self, db: DbSessionFactory
    ) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                span_filter="span_kind == 'LLM'",
            )
        )
        defs, _ = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))
        tool = next(t for t in defs if t.name == "apply_span_filter_condition")
        schema = tool.parameters_json_schema
        assert schema.get("required") == ["condition"]
        assert "condition" in schema.get("properties", {})
        assert tool.kind == "external"


class TestResolveTools:
    def test_resolves_external_tools_without_context_or_env(self) -> None:
        defs, dispatch = resolve_tools(ResolvedContexts())

        names = [tool.name for tool in defs]

        assert "ask_user" in names
        assert "bash" in names
        assert dispatch == {}

    def test_resolves_external_tools_without_env_when_context_does_not_enable_tools(self) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(type="project", project_node_id="UHJvamVjdDox")
        )
        defs, dispatch = resolve_tools(resolved)

        names = [tool.name for tool in defs]

        assert "ask_user" in names
        assert "bash" in names
        assert "apply_span_filter_condition" not in names
        assert dispatch == {}

    def test_requires_env_when_contextual_tool_is_available(self) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                span_filter="",
            )
        )

        try:
            resolve_tools(resolved)
        except ValueError as exc:
            assert str(exc) == "ToolExecutionEnv is required when resolving contextual tools"
        else:
            raise AssertionError("Expected resolve_tools to require ToolExecutionEnv")

    def test_resolves_external_and_contextual_tools(self, db: DbSessionFactory) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                span_filter="",
            )
        )
        defs, dispatch = resolve_tools(resolved, ToolExecutionEnv(user=None, db=db))

        names = [tool.name for tool in defs]

        assert "ask_user" in names
        assert "bash" in names
        assert "apply_span_filter_condition" in names
        assert dispatch == {}

    def test_resolved_tool_names_are_unique(self, db: DbSessionFactory) -> None:
        defs, _ = resolve_tools(ResolvedContexts(), ToolExecutionEnv(user=None, db=db))
        names = [tool.name for tool in defs]

        assert len(names) == len(set(names))
