from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "edit_llm_evaluator_draft"

DESCRIPTION = """\
Propose edits to the open LLM-evaluator draft. This tool does not change the form immediately: the browser renders an inline diff and the user must accept or reject it. Call `read_llm_evaluator_draft` first to see the current draft before proposing edits.

OPERATIONS
- `operations` must always be an array, even for a single edit, and they apply in order.
- Use camelCase field names exactly as shown. Common shapes:
  - {"type":"set_judge_prompt","messages":[{"role":"system","content":"You are a strict grader."},{"role":"user","content":"Question: {{input}}\\nAnswer: {{output}}\\nIs the answer correct?"}]} — whole-list replace of the judge prompt messages; `templateFormat` is optional and only set when changing it.
  - {"type":"set_judge_model","model":"gpt-4o","provider":"OPENAI"} — `model` and `provider` are required together, `invocationParameters` is optional. Do NOT change the model via `set_judge_prompt`. Prefer a provider whose credentials are already configured (see `<available_model_providers>`) and alert the user if the chosen provider still needs credentials at /settings/providers.
  - {"type":"set_include_explanation","includeExplanation":true} — whether the judge emits a free-text `explanation` alongside its label.
  - {"type":"set_input_mapping","inputMapping":{"pathMapping":{},"literalMapping":{}}}
  - {"type":"set_description","description":"Scores answer correctness"}
  - {"type":"set_name","name":"correctness-v2"}
  - {"type":"set_output_configs","outputConfigs":[{"kind":"classification","name":"correctness-v2","optimizationDirection":"MAXIMIZE","values":[{"label":"correct","score":1},{"label":"incorrect","score":0}]}]} — whole-list replace. LLM evaluators use the `classification` kind: each config lists the labels the judge can return. Use the draft evaluator name on each entry unless the judge clearly returns multiple independent outputs.
  - {"type":"set_test_payload","testPayload":{"input":{},"output":{"messages":[{"role":"assistant","content":"Final answer"}]},"reference":{},"metadata":{}}} — whole-value replacement for the JSON mapping source used by the preview/test section.

INVARIANTS
- Do NOT set the judge prompt `tools` or `toolChoice` — they are derived from `outputConfigs` and `includeExplanation` and regenerated when the edit is applied, so changing `set_output_configs` or `set_include_explanation` keeps the judge tool consistent automatically.
- The judge prompt `messages` reference run fields via template variables ({{input}}, {{output}}, {{reference}}, {{metadata}}); for dataset-backed evaluators `output` is the new experiment run output at runtime and Phoenix passes the dataset example `output` as `reference`.
- Treat the dataset example shape as evidence for which fields carry the signal, especially chat-style `messages` arrays, assistant content parts, `tool_calls`/`toolCalls`, or `function_call`; do not assume the signal is at a top-level key.

INPUT MAPPING
- Keep `inputMapping` at the safe default ({"literalMapping": {}, "pathMapping": {}}) unless the user explicitly asks for custom mapping or the current draft already uses mapping intentionally.

TEST PAYLOAD
- `testPayload` is the JSON mapping source the form preview uses while the user is authoring the evaluator, with `input`, `output`, `reference`, and `metadata` object fields.
- Shape `testPayload.output` from the dataset `output` shape or the user's concrete target case; treat it as representative evidence, not a fixed schema guarantee.
- Use `set_test_payload` when preview failures show the test case is missing the signal the judge should score, or when the user asks to try a different representative output.

GUIDELINES
- Emit operations ONLY for fields you intend to change; redundant ops produce noisy diff previews and waste tokens.
- Keep edits small and focused so the user can read the diff, grouping related field changes that form one logical intent.
- After proposing the edit, briefly summarize what the diff will show so the user knows what they are accepting or rejecting."""

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
class EditLlmEvaluatorDraftCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        llm_evaluator = ctx.deps.contexts.llm_evaluator
        if llm_evaluator is None or ctx.deps.is_viewer:
            return False
        return (
            llm_evaluator.evaluator_node_id is not None
            or ctx.deps.model_provider_availability.has_usable
        )
