"""Grade the model comparison from the experiments left in Phoenix and the final reply.

Examples are matched by question text, so experiments on a copy of the dataset count.
`reward` is 1 when at least two experiments ran on the same set of at least 20 questions,
scored by the same evaluators, and the final reply's recommendation agrees with the
correct-behavior rates the verifier computes for those experiments. A run behaves correctly
when it refuses exactly when the reference refuses and otherwise returns one read-only query
scoped to the customer; an errored run counts as wrong. A difference of 2 questions or fewer
is treated as no clear difference.

Exact match against the references isn't used: the references fix column choices, date
idioms, and refusal wording that the prompt never states, so capable models score 0% on it.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.evals_state import (
    KeyedExperiment,
    dataset_examples,
    dataset_id,
    keyed_experiments,
)
from harbor_verifiers.llm_judge import matches_reference
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply, write_reward

MIN_SHARED = 20
CLEAR_GAP = 2
_MODEL = re.compile(r"haiku|sonnet", re.IGNORECASE)


def correct_rate(found: KeyedExperiment, metadata: dict[str, Any]) -> float:
    """Returns the share of runs that behave correctly, given example metadata by question."""
    hits = [
        not run.error
        and sql.behaves_correctly(
            run.output, run.reference, metadata.get(sql.question(run.input) or "", {})
        )
        for run in found.experiment.runs
    ]
    return sum(hits) / len(hits) if hits else 0.0


def describe(found: KeyedExperiment) -> str:
    meta = {k: v for k, v in found.experiment.metadata.items() if isinstance(v, (str, int, float))}
    return f"name={found.experiment.name!r} metadata={meta}"


def main() -> None:
    scores: dict[str, float] = {
        "outcome_paired_experiments": 0.0,
        "outcome_recommendation_matches": 0.0,
        "practice_repetitions": 0.0,
        "practice_models_identifiable": 0.0,
        "diag_experiment_count": 0.0,
    }
    details: dict[str, Any] = {}
    original = dataset_id(sql.DATASET)
    examples = dataset_examples(original) if original else []
    allowed = {sql.question(e["input"]) for e in examples} - {None}
    metadata = {str(sql.question(e["input"])): e.get("metadata") or {} for e in examples}
    keyed, _ = keyed_experiments(lambda e: sql.question(e["input"]), allowed)  # type: ignore[arg-type]
    keyed = [k for k in keyed if k.experiment.runs]
    scores["diag_experiment_count"] = float(len(keyed))
    groups: dict[tuple[frozenset[str], frozenset[str]], list[KeyedExperiment]] = defaultdict(list)
    for item in keyed:
        if len(item.keys) >= MIN_SHARED and item.experiment.evaluator_names():
            groups[(item.keys, frozenset(item.experiment.evaluator_names()))].append(item)
    paired = max(
        groups.values(), key=lambda g: (len(g), max(k.experiment.rowid for k in g)), default=[]
    )
    if len(paired) >= 2:
        scores["outcome_paired_experiments"] = 1.0
        rates = [(describe(k), correct_rate(k, metadata)) for k in paired]
        n = len(paired[0].keys)
        best = max(r for _, r in rates)
        worst = min(r for _, r in rates)
        gap_questions = round((best - worst) * n)
        lines = "\n".join(f"- {d}: {r:.0%} correct" for d, r in rates)
        notes = (
            f"The agent's experiments on the same {n} questions scored:\n{lines}\n"
            f"The gap between the best and worst is {gap_questions} question(s). "
            f"If the gap is {CLEAR_GAP} or fewer, a matching reply says there's no clear "
            "quality difference, or recommends either model on other grounds such as cost or "
            "latency. If the gap is larger, a matching reply must not call the lower-scoring "
            "model better in quality; it may still recommend it on cost or latency if it names "
            "the quality gap. Use the experiment names and metadata to tell which model is which."
        )
        reply, _ = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
        if reply.strip():
            judged = matches_reference(reply, "A recommendation consistent with the scores.", notes)
            scores["outcome_recommendation_matches"] = float(judged.score or 0.0)
            details["judge"] = judged.explanation
        details["rates"] = rates
        repeated = any(
            max((run.repetition for run in k.experiment.runs), default=1) >= 2 for k in paired
        )
        scores["practice_repetitions"] = float(repeated or len(paired) >= 4)
        scores["practice_models_identifiable"] = float(
            all(_MODEL.search(describe(k)) for k in paired)
        )
    reward = float(
        scores["outcome_paired_experiments"] == 1.0
        and scores["outcome_recommendation_matches"] == 1.0
    )
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
