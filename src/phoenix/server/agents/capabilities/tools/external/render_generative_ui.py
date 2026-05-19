from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, cast

from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.config import SERVER_DIR
from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

RENDER_GENERATIVE_UI_TOOL_NAME = "render_generative_ui"

_GENERATIVE_UI_DIR = SERVER_DIR / "generative_ui"


def _load_text(name: str) -> str:
    return (_GENERATIVE_UI_DIR / name).read_text(encoding="utf-8").strip()


def _load_json(name: str) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads((_GENERATIVE_UI_DIR / name).read_text(encoding="utf-8")))


# The generative UI schema comes from json-render's `catalog.jsonSchema()`. It
# constrains the flat spec shape and allowed component names, but leaves element
# `props` open because json-render represents elements as an arbitrary ID-keyed
# record where each `props` schema depends on that element's `type`. The
# generative UI tool description carries the concrete prop contract, and the browser
# validates calls against the TypeScript catalog before rendering.
_GENERATIVE_UI_SPEC_SCHEMA = _load_json("spec_schema.json")

_RENDER_GENERATIVE_UI_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "spec": {
            **_GENERATIVE_UI_SPEC_SCHEMA,
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

RENDER_GENERATIVE_UI_TOOL_DEFINITION = ToolDefinition(
    name=RENDER_GENERATIVE_UI_TOOL_NAME,
    description=_load_text("tool_description.txt"),
    parameters_json_schema=_RENDER_GENERATIVE_UI_PARAMETERS,
    kind="external",
)


@dataclass
class RenderGenerativeUICapability(AbstractStaticCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([RENDER_GENERATIVE_UI_TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return ""
