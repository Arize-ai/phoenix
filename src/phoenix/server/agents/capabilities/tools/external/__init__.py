from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities.base import (
    AbstractDynamicCapability,
    AbstractStaticCapability,
)
from phoenix.server.agents.capabilities.tools.external import (
    ask_user,
    bash,
    batch_span_annotate,
    clone_prompt_instance,
    edit_code_evaluator_draft,
    edit_llm_evaluator_draft,
    edit_prompt_instance,
    get_route_info,
    list_playground_model_targets,
    load_dataset,
    open_code_evaluator_form,
    open_llm_evaluator_form,
    read_code_evaluator_draft,
    read_llm_evaluator_draft,
    read_playground_output,
    read_prompt_instance,
    read_prompt_tools,
    render_generative_ui,
    run_code_evaluator_draft,
    run_llm_evaluator_draft,
    run_playground,
    save_prompt,
    set_playground_model,
    set_spans_filter,
    set_time_range,
    set_variable_values,
    write_prompt_tools,
)
from phoenix.server.agents.capabilities.tools.external.ask_user import AskUserCapability
from phoenix.server.agents.capabilities.tools.external.bash import BashCapability
from phoenix.server.agents.capabilities.tools.external.batch_span_annotate import (
    BatchSpanAnnotateCapability,
)
from phoenix.server.agents.capabilities.tools.external.clone_prompt_instance import (
    ClonePromptInstanceCapability,
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
from phoenix.server.agents.capabilities.tools.external.list_playground_model_targets import (
    ListPlaygroundModelTargetsCapability,
)
from phoenix.server.agents.capabilities.tools.external.load_dataset import (
    LoadDatasetCapability,
)
from phoenix.server.agents.capabilities.tools.external.open_code_evaluator_form import (
    OpenCodeEvaluatorFormCapability,
)
from phoenix.server.agents.capabilities.tools.external.open_llm_evaluator_form import (
    OpenLlmEvaluatorFormCapability,
)
from phoenix.server.agents.capabilities.tools.external.read_code_evaluator_draft import (
    ReadCodeEvaluatorDraftCapability,
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
from phoenix.server.agents.capabilities.tools.external.set_playground_model import (
    SetPlaygroundModelCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_spans_filter import (
    SetSpansFilterCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_time_range import (
    SetTimeRangeCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_variable_values import (
    SetVariableValuesCapability,
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
        batch_span_annotate.TOOL_DEFINITION,
        bash.TOOL_DEFINITION,
        clone_prompt_instance.TOOL_DEFINITION,
        edit_code_evaluator_draft.TOOL_DEFINITION,
        edit_llm_evaluator_draft.TOOL_DEFINITION,
        edit_prompt_instance.TOOL_DEFINITION,
        get_route_info.TOOL_DEFINITION,
        load_dataset.TOOL_DEFINITION,
        open_code_evaluator_form.TOOL_DEFINITION,
        open_llm_evaluator_form.TOOL_DEFINITION,
        read_code_evaluator_draft.TOOL_DEFINITION,
        read_llm_evaluator_draft.TOOL_DEFINITION,
        read_prompt_instance.TOOL_DEFINITION,
        read_prompt_tools.TOOL_DEFINITION,
        read_playground_output.TOOL_DEFINITION,
        list_playground_model_targets.TOOL_DEFINITION,
        render_generative_ui.RENDER_GENERATIVE_UI_TOOL_DEFINITION,
        run_code_evaluator_draft.TOOL_DEFINITION,
        run_llm_evaluator_draft.TOOL_DEFINITION,
        run_playground.TOOL_DEFINITION,
        save_prompt.TOOL_DEFINITION,
        set_playground_model.TOOL_DEFINITION,
        set_spans_filter.TOOL_DEFINITION,
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
        SetTimeRangeCapability(instructions=prompts.set_time_range_tool),
        GetRouteInfoCapability(instructions=prompts.get_route_info_tool),
        RenderGenerativeUICapability(instructions=prompts.render_generative_ui_tool),
    ]
    dynamic_capabilities: list[AbstractDynamicCapability[AgentDependencies]] = [
        SetSpansFilterCapability(instructions=prompts.set_spans_filter_tool),
        SetPlaygroundModelCapability(instructions=prompts.set_playground_model_tool),
        ListPlaygroundModelTargetsCapability(
            instructions=prompts.list_playground_model_targets_tool
        ),
        ReadPromptInstanceCapability(instructions=prompts.read_prompt_instance_tool),
        ReadPromptToolsCapability(instructions=prompts.read_prompt_tools_tool),
        ReadPlaygroundOutputCapability(instructions=prompts.read_playground_output_tool),
        ClonePromptInstanceCapability(instructions=prompts.clone_prompt_instance_tool),
        EditPromptInstanceCapability(instructions=prompts.edit_prompt_instance_tool),
        SavePromptCapability(instructions=prompts.save_prompt_tool),
        WritePromptToolsCapability(instructions=prompts.write_prompt_tools_tool),
        RunPlaygroundCapability(instructions=prompts.run_playground_tool),
        SetVariableValuesCapability(instructions=prompts.set_variable_values_tool),
        LoadDatasetCapability(instructions=prompts.load_dataset_tool),
        OpenCodeEvaluatorFormCapability(instructions=prompts.open_code_evaluator_form_tool),
        OpenLlmEvaluatorFormCapability(instructions=prompts.open_llm_evaluator_form_tool),
        ReadCodeEvaluatorDraftCapability(instructions=prompts.read_code_evaluator_draft_tool),
        EditCodeEvaluatorDraftCapability(instructions=prompts.edit_code_evaluator_draft_tool),
        RunCodeEvaluatorDraftCapability(instructions=prompts.test_code_evaluator_draft_tool),
        ReadLlmEvaluatorDraftCapability(instructions=prompts.read_llm_evaluator_draft_tool),
        EditLlmEvaluatorDraftCapability(instructions=prompts.edit_llm_evaluator_draft_tool),
        RunLlmEvaluatorDraftCapability(instructions=prompts.test_llm_evaluator_draft_tool),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        included_dynamic = [cap for cap in dynamic_capabilities if cap.include_for_run(ctx)]
        return CombinedCapability(capabilities=[*static_capabilities, *included_dynamic])

    return _build


__all__ = [
    "AskUserCapability",
    "BatchSpanAnnotateCapability",
    "BashCapability",
    "ClonePromptInstanceCapability",
    "EditCodeEvaluatorDraftCapability",
    "EditLlmEvaluatorDraftCapability",
    "EditPromptInstanceCapability",
    "GetRouteInfoCapability",
    "ListPlaygroundModelTargetsCapability",
    "LoadDatasetCapability",
    "OpenCodeEvaluatorFormCapability",
    "OpenLlmEvaluatorFormCapability",
    "ReadCodeEvaluatorDraftCapability",
    "ReadLlmEvaluatorDraftCapability",
    "ReadPromptInstanceCapability",
    "ReadPromptToolsCapability",
    "ReadPlaygroundOutputCapability",
    "RenderGenerativeUICapability",
    "RunPlaygroundCapability",
    "SavePromptCapability",
    "SetPlaygroundModelCapability",
    "SetSpansFilterCapability",
    "SetTimeRangeCapability",
    "SetVariableValuesCapability",
    "WritePromptToolsCapability",
    "RunCodeEvaluatorDraftCapability",
    "RunLlmEvaluatorDraftCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
