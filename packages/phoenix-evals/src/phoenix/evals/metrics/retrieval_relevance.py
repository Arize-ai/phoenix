from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class RetrievalRelevanceEvaluator(ClassificationEvaluator):
    """
    An evaluator for whether the external information retrieved during a step is
    relevant to the request it was serving.

    This evaluator is source-agnostic: the retrieved
    information may come from a vector search, a tool or function call, an MCP
    server, a web search, or a database query. It scores the retrieved
    information as a whole (holistically, per retrieval step) against the
    request.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Evaluates whether the retrieved information contains content that
          materially helps address the request. If any meaningful part of the
          retrieved information is relevant, the step is labeled ``relevant``.
        - This is a retrieval-quality check. It judges the retrieved information
          against the request, not against any final answer.
        - ``input`` should generally be the user's request (e.g. the trace
          root's ``input.value``) rather than a reformulated tool argument or a
          generated SQL query.
        - ``context`` should be the retrieved information for the
          step, with all returned items joined together.
        - Returns one `Score` with `label` (relevant or irrelevant), `score`
          (1.0 if relevant, 0.0 if irrelevant), and, when an `LLM` judge is used,
          an `explanation` (decision models return a label and probabilities, not an
          explanation).
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.retrieval_relevance import RetrievalRelevanceEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        relevance_eval = RetrievalRelevanceEvaluator(llm=llm)

        # With custom invocation parameters
        relevance_eval = RetrievalRelevanceEvaluator(llm=llm, timeout=30)

        eval_input = {
            "input": "What is the capital of France?",
            "context": "Paris is the capital and largest city of France.",
        }
        scores = relevance_eval.evaluate(eval_input)
        print(scores)
    """

    NAME = RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class RetrievalRelevanceInputSchema(BaseModel):
        input: str = Field(description="The request the retrieval was serving.")
        context: str = Field(
            description="The external information retrieved during the step, all items joined."
        )

    def __init__(
        self,
        llm: Union[LLM, DecisionModel],
        **kwargs: Any,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.RetrievalRelevanceInputSchema,
            **kwargs,
        )
