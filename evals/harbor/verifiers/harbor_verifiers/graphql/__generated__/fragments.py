from datetime import datetime
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import Field

from .base_model import BaseModel
from .enums import EvaluatorKind, Language, OptimizationDirection


class DatasetEvaluatorFields(BaseModel):
    id: str
    name: str
    input_mapping: "DatasetEvaluatorFieldsInputMapping" = Field(alias="inputMapping")
    output_configs: list[
        Annotated[
            Union[
                "DatasetEvaluatorFieldsOutputConfigsCategoricalAnnotationConfig",
                "DatasetEvaluatorFieldsOutputConfigsContinuousAnnotationConfig",
                "DatasetEvaluatorFieldsOutputConfigsFreeformAnnotationConfig",
            ],
            Field(discriminator="typename__"),
        ]
    ] = Field(alias="outputConfigs")
    evaluator: Union[
        "DatasetEvaluatorFieldsEvaluatorEvaluator",
        "DatasetEvaluatorFieldsEvaluatorCodeEvaluator",
    ] = Field(discriminator="typename__")


class DatasetEvaluatorFieldsInputMapping(BaseModel):
    path_mapping: Any = Field(alias="pathMapping")
    literal_mapping: Any = Field(alias="literalMapping")


class DatasetEvaluatorFieldsOutputConfigsCategoricalAnnotationConfig(BaseModel):
    typename__: Literal["CategoricalAnnotationConfig"] = Field(alias="__typename")
    name: str
    description: Optional[str]
    optimization_direction: OptimizationDirection = Field(alias="optimizationDirection")
    values: list["DatasetEvaluatorFieldsOutputConfigsCategoricalAnnotationConfigValues"]


class DatasetEvaluatorFieldsOutputConfigsCategoricalAnnotationConfigValues(BaseModel):
    label: str
    score: Optional[float]


class DatasetEvaluatorFieldsOutputConfigsContinuousAnnotationConfig(BaseModel):
    typename__: Literal["ContinuousAnnotationConfig"] = Field(alias="__typename")
    name: str
    description: Optional[str]
    optimization_direction: OptimizationDirection = Field(alias="optimizationDirection")
    lower_bound: Optional[float] = Field(alias="lowerBound")
    upper_bound: Optional[float] = Field(alias="upperBound")


class DatasetEvaluatorFieldsOutputConfigsFreeformAnnotationConfig(BaseModel):
    typename__: Literal["FreeformAnnotationConfig"] = Field(alias="__typename")
    name: str
    description: Optional[str]


class DatasetEvaluatorFieldsEvaluatorEvaluator(BaseModel):
    typename__: Literal["BuiltInEvaluator", "Evaluator", "LLMEvaluator"] = Field(
        alias="__typename"
    )
    id: str
    name: str
    kind: EvaluatorKind


class DatasetEvaluatorFieldsEvaluatorCodeEvaluator(BaseModel):
    typename__: Literal["CodeEvaluator"] = Field(alias="__typename")
    id: str
    name: str
    kind: EvaluatorKind
    language: Language
    source_code: str = Field(alias="sourceCode")
    sandbox_config: Optional[
        "DatasetEvaluatorFieldsEvaluatorCodeEvaluatorSandboxConfig"
    ] = Field(alias="sandboxConfig")
    output_configs: list[
        Annotated[
            Union[
                "DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsCategoricalAnnotationConfig",
                "DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsContinuousAnnotationConfig",
                "DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsFreeformAnnotationConfig",
            ],
            Field(discriminator="typename__"),
        ]
    ] = Field(alias="outputConfigs")


class DatasetEvaluatorFieldsEvaluatorCodeEvaluatorSandboxConfig(BaseModel):
    id: str


class DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsCategoricalAnnotationConfig(
    BaseModel
):
    typename__: Literal["CategoricalAnnotationConfig"] = Field(alias="__typename")
    name: str
    description: Optional[str]
    optimization_direction: OptimizationDirection = Field(alias="optimizationDirection")
    values: list[
        "DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsCategoricalAnnotationConfigValues"
    ]


class DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsCategoricalAnnotationConfigValues(
    BaseModel
):
    label: str
    score: Optional[float]


class DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsContinuousAnnotationConfig(
    BaseModel
):
    typename__: Literal["ContinuousAnnotationConfig"] = Field(alias="__typename")
    name: str
    description: Optional[str]
    optimization_direction: OptimizationDirection = Field(alias="optimizationDirection")
    lower_bound: Optional[float] = Field(alias="lowerBound")
    upper_bound: Optional[float] = Field(alias="upperBound")


class DatasetEvaluatorFieldsEvaluatorCodeEvaluatorOutputConfigsFreeformAnnotationConfig(
    BaseModel
):
    typename__: Literal["FreeformAnnotationConfig"] = Field(alias="__typename")
    name: str
    description: Optional[str]


class ExperimentRunFields(BaseModel):
    id: str
    repetition_number: int = Field(alias="repetitionNumber")
    error: Optional[str]
    example: "ExperimentRunFieldsExample"
    annotations: "ExperimentRunFieldsAnnotations"


class ExperimentRunFieldsExample(BaseModel):
    id: str


class ExperimentRunFieldsAnnotations(BaseModel):
    edges: list["ExperimentRunFieldsAnnotationsEdges"]


class ExperimentRunFieldsAnnotationsEdges(BaseModel):
    node: "ExperimentRunFieldsAnnotationsEdgesNode"


class ExperimentRunFieldsAnnotationsEdgesNode(BaseModel):
    name: str
    score: Optional[float]
    label: Optional[str]
    start_time: datetime = Field(alias="startTime")


class ExperimentFields(BaseModel):
    id: str
    name: str
    description: Optional[str]
    metadata: Any
    created_at: datetime = Field(alias="createdAt")
    average_run_latency_ms: Optional[float] = Field(alias="averageRunLatencyMs")
    cost_summary: "ExperimentFieldsCostSummary" = Field(alias="costSummary")
    runs: "ExperimentFieldsRuns"


class ExperimentFieldsCostSummary(BaseModel):
    total: "ExperimentFieldsCostSummaryTotal"


class ExperimentFieldsCostSummaryTotal(BaseModel):
    cost: Optional[float]


class ExperimentFieldsRuns(BaseModel):
    edges: list["ExperimentFieldsRunsEdges"]


class ExperimentFieldsRunsEdges(BaseModel):
    node: "ExperimentFieldsRunsEdgesNode"


class ExperimentFieldsRunsEdgesNode(ExperimentRunFields):
    pass


DatasetEvaluatorFields.model_rebuild()
ExperimentRunFields.model_rebuild()
ExperimentFields.model_rebuild()
