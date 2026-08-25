from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "read_dataset_evaluator_definition"

MAX_EVALUATOR_IDS = 5

DESCRIPTION = (
    "Read the full definition of one or a few existing dataset evaluators by id, "
    "without opening any form. Returns `datasetEvaluatorDefinitions`, one entry per id "
    "in request order. Use this to inspect, compare, or summarize an evaluator's body "
    "before selecting or proposing edits: code evaluators return source, language, "
    "sandbox, and mappings; LLM evaluators return judge messages, model config, and "
    "output configs; built-in evaluators return metadata, input schema, and output "
    "configs.\n"
    "Pass `datasetEvaluatorIds` from the playground roster (`existing_dataset_evaluators`); "
    f"read only the ids you need, at most {MAX_EVALUATOR_IDS} at a time.\n"
    "If any id is not on the roster, the whole call fails — re-check the roster and retry "
    "with valid ids. If an id passes the roster check but can't be read (for example it "
    "was just deleted), that id is reported under `errors` while the rest still return in "
    "`datasetEvaluatorDefinitions`; retry only the failed ids.\n"
    "Long body fields may be truncated with a `… [truncated]` marker; open the evaluator's "
    "form if you need the untruncated body.\n"
    "This tool only reads. To edit an evaluator use `open_dataset_evaluator_for_edit`; to "
    "change which ones run use `set_dataset_evaluator_selection`."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetEvaluatorIds": {
            "type": "array",
            "description": (
                "Ids of the dataset evaluators to read, taken from the playground "
                "roster. Prefer reading the few evaluators you actually need."
            ),
            "items": {"type": "string", "minLength": 1},
            "minItems": 1,
            "maxItems": MAX_EVALUATOR_IDS,
        },
    },
    "required": ["datasetEvaluatorIds"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ReadDatasetEvaluatorDefinitionCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Pure read, so not viewer-gated, matching read_code_evaluator_draft and the
        # list_* tools; only writes/runs gate on is_viewer.
        playground = ctx.deps.contexts.playground
        return (
            playground is not None
            and ctx.deps.contexts.dataset is not None
            and bool(playground.evaluators)
        )
