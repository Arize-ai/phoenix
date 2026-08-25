from __future__ import annotations

from typing import Annotated, Literal, TypeAlias

from pydantic import Field, StringConstraints, model_validator

from phoenix.server.api.types.node import (
    CodeEvaluatorNodeId,
    DatasetEvaluatorNodeId,
    DatasetNodeId,
    DatasetVersionNodeId,
    ExperimentNodeId,
    LLMEvaluatorNodeId,
    ProjectNodeId,
    ProjectSessionNodeId,
    PromptNodeId,
    PromptVersionNodeId,
    SpanNodeId,
)

from ._models import CamelBaseModel

EditPermission: TypeAlias = Literal["manual", "bypass"]

OtelTraceId: TypeAlias = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{32}$")]
OtelSpanId: TypeAlias = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{16}$")]


class BaseUIContext(CamelBaseModel):
    pass


class ProjectUIContext(BaseUIContext):
    type: Literal["project"]
    project_node_id: ProjectNodeId
    span_filter: str | None = None


class TraceUIContext(BaseUIContext):
    type: Literal["trace"]
    project_node_id: ProjectNodeId
    otel_trace_id: OtelTraceId


class SessionUIContext(BaseUIContext):
    type: Literal["session"]
    project_node_id: ProjectNodeId
    session_node_id: ProjectSessionNodeId


class PromptUIContext(BaseUIContext):
    type: Literal["prompt"]
    prompt_node_id: PromptNodeId


class PromptVersionUIContext(BaseUIContext):
    type: Literal["prompt_version"]
    prompt_node_id: PromptNodeId
    prompt_version_node_id: PromptVersionNodeId


class SpanUIContext(BaseUIContext):
    type: Literal["span"]
    project_node_id: ProjectNodeId | None = None
    span_node_id: SpanNodeId | None = None
    otel_span_id: OtelSpanId | None = None

    @model_validator(mode="after")
    def _exactly_one_span_id(self) -> "SpanUIContext":
        has_node = self.span_node_id is not None
        has_otel = self.otel_span_id is not None
        if has_node == has_otel:
            raise ValueError("SpanUIContext requires exactly one of spanNodeId or otelSpanId")
        return self


class PlaygroundBuiltinModelUIContext(BaseUIContext):
    type: Literal["builtin"] = "builtin"
    provider: str
    model_name: str


class PlaygroundCustomProviderModelUIContext(BaseUIContext):
    type: Literal["custom"] = "custom"
    custom_provider_id: str
    custom_provider_name: str
    provider: str
    model_name: str


PlaygroundModelUIContext = Annotated[
    PlaygroundBuiltinModelUIContext | PlaygroundCustomProviderModelUIContext,
    Field(discriminator="type"),
]


class PlaygroundInstanceUIContext(BaseUIContext):
    instance_id: int
    model: PlaygroundModelUIContext | None = None
    experiment_id: ExperimentNodeId | None = None


class PlaygroundEvaluatorUIContext(BaseUIContext):
    dataset_evaluator_id: DatasetEvaluatorNodeId
    name: str
    kind: Literal["LLM", "CODE", "BUILTIN"]
    is_builtin: bool
    is_applied: bool


class PlaygroundExperimentScaffoldUIContext(BaseUIContext):
    name: str | None = None
    description: str | None = None
    has_metadata: bool = False


class PlaygroundUIContext(BaseUIContext):
    type: Literal["playground"]
    record_experiments: bool = True
    repetitions: int = 1
    next_experiment_scaffold: PlaygroundExperimentScaffoldUIContext | None = None
    instances: list[PlaygroundInstanceUIContext] = Field(default_factory=list)
    evaluators: list[PlaygroundEvaluatorUIContext] = Field(default_factory=list)


class CodeEvaluatorUIContext(BaseUIContext):
    type: Literal["code_evaluator"]
    evaluator_node_id: CodeEvaluatorNodeId | None = None


class LlmEvaluatorUIContext(BaseUIContext):
    type: Literal["llm_evaluator"]
    evaluator_node_id: LLMEvaluatorNodeId | None = None


class DatasetUIContext(BaseUIContext):
    type: Literal["dataset"]
    dataset_node_id: DatasetNodeId
    dataset_version_node_id: DatasetVersionNodeId | None = None


class UIContexts(CamelBaseModel):
    project: ProjectUIContext | None = None
    trace: TraceUIContext | None = None
    session: SessionUIContext | None = None
    span: SpanUIContext | None = None
    prompt: PromptUIContext | None = None
    prompt_version: PromptVersionUIContext | None = None
    dataset: DatasetUIContext | None = None
    playground: PlaygroundUIContext | None = None
    code_evaluator: CodeEvaluatorUIContext | None = None
    llm_evaluator: LlmEvaluatorUIContext | None = None
