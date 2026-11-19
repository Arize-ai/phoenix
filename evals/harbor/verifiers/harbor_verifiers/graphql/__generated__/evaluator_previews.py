from typing import Optional

from pydantic import Field

from .base_model import BaseModel


class EvaluatorPreviews(BaseModel):
    evaluator_previews: "EvaluatorPreviewsEvaluatorPreviews" = Field(
        alias="evaluatorPreviews"
    )


class EvaluatorPreviewsEvaluatorPreviews(BaseModel):
    results: list["EvaluatorPreviewsEvaluatorPreviewsResults"]


class EvaluatorPreviewsEvaluatorPreviewsResults(BaseModel):
    error: Optional[str]
    annotation: Optional["EvaluatorPreviewsEvaluatorPreviewsResultsAnnotation"]


class EvaluatorPreviewsEvaluatorPreviewsResultsAnnotation(BaseModel):
    score: Optional[float]
    label: Optional[str]


EvaluatorPreviews.model_rebuild()
EvaluatorPreviewsEvaluatorPreviews.model_rebuild()
EvaluatorPreviewsEvaluatorPreviewsResults.model_rebuild()
