from typing import Any, Literal, Optional, Union

from pydantic import Field

from .base_model import BaseModel


class ExperimentRuns(BaseModel):
    node: Union["ExperimentRunsNodeNode", "ExperimentRunsNodeExperiment"] = Field(
        discriminator="typename__"
    )


class ExperimentRunsNodeNode(BaseModel):
    typename__: Literal[
        "AgentSession",
        "BuiltInEvaluator",
        "CategoricalAnnotationConfig",
        "CodeEvaluator",
        "CodeEvaluatorVersion",
        "ContinuousAnnotationConfig",
        "Dataset",
        "DatasetEvaluator",
        "DatasetExample",
        "DatasetLabel",
        "DatasetSplit",
        "DatasetVersion",
        "DocumentAnnotation",
        "ExperimentComparison",
        "ExperimentJob",
        "ExperimentLog",
        "ExperimentRepeatedRunGroup",
        "ExperimentRun",
        "ExperimentRunAnnotation",
        "ExperimentTag",
        "FreeformAnnotationConfig",
        "GenerativeModel",
        "GenerativeModelCustomProvider",
        "LLMEvaluator",
        "Node",
        "OAuth2Grant",
        "Project",
        "ProjectSession",
        "ProjectSessionAnnotation",
        "ProjectTraceRetentionPolicy",
        "Prompt",
        "PromptLabel",
        "PromptTaskConfig",
        "PromptVersion",
        "PromptVersionTag",
        "SandboxConfig",
        "SandboxProvider",
        "Secret",
        "Span",
        "SpanAnnotation",
        "SystemApiKey",
        "Trace",
        "TraceAnnotation",
        "User",
        "UserApiKey",
        "UserRole",
    ] = Field(alias="__typename")


class ExperimentRunsNodeExperiment(BaseModel):
    typename__: Literal["Experiment"] = Field(alias="__typename")
    runs: "ExperimentRunsNodeExperimentRuns"


class ExperimentRunsNodeExperimentRuns(BaseModel):
    page_info: "ExperimentRunsNodeExperimentRunsPageInfo" = Field(alias="pageInfo")
    edges: list["ExperimentRunsNodeExperimentRunsEdges"]


class ExperimentRunsNodeExperimentRunsPageInfo(BaseModel):
    has_next_page: bool = Field(alias="hasNextPage")
    end_cursor: Optional[str] = Field(alias="endCursor")


class ExperimentRunsNodeExperimentRunsEdges(BaseModel):
    node: "ExperimentRunsNodeExperimentRunsEdgesNode"


class ExperimentRunsNodeExperimentRunsEdgesNode(BaseModel):
    id: str
    trace_id: Optional[str] = Field(alias="traceId")
    error: Optional[str]
    output: Optional[Any]
    annotations: "ExperimentRunsNodeExperimentRunsEdgesNodeAnnotations"
    example: "ExperimentRunsNodeExperimentRunsEdgesNodeExample"


class ExperimentRunsNodeExperimentRunsEdgesNodeAnnotations(BaseModel):
    edges: list["ExperimentRunsNodeExperimentRunsEdgesNodeAnnotationsEdges"]


class ExperimentRunsNodeExperimentRunsEdgesNodeAnnotationsEdges(BaseModel):
    node: "ExperimentRunsNodeExperimentRunsEdgesNodeAnnotationsEdgesNode"


class ExperimentRunsNodeExperimentRunsEdgesNodeAnnotationsEdgesNode(BaseModel):
    name: str
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]


class ExperimentRunsNodeExperimentRunsEdgesNodeExample(BaseModel):
    id: str
    revision: "ExperimentRunsNodeExperimentRunsEdgesNodeExampleRevision"


class ExperimentRunsNodeExperimentRunsEdgesNodeExampleRevision(BaseModel):
    input: Any
    output: Any
    metadata: Any


ExperimentRuns.model_rebuild()
ExperimentRunsNodeExperiment.model_rebuild()
ExperimentRunsNodeExperimentRuns.model_rebuild()
ExperimentRunsNodeExperimentRunsEdges.model_rebuild()
ExperimentRunsNodeExperimentRunsEdgesNode.model_rebuild()
ExperimentRunsNodeExperimentRunsEdgesNodeAnnotations.model_rebuild()
ExperimentRunsNodeExperimentRunsEdgesNodeAnnotationsEdges.model_rebuild()
ExperimentRunsNodeExperimentRunsEdgesNodeExample.model_rebuild()
