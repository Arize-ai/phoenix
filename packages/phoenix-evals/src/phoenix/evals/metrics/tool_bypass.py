from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    TOOL_BYPASS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ToolBypassEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator that detects "tool bypass" failures: assistant content asserting
    an entity-affecting outcome (a state change, a created record, an updated value) without
    a corresponding tool call in the same trace.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Determines whether an assistant's claim of an action ("logged your water,"
          "updated the record," "added the entry") is grounded in an actual tool call
          observed in the same trace.
        - This metric fills the action-claim, external-state cell of the agent failure
          taxonomy that existing Phoenix metrics do not cover. HallucinationEvaluator
          catches fabricated facts. ToolSelectionEvaluator catches wrong tool / wrong
          args. ToolBypassEvaluator catches the case where the assistant asserts a state
          change with no tool call at all.
        - Returns one ``Score`` with ``label`` (grounded or phantom), ``score`` (1.0 if
          grounded, 0.0 if phantom), and an ``explanation`` from the LLM judge.
        - Designed to compose with the regex pre-filter pattern: a cheap regex surfaces
          candidate suspect spans, the LLM judge confirms or rejects.

    Boundary cases the prompt handles explicitly:
        - Quoted corrections ("you said 16/16 but nothing got logged") are NOT phantoms.
        - Date/numeric collisions ("4/16" as a calendar date) are NOT phantoms.
        - Reads of prior state ("you're at 48g" recalling earlier tool output) are grounded
          if an earlier tool span set that state.

    Examples::

        from phoenix.evals.metrics.tool_bypass import ToolBypassEvaluator
        from phoenix.evals import LLM

        llm = LLM(provider="openai", model="gpt-4o-mini")
        tool_bypass_judge = ToolBypassEvaluator(llm=llm)

        single_input = {
            "input": "User: did u get my water from earlier",
            "assistant_response_text": "16/16 already from earlier backfill",
            "observed_tool_call_summary": "[no tool calls in trace]",
            "available_tools_list": (
                "log_water: log water consumption for a user.\\n"
                "fix_water: correct an existing water log entry."
            ),
        }
        score = tool_bypass_judge(eval_input=single_input)
        # score.label == "phantom"
        # score.score  == 0.0
    """

    NAME = TOOL_BYPASS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in TOOL_BYPASS_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ]
    )
    CHOICES = TOOL_BYPASS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = TOOL_BYPASS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    def __init__(self, llm: LLM, **kwargs: Any) -> None:
        super().__init__(
            llm=llm,
            name=self.NAME,
            prompt_template=self.PROMPT,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            **kwargs,
        )


class ToolBypassInputSchema(BaseModel):
    """Input schema for the ToolBypassEvaluator.

    The four fields map to the four substitution placeholders in the prompt template.
    Bind these to your trace data via the standard ``ClassificationEvaluator`` input
    binding mechanism.
    """

    input: str = Field(description="The user input that produced the assistant response.")
    assistant_response_text: str = Field(
        description="The assistant's output. The text being judged for tool bypass."
    )
    observed_tool_call_summary: str = Field(
        description=(
            "Compact summary of tool calls observed in the same trace. Empty string or "
            "'[no tool calls in trace]' if none."
        )
    )
    available_tools_list: str = Field(
        description="List of tools the agent could have called, with brief descriptions."
    )
