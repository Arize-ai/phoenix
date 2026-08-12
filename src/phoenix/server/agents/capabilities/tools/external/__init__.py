from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.capabilities.tools.external import (
    ask_user,
    batch_span_annotate,
    execute_browser_action,
    get_route_info,
    list_dataset_examples,
    list_dataset_labels,
    list_dataset_splits,
    list_datasets,
    list_labels,
    list_splits,
    render_generative_ui,
    search_browser_actions,
)
from phoenix.server.agents.capabilities.tools.external.ask_user import AskUserCapability
from phoenix.server.agents.capabilities.tools.external.batch_span_annotate import (
    BatchSpanAnnotateCapability,
)
from phoenix.server.agents.capabilities.tools.external.execute_browser_action import (
    ExecuteBrowserActionCapability,
)
from phoenix.server.agents.capabilities.tools.external.get_route_info import (
    GetRouteInfoCapability,
)
from phoenix.server.agents.capabilities.tools.external.list_dataset_examples import (
    ListDatasetExamplesCapability,
)
from phoenix.server.agents.capabilities.tools.external.list_dataset_labels import (
    ListDatasetLabelsCapability,
)
from phoenix.server.agents.capabilities.tools.external.list_dataset_splits import (
    ListDatasetSplitsCapability,
)
from phoenix.server.agents.capabilities.tools.external.list_datasets import (
    ListDatasetsCapability,
)
from phoenix.server.agents.capabilities.tools.external.list_labels import (
    ListLabelsCapability,
)
from phoenix.server.agents.capabilities.tools.external.list_splits import (
    ListSplitsCapability,
)
from phoenix.server.agents.capabilities.tools.external.render_generative_ui import (
    RenderGenerativeUICapability,
)
from phoenix.server.agents.capabilities.tools.external.search_browser_actions import (
    SearchBrowserActionsCapability,
)
from phoenix.server.agents.types import AgentDependencies

_EXTERNAL_TOOL_DEFINITIONS_BY_NAME: dict[str, ToolDefinition] = {
    tool_def.name: tool_def
    for tool_def in (
        ask_user.TOOL_DEFINITION,
        list_dataset_examples.TOOL_DEFINITION,
        list_dataset_splits.TOOL_DEFINITION,
        list_datasets.TOOL_DEFINITION,
        list_labels.TOOL_DEFINITION,
        list_splits.TOOL_DEFINITION,
        list_dataset_labels.TOOL_DEFINITION,
        batch_span_annotate.TOOL_DEFINITION,
        execute_browser_action.TOOL_DEFINITION,
        get_route_info.TOOL_DEFINITION,
        render_generative_ui.RENDER_GENERATIVE_UI_TOOL_DEFINITION,
        search_browser_actions.TOOL_DEFINITION,
    )
}


def get_external_tool_definition(name: str) -> ToolDefinition | None:
    """Look up a registered external tool definition by name."""
    return _EXTERNAL_TOOL_DEFINITIONS_BY_NAME.get(name)


def get_external_tool_capability_function() -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles the per-run external-tool
    capability bundle. Ungated capabilities are always included; gated
    capabilities self-gate via ``include_for_run``.
    """
    ungated_capabilities: list[AbstractCapability[AgentDependencies]] = [
        AskUserCapability(),
        BatchSpanAnnotateCapability(),
        ListDatasetsCapability(),
        ListLabelsCapability(),
        ListSplitsCapability(),
        SearchBrowserActionsCapability(),
        ExecuteBrowserActionCapability(),
        GetRouteInfoCapability(),
        RenderGenerativeUICapability(),
    ]
    gated_capabilities: list[AbstractGatedToolCapability[AgentDependencies]] = [
        ListDatasetExamplesCapability(),
        ListDatasetSplitsCapability(),
        ListDatasetLabelsCapability(),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        included_gated = [cap for cap in gated_capabilities if cap.include_for_run(ctx)]
        return CombinedCapability(capabilities=[*ungated_capabilities, *included_gated])

    return _build


__all__ = [
    "AskUserCapability",
    "ListDatasetExamplesCapability",
    "ListDatasetSplitsCapability",
    "ListDatasetLabelsCapability",
    "ListDatasetsCapability",
    "ListLabelsCapability",
    "ListSplitsCapability",
    "BatchSpanAnnotateCapability",
    "ExecuteBrowserActionCapability",
    "GetRouteInfoCapability",
    "RenderGenerativeUICapability",
    "SearchBrowserActionsCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
