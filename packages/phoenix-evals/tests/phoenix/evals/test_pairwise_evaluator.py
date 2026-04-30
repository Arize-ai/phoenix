from typing import Any, List

import pandas as pd
import pytest

from phoenix.evals import PairwiseEvaluator, evaluate_dataframe
from phoenix.evals.aggregation import win_rate
from phoenix.evals.evaluators import Score
from phoenix.evals.exceptions import InvalidPromptTemplateError
from phoenix.evals.llm import LLM
from phoenix.evals.metrics import PairwiseQualityEvaluator

PROMPT_TEMPLATE = """
Question: {{input}}

Response A:
{{item_1}}

Response B:
{{item_2}}
"""


class PairwiseMockLLM(LLM):
    def __init__(self, choices: List[str], model: str = "test-model"):
        self.provider = "openai"
        self.model = model
        self.choices = choices
        self.prompts: List[Any] = []

    def generate_classification(self, prompt, labels, include_explanation: bool, **kwargs):
        self.prompts.append(prompt)
        choice = self.choices[min(len(self.prompts) - 1, len(self.choices) - 1)]
        return {"label": choice, "explanation": f"picked {choice}"}

    async def async_generate_classification(self, prompt, labels, include_explanation: bool, **kwargs):
        return self.generate_classification(prompt, labels, include_explanation, **kwargs)


def test_pairwise_fixed_maps_position_choice_to_group_label() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["B"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="fixed",
    )

    score = evaluator.evaluate({"a": "short", "b": "better", "input": "question"})[0]

    assert score.label == "b"
    assert score.score == 0.0
    assert score.metadata["presented_first"] == "a"
    assert score.metadata["judge_choice_pass_1"] == "B"
    assert score.metadata["tie_reason"] is None


def test_pairwise_random_is_deterministic_per_row() -> None:
    eval_input = {"a": "first", "b": "second", "input": "question"}
    evaluator_1 = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="random",
        seed=7,
    )
    evaluator_2 = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="random",
        seed=7,
    )

    score_1 = evaluator_1.evaluate(eval_input)[0]
    score_2 = evaluator_2.evaluate(eval_input)[0]

    assert score_1.metadata["presented_first"] == score_2.metadata["presented_first"]
    assert score_1.label == score_2.label


def test_pairwise_both_requires_semantic_agreement() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A", "B"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="both",
    )

    score = evaluator.evaluate({"a": "better", "b": "worse", "input": "question"})[0]

    assert score.label == "a"
    assert score.score == 1.0
    assert score.metadata["judge_choice_pass_1"] == "A"
    assert score.metadata["judge_choice_pass_2"] == "B"
    assert "[Consensus: agreed -> winner=a]" in (score.explanation or "")


def test_pairwise_both_disagreement_returns_structural_tie() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A", "A"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="both",
        allow_ties=False,
    )

    score = evaluator.evaluate({"a": "first", "b": "second", "input": "question"})[0]

    assert score.label == "tie"
    assert score.score == 0.5
    assert score.metadata["tie_reason"] == "disagreement"


def test_pairwise_custom_groups() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A"]),
        prompt_template=PROMPT_TEMPLATE,
        groups=("claude", "gpt"),
        ordering="fixed",
    )

    score = evaluator.evaluate({"claude": "better", "gpt": "worse", "input": "question"})[0]

    assert score.label == "claude"
    assert score.metadata["claude"] == "better"
    assert score.metadata["gpt"] == "worse"


def test_pairwise_invalid_prompt_template_rejected() -> None:
    with pytest.raises(InvalidPromptTemplateError):
        PairwiseEvaluator(
            name="pairwise",
            llm=PairwiseMockLLM(["A"]),
            prompt_template="Compare {{a}} and {{item_1}}",
        )


def test_pairwise_invalid_judge_output_returns_error_score() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["invalid"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="fixed",
    )

    score = evaluator.evaluate({"a": "first", "b": "second", "input": "question"})[0]

    assert score.label is None
    assert score.score is None
    assert score.metadata["error"] == "invalid judge choice: invalid"


def test_win_rate_counts_ties() -> None:
    scores = [
        Score(label="a", metadata={"a": "one", "b": "two"}),
        Score(label="b", metadata={"a": "one", "b": "two"}),
        Score(label="tie", metadata={"a": "one", "b": "two"}),
    ]

    assert win_rate(scores, group="a") == pytest.approx(0.5)


def test_pairwise_evaluator_dataframe_smoke() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A", "B"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="fixed",
    )
    dataframe = pd.DataFrame(
        [
            {"a": "good", "b": "bad", "input": "question 1"},
            {"a": "bad", "b": "good", "input": "question 2"},
        ]
    )

    result = evaluate_dataframe(dataframe=dataframe, evaluators=[evaluator])

    assert result["pairwise_score"].iloc[0]["label"] == "a"
    assert result["pairwise_score"].iloc[1]["label"] == "b"


def test_pairwise_quality_evaluator_instantiates() -> None:
    evaluator = PairwiseQualityEvaluator(llm=PairwiseMockLLM(["tie"]), ordering="fixed")

    score = evaluator.evaluate({"a": "one", "b": "two", "input": "question"})[0]

    assert score.name == "pairwise_quality"
    assert score.label == "tie"
