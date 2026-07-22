from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities.base import (
    AbstractDynamicCapability,
    AbstractStaticCapability,
)
from phoenix.server.agents.capabilities.tools.external import (
    add_dataset_examples,
    add_prompt_instance,
    add_spans_to_dataset,
    ask_user,
    bash,
    batch_span_annotate,
    cancel_playground_run,
    clone_prompt_instance,
    create_annotation_config,
    create_dataset,
    create_dataset_label,
    create_dataset_split,
    delete_dataset,
    delete_dataset_examples,
    delete_dataset_labels,
    delete_dataset_splits,
    edit_code_evaluator_draft,
    edit_llm_evaluator_draft,
    edit_prompt_instance,
    get_route_info,
    list_dataset_examples,
    list_dataset_labels,
    list_dataset_splits,
    list_datasets,
    list_labels,
    list_playground_model_targets,
    list_splits,
    load_dataset,
    open_code_evaluator_form,
    open_dataset_evaluator_for_edit,
    open_llm_evaluator_form,
    patch_dataset,
    patch_dataset_examples,
    patch_dataset_split,
    patch_experiment,
    read_code_evaluator_draft,
    read_dataset_evaluator_definition,
    read_llm_evaluator_draft,
    read_playground_output,
    read_prompt_instance,
    read_prompt_tools,
    remove_prompt_instance,
    render_generative_ui,
    run_code_evaluator_draft,
    run_llm_evaluator_draft,
    run_playground,
    save_prompt,
    set_appended_messages_path,
    set_dataset_evaluator_selection,
    set_dataset_example_splits,
    set_dataset_labels,
    set_playground_experiment_recording,
    set_playground_model,
    set_playground_repetitions,
    set_spans_filter,
    set_template_variables_path,
    set_time_range,
    set_variable_values,
    submit_code_evaluator_draft,
    submit_llm_evaluator_draft,
    update_annotation_config,
    write_prompt_tools,
)
from phoenix.server.agents.capabilities.tools.external.add_dataset_examples import (
    AddDatasetExamplesCapability,
)
from phoenix.server.agents.capabilities.tools.external.add_prompt_instance import (
    AddPromptInstanceCapability,
)
from phoenix.server.agents.capabilities.tools.external.add_spans_to_dataset import (
    AddSpansToDatasetCapability,
)
from phoenix.server.agents.capabilities.tools.external.ask_user import AskUserCapability
from phoenix.server.agents.capabilities.tools.external.bash import BashCapability
from phoenix.server.agents.capabilities.tools.external.batch_span_annotate import (
    BatchSpanAnnotateCapability,
)
from phoenix.server.agents.capabilities.tools.external.cancel_playground_run import (
    CancelPlaygroundRunCapability,
)
from phoenix.server.agents.capabilities.tools.external.clone_prompt_instance import (
    ClonePromptInstanceCapability,
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
from phoenix.server.agents.capabilities.tools.external.edit_code_evaluator_draft import (
    EditCodeEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.edit_llm_evaluator_draft import (
    EditLlmEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.edit_prompt_instance import (
    EditPromptInstanceCapability,
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
from phoenix.server.agents.capabilities.tools.external.list_playground_model_targets import (
    ListPlaygroundModelTargetsCapability,
)
from phoenix.server.agents.capabilities.tools.external.list_splits import (
    ListSplitsCapability,
)
from phoenix.server.agents.capabilities.tools.external.load_dataset import (
    LoadDatasetCapability,
)
from phoenix.server.agents.capabilities.tools.external.open_code_evaluator_form import (
    OpenCodeEvaluatorFormCapability,
)
from phoenix.server.agents.capabilities.tools.external.open_dataset_evaluator_for_edit import (
    OpenDatasetEvaluatorForEditCapability,
)
from phoenix.server.agents.capabilities.tools.external.open_llm_evaluator_form import (
    OpenLlmEvaluatorFormCapability,
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
from phoenix.server.agents.capabilities.tools.external.read_code_evaluator_draft import (
    ReadCodeEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.read_dataset_evaluator_definition import (
    ReadDatasetEvaluatorDefinitionCapability,
)
from phoenix.server.agents.capabilities.tools.external.read_llm_evaluator_draft import (
    ReadLlmEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.read_playground_output import (
    ReadPlaygroundOutputCapability,
)
from phoenix.server.agents.capabilities.tools.external.read_prompt_instance import (
    ReadPromptInstanceCapability,
)
from phoenix.server.agents.capabilities.tools.external.read_prompt_tools import (
    ReadPromptToolsCapability,
)
from phoenix.server.agents.capabilities.tools.external.remove_prompt_instance import (
    RemovePromptInstanceCapability,
)
from phoenix.server.agents.capabilities.tools.external.render_generative_ui import (
    RenderGenerativeUICapability,
)
from phoenix.server.agents.capabilities.tools.external.run_code_evaluator_draft import (
    RunCodeEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.run_llm_evaluator_draft import (
    RunLlmEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.run_playground import (
    RunPlaygroundCapability,
)
from phoenix.server.agents.capabilities.tools.external.save_prompt import SavePromptCapability
from phoenix.server.agents.capabilities.tools.external.set_appended_messages_path import (
    SetAppendedMessagesPathCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_dataset_evaluator_selection import (
    SetDatasetEvaluatorSelectionCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_dataset_example_splits import (
    SetDatasetExampleSplitsCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_dataset_labels import (
    SetDatasetLabelsCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_playground_experiment_recording import (
    SetPlaygroundExperimentRecordingCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_playground_model import (
    SetPlaygroundModelCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_playground_repetitions import (
    SetPlaygroundRepetitionsCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_spans_filter import (
    SetSpansFilterCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_template_variables_path import (
    SetTemplateVariablesPathCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_time_range import (
    SetTimeRangeCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_variable_values import (
    SetVariableValuesCapability,
)
from phoenix.server.agents.capabilities.tools.external.submit_code_evaluator_draft import (
    SubmitCodeEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.submit_llm_evaluator_draft import (
    SubmitLlmEvaluatorDraftCapability,
)
from phoenix.server.agents.capabilities.tools.external.update_annotation_config import (
    UpdateAnnotationConfigCapability,
)
from phoenix.server.agents.capabilities.tools.external.write_prompt_tools import (
    WritePromptToolsCapability,
)
from phoenix.server.agents.prompts import AgentPrompts
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
        add_prompt_instance.TOOL_DEFINITION,
        batch_span_annotate.TOOL_DEFINITION,
        create_annotation_config.TOOL_DEFINITION,
        update_annotation_config.TOOL_DEFINITION,
        bash.TOOL_DEFINITION,
        cancel_playground_run.TOOL_DEFINITION,
        clone_prompt_instance.TOOL_DEFINITION,
        edit_code_evaluator_draft.TOOL_DEFINITION,
        edit_llm_evaluator_draft.TOOL_DEFINITION,
        edit_prompt_instance.TOOL_DEFINITION,
        get_route_info.TOOL_DEFINITION,
        load_dataset.TOOL_DEFINITION,
        open_code_evaluator_form.TOOL_DEFINITION,
        open_dataset_evaluator_for_edit.TOOL_DEFINITION,
        open_llm_evaluator_form.TOOL_DEFINITION,
        patch_experiment.TOOL_DEFINITION,
        read_code_evaluator_draft.TOOL_DEFINITION,
        read_dataset_evaluator_definition.TOOL_DEFINITION,
        read_llm_evaluator_draft.TOOL_DEFINITION,
        read_prompt_instance.TOOL_DEFINITION,
        read_prompt_tools.TOOL_DEFINITION,
        read_playground_output.TOOL_DEFINITION,
        list_playground_model_targets.TOOL_DEFINITION,
        render_generative_ui.RENDER_GENERATIVE_UI_TOOL_DEFINITION,
        remove_prompt_instance.TOOL_DEFINITION,
        run_code_evaluator_draft.TOOL_DEFINITION,
        run_llm_evaluator_draft.TOOL_DEFINITION,
        submit_code_evaluator_draft.TOOL_DEFINITION,
        submit_llm_evaluator_draft.TOOL_DEFINITION,
        run_playground.TOOL_DEFINITION,
        save_prompt.TOOL_DEFINITION,
        set_appended_messages_path.TOOL_DEFINITION,
        set_dataset_evaluator_selection.TOOL_DEFINITION,
        set_playground_experiment_recording.TOOL_DEFINITION,
        set_playground_model.TOOL_DEFINITION,
        set_playground_repetitions.TOOL_DEFINITION,
        set_spans_filter.TOOL_DEFINITION,
        set_template_variables_path.TOOL_DEFINITION,
        set_time_range.TOOL_DEFINITION,
        set_variable_values.TOOL_DEFINITION,
        write_prompt_tools.TOOL_DEFINITION,
    )
}


def get_external_tool_definition(name: str) -> ToolDefinition | None:
    """Look up a registered external tool definition by name."""
    return _EXTERNAL_TOOL_DEFINITIONS_BY_NAME.get(name)


def get_external_tool_capability_function(
    *,
    prompts: AgentPrompts,
) -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles the per-run external-tool
    capability bundle. Static capabilities are always included; dynamic
    capabilities self-gate via ``include_for_run``.
    """
    static_capabilities: list[AbstractStaticCapability[AgentDependencies]] = [
        BashCapability(instructions=prompts.bash_tool),
        AskUserCapability(instructions=prompts.ask_user_tool),
        BatchSpanAnnotateCapability(instructions=prompts.batch_span_annotate_tool),
        ListDatasetsCapability(instructions=prompts.list_datasets_tool),
        ListLabelsCapability(instructions=prompts.list_labels_tool),
        ListSplitsCapability(instructions=prompts.list_splits_tool),
        SetTimeRangeCapability(instructions=prompts.set_time_range_tool),
        GetRouteInfoCapability(instructions=prompts.get_route_info_tool),
        RenderGenerativeUICapability(instructions=prompts.render_generative_ui_tool),
    ]
    dynamic_capabilities: list[AbstractDynamicCapability[AgentDependencies]] = [
        AddDatasetExamplesCapability(instructions=prompts.add_dataset_examples_tool),
        AddSpansToDatasetCapability(instructions=prompts.add_spans_to_dataset_tool),
        CreateDatasetCapability(instructions=prompts.create_dataset_tool),
        ListDatasetExamplesCapability(instructions=prompts.list_dataset_examples_tool),
        ListDatasetSplitsCapability(instructions=prompts.list_dataset_splits_tool),
        CreateDatasetSplitCapability(instructions=prompts.create_dataset_split_tool),
        SetDatasetExampleSplitsCapability(instructions=prompts.set_dataset_example_splits_tool),
        ListDatasetLabelsCapability(instructions=prompts.list_dataset_labels_tool),
        CreateDatasetLabelCapability(instructions=prompts.create_dataset_label_tool),
        SetDatasetLabelsCapability(instructions=prompts.set_dataset_labels_tool),
        PatchDatasetCapability(instructions=prompts.patch_dataset_tool),
        DeleteDatasetCapability(instructions=prompts.delete_dataset_tool),
        PatchDatasetExamplesCapability(instructions=prompts.patch_dataset_examples_tool),
        DeleteDatasetExamplesCapability(instructions=prompts.delete_dataset_examples_tool),
        PatchDatasetSplitCapability(instructions=prompts.patch_dataset_split_tool),
        DeleteDatasetSplitsCapability(instructions=prompts.delete_dataset_splits_tool),
        DeleteDatasetLabelsCapability(instructions=prompts.delete_dataset_labels_tool),
        SetSpansFilterCapability(instructions=prompts.set_spans_filter_tool),
        SetPlaygroundModelCapability(instructions=prompts.set_playground_model_tool),
        ListPlaygroundModelTargetsCapability(
            instructions=prompts.list_playground_model_targets_tool
        ),
        ReadPromptInstanceCapability(instructions=prompts.read_prompt_instance_tool),
        ReadPromptToolsCapability(instructions=prompts.read_prompt_tools_tool),
        ReadPlaygroundOutputCapability(instructions=prompts.read_playground_output_tool),
        ClonePromptInstanceCapability(instructions=prompts.clone_prompt_instance_tool),
        AddPromptInstanceCapability(instructions=prompts.add_prompt_instance_tool),
        RemovePromptInstanceCapability(instructions=prompts.remove_prompt_instance_tool),
        EditPromptInstanceCapability(instructions=prompts.edit_prompt_instance_tool),
        SavePromptCapability(instructions=prompts.save_prompt_tool),
        WritePromptToolsCapability(instructions=prompts.write_prompt_tools_tool),
        RunPlaygroundCapability(instructions=prompts.run_playground_tool),
        CancelPlaygroundRunCapability(instructions=prompts.cancel_playground_run_tool),
        SetVariableValuesCapability(instructions=prompts.set_variable_values_tool),
        SetPlaygroundExperimentRecordingCapability(
            instructions=prompts.set_playground_experiment_recording_tool
        ),
        SetPlaygroundRepetitionsCapability(instructions=prompts.set_playground_repetitions_tool),
        SetTemplateVariablesPathCapability(instructions=prompts.set_template_variables_path_tool),
        SetAppendedMessagesPathCapability(instructions=prompts.set_appended_messages_path_tool),
        LoadDatasetCapability(instructions=prompts.load_dataset_tool),
        SetDatasetEvaluatorSelectionCapability(
            instructions=prompts.set_dataset_evaluator_selection_tool
        ),
        OpenDatasetEvaluatorForEditCapability(
            instructions=prompts.open_dataset_evaluator_for_edit_tool
        ),
        ReadDatasetEvaluatorDefinitionCapability(
            instructions=prompts.read_dataset_evaluator_definition_tool
        ),
        PatchExperimentCapability(instructions=prompts.patch_experiment_tool),
        CreateAnnotationConfigCapability(instructions=prompts.create_annotation_config_tool),
        UpdateAnnotationConfigCapability(instructions=prompts.update_annotation_config_tool),
        OpenCodeEvaluatorFormCapability(instructions=prompts.open_code_evaluator_form_tool),
        OpenLlmEvaluatorFormCapability(instructions=prompts.open_llm_evaluator_form_tool),
        ReadCodeEvaluatorDraftCapability(instructions=prompts.read_code_evaluator_draft_tool),
        EditCodeEvaluatorDraftCapability(instructions=prompts.edit_code_evaluator_draft_tool),
        RunCodeEvaluatorDraftCapability(instructions=prompts.test_code_evaluator_draft_tool),
        SubmitCodeEvaluatorDraftCapability(instructions=prompts.submit_code_evaluator_draft_tool),
        ReadLlmEvaluatorDraftCapability(instructions=prompts.read_llm_evaluator_draft_tool),
        EditLlmEvaluatorDraftCapability(instructions=prompts.edit_llm_evaluator_draft_tool),
        RunLlmEvaluatorDraftCapability(instructions=prompts.test_llm_evaluator_draft_tool),
        SubmitLlmEvaluatorDraftCapability(instructions=prompts.submit_llm_evaluator_draft_tool),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        included_dynamic = [cap for cap in dynamic_capabilities if cap.include_for_run(ctx)]
        return CombinedCapability(capabilities=[*static_capabilities, *included_dynamic])

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
    "AddPromptInstanceCapability",
    "BatchSpanAnnotateCapability",
    "CreateAnnotationConfigCapability",
    "UpdateAnnotationConfigCapability",
    "BashCapability",
    "CancelPlaygroundRunCapability",
    "ClonePromptInstanceCapability",
    "EditCodeEvaluatorDraftCapability",
    "EditLlmEvaluatorDraftCapability",
    "EditPromptInstanceCapability",
    "GetRouteInfoCapability",
    "ListPlaygroundModelTargetsCapability",
    "LoadDatasetCapability",
    "OpenCodeEvaluatorFormCapability",
    "OpenDatasetEvaluatorForEditCapability",
    "OpenLlmEvaluatorFormCapability",
    "PatchExperimentCapability",
    "ReadCodeEvaluatorDraftCapability",
    "ReadDatasetEvaluatorDefinitionCapability",
    "ReadLlmEvaluatorDraftCapability",
    "ReadPromptInstanceCapability",
    "ReadPromptToolsCapability",
    "ReadPlaygroundOutputCapability",
    "RemovePromptInstanceCapability",
    "RenderGenerativeUICapability",
    "RunPlaygroundCapability",
    "SavePromptCapability",
    "SetAppendedMessagesPathCapability",
    "SetDatasetEvaluatorSelectionCapability",
    "SetPlaygroundExperimentRecordingCapability",
    "SetPlaygroundModelCapability",
    "SetPlaygroundRepetitionsCapability",
    "SetSpansFilterCapability",
    "SetTemplateVariablesPathCapability",
    "SetTimeRangeCapability",
    "SetVariableValuesCapability",
    "WritePromptToolsCapability",
    "RunCodeEvaluatorDraftCapability",
    "RunLlmEvaluatorDraftCapability",
    "SubmitCodeEvaluatorDraftCapability",
    "SubmitLlmEvaluatorDraftCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
