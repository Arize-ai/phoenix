from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template

from phoenix.server.agents.prompts.templating import get_template

_BASE_INSTRUCTIONS = get_template("base/BASE_INSTRUCTIONS.xml.j2")
_BASE_SUBAGENT_INSTRUCTIONS = get_template("base/BASE_SUBAGENT_INSTRUCTIONS.xml.j2")
_DOCS_TOOL_INSTRUCTIONS = get_template("tools/DOCS_TOOL_INSTRUCTIONS.xml.j2")
_BASH_TOOL_INSTRUCTIONS = get_template("tools/BASH_TOOL_INSTRUCTIONS.xml.j2")
_WRITE_SPAN_NOTE_TOOL_INSTRUCTIONS = get_template("tools/WRITE_SPAN_NOTE_TOOL_INSTRUCTIONS.xml.j2")
_ASK_USER_TOOL_INSTRUCTIONS = get_template("tools/ASK_USER_TOOL_INSTRUCTIONS.xml.j2")
_SEARCH_UI_TOOL_INSTRUCTIONS = get_template("tools/SEARCH_UI_TOOL_INSTRUCTIONS.xml.j2")
_EXECUTE_UI_TOOL_INSTRUCTIONS = get_template("tools/EXECUTE_UI_TOOL_INSTRUCTIONS.xml.j2")
_GET_CURRENT_DATETIME_TOOL_INSTRUCTIONS = get_template(
    "tools/GET_CURRENT_DATETIME_TOOL_INSTRUCTIONS.xml.j2"
)
_GET_ROUTE_INFO_TOOL_INSTRUCTIONS = get_template("tools/GET_ROUTE_INFO_TOOL_INSTRUCTIONS.xml.j2")
_RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS = get_template(
    "tools/RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS.xml.j2"
)
_LIST_DATASET_EXAMPLES_TOOL_INSTRUCTIONS = get_template(
    "tools/LIST_DATASET_EXAMPLES_TOOL_INSTRUCTIONS.xml.j2"
)
_LIST_DATASET_SPLITS_TOOL_INSTRUCTIONS = get_template(
    "tools/LIST_DATASET_SPLITS_TOOL_INSTRUCTIONS.xml.j2"
)
_LIST_SPLITS_TOOL_INSTRUCTIONS = get_template("tools/LIST_SPLITS_TOOL_INSTRUCTIONS.xml.j2")
_LIST_DATASET_LABELS_TOOL_INSTRUCTIONS = get_template(
    "tools/LIST_DATASET_LABELS_TOOL_INSTRUCTIONS.xml.j2"
)
_LIST_DATASETS_TOOL_INSTRUCTIONS = get_template("tools/LIST_DATASETS_TOOL_INSTRUCTIONS.xml.j2")
_LIST_LABELS_TOOL_INSTRUCTIONS = get_template("tools/LIST_LABELS_TOOL_INSTRUCTIONS.xml.j2")
_APP_CONTEXT_TEMPLATE = get_template("context/APP_CONTEXT_INSTRUCTIONS.xml.j2")
_PROJECT_CONTEXT_TEMPLATE = get_template("context/PROJECT_CONTEXT_INSTRUCTIONS.xml.j2")
_TRACE_CONTEXT_TEMPLATE = get_template("context/TRACE_CONTEXT_INSTRUCTIONS.xml.j2")
_SESSION_CONTEXT_TEMPLATE = get_template("context/SESSION_CONTEXT_INSTRUCTIONS.xml.j2")
_PROMPT_CONTEXT_TEMPLATE = get_template("context/PROMPT_CONTEXT_INSTRUCTIONS.xml.j2")
_PROMPT_VERSION_CONTEXT_TEMPLATE = get_template(
    "context/PROMPT_VERSION_CONTEXT_INSTRUCTIONS.xml.j2"
)
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
_CALL_SUBAGENT_TOOL_INSTRUCTIONS = get_template("tools/CALL_SUBAGENT_TOOL_INSTRUCTIONS.xml.j2")

SUMMARIZATION_INSTRUCTIONS_TEMPLATE = get_template(
    "summarization/SUMMARIZATION_PROMPT_INSTRUCTIONS.xml.j2"
)
COMPACTION_INSTRUCTIONS_TEMPLATE = get_template(
    "summarization/COMPACTION_PROMPT_INSTRUCTIONS.xml.j2"
)
COMPACTION_MESSAGE_TEMPLATE = get_template("summarization/COMPACTION_MESSAGE.xml.j2")


@dataclass(frozen=True)
class AgentPrompts:
    """Every prompt template the chat agent uses."""

    base: Template = _BASE_INSTRUCTIONS
    docs_tool: Template = _DOCS_TOOL_INSTRUCTIONS
    bash_tool: Template = _BASH_TOOL_INSTRUCTIONS
    write_span_note_tool: Template = _WRITE_SPAN_NOTE_TOOL_INSTRUCTIONS
    ask_user_tool: Template = _ASK_USER_TOOL_INSTRUCTIONS
    search_ui_tool: Template = _SEARCH_UI_TOOL_INSTRUCTIONS
    execute_ui_tool: Template = _EXECUTE_UI_TOOL_INSTRUCTIONS
    get_current_datetime_tool: Template = _GET_CURRENT_DATETIME_TOOL_INSTRUCTIONS
    get_route_info_tool: Template = _GET_ROUTE_INFO_TOOL_INSTRUCTIONS
    render_generative_ui_tool: Template = _RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS
    list_dataset_examples_tool: Template = _LIST_DATASET_EXAMPLES_TOOL_INSTRUCTIONS
    list_dataset_splits_tool: Template = _LIST_DATASET_SPLITS_TOOL_INSTRUCTIONS
    list_splits_tool: Template = _LIST_SPLITS_TOOL_INSTRUCTIONS
    list_dataset_labels_tool: Template = _LIST_DATASET_LABELS_TOOL_INSTRUCTIONS
    list_datasets_tool: Template = _LIST_DATASETS_TOOL_INSTRUCTIONS
    list_labels_tool: Template = _LIST_LABELS_TOOL_INSTRUCTIONS
    app_context: Template = _APP_CONTEXT_TEMPLATE
    project_context: Template = _PROJECT_CONTEXT_TEMPLATE
    trace_context: Template = _TRACE_CONTEXT_TEMPLATE
    session_context: Template = _SESSION_CONTEXT_TEMPLATE
    prompt_context: Template = _PROMPT_CONTEXT_TEMPLATE
    prompt_version_context: Template = _PROMPT_VERSION_CONTEXT_TEMPLATE
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
    call_subagent_tool: Template = _CALL_SUBAGENT_TOOL_INSTRUCTIONS


@dataclass(frozen=True)
class ServerAgentPrompts:
    """Every prompt template the server agent uses."""

    base: Template = _BASE_SUBAGENT_INSTRUCTIONS
    bash_tool: Template = _BASH_TOOL_INSTRUCTIONS
    write_span_note_tool: Template = _WRITE_SPAN_NOTE_TOOL_INSTRUCTIONS
    docs_tool: Template = _DOCS_TOOL_INSTRUCTIONS
    skills: Template = _SKILLS_TEMPLATE
    load_skill: Template = _LOAD_SKILL_TEMPLATE
    load_skill_tool: Template = _LOAD_SKILL_TOOL_TEMPLATE
    read_skill_resource_tool: Template = _READ_SKILL_RESOURCE_TOOL_TEMPLATE
    call_subagent_tool: Template = _CALL_SUBAGENT_TOOL_INSTRUCTIONS


__all__ = [
    "AgentPrompts",
    "COMPACTION_INSTRUCTIONS_TEMPLATE",
    "COMPACTION_MESSAGE_TEMPLATE",
    "ServerAgentPrompts",
    "SUMMARIZATION_INSTRUCTIONS_TEMPLATE",
]
