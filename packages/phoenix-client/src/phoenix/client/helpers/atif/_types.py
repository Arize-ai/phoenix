"""TypedDict definitions for the ATIF (Agent Trajectory Interchange Format) schema v1.0–v1.6."""

from __future__ import annotations

from typing import Any, Dict, List

from typing_extensions import TypedDict


class ATIFToolCall(TypedDict):
    """A single tool/function call made by the agent."""

    tool_call_id: str
    function_name: str
    arguments: Dict[str, Any]


class ATIFObservationResult(TypedDict):
    """A single observation result returned from a tool call."""

    source_call_id: str
    content: str


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
    latency_ms: float


class ATIFStep(TypedDict, total=False):
    """A single step in an ATIF trajectory.

    Required fields: step_id, timestamp, source.
    Conditional: message is required for user/system steps.
    Agent-only: model_name, reasoning_content, tool_calls, observation, metrics.
    """

    step_id: int  # required
    timestamp: str  # required, ISO 8601
    source: str  # required: "user" | "agent" | "system"
    message: str
    model_name: str
    reasoning_content: str
    tool_calls: List[ATIFToolCall]
    observation: ATIFObservation
    metrics: ATIFStepMetrics
    extra: Dict[str, Any]


class ATIFAgent(TypedDict, total=False):
    """Agent metadata block.

    Required: name, version, model_name.
    """

    name: str  # required
    version: str  # required
    model_name: str  # required
    extra: Dict[str, Any]


class ATIFFinalMetrics(TypedDict, total=False):
    """Trajectory-level aggregate metrics. All fields optional."""

    total_prompt_tokens: int
    total_completion_tokens: int
    total_cached_tokens: int
    total_cost_usd: float
    total_steps: int
    total_tool_calls: int
    total_latency_ms: float
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
    environment: Dict[str, Any]
    extra: Dict[str, Any]
