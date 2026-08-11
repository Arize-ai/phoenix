from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.capabilities.tools.external import (
    add_dataset_examples,
    add_spans_to_dataset,
    ask_user,
    batch_span_annotate,
    create_annotation_config,
    create_dataset,
    create_dataset_label,
    create_dataset_split,
    delete_dataset,
    delete_dataset_examples,
    delete_dataset_labels,
    delete_dataset_splits,
    execute_ui,
    get_route_info,
    list_dataset_examples,
    list_dataset_labels,
    list_dataset_splits,
    list_datasets,
    list_labels,
    list_splits,
    patch_dataset,
    patch_dataset_examples,
    patch_dataset_split,
    patch_experiment,
    render_generative_ui,
    search_ui,
    set_dataset_example_splits,
    set_dataset_labels,
    update_annotation_config,
)
from phoenix.server.agents.capabilities.tools.external.add_dataset_examples import (
    AddDatasetExamplesCapability,
)
from phoenix.server.agents.capabilities.tools.external.add_spans_to_dataset import (
    AddSpansToDatasetCapability,
)
from phoenix.server.agents.capabilities.tools.external.ask_user import AskUserCapability
from phoenix.server.agents.capabilities.tools.external.batch_span_annotate import (
    BatchSpanAnnotateCapability,
)
from phoenix.server.agents.capabilities.tools.external.create_annotation_config import (
    CreateAnnotationConfigCapability,
)
from phoenix.server.agents.capabilities.tools.external.create_dataset import (
    CreateDatasetCapability,
)
from phoenix.server.agents.capabilities.tools.external.create_dataset_label import (
    CreateDatasetLabelCapability,
)
from phoenix.server.agents.capabilities.tools.external.create_dataset_split import (
    CreateDatasetSplitCapability,
)
from phoenix.server.agents.capabilities.tools.external.delete_dataset import (
    DeleteDatasetCapability,
)
from phoenix.server.agents.capabilities.tools.external.delete_dataset_examples import (
    DeleteDatasetExamplesCapability,
)
from phoenix.server.agents.capabilities.tools.external.delete_dataset_labels import (
    DeleteDatasetLabelsCapability,
)
from phoenix.server.agents.capabilities.tools.external.delete_dataset_splits import (
    DeleteDatasetSplitsCapability,
)
from phoenix.server.agents.capabilities.tools.external.execute_ui import (
    ExecuteUiCapability,
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
from phoenix.server.agents.capabilities.tools.external.patch_dataset import (
    PatchDatasetCapability,
)
from phoenix.server.agents.capabilities.tools.external.patch_dataset_examples import (
    PatchDatasetExamplesCapability,
)
from phoenix.server.agents.capabilities.tools.external.patch_dataset_split import (
    PatchDatasetSplitCapability,
)
from phoenix.server.agents.capabilities.tools.external.patch_experiment import (
    PatchExperimentCapability,
)
from phoenix.server.agents.capabilities.tools.external.render_generative_ui import (
    RenderGenerativeUICapability,
)
from phoenix.server.agents.capabilities.tools.external.search_ui import (
    SearchUiCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_dataset_example_splits import (
    SetDatasetExampleSplitsCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_dataset_labels import (
    SetDatasetLabelsCapability,
)
from phoenix.server.agents.capabilities.tools.external.update_annotation_config import (
    UpdateAnnotationConfigCapability,
)
from phoenix.server.agents.types import AgentDependencies

_EXTERNAL_TOOL_DEFINITIONS_BY_NAME: dict[str, ToolDefinition] = {
    tool_def.name: tool_def
    for tool_def in (
        ask_user.TOOL_DEFINITION,
        add_dataset_examples.TOOL_DEFINITION,
        add_spans_to_dataset.TOOL_DEFINITION,
        list_dataset_examples.TOOL_DEFINITION,
        list_dataset_splits.TOOL_DEFINITION,
        list_datasets.TOOL_DEFINITION,
        list_labels.TOOL_DEFINITION,
        list_splits.TOOL_DEFINITION,
        create_dataset.TOOL_DEFINITION,
        create_dataset_split.TOOL_DEFINITION,
        set_dataset_example_splits.TOOL_DEFINITION,
        list_dataset_labels.TOOL_DEFINITION,
        create_dataset_label.TOOL_DEFINITION,
        set_dataset_labels.TOOL_DEFINITION,
        patch_dataset.TOOL_DEFINITION,
        delete_dataset.TOOL_DEFINITION,
        patch_dataset_examples.TOOL_DEFINITION,
        delete_dataset_examples.TOOL_DEFINITION,
        patch_dataset_split.TOOL_DEFINITION,
        delete_dataset_splits.TOOL_DEFINITION,
        delete_dataset_labels.TOOL_DEFINITION,
        batch_span_annotate.TOOL_DEFINITION,
        create_annotation_config.TOOL_DEFINITION,
        update_annotation_config.TOOL_DEFINITION,
        execute_ui.TOOL_DEFINITION,
        get_route_info.TOOL_DEFINITION,
        patch_experiment.TOOL_DEFINITION,
        render_generative_ui.RENDER_GENERATIVE_UI_TOOL_DEFINITION,
        search_ui.TOOL_DEFINITION,
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
        SearchUiCapability(),
        ExecuteUiCapability(),
        GetRouteInfoCapability(),
        RenderGenerativeUICapability(),
    ]
    gated_capabilities: list[AbstractGatedToolCapability[AgentDependencies]] = [
        AddDatasetExamplesCapability(),
        AddSpansToDatasetCapability(),
        CreateDatasetCapability(),
        ListDatasetExamplesCapability(),
        ListDatasetSplitsCapability(),
        CreateDatasetSplitCapability(),
        SetDatasetExampleSplitsCapability(),
        ListDatasetLabelsCapability(),
        CreateDatasetLabelCapability(),
        SetDatasetLabelsCapability(),
        PatchDatasetCapability(),
        DeleteDatasetCapability(),
        PatchDatasetExamplesCapability(),
        DeleteDatasetExamplesCapability(),
        PatchDatasetSplitCapability(),
        DeleteDatasetSplitsCapability(),
        DeleteDatasetLabelsCapability(),
        PatchExperimentCapability(),
        CreateAnnotationConfigCapability(),
        UpdateAnnotationConfigCapability(),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        included_gated = [cap for cap in gated_capabilities if cap.include_for_run(ctx)]
        return CombinedCapability(capabilities=[*ungated_capabilities, *included_gated])

    return _build


__all__ = [
    "AskUserCapability",
    "AddDatasetExamplesCapability",
    "AddSpansToDatasetCapability",
    "ListDatasetExamplesCapability",
    "ListDatasetSplitsCapability",
    "CreateDatasetSplitCapability",
    "SetDatasetExampleSplitsCapability",
    "ListDatasetLabelsCapability",
    "CreateDatasetLabelCapability",
    "SetDatasetLabelsCapability",
    "PatchDatasetCapability",
    "DeleteDatasetCapability",
    "PatchDatasetExamplesCapability",
    "DeleteDatasetExamplesCapability",
    "PatchDatasetSplitCapability",
    "DeleteDatasetSplitsCapability",
    "DeleteDatasetLabelsCapability",
    "ListDatasetsCapability",
    "ListLabelsCapability",
    "ListSplitsCapability",
    "CreateDatasetCapability",
    "BatchSpanAnnotateCapability",
    "CreateAnnotationConfigCapability",
    "UpdateAnnotationConfigCapability",
    "ExecuteUiCapability",
    "GetRouteInfoCapability",
    "PatchExperimentCapability",
    "RenderGenerativeUICapability",
    "SearchUiCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
