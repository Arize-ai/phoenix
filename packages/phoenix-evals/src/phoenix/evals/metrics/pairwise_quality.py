from typing import Any, Optional, Tuple

from ..__generated__.pairwise_evaluator_configs import PAIRWISE_QUALITY_EVALUATOR_CONFIG
from ..evaluators import DirectionType, PairwiseEvaluator, PairwiseOrdering
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class PairwiseQualityEvaluator(PairwiseEvaluator):
    """Compare two responses and choose the one with better overall quality.

    With default groups ``("output", "reference")``, ``evaluate`` expects an
    input dict with three keys: ``input`` (the query/task), ``output`` (the
    first response to compare), and ``reference`` (the second response to
    compare). Customizing ``groups`` re-shapes the contract: e.g.
    ``groups=("claude", "gpt")`` requires keys ``input``, ``claude``, and
    ``gpt``. The required schema is built dynamically from the prompt template
    variables and the ``groups`` tuple, so it always matches the constructor
    arguments.
    """

    NAME = PAIRWISE_QUALITY_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in PAIRWISE_QUALITY_EVALUATOR_CONFIG.messages],
    )
    DIRECTION: DirectionType = PAIRWISE_QUALITY_EVALUATOR_CONFIG.optimization_direction

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
