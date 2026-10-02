from typing import Literal, Union

from pydantic import Field

from .base_model import BaseModel
from .fragments import DatasetEvaluatorFields


class DatasetEvaluators(BaseModel):
    node: Union["DatasetEvaluatorsNodeNode", "DatasetEvaluatorsNodeDataset"] = Field(
        discriminator="typename__"
    )


class DatasetEvaluatorsNodeNode(BaseModel):
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


class DatasetEvaluatorsNodeDataset(BaseModel):
    typename__: Literal["Dataset"] = Field(alias="__typename")
    dataset_evaluators: "DatasetEvaluatorsNodeDatasetDatasetEvaluators" = Field(
        alias="datasetEvaluators"
    )


class DatasetEvaluatorsNodeDatasetDatasetEvaluators(BaseModel):
    edges: list["DatasetEvaluatorsNodeDatasetDatasetEvaluatorsEdges"]


class DatasetEvaluatorsNodeDatasetDatasetEvaluatorsEdges(BaseModel):
    node: "DatasetEvaluatorsNodeDatasetDatasetEvaluatorsEdgesNode"


DatasetEvaluatorsNodeDatasetDatasetEvaluatorsEdgesNode = DatasetEvaluatorFields
DatasetEvaluators.model_rebuild()
DatasetEvaluatorsNodeDataset.model_rebuild()
DatasetEvaluatorsNodeDatasetDatasetEvaluators.model_rebuild()
DatasetEvaluatorsNodeDatasetDatasetEvaluatorsEdges.model_rebuild()
