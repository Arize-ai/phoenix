from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template

from phoenix.server.agents.prompts.templating import get_template

_BASE_INSTRUCTIONS = get_template("base/BASE_INSTRUCTIONS.xml.j2")
_DOCS_TOOL_INSTRUCTIONS = get_template("tools/DOCS_TOOL_INSTRUCTIONS.xml.j2")
_BASH_TOOL_INSTRUCTIONS = get_template("tools/BASH_TOOL_INSTRUCTIONS.xml.j2")
_ASK_USER_TOOL_INSTRUCTIONS = get_template("tools/ASK_USER_TOOL_INSTRUCTIONS.xml.j2")
_SET_TIME_RANGE_TOOL_INSTRUCTIONS = get_template("tools/SET_TIME_RANGE_TOOL_INSTRUCTIONS.xml.j2")
_GET_ROUTE_INFO_TOOL_INSTRUCTIONS = get_template("tools/GET_ROUTE_INFO_TOOL_INSTRUCTIONS.xml.j2")
_RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS = get_template(
    "tools/RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS.xml.j2"
)
_SET_SPANS_FILTER_TOOL_INSTRUCTIONS = get_template(
    "tools/SET_SPANS_FILTER_TOOL_INSTRUCTIONS.xml.j2"
)
_SET_PLAYGROUND_MODEL_TOOL_INSTRUCTIONS = get_template(
    "tools/SET_PLAYGROUND_MODEL_TOOL_INSTRUCTIONS.xml.j2"
)
_LIST_PLAYGROUND_MODEL_TARGETS_TOOL_INSTRUCTIONS = get_template(
    "tools/LIST_PLAYGROUND_MODEL_TARGETS_TOOL_INSTRUCTIONS.xml.j2"
)
_READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = get_template(
    "tools/READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml.j2"
)
_READ_PLAYGROUND_OUTPUT_TOOL_INSTRUCTIONS = get_template(
    "tools/READ_PLAYGROUND_OUTPUT_TOOL_INSTRUCTIONS.xml.j2"
)
_CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = get_template(
    "tools/CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml.j2"
)
_EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = get_template(
    "tools/EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml.j2"
)
_READ_PROMPT_TOOLS_TOOL_INSTRUCTIONS = get_template(
    "tools/READ_PROMPT_TOOLS_TOOL_INSTRUCTIONS.xml.j2"
)
_WRITE_PROMPT_TOOLS_TOOL_INSTRUCTIONS = get_template(
    "tools/WRITE_PROMPT_TOOLS_TOOL_INSTRUCTIONS.xml.j2"
)
_RUN_PLAYGROUND_TOOL_INSTRUCTIONS = get_template("tools/RUN_PLAYGROUND_TOOL_INSTRUCTIONS.xml.j2")
_SAVE_PROMPT_TOOL_INSTRUCTIONS = get_template("tools/SAVE_PROMPT_TOOL_INSTRUCTIONS.xml.j2")
_SET_VARIABLE_VALUES_TOOL_INSTRUCTIONS = get_template(
    "tools/SET_VARIABLE_VALUES_TOOL_INSTRUCTIONS.xml.j2"
)
_LOAD_DATASET_TOOL_INSTRUCTIONS = get_template("tools/LOAD_DATASET_TOOL_INSTRUCTIONS.xml.j2")
_BATCH_SPAN_ANNOTATE_TOOL_INSTRUCTIONS = get_template(
    "tools/BATCH_SPAN_ANNOTATE_TOOL_INSTRUCTIONS.xml.j2"
)
_READ_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS = get_template(
    "tools/READ_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS.xml.j2"
)
_EDIT_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS = get_template(
    "tools/EDIT_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS.xml.j2"
)
_TEST_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS = get_template(
    "tools/TEST_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS.xml.j2"
)
_OPEN_CODE_EVALUATOR_FORM_TOOL_INSTRUCTIONS = get_template(
    "tools/OPEN_CODE_EVALUATOR_FORM_TOOL_INSTRUCTIONS.xml.j2"
)
_READ_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS = get_template(
    "tools/READ_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS.xml.j2"
)
_EDIT_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS = get_template(
    "tools/EDIT_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS.xml.j2"
)
_TEST_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS = get_template(
    "tools/TEST_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS.xml.j2"
)
_OPEN_LLM_EVALUATOR_FORM_TOOL_INSTRUCTIONS = get_template(
    "tools/OPEN_LLM_EVALUATOR_FORM_TOOL_INSTRUCTIONS.xml.j2"
)
_APP_CONTEXT_TEMPLATE = get_template("context/APP_CONTEXT_INSTRUCTIONS.xml.j2")
_PROJECT_CONTEXT_TEMPLATE = get_template("context/PROJECT_CONTEXT_INSTRUCTIONS.xml.j2")
_TRACE_CONTEXT_TEMPLATE = get_template("context/TRACE_CONTEXT_INSTRUCTIONS.xml.j2")
_SPAN_CONTEXT_TEMPLATE = get_template("context/SPAN_CONTEXT_INSTRUCTIONS.xml.j2")
_PLAYGROUND_CONTEXT_TEMPLATE = get_template("context/PLAYGROUND_CONTEXT_INSTRUCTIONS.xml.j2")
_CODE_EVALUATOR_CONTEXT_TEMPLATE = get_template(
    "context/CODE_EVALUATOR_CONTEXT_INSTRUCTIONS.xml.j2"
)
_LLM_EVALUATOR_CONTEXT_TEMPLATE = get_template("context/LLM_EVALUATOR_CONTEXT_INSTRUCTIONS.xml.j2")
_DATASET_CONTEXT_TEMPLATE = get_template("context/DATASET_CONTEXT_INSTRUCTIONS.xml.j2")
_GRAPHQL_MUTATIONS_TEMPLATE = get_template("context/GRAPHQL_MUTATIONS_INSTRUCTIONS.xml.j2")
_SKILLS_TEMPLATE = get_template("skills/SKILLS_INSTRUCTIONS.xml.j2")
_LOAD_SKILL_TEMPLATE = get_template("skills/LOAD_SKILL.xml.j2")
_LOAD_SKILL_TOOL_TEMPLATE = get_template("skills/LOAD_SKILL_TOOL.xml.j2")
_READ_SKILL_RESOURCE_TOOL_TEMPLATE = get_template("skills/READ_SKILL_RESOURCE_TOOL.xml.j2")

SUMMARIZATION_INSTRUCTIONS_TEMPLATE = get_template(
    "summarization/SUMMARIZATION_PROMPT_INSTRUCTIONS.xml.j2"
)


@dataclass(frozen=True)
class AgentPrompts:
    """Typed bundle of every prompt template the chat agent uses."""

    base: Template = _BASE_INSTRUCTIONS
    docs_tool: Template = _DOCS_TOOL_INSTRUCTIONS
    bash_tool: Template = _BASH_TOOL_INSTRUCTIONS
    ask_user_tool: Template = _ASK_USER_TOOL_INSTRUCTIONS
    set_time_range_tool: Template = _SET_TIME_RANGE_TOOL_INSTRUCTIONS
    get_route_info_tool: Template = _GET_ROUTE_INFO_TOOL_INSTRUCTIONS
    render_generative_ui_tool: Template = _RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS
    set_spans_filter_tool: Template = _SET_SPANS_FILTER_TOOL_INSTRUCTIONS
    set_playground_model_tool: Template = _SET_PLAYGROUND_MODEL_TOOL_INSTRUCTIONS
    list_playground_model_targets_tool: Template = _LIST_PLAYGROUND_MODEL_TARGETS_TOOL_INSTRUCTIONS
    read_prompt_instance_tool: Template = _READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    read_playground_output_tool: Template = _READ_PLAYGROUND_OUTPUT_TOOL_INSTRUCTIONS
    clone_prompt_instance_tool: Template = _CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    edit_prompt_instance_tool: Template = _EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    save_prompt_tool: Template = _SAVE_PROMPT_TOOL_INSTRUCTIONS
    read_prompt_tools_tool: Template = _READ_PROMPT_TOOLS_TOOL_INSTRUCTIONS
    write_prompt_tools_tool: Template = _WRITE_PROMPT_TOOLS_TOOL_INSTRUCTIONS
    run_playground_tool: Template = _RUN_PLAYGROUND_TOOL_INSTRUCTIONS
    set_variable_values_tool: Template = _SET_VARIABLE_VALUES_TOOL_INSTRUCTIONS
    load_dataset_tool: Template = _LOAD_DATASET_TOOL_INSTRUCTIONS
    batch_span_annotate_tool: Template = _BATCH_SPAN_ANNOTATE_TOOL_INSTRUCTIONS
    read_code_evaluator_draft_tool: Template = _READ_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS
    edit_code_evaluator_draft_tool: Template = _EDIT_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS
    test_code_evaluator_draft_tool: Template = _TEST_CODE_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS
    open_code_evaluator_form_tool: Template = _OPEN_CODE_EVALUATOR_FORM_TOOL_INSTRUCTIONS
    read_llm_evaluator_draft_tool: Template = _READ_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS
    edit_llm_evaluator_draft_tool: Template = _EDIT_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS
    test_llm_evaluator_draft_tool: Template = _TEST_LLM_EVALUATOR_DRAFT_TOOL_INSTRUCTIONS
    open_llm_evaluator_form_tool: Template = _OPEN_LLM_EVALUATOR_FORM_TOOL_INSTRUCTIONS
    app_context: Template = _APP_CONTEXT_TEMPLATE
    project_context: Template = _PROJECT_CONTEXT_TEMPLATE
    trace_context: Template = _TRACE_CONTEXT_TEMPLATE
    span_context: Template = _SPAN_CONTEXT_TEMPLATE
    playground_context: Template = _PLAYGROUND_CONTEXT_TEMPLATE
    code_evaluator_context: Template = _CODE_EVALUATOR_CONTEXT_TEMPLATE
    llm_evaluator_context: Template = _LLM_EVALUATOR_CONTEXT_TEMPLATE
    dataset_context: Template = _DATASET_CONTEXT_TEMPLATE
    graphql_mutations: Template = _GRAPHQL_MUTATIONS_TEMPLATE
    skills: Template = _SKILLS_TEMPLATE
    load_skill: Template = _LOAD_SKILL_TEMPLATE
    load_skill_tool: Template = _LOAD_SKILL_TOOL_TEMPLATE
    read_skill_resource_tool: Template = _READ_SKILL_RESOURCE_TOOL_TEMPLATE


__all__ = [
    "AgentPrompts",
    "SUMMARIZATION_INSTRUCTIONS_TEMPLATE",
]
