from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, cast

from jinja2 import Template
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


# The frontend catalog generator owns json-render-specific artifacts that depend
# on the current React registry. The backend owns the external-tool wrapper and
# composes these generated catalog details into the tool definition below.
_GENERATIVE_UI_SPEC_SCHEMA = _load_json("spec_schema.json")
_GENERATIVE_UI_COMPONENT_REFERENCE = _load_text("component_reference.txt")

DESCRIPTION = "\n".join(
    [
        "Render a generative UI in the Phoenix chat using the available components below.",
        (
            "Use this tool when a compact visual UI such as metrics, charts, or an "
            "analytical card would answer the user better than prose alone."
        ),
        (
            "The `spec` argument must be one complete UI tree in this shape: "
            "`{ root: string, elements: Record<string, { type: string, props: "
            "object, children: [] }> }`."
        ),
        (
            "`root` is the id of the chart element to render. Each chart component "
            "is a leaf node, so `children` must be an empty array."
        ),
        (
            "Every element `type` must come from the component list below, and every "
            "element must include `type`, `props`, and `children`."
        ),
        (
            "Do not provide partial updates, JSONL patches, markdown, or prose inside "
            "`spec`; provide the full render tree in one object."
        ),
        _GENERATIVE_UI_COMPONENT_REFERENCE,
    ]
)

PARAMETERS: dict[str, Any] = {
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
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class RenderGenerativeUICapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([RENDER_GENERATIVE_UI_TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
