from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "edit_llm_evaluator_draft"

DESCRIPTION = (
    "Propose edits to the open LLM-evaluator draft. This tool does not change "
    "the form immediately: the browser renders an inline diff and the user must "
    "accept or reject it. Call `read_llm_evaluator_draft` first to see the "
    "current draft before proposing edits. "
    "Use camelCase field names exactly as shown. Common valid examples: "
    '{"type":"set_judge_prompt","messages":[{"role":"system","content":'
    '"You are a strict grader."},{"role":"user","content":'
    '"Question: {{input}}\\nAnswer: {{output}}"}]}; '
    '{"type":"set_judge_model","model":"gpt-4o","provider":"OPENAI"}; '
    '{"type":"set_include_explanation","includeExplanation":true}; '
    '{"type":"set_input_mapping","inputMapping":{"pathMapping":{},"literalMapping":{}}}; '
    '{"type":"set_test_payload","testPayload":{"input":{},'
    '"output":{"messages":[{"role":"assistant","content":"ok"}]},'
    '"reference":{},"metadata":{}}}. '
    "Do not set the judge prompt `tools` or `toolChoice`; they are derived from "
    "`outputConfigs` and `includeExplanation` when the edit is applied."
)

JSON_RECORD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "JSON object with arbitrary JSON-safe values.",
    "additionalProperties": True,
}

TEST_PAYLOAD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "Replacement evaluator preview payload. The shape matches the form "
        "mapping source: input, output, reference, and metadata JSON objects."
    ),
    "properties": {
        "input": JSON_RECORD_SCHEMA,
        "output": JSON_RECORD_SCHEMA,
        "reference": JSON_RECORD_SCHEMA,
        "metadata": JSON_RECORD_SCHEMA,
    },
    "required": ["input", "output", "reference", "metadata"],
    "additionalProperties": False,
}

# The LLM-evaluator form exercises only the classification output variant.
OUTPUT_CONFIG_DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One classification output config the judge produces. `values` is the "
        "list of labels (each optionally scored) the annotation can take."
    ),
    "properties": {
        "kind": {
            "type": "string",
            "enum": ["classification"],
        },
        "name": {"type": "string"},
        "optimizationDirection": {
            "type": "string",
            "enum": ["MINIMIZE", "MAXIMIZE", "NONE"],
        },
        "values": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "score": {"type": ["number", "null"]},
                },
                "required": ["label"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["kind", "name", "optimizationDirection", "values"],
    "additionalProperties": False,
}

JUDGE_MESSAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "One judge prompt message: a role and its text content.",
    "properties": {
        "role": {
            "type": "string",
            "enum": ["user", "ai", "system", "tool"],
            "description": (
                "Message role. Roles are user/ai/system/tool; the OpenAI-style "
                "`assistant` is accepted as an alias for `ai`. Prefer emitting "
                "`ai` directly."
            ),
        },
        "content": {"type": "string"},
    },
    "required": ["role", "content"],
    "additionalProperties": False,
}

OPERATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One LLM-evaluator draft edit operation. Required fields by type: "
        "set_judge_prompt requires messages and may also set templateFormat; "
        "set_judge_model requires model and provider together and may also set "
        "invocationParameters; set_include_explanation requires "
        "includeExplanation; set_input_mapping requires inputMapping; "
        "set_description requires description; set_name requires name; "
        "set_output_configs requires outputConfigs (whole-list replace); "
        "set_test_payload requires testPayload."
    ),
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "set_judge_prompt",
                "set_judge_model",
                "set_include_explanation",
                "set_input_mapping",
                "set_description",
                "set_name",
                "set_output_configs",
                "set_test_payload",
            ],
            "description": "The operation kind.",
        },
        "messages": {
            "type": "array",
            "description": (
                "Whole-list replacement of the judge prompt messages. Each "
                "message has a role and string content; reference the run "
                "fields via template variables (e.g. `{{input}}`, `{{output}}`)."
            ),
            "items": JUDGE_MESSAGE_SCHEMA,
            "minItems": 1,
        },
        "templateFormat": {
            "type": "string",
            "enum": ["MUSTACHE", "F_STRING", "NONE"],
            "description": "Template variable syntax used in the judge prompt messages.",
        },
        "model": {
            "type": "string",
            "description": (
                "Judge model name (e.g. `gpt-4o`). Must match a provider with an installed "
                "SDK; prefer a provider whose credentials are already configured (see the "
                "context's available model providers guidance)."
            ),
        },
        "provider": {
            "type": "string",
            "description": "Judge model provider key (e.g. `OPENAI`, `ANTHROPIC`).",
        },
        "invocationParameters": {
            **JSON_RECORD_SCHEMA,
            "description": (
                "Judge model invocation parameters (e.g. temperature). Omit to "
                "keep the draft's current parameters."
            ),
        },
        "includeExplanation": {
            "type": "boolean",
            "description": (
                "Whether the judge must emit a free-text `explanation` alongside "
                "its label. The judge prompt tool is regenerated to match when applied."
            ),
        },
        "inputMapping": {
            "type": "object",
            "description": (
                "Replacement input mapping. The form treats `pathMapping` as "
                "field-path lookups and `literalMapping` as literal values."
            ),
            "properties": {
                "pathMapping": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                },
                "literalMapping": {
                    "type": "object",
                    "additionalProperties": True,
                },
            },
            "additionalProperties": False,
        },
        "description": {
            "type": "string",
            "description": "Replacement evaluator description.",
        },
        "name": {
            "type": "string",
            "description": "Replacement user-facing evaluator name.",
        },
        "outputConfigs": {
            "type": "array",
            "description": (
                "Whole-list replacement of the judge's classification output "
                "configs. Each entry follows the classification OutputConfigDraft."
            ),
            "items": OUTPUT_CONFIG_DRAFT_SCHEMA,
        },
        "testPayload": {
            **TEST_PAYLOAD_SCHEMA,
            "description": (
                "Replacement mapping source used by the evaluator preview/test section. "
                "For dataset-backed evaluators, shape `output` like a representative "
                "future experiment run output; relational evaluators can compare it "
                "to `reference`."
            ),
        },
    },
    "required": ["type"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "operations": {
            "type": "array",
            "description": "Ordered edit operations to propose for the draft.",
            "items": OPERATION_SCHEMA,
            "minItems": 1,
        },
    },
    "required": ["operations"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class EditLlmEvaluatorDraftCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        llm_evaluator = ctx.deps.contexts.llm_evaluator
        if llm_evaluator is None or ctx.deps.is_viewer:
            return False
        return (
            llm_evaluator.evaluator_node_id is not None
            or ctx.deps.model_provider_availability.has_usable
        )
