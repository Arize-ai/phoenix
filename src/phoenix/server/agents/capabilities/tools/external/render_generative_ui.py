from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, cast

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.config import SERVER_DIR
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
        (
            "Reach for this when the user asks to compare quantities across categories, "
            "time buckets, models, spans, sessions, or trace groups, and you have enough "
            "structured data for a small, self-contained visualization. Prefer BarChart, "
            "VerticalBarChart, StackedBarChart, and LineChart for quantitative answers."
        ),
        (
            "Keep BarChart, VerticalBarChart, and StackedBarChart `data` arrays between 2 "
            "and 12 items, with 2 to 4 segments in each StackedBarChart bar, and keep "
            "LineChart `lines` arrays between 1 and 4 items. A VerticalBarChart bar "
            "supports one base value and one optional highlight value, not arbitrary "
            "stacked subdivisions. When data density exceeds the bar chart limits, switch "
            "to a line chart or consolidate periods, such as hourly metrics into multi-hour "
            "chunks or monthly data into weekly summaries."
        ),
        (
            "If a call fails because the chart request violates a requirement, correct the "
            "counts or malformed data and re-render without announcing the specific limit "
            "numbers."
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
    defer_loading=True,
)


@dataclass
class RenderGenerativeUICapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([RENDER_GENERATIVE_UI_TOOL_DEFINITION])
