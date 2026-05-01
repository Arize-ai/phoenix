from typing import Any, Optional, Tuple

from pydantic import BaseModel, Field

from ..__generated__.pairwise_evaluator_configs import PAIRWISE_QUALITY_EVALUATOR_CONFIG
from ..evaluators import DirectionType, PairwiseEvaluator, PairwiseOrdering
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class PairwiseQualityEvaluator(PairwiseEvaluator):
    """Compare two responses and choose the one with better overall quality."""

    NAME = PAIRWISE_QUALITY_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in PAIRWISE_QUALITY_EVALUATOR_CONFIG.messages],
    )
    DIRECTION: DirectionType = PAIRWISE_QUALITY_EVALUATOR_CONFIG.optimization_direction

    class PairwiseQualityInputSchema(BaseModel):
        input: str = Field(description="The input query, question, or task.")
        output: Any = Field(description="The first response to compare.")
        reference: Any = Field(description="The second response to compare.")

    def __init__(
        self,
        llm: LLM,
        *,
        groups: Tuple[str, str] = ("output", "reference"),
        ordering: PairwiseOrdering = "random",
        allow_ties: bool = True,
        include_explanation: bool = True,
        seed: Optional[int] = 0,
        **kwargs: Any,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            groups=groups,
            ordering=ordering,
            allow_ties=allow_ties,
            include_explanation=include_explanation,
            seed=seed,
            direction=self.DIRECTION,
            **kwargs,
        )
