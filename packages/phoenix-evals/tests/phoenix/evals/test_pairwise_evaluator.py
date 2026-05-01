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

    async def async_generate_classification(
        self, prompt, labels, include_explanation: bool, **kwargs
    ):
        return self.generate_classification(prompt, labels, include_explanation, **kwargs)


def test_pairwise_fixed_maps_position_choice_to_group_label() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["B"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="fixed",
    )

    score = evaluator.evaluate({"output": "short", "reference": "better", "input": "question"})[0]

    assert score.label == "reference"
    assert score.score == 0.0
    assert score.metadata["groups"] == ["output", "reference"]
    assert score.metadata["ordering"] == "fixed"
    assert score.metadata["passes"][0]["position_mapping"] == {
        "A": "output",
        "B": "reference",
    }
    assert score.metadata["passes"][0]["choice"] == "B"
    assert score.metadata.get("tie_reason") is None


def test_pairwise_random_is_deterministic_per_row() -> None:
    eval_input = {"output": "first", "reference": "second", "input": "question"}
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

    assert (
        score_1.metadata["passes"][0]["position_mapping"]
        == score_2.metadata["passes"][0]["position_mapping"]
    )
    assert score_1.label == score_2.label


def test_pairwise_both_requires_semantic_agreement() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A", "B"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="both",
    )

    score = evaluator.evaluate({"output": "better", "reference": "worse", "input": "question"})[0]

    assert score.label == "output"
    assert score.score == 1.0
    assert score.metadata["passes"][0]["choice"] == "A"
    assert score.metadata["passes"][1]["choice"] == "B"
    assert (
        score.explanation
        == "Pass 1 (A=output, B=reference): picked A\nPass 2 (A=reference, B=output): picked B"
    )


def test_pairwise_both_disagreement_returns_structural_tie() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A", "A"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="both",
        allow_ties=False,
    )

    score = evaluator.evaluate({"output": "first", "reference": "second", "input": "question"})[0]

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
    assert score.metadata["groups"] == ["claude", "gpt"]
    assert score.metadata["passes"][0]["position_mapping"] == {"A": "claude", "B": "gpt"}


def test_pairwise_invalid_prompt_template_rejected() -> None:
    with pytest.raises(InvalidPromptTemplateError):
        PairwiseEvaluator(
            name="pairwise",
            llm=PairwiseMockLLM(["A"]),
            prompt_template="Compare {{item_1}} and {{item_2}}.",
        )


def test_pairwise_invalid_judge_output_raises() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["invalid"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="fixed",
    )

    with pytest.raises(ValueError, match="invalid judge choice"):
        evaluator.evaluate({"output": "first", "reference": "second", "input": "question"})


def test_win_rate_counts_ties() -> None:
    scores = [
        Score(label="output", metadata={"groups": ["output", "reference"], "passes": []}),
        Score(label="reference", metadata={"groups": ["output", "reference"], "passes": []}),
        Score(label="tie", metadata={"groups": ["output", "reference"], "passes": []}),
    ]

    summary = win_rate(scores)

    assert summary.group == "output"
    assert summary.win_rate == pytest.approx(0.5)
    assert summary.wins == 1
    assert summary.losses == 1
    assert summary.ties == 1
    assert summary.n == 3


def test_pairwise_evaluator_dataframe_smoke() -> None:
    evaluator = PairwiseEvaluator(
        name="pairwise",
        llm=PairwiseMockLLM(["A", "B"]),
        prompt_template=PROMPT_TEMPLATE,
        ordering="fixed",
    )
    dataframe = pd.DataFrame(
        [
            {"output": "good", "reference": "bad", "input": "question 1"},
            {"output": "bad", "reference": "good", "input": "question 2"},
        ]
    )

    result = evaluate_dataframe(dataframe=dataframe, evaluators=[evaluator])

    assert result["pairwise_score"].iloc[0]["label"] == "output"
    assert result["pairwise_score"].iloc[1]["label"] == "reference"


def test_pairwise_quality_evaluator_instantiates() -> None:
    evaluator = PairwiseQualityEvaluator(llm=PairwiseMockLLM(["tie"]), ordering="fixed")

    score = evaluator.evaluate({"output": "one", "reference": "two", "input": "question"})[0]

    assert score.name == "pairwise_quality"
    assert score.label == "tie"
