from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class HallucinationEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting hallucinations in an assistant's latest response,
    judged against the conversation it was produced in.

    Unlike :class:`FaithfulnessEvaluator`, which grounds a response against a
    specific provided context (e.g. retrieved documents in a RAG pipeline), this
    evaluator grounds the response against the conversation itself — earlier user
    and assistant turns, tool calls, and tool results. Use it when the source of
    truth is the conversation rather than a separately supplied context.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - ``input`` is the full conversation history the assistant had access to
          (its last message is the user turn being answered), and ``output`` is
          the assistant's latest response. The conversation is the source of
          truth.
        - Returns one `Score` with `label` (grounded or hallucinated), `score`
          (1.0 if hallucinated, 0.0 if grounded), and an `explanation` from the
          LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.hallucination import HallucinationEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        hallucination_eval = HallucinationEvaluator(llm=llm)

        # With custom invocation parameters
        hallucination_eval = HallucinationEvaluator(llm=llm, temperature=0.0)

        eval_input = {
            "input": (
                "User: What's our refund window?\\n"
                "Tool (lookup_policy): Refunds: 30 days from delivery.\\n"
                "Assistant: 30 days from delivery.\\n"
                "User: And for electronics?"
            ),
            "output": "Electronics can be returned within 90 days.",
            }
        scores = hallucination_eval.evaluate(eval_input)
        print(scores)
        [Score(name='hallucination', score=1.0, label='hallucinated',
            explanation='The conversation does not support a 90-day window for electronics.',
            metadata={'model': 'gpt-4o-mini'}, kind="llm", direction="minimize")]

    """

    NAME = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class HallucinationInputSchema(BaseModel):
        input: str = Field(
            description="The full conversation history the assistant had access to "
            "(prior turns, tool calls, and tool results); its last message is the "
            "user turn being answered."
        )
        output: str = Field(description="The assistant's latest response to classify.")

    def __init__(
        self,
        llm: LLM,
        **kwargs: Any,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.HallucinationInputSchema,
            **kwargs,
        )
