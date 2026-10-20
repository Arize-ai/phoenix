from typing import Optional

from pydantic import Field

from .base_model import BaseModel


class PreviewEvaluator(BaseModel):
    preview_evaluator: "PreviewEvaluatorPreviewEvaluator" = Field(
        alias="previewEvaluator"
    )


class PreviewEvaluatorPreviewEvaluator(BaseModel):
    results: list["PreviewEvaluatorPreviewEvaluatorResults"]


class PreviewEvaluatorPreviewEvaluatorResults(BaseModel):
    id: str
    error: Optional[str]
    results: list["PreviewEvaluatorPreviewEvaluatorResultsResults"]


class PreviewEvaluatorPreviewEvaluatorResultsResults(BaseModel):
    error: Optional[str]
    annotation: Optional["PreviewEvaluatorPreviewEvaluatorResultsResultsAnnotation"]


class PreviewEvaluatorPreviewEvaluatorResultsResultsAnnotation(BaseModel):
    score: Optional[float]
    label: Optional[str]


PreviewEvaluator.model_rebuild()
PreviewEvaluatorPreviewEvaluator.model_rebuild()
PreviewEvaluatorPreviewEvaluatorResults.model_rebuild()
PreviewEvaluatorPreviewEvaluatorResultsResults.model_rebuild()
