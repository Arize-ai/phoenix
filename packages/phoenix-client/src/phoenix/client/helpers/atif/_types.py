"""TypedDict definitions for the ATIF (Agent Trajectory Interchange Format) schema v1.0–v1.6.

Based on the Harbor reference implementation at laude-institute/harbor.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from typing_extensions import TypedDict


class ATIFToolCall(TypedDict):
    """A single tool/function call made by the agent."""

    tool_call_id: str
    function_name: str
    arguments: Dict[str, Any]


class ATIFContentPartSource(TypedDict, total=False):
    """Source object for image content parts (ATIF v1.6+)."""

    media_type: str  # e.g. "image/png"
    path: str  # URL or file path


class ATIFContentPart(TypedDict, total=False):
    """A multimodal content part (v1.6+). All fields optional by convention."""

    type: str  # "text" | "image"
    text: str
    source: ATIFContentPartSource


class ATIFObservationResult(TypedDict, total=False):
    """A single observation result returned from a tool call.

    Both source_call_id and content are optional per the spec:
    source_call_id may be omitted for non-tool-call observations,
    and content may be omitted when there is no output.
    """

    source_call_id: str
    content: Union[str, List[ATIFContentPart]]
    subagent_trajectory_ref: List[Dict[str, Any]]


class ATIFObservation(TypedDict):
    """Observation block containing results from tool calls within a step."""

    results: List[ATIFObservationResult]


class ATIFStepMetrics(TypedDict, total=False):
    """Per-step LLM metrics. All fields are optional."""

    prompt_tokens: int
    completion_tokens: int
    cached_tokens: int
    cost_usd: float
    logprobs: List[float]
    completion_token_ids: List[int]
    prompt_token_ids: List[int]
    extra: Dict[str, Any]


class ATIFStep(TypedDict, total=False):
    """A single step in an ATIF trajectory.

    Required fields: step_id, source.
    Conditional: message is required for user/system steps.
    Optional: timestamp (may be omitted).
    Agent-only: model_name, reasoning_content, reasoning_effort.
    Any-source: tool_calls, observation, metrics (observation allowed
    on system steps since v1.2).
    """

    step_id: int  # required
    timestamp: str  # optional, ISO 8601
    source: str  # required: "user" | "agent" | "system"
    message: Union[str, List[ATIFContentPart]]
    model_name: str
    reasoning_content: str
    reasoning_effort: Union[str, float]
    tool_calls: List[ATIFToolCall]
    observation: ATIFObservation
    metrics: ATIFStepMetrics
    is_copied_context: bool
    extra: Dict[str, Any]


class ATIFAgent(TypedDict, total=False):
    """Agent metadata block.

    Required: name, version.
    Optional: model_name, tool_definitions, extra.
    """

    name: str  # required
    version: str  # required
    model_name: Optional[str]  # optional
    tool_definitions: List[Dict[str, Any]]
    extra: Dict[str, Any]


class ATIFFinalMetrics(TypedDict, total=False):
    """Trajectory-level aggregate metrics. All fields optional."""

    total_prompt_tokens: int
    total_completion_tokens: int
    total_cached_tokens: int
    total_cost_usd: float
    total_steps: int
    extra: Dict[str, Any]


class ATIFTrajectory(TypedDict, total=False):
    """Root ATIF trajectory object.

    Required: schema_version, session_id, agent, steps.
    """

    schema_version: str  # required, e.g. "ATIF-v1.4"
    session_id: str  # required
    agent: ATIFAgent  # required
    steps: List[ATIFStep]  # required, at least one step
    final_metrics: ATIFFinalMetrics
    notes: str
    continued_trajectory_ref: str
    extra: Dict[str, Any]
