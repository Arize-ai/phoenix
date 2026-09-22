from __future__ import annotations

from typing import Annotated, Literal, TypeAlias

from pydantic import ConfigDict, Field, StringConstraints, model_validator
from pydantic.alias_generators import to_camel

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


class PlaygroundPromptTaskUIContext(BaseUIContext):
    kind: Literal["prompt"] = "prompt"


class PlaygroundEvaluatorTaskUIContext(BaseUIContext):
    """An evaluator draft judged over the dataset; its judge prompt is the instance's prompt."""

    kind: Literal["evaluator"] = "evaluator"
    # ``kind`` is the task discriminator above, so the evaluator's own kind needs another
    # name here; PlaygroundEvaluatorUIContext, which is not a task, can call it ``kind``.
    # Built-in evaluators are never offered as tasks.
    evaluator_kind: Literal["LLM", "CODE"]
    name: str
    is_dirty: bool = False


PlaygroundInstanceTaskUIContext = Annotated[
    PlaygroundPromptTaskUIContext | PlaygroundEvaluatorTaskUIContext,
    Field(discriminator="kind"),
]


class PlaygroundInstanceUIContext(BaseUIContext):
    instance_id: int
    model: PlaygroundModelUIContext | None = None
    experiment_id: ExperimentNodeId | None = None
    # Absent for older clients, which only ever mounted prompt instances.
    task: PlaygroundInstanceTaskUIContext | None = None


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
    # Persisted agent sessions carry the contexts of the turn that wrote them. Earlier
    # builds of the evaluator playground wrote `mode`, `evaluatorSlots` and `sampleSize`
    # here; those fields are gone, and a session that recorded them must still load.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    type: Literal["playground"]
    # Every instance on the page holds the same kind of task.
    task_kind: Literal["prompt", "evaluator"] = "prompt"
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
