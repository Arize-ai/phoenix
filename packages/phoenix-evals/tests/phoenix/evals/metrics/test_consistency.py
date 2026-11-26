# type: ignore
import asyncio
import itertools
import re
from collections import Counter

import pandas as pd
import pytest

from phoenix.evals import evaluate_dataframe
from phoenix.evals.metrics import (
    AnswerConsistencyEvaluator,
    RetrievalConsistencyEvaluator,
    chunk_id_jaccard,
    ngram_jaccard,
    sample_run_pairs,
)
from phoenix.evals.metrics.consistency import _parse_judge_rating, _render_prompt

# The two responses compared by a judge prompt.
_COMPARED = re.compile(
    r"<response_a>\n(.*?)\n</response_a>.*?<response_b>\n(.*?)\n</response_b>", re.S
)
GOOD_REPLY = {"label": "4", "explanation": "close"}


class FakeLLM:
    """Stands in for ``LLM`` and records every judge call.

    A reply depends only on the two outputs compared, never on call order, because async judge
    calls can finish in any order. ``replies`` maps ``frozenset({output_a, output_b})`` to the
    reply for that pair; other pairs get ``default``. Async calls finish in reverse order.
    """

    model = "fake-judge"

    def __init__(self, replies=None, default=GOOD_REPLY):
        self.replies = replies or {}
        self.default = default
        self.calls = []
        self._started = 0

    @property
    def prompts(self):
        return [call["prompt"] for call in self.calls]

    def generate_classification(self, prompt, labels, include_explanation=True, **kwargs):
        self.calls.append(
            {
                "prompt": prompt,
                "labels": labels,
                "include_explanation": include_explanation,
                "kwargs": kwargs,
            }
        )
        compared = frozenset(_COMPARED.search(prompt).groups())
        return self.replies.get(compared, self.default)

    async def async_generate_classification(
        self, prompt, labels, include_explanation=True, **kwargs
    ):
        self._started += 1
        await asyncio.sleep(0.01 / self._started)  # calls started later finish first
        return self.generate_classification(prompt, labels, include_explanation, **kwargs)


@pytest.fixture(params=["sync", "async"])
def run(request):
    """Run an evaluator with ``evaluate`` or ``async_evaluate``."""

    async def _run(evaluator, eval_input, **kwargs):
        if request.param == "sync":
            return evaluator.evaluate(eval_input, **kwargs)
        return await evaluator.async_evaluate(eval_input, **kwargs)

    return _run


# Judge replies with no usable 1-5 rating: each must fail, never be scored.
INVALID_REPLIES = [
    pytest.param({"label": "I cannot compare these; there are 2 responses."}, id="refusal"),
    pytest.param({"label": "N/A", "explanation": "3 facts match"}, id="n/a"),
    pytest.param({"label": "10"}, id="10"),
    pytest.param({"label": "0"}, id="0"),
    pytest.param({"label": "NaN"}, id="nan"),
    pytest.param({"label": ""}, id="empty"),
    pytest.param({"label": "4.5"}, id="decimal"),
    pytest.param({"label": 5}, id="non-string"),
    pytest.param({"label": None}, id="none-label"),
    pytest.param({"explanation": "they agree"}, id="missing-label"),
    pytest.param(None, id="none"),
    pytest.param("5", id="not-a-dict"),
]

# Text runs whose word n-gram overlap depends on n.
CAT_RUNS = [["The cat sat", "on the mat"], ["the cat sat on a mat"]]


class TestSampleRunPairs:
    @pytest.mark.parametrize("n_runs", [0, 1])
    def test_fewer_than_two_runs(self, n_runs):
        assert sample_run_pairs(n_runs) == []

    @pytest.mark.parametrize("n_runs", [3, 4, 5, 8, 11])
    @pytest.mark.parametrize("seed", [0, 1, 42])
    def test_default_budget_is_a_cycle_covering_every_run_twice(self, n_runs, seed):
        pairs = sample_run_pairs(n_runs, seed=seed)
        assert len(pairs) == len(set(pairs)) == n_runs
        assert all(i < j for i, j in pairs)
        degree = Counter(k for pair in pairs for k in pair)
        assert all(degree[k] == 2 for k in range(n_runs))

    @pytest.mark.parametrize("n_runs", [6, 7])
    def test_small_budget_covers_as_many_runs_as_possible(self, n_runs):
        budget = (n_runs + 1) // 2
        pairs = sample_run_pairs(n_runs, budget=budget)
        assert len(pairs) == budget
        assert {k for pair in pairs for k in pair} == set(range(n_runs))

    def test_large_budget_returns_all_pairs(self):
        assert sample_run_pairs(5, budget=100) == list(itertools.combinations(range(5), 2))

    def test_budget_above_cycle_tops_up_with_distinct_pairs(self):
        pairs = sample_run_pairs(6, budget=9)
        assert len(set(pairs)) == 9

    def test_deterministic_for_seed(self):
        assert sample_run_pairs(10, seed=7) == sample_run_pairs(10, seed=7)

    def test_seed_changes_pairs(self):
        assert sample_run_pairs(6, seed=0) != sample_run_pairs(6, seed=1)

    def test_invalid_budget(self):
        with pytest.raises(ValueError):
            sample_run_pairs(4, budget=0)


class TestChunkIdJaccard:
    def test_fewer_than_two_runs(self):
        assert chunk_id_jaccard([]) == 1.0
        assert chunk_id_jaccard([["a"]]) == 1.0

    def test_both_empty(self):
        assert chunk_id_jaccard([[], []]) == 1.0

    def test_one_empty(self):
        assert chunk_id_jaccard([["a"], []]) == 0.0

    def test_order_and_duplicates_ignored(self):
        assert chunk_id_jaccard([["a", "b"], ["b", "a", "a"]]) == 1.0

    def test_mean_over_all_pairs(self):
        # pairs: (0,1)=1/3, (0,2)=1, (1,2)=1/3
        runs = [["d1", "d2"], ["d1", "d3"], ["d1", "d2"]]
        assert chunk_id_jaccard(runs) == pytest.approx(5 / 9)

    def test_rejects_bare_string_run(self):
        with pytest.raises(TypeError):
            chunk_id_jaccard(["abc", "abd"])


class TestNgramJaccard:
    def test_fewer_than_two_runs(self):
        assert ngram_jaccard([["some text"]]) == 1.0

    def test_both_empty(self):
        assert ngram_jaccard([[], [""]]) == 1.0

    def test_robust_to_rechunking_case_and_whitespace(self):
        a = ["The quick brown fox", "jumps over the lazy dog"]
        b = ["the QUICK  brown", "fox jumps over\nthe lazy dog"]
        assert ngram_jaccard([a, b]) == 1.0

    def test_disjoint(self):
        assert ngram_jaccard([["alpha beta gamma"], ["delta epsilon zeta"]]) == 0.0

    def test_short_text_yields_one_gram(self):
        assert ngram_jaccard([["hi there"], ["hi there"]], n=3) == 1.0
        assert ngram_jaccard([["hi there"], ["hi you"]], n=3) == 0.0

    @pytest.mark.parametrize("n, expected", [(1, 5 / 6), (2, 3 / 7), (3, 1 / 3)])
    def test_n_sets_the_gram_size(self, n, expected):
        assert ngram_jaccard(CAT_RUNS, n=n) == pytest.approx(expected)

    def test_invalid_n(self):
        with pytest.raises(ValueError):
            ngram_jaccard([["a"], ["a"]], n=0)


class TestRetrievalConsistencyEvaluator:
    def test_ids_mode(self):
        evaluator = RetrievalConsistencyEvaluator()
        [score] = evaluator.evaluate({"runs": [["d1", "d2"], ["d1", "d3"], ["d1", "d2"]]})
        assert score.name == "retrieval_consistency"
        assert score.kind == "code"
        assert score.direction == "maximize"
        assert score.score == pytest.approx(5 / 9)
        assert score.metadata["n_runs"] == 3
        assert score.metadata["n_pairs"] == 3

    def test_text_mode(self):
        evaluator = RetrievalConsistencyEvaluator(mode="text")
        runs = [["Paris is the capital", "of France"], ["Paris is the capital of France"]]
        [score] = evaluator.evaluate({"runs": runs})
        assert score.score == 1.0

    @pytest.mark.parametrize(
        "kwargs, expected",
        [
            pytest.param({"n": 1}, 5 / 6, id="n=1"),
            pytest.param({"n": 2}, 3 / 7, id="n=2"),
            pytest.param({"n": 3}, 1 / 3, id="n=3"),
            pytest.param({}, 1 / 3, id="default-n"),
        ],
    )
    def test_text_mode_uses_n(self, kwargs, expected):
        evaluator = RetrievalConsistencyEvaluator(mode="text", **kwargs)
        [score] = evaluator.evaluate({"runs": CAT_RUNS})
        assert score.score == pytest.approx(expected)

    def test_single_run(self):
        [score] = RetrievalConsistencyEvaluator().evaluate({"runs": [["d1"]]})
        assert score.score == 1.0
        assert score.metadata["n_pairs"] == 0

    async def test_async(self):
        evaluator = RetrievalConsistencyEvaluator()
        [score] = await evaluator.async_evaluate({"runs": [[1, 2], [2, 3]]})
        assert score.score == pytest.approx(1 / 3)

    def test_invalid_mode(self):
        with pytest.raises(ValueError):
            RetrievalConsistencyEvaluator(mode="embeddings")


class TestParseJudgeRating:
    @pytest.mark.parametrize(
        "label, expected", [("1", 1.0), ("2", 2.0), ("3", 3.0), ("4", 4.0), ("5", 5.0)]
    )
    def test_valid_labels(self, label, expected):
        assert _parse_judge_rating({"label": label, "explanation": "why"}) == (expected, "why")

    def test_surrounding_whitespace_is_ignored(self):
        assert _parse_judge_rating({"label": " 3\n", "explanation": "why"}) == (3.0, "why")

    def test_explanation_is_optional(self):
        assert _parse_judge_rating({"label": "5"}) == (5.0, None)

    @pytest.mark.parametrize("response", INVALID_REPLIES)
    def test_invalid_replies_raise(self, response):
        with pytest.raises(ValueError):
            _parse_judge_rating(response)

    def test_render_does_not_substitute_inside_values(self):
        prompt = _render_prompt(None, "contains {item_b}", "B")
        assert "contains {item_b}" in prompt
        assert "(not provided)" in prompt


class TestAnswerConsistencyEvaluator:
    async def test_scores_sampled_pairs(self, run):
        llm = FakeLLM(
            replies={
                frozenset(("Paris", "Lyon")): {"label": "5", "explanation": "same"},
                frozenset(("paris ", "Lyon")): {"label": "1", "explanation": "diff"},
            }
        )
        evaluator = AnswerConsistencyEvaluator(llm, budget=3)
        [score] = await run(
            evaluator, {"input": "Capital of France?", "outputs": ["Paris", "paris ", "Lyon"]}
        )
        # Pair (0, 1) is identical after normalization and skipped; the other two are judged.
        assert len(llm.calls) == 2
        assert all("Capital of France?" in p for p in llm.prompts)
        assert score.name == "answer_consistency"
        assert score.kind == "llm"
        assert score.score == pytest.approx((1.0 + 1.0 + 0.0) / 3)
        assert score.metadata["model"] == "fake-judge"
        assert score.metadata["n_runs"] == 3
        assert score.metadata["n_pairs"] == 3
        pairs = score.metadata["pairs"]
        assert [p["pair"] for p in pairs] == [[0, 1], [0, 2], [1, 2]]
        assert [p["skipped"] for p in pairs] == [True, False, False]
        assert [p["score"] for p in pairs] == [1.0, 1.0, 0.0]
        assert [p["reason"] for p in pairs] == ["identical", "same", "diff"]
        assert "3 sampled pair(s)" in score.explanation

    async def test_each_pair_gets_its_own_judgment(self, run):
        outputs = ["alpha", "bravo", "charlie", "delta", "echo"]
        pairs = sample_run_pairs(len(outputs), seed=3)
        assert pairs != sample_run_pairs(len(outputs))  # so ignoring the seed shows up
        # A distinct rating and explanation for each pair that should be judged; judging any
        # other pair gets an invalid reply and fails.
        llm = FakeLLM(
            replies={
                frozenset((outputs[i], outputs[j])): {
                    "label": str(k + 1),
                    "explanation": f"{i}-{j}",
                }
                for k, (i, j) in enumerate(pairs)
            },
            default={"label": "N/A"},
        )
        [score] = await run(AnswerConsistencyEvaluator(llm, seed=3), {"outputs": outputs})
        assert len(llm.calls) == 5
        assert score.metadata["pairs"] == [
            {"pair": [i, j], "score": k / 4, "reason": f"{i}-{j}", "skipped": False}
            for k, (i, j) in enumerate(pairs)
        ]
        assert score.score == pytest.approx(0.5)

    async def test_budget_limits_judged_pairs(self, run):
        llm = FakeLLM()
        outputs = ["alpha", "bravo", "charlie", "delta", "echo"]
        [score] = await run(AnswerConsistencyEvaluator(llm, budget=2), {"outputs": outputs})
        assert len(llm.calls) == 2
        assert score.metadata["n_runs"] == 5
        assert score.metadata["n_pairs"] == 2
        expected_pairs = [list(pair) for pair in sample_run_pairs(5, budget=2)]
        assert [p["pair"] for p in score.metadata["pairs"]] == expected_pairs
        assert "2 sampled pair(s) of 5 outputs" in score.explanation

    async def test_invocation_parameters_reach_the_judge(self, run):
        llm = FakeLLM()
        evaluator = AnswerConsistencyEvaluator(llm, budget=3, temperature=0.0, max_tokens=64)
        assert evaluator.invocation_parameters == {"temperature": 0.0, "max_tokens": 64}
        [score] = await run(evaluator, {"outputs": ["a", "b", "c"]})
        assert len(llm.calls) == 3
        for call in llm.calls:
            assert call["kwargs"] == {"temperature": 0.0, "max_tokens": 64}
            assert call["labels"] == ["1", "2", "3", "4", "5"]
            assert call["include_explanation"] is True
        assert score.metadata["model"] == "fake-judge"

    @pytest.mark.parametrize("reply", INVALID_REPLIES)
    async def test_invalid_judge_reply_fails_the_evaluation(self, run, reply):
        llm = FakeLLM(replies={frozenset(("Paris", "Lyon")): reply})
        evaluator = AnswerConsistencyEvaluator(llm)
        with pytest.raises(ValueError):
            await run(evaluator, {"outputs": ["Paris", "The capital is Paris.", "Lyon"]})

    def test_invalid_judge_reply_is_a_failed_row_not_a_score(self):
        llm = FakeLLM(replies={frozenset(("Paris", "Lyon")): {"label": "N/A"}})
        dataframe = pd.DataFrame({"outputs": [["Paris", "paris"], ["Paris", "Lyon"]]})
        result = evaluate_dataframe(
            dataframe=dataframe,
            evaluators=[AnswerConsistencyEvaluator(llm)],
            max_retries=0,
            exit_on_error=False,
            hide_tqdm_bar=True,
        )
        identical, invalid = result["answer_consistency_score"]
        assert identical["score"] == 1.0
        assert invalid is None
        details = result["answer_consistency_execution_details"][1]
        assert details["status"] == "FAILED"
        assert "ValueError" in details["exceptions"][0]

    async def test_input_is_optional(self, run):
        llm = FakeLLM()
        [score] = await run(AnswerConsistencyEvaluator(llm), {"outputs": ["a b", "c d"]})
        assert score.score == pytest.approx(0.75)
        assert "(not provided)" in llm.prompts[0]

    def test_input_mapping(self):
        llm = FakeLLM()
        evaluator = AnswerConsistencyEvaluator(llm)
        evaluator.evaluate(
            {"question": "Q?", "answers": ["a", "b"]},
            input_mapping={"input": "question", "outputs": "answers"},
        )
        assert "Q?" in llm.prompts[0]

    def test_unmapped_input_passes_through(self):
        # Only "outputs" is mapped; the optional top-level "input" still reaches the prompt.
        llm = FakeLLM()
        AnswerConsistencyEvaluator(llm).evaluate(
            {"input": "Q?", "answers": ["a", "b"]}, input_mapping={"outputs": "answers"}
        )
        assert "Q?" in llm.prompts[0]

    async def test_bound_mapping(self):
        llm = FakeLLM()
        evaluator = AnswerConsistencyEvaluator(llm)
        evaluator.bind({"input": "question", "outputs": "answers"})
        await evaluator.async_evaluate({"question": "Q?", "answers": ["a", "b"]})
        assert "Q?" in llm.prompts[0]

    async def test_all_identical_makes_no_calls(self, run):
        llm = FakeLLM()
        [score] = await run(AnswerConsistencyEvaluator(llm), {"outputs": ["Same", "same", "SAME"]})
        assert score.score == 1.0
        assert llm.calls == []

    def test_single_output(self):
        llm = FakeLLM()
        [score] = AnswerConsistencyEvaluator(llm).evaluate({"outputs": ["only"]})
        assert score.score == 1.0
        assert score.metadata["n_pairs"] == 0
