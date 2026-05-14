from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any

from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

from phoenix.config import SERVER_DIR

RENDER_GENERATED_UI_TOOL_NAME = "render_generated_ui"

_GENERATED_UI_DIR = SERVER_DIR / "generated_ui"


def _load_text(name: str) -> str:
    return (_GENERATED_UI_DIR / name).read_text(encoding="utf-8").strip()


def _load_json(name: str) -> dict[str, Any]:
    return json.loads((_GENERATED_UI_DIR / name).read_text(encoding="utf-8"))


# The generated schema comes from json-render's `catalog.jsonSchema()`. It
# constrains the flat spec shape and allowed component names, but leaves element
# `props` open because json-render represents elements as an arbitrary ID-keyed
# record where each `props` schema depends on that element's `type`. The
# generated tool description carries the concrete prop contract, and the browser
# validates calls against the TypeScript catalog before rendering.
_GENERATED_UI_SPEC_SCHEMA = _load_json("spec_schema.json")

_RENDER_GENERATED_UI_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "spec": {
            **_GENERATED_UI_SPEC_SCHEMA,
            "description": "Complete @json-render/react flat spec object to render.",
        },
        "state": {
            "type": "object",
            "description": (
                "Optional initial state model for $state references in the spec. "
                "Use an empty object when props carry literal data."
            ),
            "additionalProperties": True,
        },
    },
    "required": ["spec"],
    "additionalProperties": False,
}

RENDER_GENERATED_UI_TOOL_DEFINITION = ToolDefinition(
    name=RENDER_GENERATED_UI_TOOL_NAME,
    description=_load_text("tool_description.txt"),
    parameters_json_schema=_RENDER_GENERATED_UI_PARAMETERS,
    kind="external",
)


@dataclass
class RenderGeneratedUICapability(AbstractStaticCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([RENDER_GENERATED_UI_TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return ""
