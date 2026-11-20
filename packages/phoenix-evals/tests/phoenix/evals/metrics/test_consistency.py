# type: ignore
import itertools
from collections import Counter

import pytest

from phoenix.evals.metrics import (
    AnswerConsistencyEvaluator,
    RetrievalConsistencyEvaluator,
    chunk_id_jaccard,
    ngram_jaccard,
    sample_run_pairs,
)
from phoenix.evals.metrics.consistency import _parse_judge_output, _render_prompt


class FakeLLM:
    """Returns canned replies in order and records every prompt."""

    def __init__(self, replies=None, default='{"reason": "close", "score": 4}'):
        self.replies = list(replies or [])
        self.default = default
        self.prompts = []

    def _next(self, prompt):
        self.prompts.append(prompt)
        return self.replies.pop(0) if self.replies else self.default

    def generate_text(self, prompt, **kwargs):
        return self._next(prompt)

    async def async_generate_text(self, prompt, **kwargs):
        return self._next(prompt)


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
        covered = {k for pair in sample_run_pairs(n_runs, budget=budget) for k in pair}
        assert covered == set(range(n_runs))

    def test_large_budget_returns_all_pairs(self):
        assert sample_run_pairs(5, budget=100) == list(itertools.combinations(range(5), 2))

    def test_budget_above_cycle_tops_up_with_distinct_pairs(self):
        pairs = sample_run_pairs(6, budget=9)
        assert len(set(pairs)) == 9

    def test_deterministic_for_seed(self):
        assert sample_run_pairs(10, seed=7) == sample_run_pairs(10, seed=7)

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


class TestParseJudgeOutput:
    @pytest.mark.parametrize(
        "reply, expected",
        [
            ('{"reason": "same", "score": 5}', (5.0, "same")),
            ('```json\n{"reason": "meh", "score": 3}\n```', (3.0, "meh")),
            ("On a 1-5 scale, score: 2", (2.0, None)),
            ("I'd give it 4 out of 5", (4.0, None)),
            ('{"score": 9}', (5.0, None)),
        ],
    )
    def test_parses(self, reply, expected):
        assert _parse_judge_output(reply) == expected

    def test_unparseable(self):
        with pytest.raises(ValueError):
            _parse_judge_output("no idea")

    def test_render_does_not_substitute_inside_values(self):
        prompt = _render_prompt(None, "contains {item_b}", "B")
        assert "contains {item_b}" in prompt
        assert "(not provided)" in prompt


class TestAnswerConsistencyEvaluator:
    def test_scores_sampled_pairs(self):
        llm = FakeLLM(replies=['{"reason": "same", "score": 5}', '{"reason": "diff", "score": 1}'])
        evaluator = AnswerConsistencyEvaluator(llm, budget=3)
        [score] = evaluator.evaluate(
            {"input": "Capital of France?", "outputs": ["Paris", "paris ", "Lyon"]}
        )
        # Pair (0, 1) is identical after normalization and skipped; the other two are judged.
        assert len(llm.prompts) == 2
        assert all("Capital of France?" in p for p in llm.prompts)
        assert score.name == "answer_consistency"
        assert score.kind == "llm"
        assert score.score == pytest.approx((1.0 + 1.0 + 0.0) / 3)
        assert score.metadata["n_runs"] == 3
        assert score.metadata["n_pairs"] == 3
        pairs = score.metadata["pairs"]
        assert [p["pair"] for p in pairs] == [[0, 1], [0, 2], [1, 2]]
        assert pairs[0]["skipped"] is True
        assert [p["score"] for p in pairs[1:]] == [1.0, 0.0]
        assert "3 sampled pair(s)" in score.explanation

    def test_input_is_optional(self):
        llm = FakeLLM()
        [score] = AnswerConsistencyEvaluator(llm).evaluate({"outputs": ["a b", "c d"]})
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

    def test_all_identical_makes_no_calls(self):
        llm = FakeLLM()
        [score] = AnswerConsistencyEvaluator(llm).evaluate({"outputs": ["Same", "same", "SAME"]})
        assert score.score == 1.0
        assert llm.prompts == []

    def test_single_output(self):
        llm = FakeLLM()
        [score] = AnswerConsistencyEvaluator(llm).evaluate({"outputs": ["only"]})
        assert score.score == 1.0
        assert score.metadata["n_pairs"] == 0

    async def test_async_matches_sync(self):
        outputs = ["one", "two", "three", "four", "five"]
        sync_llm, async_llm = FakeLLM(), FakeLLM()
        [sync_score] = AnswerConsistencyEvaluator(sync_llm, seed=3).evaluate({"outputs": outputs})
        [async_score] = await AnswerConsistencyEvaluator(async_llm, seed=3).async_evaluate(
            {"outputs": outputs}
        )
        assert len(async_llm.prompts) == 5
        assert sorted(async_llm.prompts) == sorted(sync_llm.prompts)
        assert async_score.score == sync_score.score == pytest.approx(0.75)
        assert async_score.metadata["pairs"] == sync_score.metadata["pairs"]
