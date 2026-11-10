"""Grade the goal-deviation judge and the agreement the agent reported for it.

The annotators' verdict for a labeled trace is whether any of its `trail_error` annotations
is a goal deviation. `reward` is 1 when:

- an LLM judge's verdicts are stored in Phoenix for at least 40 labeled traces, as
  annotations or as an experiment over a dataset built from the traces;
- the final reply reports precision, recall and F1, or Cohen's kappa, not accuracy alone;
- the figures in the reply match a confusion matrix the verifier recomputes from the stored
  verdicts, within 0.05; and
- the experiment's dataset, if there is one, contains no trace the annotators never labeled.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

import re
from typing import Any

from harbor_verifiers import trail_truth
from harbor_verifiers.judge_alignment import (
    annotation_candidates,
    describe,
    experiment_candidates,
    ranked,
)
from harbor_verifiers.llm_judge import matches_reference
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply, write_reward

MIN_TRACES = 40
_CLASS_AWARE = re.compile(r"precision|recall|\bf1\b|f-?score|f1-score|kappa", re.IGNORECASE)
NOTES = (
    "The reply reports how well an LLM judge agrees with human labels. The reference lists "
    "confusion matrices recomputed from the judge verdicts the agent stored. The reply "
    "matches when the agreement figures it reports (any of precision, recall, F1, kappa, "
    "accuracy, or counts) agree with one of those matrices within 0.05 absolute, or within "
    "2 for counts, allowing for the positive class being either 'deviation' or 'no "
    "deviation'. Ignore metrics the reply doesn't report. A reply with no figures doesn't "
    "match."
)


def truth(fact: trail_truth.TraceFacts) -> bool:
    return fact.goal_deviation


def main() -> None:
    scores: dict[str, float] = {
        "outcome_judge_labels_stored": 0.0,
        "outcome_class_aware_metrics": 0.0,
        "outcome_reported_numbers_correct": 0.0,
        "outcome_no_unlabeled_in_dataset": 0.0,
        "practice_both_classes": 0.0,
        "diag_balanced_accuracy": 0.0,
        "diag_kappa": 0.0,
    }
    details: dict[str, Any] = {}
    facts = trail_truth.traces()
    candidates = [
        c
        for c in annotation_candidates() + experiment_candidates()
        if c.llm_kind and c.labeled_count >= MIN_TRACES
    ]
    top = ranked(candidates, truth)[:3]
    details["candidates"] = [describe(c, truth) for c in top]
    reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
    details["reply_source"] = source
    if top:
        best = top[0]
        scores["outcome_judge_labels_stored"] = 1.0
        scores["outcome_no_unlabeled_in_dataset"] = float(
            all(facts[t].labeled for t in best.dataset_traces)
        )
        matrix = best.scored(truth)
        scores["diag_balanced_accuracy"] = matrix.balanced_accuracy
        scores["diag_kappa"] = matrix.kappa
        positives = matrix.tp + matrix.fn
        total = positives + matrix.tn + matrix.fp
        scores["practice_both_classes"] = float(total > 0 and 0.25 <= positives / total <= 0.75)
        if reply.strip():
            reference = "Agreement figures consistent with one of:\n" + "\n".join(
                details["candidates"]
            )
            judged = matches_reference(reply, reference, NOTES)
            scores["outcome_reported_numbers_correct"] = float(judged.score or 0.0)
            details["judge"] = judged.explanation
    scores["outcome_class_aware_metrics"] = float(bool(_CLASS_AWARE.search(reply)))
    reward = float(all(scores[k] == 1.0 for k in scores if k.startswith("outcome_")))
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
