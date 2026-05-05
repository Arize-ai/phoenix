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

    def test_set_spans_filter_advertised_when_project_carries_span_filter(
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
        assert "set_spans_filter" in names
        assert dispatch == {}

    def test_set_spans_filter_schema_requires_both_fields(self, db: DbSessionFactory) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                span_filter="span_kind == 'LLM'",
            )
        )
        defs, _ = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))
        tool = next(t for t in defs if t.name == "set_spans_filter")
        schema = tool.parameters_json_schema
        properties = schema.get("properties", {})
        assert "condition" in properties
        assert "rootSpansOnly" in properties
        assert schema.get("required") == ["condition", "rootSpansOnly"]
        assert "minProperties" not in schema
        assert tool.kind == "external"

    def test_set_spans_filter_advertised_without_root_toggle(self, db: DbSessionFactory) -> None:
        # Traces tab advertises only the filter field, not the root toggle.
        # The consolidated tool is still advertised — `rootSpansOnly` simply
        # has no visible effect on that tab.
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                span_filter="",
            )
        )
        defs, _ = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))
        names = [tool.name for tool in defs]
        assert "set_spans_filter" in names

    def test_set_spans_filter_advertised_when_toggle_present(self, db: DbSessionFactory) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                span_filter="",
                root_spans_only=True,
            )
        )
        defs, dispatch = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))
        names = [tool.name for tool in defs]
        assert "set_spans_filter" in names
        assert dispatch == {}

    def test_root_toggle_alone_does_not_advertise_tool(self, db: DbSessionFactory) -> None:
        # Without the filter field mounted, the tool is not advertised even
        # when the root toggle alone is present (a state the current UI does
        # not produce, but which the gating must still tolerate).
        resolved = ResolvedContexts(
            project=ProjectContext(
                type="project",
                project_node_id="UHJvamVjdDox",
                root_spans_only=True,
            )
        )
        defs, _ = resolve_contextual_tools(resolved, ToolExecutionEnv(user=None, db=db))
        names = [tool.name for tool in defs]
        assert "set_spans_filter" not in names


class TestResolveTools:
    def test_resolves_external_tools_without_context_or_env(self) -> None:
        defs, dispatch = resolve_tools(ResolvedContexts())

        names = [tool.name for tool in defs]

        assert "ask_user" in names
        assert "bash" in names
        assert "set_time_range" in names
        assert dispatch == {}

    def test_resolves_external_tools_without_env_when_context_does_not_enable_tools(self) -> None:
        resolved = ResolvedContexts(
            project=ProjectContext(type="project", project_node_id="UHJvamVjdDox")
        )
        defs, dispatch = resolve_tools(resolved)

        names = [tool.name for tool in defs]

        assert "ask_user" in names
        assert "bash" in names
        assert "set_time_range" in names
        assert "set_spans_filter" not in names
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
        assert "set_time_range" in names
        assert "set_spans_filter" in names
        assert dispatch == {}

    def test_set_time_range_schema_accepts_presets_and_custom(self) -> None:
        defs, _ = resolve_tools(ResolvedContexts())
        tool = next(t for t in defs if t.name == "set_time_range")
        schema = tool.parameters_json_schema
        properties = schema.get("properties", {})

        assert tool.kind == "external"
        assert schema.get("required") == ["timeRangeKey"]
        assert properties["timeRangeKey"]["enum"] == [
            "15m",
            "1h",
            "12h",
            "1d",
            "7d",
            "30d",
            "custom",
        ]
        assert "startTime" in properties
        assert "endTime" in properties

    def test_resolved_tool_names_are_unique(self, db: DbSessionFactory) -> None:
        defs, _ = resolve_tools(ResolvedContexts(), ToolExecutionEnv(user=None, db=db))
        names = [tool.name for tool in defs]

        assert len(names) == len(set(names))
