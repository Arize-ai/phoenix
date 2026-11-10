"""Grade the labeled dataset for a tool-selection judge.

`reward` is 1 when the dataset `tool-selection-labels` exists with 40 to 60 examples, each
example links to a trace in `research-assistant` (through its source span or a span or trace
ID in its fields), no example comes from a trace that annotators never labeled, and the
stored labels agree with the annotators on at least 95% of examples. The annotators' verdict
for a trace is whether any `trail_error` annotation in it is a tool-selection error.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from harbor_verifiers import trail_truth
from harbor_verifiers.evals_state import (
    dataset_examples,
    dataset_id,
    stored_label_agreement,
    word_ngrams,
)
from harbor_verifiers.verify import write_reward

DATASET = "tool-selection-labels"
MIN_EXAMPLES, MAX_EXAMPLES = 40, 60
MIN_LABEL_AGREEMENT = 0.95


def main() -> None:
    scores: dict[str, float] = {
        "outcome_dataset_shape": 0.0,
        "outcome_examples_traceable": 0.0,
        "outcome_no_unlabeled": 0.0,
        "outcome_labels_correct": 0.0,
        "practice_class_balance": 0.0,
        "practice_both_agent_paths": 0.0,
        "practice_no_duplicates": 0.0,
        "diag_input_has_question": 0.0,
        "diag_positive_share": 0.0,
    }
    details: dict[str, Any] = {}
    found = dataset_id(DATASET)
    examples = dataset_examples(found) if found else []
    if not examples:
        write_reward(0.0, {"reason": f"no dataset named {DATASET} with examples"}, **scores)
        return
    facts = trail_truth.traces()
    linked = [trail_truth.linked_trace(example) for example in examples]
    traced = [(e, t) for e, t in zip(examples, linked) if t is not None]
    labeled = [(e, t) for e, t in traced if facts[t].labeled]
    scores["outcome_dataset_shape"] = float(MIN_EXAMPLES <= len(examples) <= MAX_EXAMPLES)
    scores["outcome_examples_traceable"] = float(len(traced) == len(examples))
    scores["outcome_no_unlabeled"] = float(len(labeled) == len(traced))
    if labeled:
        truth = [facts[t].tool_selection_error for _, t in labeled]
        label_fit = stored_label_agreement(
            [e.get("output") for e, _ in labeled], truth, r"tool[ _-]?selection"
        )
        scores["outcome_labels_correct"] = float(label_fit >= MIN_LABEL_AGREEMENT)
        positives = sum(truth) / len(truth)
        scores["diag_positive_share"] = positives
        scores["practice_class_balance"] = float(0.35 <= positives <= 0.65)
        search = sum(facts[t].uses_search_agent for _, t in labeled) / len(labeled)
        scores["practice_both_agent_paths"] = float(0.2 <= search <= 0.8)
        details["label_agreement"] = label_fit
        details["search_agent_share"] = search
    counts = Counter(t for t in linked if t)
    scores["practice_no_duplicates"] = float(all(n == 1 for n in counts.values()))
    with_question = [
        bool(word_ngrams(facts[t].question, 6) & word_ngrams(str(e.get("input")), 6))
        for e, t in traced
        if facts[t].question
    ]
    scores["diag_input_has_question"] = (
        sum(with_question) / len(with_question) if with_question else 0.0
    )
    details.update(
        examples=len(examples),
        traceable=len(traced),
        labeled=len(labeled),
        unlabeled=[t for _, t in traced if not facts[t].labeled],
    )
    reward = float(
        all(
            scores[k] == 1.0
            for k in (
                "outcome_dataset_shape",
                "outcome_examples_traceable",
                "outcome_no_unlabeled",
                "outcome_labels_correct",
            )
        )
    )
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
