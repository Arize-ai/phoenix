"""Grade the representative review sample.

`reward` is 1 when the dataset `review-batch-1` has 25 to 35 examples that each link to a
different trace in `research-assistant`, and the sample's mix matches the project's traffic:
the share of traces that used the search agent, and the share in each size band (6 or
fewer LLM spans, 7 to 15, more than 15), are each within 20 points of the whole project.

A uniform random sample of 30 passes about nine times in ten; a stratified sample always
passes. Samples drawn only from errored, short, or long traces fail.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

from typing import Any

from harbor_verifiers import trail_truth
from harbor_verifiers.evals_state import dataset_examples, dataset_id
from harbor_verifiers.verify import write_reward

DATASET = "review-batch-1"
MIN_EXAMPLES, MAX_EXAMPLES = 25, 35
TOLERANCE = 0.2
BANDS = ("small", "medium", "large")


def main() -> None:
    scores: dict[str, float] = {
        "outcome_dataset_shape": 0.0,
        "outcome_distinct_traces": 0.0,
        "outcome_agent_path_mix": 0.0,
        "outcome_size_mix": 0.0,
        "practice_error_share_close": 0.0,
        "practice_labeled_share_close": 0.0,
    }
    details: dict[str, Any] = {}
    found = dataset_id(DATASET)
    examples = dataset_examples(found) if found else []
    facts = trail_truth.traces()
    linked = [trail_truth.linked_trace(example) for example in examples]
    traces = [t for t in linked if t]
    scores["outcome_dataset_shape"] = float(MIN_EXAMPLES <= len(examples) <= MAX_EXAMPLES)
    scores["outcome_distinct_traces"] = float(
        bool(examples) and len(traces) == len(examples) and len(set(traces)) == len(traces)
    )
    if traces:
        population = list(facts.values())
        sample = [facts[t] for t in set(traces)]

        def share(group: list[trail_truth.TraceFacts], test: Any) -> float:
            return sum(bool(test(f)) for f in group) / len(group)

        def close(test: Any) -> bool:
            return abs(share(sample, test) - share(population, test)) <= TOLERANCE

        scores["outcome_agent_path_mix"] = float(close(lambda f: f.uses_search_agent))
        scores["outcome_size_mix"] = float(
            all(close(lambda f, b=band: f.size_band == b) for band in BANDS)
        )
        scores["practice_error_share_close"] = float(close(lambda f: f.error_status))
        scores["practice_labeled_share_close"] = float(close(lambda f: f.labeled))
        details["shares"] = {
            "search_agent": [
                share(sample, lambda f: f.uses_search_agent),
                share(population, lambda f: f.uses_search_agent),
            ],
            **{
                band: [
                    share(sample, lambda f, b=band: f.size_band == b),
                    share(population, lambda f, b=band: f.size_band == b),
                ]
                for band in BANDS
            },
            "error_status": [
                share(sample, lambda f: f.error_status),
                share(population, lambda f: f.error_status),
            ],
        }
    details.update(examples=len(examples), linked=len(traces), distinct=len(set(traces)))
    reward = float(all(scores[k] == 1.0 for k in scores if k.startswith("outcome_")))
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
