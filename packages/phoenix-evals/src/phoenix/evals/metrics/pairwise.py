from typing import Any, Dict, List, cast

from pydantic import BaseModel, Field

from ..evaluators import EvalInput, LLMEvaluator, Score
from ..llm import LLM
from ..templating import Template

_DEFAULT_RESPONSE_COMPARISON_TEMPLATE = """\
You are evaluating the quality of responses provided by two AI assistants
to the same input question.
Your goal is to determine which response answers the question better.

Please compare the two responses carefully.
Consider the following criteria when making your judgment:
- Helpfulness and relevance to the input question
- Factual accuracy and logical consistency
- Depth and completeness of the explanation
- Creativity and clarity of presentation

Be impartial and do not let the order, name, or length of the responses
affect your judgment.
After analyzing both responses, briefly explain your reasoning,
then provide your final verdict strictly in the following format:
"output" if the first response is better,
"second_output" if the second response is better, or
"tie" if both responses are equally good.

[BEGIN DATA]
************
[Input Question]: {input}
************
[First Response]: {output}
************
[Second Response]: {second_output}
************
[END DATA]

Which response provides a better answer to the question based on the evaluation criteria?
"""


class PairwiseEvaluator(LLMEvaluator):
    """
    A specialized evaluator for pairwise comparison of two AI responses to the same question.

    This evaluator uses an LLM to judge which of two responses ('output' and 'second_output')
    better answers a given input question. It supports a consensus mode to mitigate positional
    bias by running a second evaluation with the response order swapped and resolving any
    discrepancies.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        include_explanation (bool, optional): Whether to include the LLM's reasoning in the
            evaluation results. Defaults to True.
        consensus (bool, optional): Whether to use consensus mode for more robust evaluation.
            When True, performs two evaluations (original and flipped order) and resolves
            conflicts. Defaults to False.

    Notes:
        - Returns one `Score` with `label` ("output", "second_output", or "tie"), `score`
          (1.0 if first response wins, 0.0 if second response wins, 0.5 if tie), and an
          `explanation` from the LLM judge.
        - When consensus=True, the evaluator runs two evaluations and combines the results
          to produce a final score that is less susceptible to positional bias.
        - Evaluation criteria includes: helpfulness, relevance, factual accuracy, logical
          consistency, depth, completeness, creativity, and clarity.
        - The consensus mechanism helps identify when judgments are inconsistent due to
          presentation order, providing more reliable comparisons.

    Examples::

        from phoenix.evals.llm import LLM
        from phoenix.evals.metrics.pairwise_comparison import PairwiseEvaluator

        # Initialize the LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Create evaluator instances
        pairwise_eval = PairwiseEvaluator(llm=llm)
        consensus_pairwise_eval = PairwiseEvaluator(llm=llm, consensus=True)

        # Define input with question and two responses to compare
        eval_input = {
            "input": "What is the capital of France?",
            "output": (
                "Paris is the capital city of France, located in the "
                "north-central part of the country."
            ),
            "second_output": (
                "The capital of France is Paris, which is known for its "
                "cultural landmarks like the Eiffel Tower."
            ),
        }

        # Single evaluation (faster but potentially biased by response order)
        scores = pairwise_eval.evaluate(eval_input)
        print(scores)

        # Consensus evaluation (slower but more robust against positional bias)
        scores = consensus_pairwise_eval.evaluate(eval_input)
        print(scores)
    """

    NAME = "pairwise_evaluator"
    PROMPT = Template(template=_DEFAULT_RESPONSE_COMPARISON_TEMPLATE)

    class PairwiseEvaluatorInputSchema(BaseModel):
        input: str = Field(description="The input question")
        output: str = Field(description="First response to compare")
        second_output: str = Field(description="Second response to compare")

    def __init__(self, llm: LLM, include_explanation: bool = True, consensus: bool = False):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT,
            input_schema=self.PairwiseEvaluatorInputSchema,
        )
        self.include_explanation = include_explanation
        self.consensus = consensus
        self._labels = ["output", "second_output", "tie"]
        self._label_score_map = {"output": 1.0, "second_output": 0.0, "tie": 0.5}

    def _resolve_results(
        self, eval_result: Dict[str, Any], flipped_eval_result: Dict[str, Any]
    ) -> List[Score]:
        """
        Resolve consensus between original and flipped evaluation results.
        """
        eval_score = self._label_score_map.get(cast(str, eval_result.get("label")), 0.5)
        flipped_score = self._label_score_map.get(cast(str, flipped_eval_result.get("label")), 0.5)

        votes_first_response = eval_score + (1 - flipped_score)
        votes_second_response = (1 - eval_score) + flipped_score

        if abs((votes_first_response + votes_second_response) - 2.0) > 1e-6:
            raise ValueError("Invalid score results. Total votes should sum to 2.")

        base_metadata = {
            "model": self.llm.model,
            "consensus": self.consensus,
            "evaluation_result": {
                "label": eval_result.get("label"),
                "explanation": eval_result.get("explanation"),
            },
            "flipped_evaluation_result": {
                "label": flipped_eval_result.get("label"),
                "explanation": flipped_eval_result.get("explanation"),
            },
        }

        if votes_first_response > votes_second_response:
            return [
                Score(
                    score=1.0,
                    name=self.NAME,
                    label="output",
                    explanation=eval_result.get("explanation"),
                    metadata=base_metadata,
                    source=self.source,
                )
            ]
        elif votes_second_response > votes_first_response:
            return [
                Score(
                    score=0.0,
                    name=self.NAME,
                    label="second_output",
                    explanation=flipped_eval_result.get("explanation"),
                    metadata=base_metadata,
                    source=self.source,
                )
            ]
        else:
            # Tie scenario
            if eval_score == 0.5 and flipped_score == 0.5:
                explanation = (
                    "Actual tie: both options are equally preferred, and the "
                    "judgment is independent of presentation order."
                )
                label = "tie"
            else:
                explanation = (
                    "Ambiguous judgment: the preferred option changes when the "
                    "order is flipped, indicating potential position bias or "
                    "comparable quality."
                )
                label = None

            return [
                Score(
                    score=0.5,
                    name=self.NAME,
                    label=label,
                    explanation=explanation,
                    metadata=base_metadata,
                    source=self.source,
                )
            ]

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        """
        Evaluate two responses using pairwise comparison.

        This method sends the provided inputs to the LLM for judgment. If consensus
        mode is enabled, it performs a second evaluation with the response order
        swapped and then resolves the two results to produce a final, more
        robust score.
        """
        prompt_filled = self.prompt_template.render(variables=eval_input)
        response = self.llm.generate_classification(
            prompt=prompt_filled,
            labels=self._labels,
            include_explanation=self.include_explanation,
            **self.invocation_parameters,
        )

        label = response.get("label")
        explanation = response.get("explanation")

        if label and label not in self._labels:
            raise ValueError(
                f"PairwiseEvaluator received invalid label '{label}'. "
                f"Valid labels are: {self._labels}."
            )

        if not self.consensus:
            return [
                Score(
                    score=self._label_score_map.get(cast(str, label)),
                    name=self.NAME,
                    label=label,
                    explanation=explanation,
                    metadata={"model": self.llm.model, "consensus": self.consensus},
                    source=self.source,
                )
            ]

        flipped_prompt_filled = self.prompt_template.render(
            variables={
                "input": eval_input["input"],
                "output": eval_input["second_output"],
                "second_output": eval_input["output"],
            }
        )
        flipped_response = self.llm.generate_classification(
            prompt=flipped_prompt_filled,
            labels=self._labels,
            include_explanation=self.include_explanation,
            **self.invocation_parameters,
        )

        flipped_label = flipped_response.get("label")

        if flipped_label and flipped_label not in self._labels:
            raise ValueError(
                f"PairwiseEvaluator received invalid label '{flipped_label}'. "
                f"Valid labels are: {self._labels}."
            )

        if not flipped_label:
            return [
                Score(
                    score=None,
                    name=self.NAME,
                    label=None,
                    explanation="Incomplete consensus evaluation",
                    metadata={
                        "model": self.llm.model,
                        "consensus": self.consensus,
                        "evaluation_result": {
                            "label": label,
                            "explanation": explanation,
                        },
                        "flipped_evaluation_result": {
                            "label": None,
                            "explanation": None,
                        },
                    },
                    source=self.source,
                )
            ]

        return self._resolve_results(response, flipped_response)
