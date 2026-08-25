from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "edit_code_evaluator_draft"

LANGUAGE_ENUM = ["PYTHON", "TYPESCRIPT"]

DESCRIPTION = """\
Propose edits to the open code-evaluator draft. This tool does not change the form immediately: the browser renders an inline diff and the user must accept or reject it. Call `read_code_evaluator_draft` first to see the current draft before proposing edits.

OPERATIONS
- `operations` must always be an array, even for a single edit, and they apply in order.
- Use camelCase field names exactly as shown. Common shapes:
  - {"type":"set_source_code","sourceCode":"def evaluate(output):\\n    return 1.0"}
  - {"type":"set_language","language":"PYTHON"} — only valid in `create` mode.
  - {"type":"set_sandbox_config","sandboxConfigId":"U2FuZGJveENvbmZpZzox"} — pass null only in `edit` mode to clear. In `create` mode the sandbox config ID must be non-null and its language must match the draft language.
  - {"type":"set_input_mapping","inputMapping":{"pathMapping":{"input":"attributes.input.value"},"literalMapping":{}}}
  - {"type":"set_description","description":"Scores hallucination risk"}
  - {"type":"set_name","name":"hallucination-v2"}
  - {"type":"set_output_configs","outputConfigs":[{"kind":"freeform","name":"hallucination-v2","optimizationDirection":"MAXIMIZE","threshold":0.5,"lowerBound":0,"upperBound":1}]} — whole-list replace. Other valid `kind`s: `classification` (with a `values` list of {label, score?}) and `continuous` (with `lowerBound`/`upperBound`). Use the draft evaluator name on each entry unless the evaluator clearly returns multiple independent outputs. Propose output configs whenever you can infer them from the source rather than leaving the draft's defaults in place.
  - {"type":"set_test_payload","testPayload":{"input":{},"output":{"messages":[{"role":"assistant","content":"Final answer"}]},"reference":{},"metadata":{}}} — whole-value replacement for the JSON mapping source used by the preview/test section.

INVARIANTS
- Never rename or remove the `evaluate` function — the runtime calls it by name.
- Only declare parameters from {input, output, reference, metadata} on `evaluate`; additional parameters fail at execution.
- For dataset-backed evaluators, `output` is the new experiment run output at runtime, and Phoenix passes the dataset example `output` as `reference`; the dataset `output` shape is evidence for what future run outputs may look like.
- Prefer direct `evaluate` arguments and parse nested dicts, lists, or stringified JSON inside the function rather than relying on custom input mapping — the simplest evaluator usually declares only `output`, adding `reference` for relational checks against expected/golden/subset data.
- Treat the dataset example shape as evidence: write helpers that normalize JSON strings and traverse the actual structure, especially chat-style `messages` arrays, assistant content parts, `tool_calls`/`toolCalls`, or `function_call`; do not assume the signal is at a top-level key.
- In `edit` mode `set_language` is rejected (language is immutable post-create).
- In `create` mode, switching `set_language` may clear an incompatible `sandboxConfigId`, so include a compatible `set_sandbox_config` in the same proposal; create-mode proposals that leave `sandboxConfigId` null are rejected.

SAMPLE SHAPE PARSING
- If the dataset examples use a message transcript shape, propose `sourceCode` with explicit traversal of that shape rather than a generic top-level field check.
- If comparing the new run output to the dataset reference, apply equivalent normalization/traversal to both `output` and `reference`; otherwise prefer deriving the score from `output`.

INPUT MAPPING
- Keep `inputMapping` at the safe default ({"literalMapping": {}, "pathMapping": {}}) unless the user explicitly asks for custom mapping or the current draft already uses mapping intentionally.
- If you need a nested value from the dataset example, read it from the direct argument in `sourceCode` instead of proposing a path-mapping edit.

TEST PAYLOAD
- `testPayload` is the JSON mapping source the form preview uses while the user is authoring the evaluator, with `input`, `output`, `reference`, and `metadata` object fields.
- Shape `testPayload.output` from the dataset `output` shape or the user's concrete target case; treat it as representative evidence, not a fixed schema guarantee.
- For relational evaluators, keep `testPayload.output` as the candidate new run output and put expected/golden/subset data in `testPayload.reference`, not in input mapping.
- Use `set_test_payload` when preview failures show the test case is missing the signal the evaluator should score, or when the user asks to try a different representative output.

SANDBOX CONFIG
- Before emitting `set_sandbox_config`, fetch the selectable inventory on demand with the `bash` tool's `phoenix-gql` command — it is not inlined in this prompt. Query `sandboxBackends { backendType status }` and `sandboxProviders { backendType enabled configs { id name language enabled config { envVars { name } internetAccess { mode } dependencies { packages } } } }`, then keep only configs where the provider `enabled` is true, the config `enabled` is true, and the config's backend has `status` `AVAILABLE`.
- Request only `envVars { name }` — never `secretKey`.
- Pick `sandboxConfigId` from the filtered set; do NOT invent or guess an ID. The chosen config's `language` must match the draft language.
- If the latest `read_code_evaluator_draft` snapshot already has a non-null `sandboxConfigId`, you are not changing `language`, and the user did not ask to change sandboxes, leave the sandbox untouched — do NOT emit `set_sandbox_config` just to restate an existing compatible selection.

GUIDELINES
- Emit operations ONLY for fields you intend to change; redundant ops produce noisy diff previews and waste tokens.
- Keep edits small and focused so the user can read the diff, grouping related field changes that form one logical intent.
- After proposing the edit, briefly summarize what the diff will show.
- After the user accepts relevant edits, offer to run `test_code_evaluator_draft` so they can inspect the preview result before the draft is saved."""

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

OUTPUT_CONFIG_DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One output config the evaluator produces. Discriminated by `kind`: "
        "`classification` uses `values`; `continuous` uses `lowerBound`/`upperBound`; "
        "`freeform` uses `threshold` and optional bounds."
    ),
    "properties": {
        "kind": {
            "type": "string",
            "enum": ["classification", "continuous", "freeform"],
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
        "threshold": {"type": ["number", "null"]},
        "lowerBound": {"type": ["number", "null"]},
        "upperBound": {"type": ["number", "null"]},
    },
    "required": ["kind", "name", "optimizationDirection"],
    "additionalProperties": False,
}

OPERATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One code-evaluator draft edit operation. Required fields by type: "
        "set_source_code requires sourceCode; set_language requires language "
        "(rejected in edit mode); set_sandbox_config requires sandboxConfigId "
        "(must be non-null in create mode; may be null only in edit mode to clear); "
        "set_input_mapping requires inputMapping; "
        "set_description requires description; set_name requires name; "
        "set_output_configs requires outputConfigs (whole-list replace); "
        "set_test_payload requires testPayload."
    ),
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "set_source_code",
                "set_language",
                "set_sandbox_config",
                "set_input_mapping",
                "set_description",
                "set_name",
                "set_output_configs",
                "set_test_payload",
            ],
            "description": "The operation kind.",
        },
        "sourceCode": {
            "type": "string",
            "description": (
                "Full replacement source for the evaluator. Must still define a "
                "function named `evaluate` whose parameters are a subset of "
                "{input, output, reference, metadata}."
            ),
        },
        "language": {
            "type": "string",
            "enum": LANGUAGE_ENUM,
            "description": (
                "Evaluator language. Only valid in `create` mode; rejected in "
                "`edit` mode since language is immutable post-create."
            ),
        },
        "sandboxConfigId": {
            "type": ["string", "null"],
            "description": (
                "Relay node ID of the sandbox configuration. Must match the "
                "draft language. Create-mode drafts require a non-null value; "
                "pass null only in edit mode to clear the selection."
            ),
        },
        "inputMapping": {
            "type": "object",
            "description": (
                "Replacement input mapping. The form treats `pathMapping` as "
                "field-path lookups and `literalMapping` as literal values "
                "passed to the evaluator's parameters."
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
                "Whole-list replacement of the evaluator's output configs. "
                "Each entry follows the kind-discriminated OutputConfigDraft."
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
class EditCodeEvaluatorDraftCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        code_evaluator = ctx.deps.contexts.code_evaluator
        if code_evaluator is None or ctx.deps.is_viewer:
            return False
        return (
            code_evaluator.evaluator_node_id is not None or ctx.deps.sandbox_availability.has_usable
        )
