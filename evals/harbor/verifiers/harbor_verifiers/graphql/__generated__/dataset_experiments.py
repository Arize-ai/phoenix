from typing import Literal, Union

from pydantic import Field

from .base_model import BaseModel
from .fragments import ExperimentFields


class DatasetExperiments(BaseModel):
    node: Union["DatasetExperimentsNodeNode", "DatasetExperimentsNodeDataset"] = Field(
        discriminator="typename__"
    )


class DatasetExperimentsNodeNode(BaseModel):
    typename__: Literal[
        "AgentSession",
        "BuiltInEvaluator",
        "CategoricalAnnotationConfig",
        "CodeEvaluator",
        "CodeEvaluatorVersion",
        "ContinuousAnnotationConfig",
        "DatasetEvaluator",
        "DatasetExample",
        "DatasetLabel",
        "DatasetSplit",
        "DatasetVersion",
        "DocumentAnnotation",
        "Experiment",
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


class DatasetExperimentsNodeDataset(BaseModel):
    typename__: Literal["Dataset"] = Field(alias="__typename")
    experiments: "DatasetExperimentsNodeDatasetExperiments"


class DatasetExperimentsNodeDatasetExperiments(BaseModel):
    edges: list["DatasetExperimentsNodeDatasetExperimentsEdges"]


class DatasetExperimentsNodeDatasetExperimentsEdges(BaseModel):
    node: "DatasetExperimentsNodeDatasetExperimentsEdgesNode"


DatasetExperimentsNodeDatasetExperimentsEdgesNode = ExperimentFields
DatasetExperiments.model_rebuild()
DatasetExperimentsNodeDataset.model_rebuild()
DatasetExperimentsNodeDatasetExperiments.model_rebuild()
DatasetExperimentsNodeDatasetExperimentsEdges.model_rebuild()
