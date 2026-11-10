"""Grade the improved goal-deviation judge and its held-out agreement.

Experiments are matched to traces through their datasets' examples. The held-out set is the
most recently used set of at least 20 labeled traces, with at least 3 of each class, that no
experiment overlaps only partly and that some other experiment avoided entirely (the
tuning). `reward` is 1 when:

- the prompt `goal-deviation-judge` is saved and differs from the starting prompt;
- such a held-out set exists;
- the agreement in the final reply matches what the verifier recomputes from the newest
  experiment on the held-out set, within 0.05; and
- the saved prompt quotes no held-out trace's question.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

from harbor_verifiers import trail_truth
from harbor_verifiers.evals_state import leaked_sources, prompt_versions
from harbor_verifiers.judge_alignment import Candidate, describe, experiment_candidates
from harbor_verifiers.llm_judge import matches_reference
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply, write_reward

PROMPT_NAME = "goal-deviation-judge"
START_PROMPT = (Path(__file__).parent / "start_prompt.txt").read_text()
MIN_HELD_OUT, MIN_PER_CLASS = 20, 3
NOTES = (
    "The reply reports how well an LLM judge agrees with human labels on held-out traces. "
    "The reference lists confusion matrices recomputed from the newest held-out experiment. "
    "The reply matches when the held-out agreement figures it reports (any of precision, "
    "recall, F1, kappa, accuracy, or counts) agree with one of them within 0.05 absolute, "
    "or within 2 for counts, allowing either class as positive. Ignore figures the reply "
    "gives for other sets. A reply with no held-out figures doesn't match."
)


def truth(fact: trail_truth.TraceFacts) -> bool:
    return fact.goal_deviation


def _normalized(text: str) -> str:
    return " ".join(text.split()).lower()


def labeled(traces: frozenset[str]) -> frozenset[str]:
    facts = trail_truth.traces()
    return frozenset(t for t in traces if facts[t].labeled)


def choose_held_out(sets: dict[str, frozenset[str]], order: dict[str, int]) -> frozenset[str]:
    facts = trail_truth.traces()
    best: tuple[int, frozenset[str]] | None = None
    for key, traces in sets.items():
        held = labeled(traces)
        positives = sum(truth(facts[t]) for t in held)
        others = [s for k, s in sets.items() if k != key]
        disjoint = any(s and not s & traces for s in others)
        partial = any(s & traces and s != traces for s in others)
        if (
            len(held) >= MIN_HELD_OUT
            and min(positives, len(held) - positives) >= MIN_PER_CLASS
            and disjoint
            and not partial
            and (best is None or order[key] > best[0])
        ):
            best = (order[key], traces)
    return best[1] if best else frozenset()


def main() -> None:
    scores: dict[str, float] = {
        "outcome_prompt_saved": 0.0,
        "outcome_held_out_set": 0.0,
        "outcome_reported_numbers_correct": 0.0,
        "outcome_no_leakage": 0.0,
        "practice_single_holdout_look": 0.0,
        "diag_holdout_balanced_accuracy": 0.0,
        "diag_holdout_gain": 0.0,
    }
    details: dict[str, Any] = {}
    facts = trail_truth.traces()
    versions = prompt_versions(PROMPT_NAME)
    final_prompt = versions[-1].text if versions else ""
    scores["outcome_prompt_saved"] = float(
        bool(final_prompt) and _normalized(final_prompt) != _normalized(START_PROMPT)
    )
    candidates = experiment_candidates()
    by_experiment: dict[str, list[Candidate]] = defaultdict(list)
    for candidate in candidates:
        if candidate.experiment is not None:
            by_experiment[candidate.experiment.id].append(candidate)
    sets = {
        exp_id: frozenset(t for c in group for t in c.predictions)
        for exp_id, group in by_experiment.items()
    }
    order = {
        exp_id: group[0].experiment.rowid  # type: ignore[union-attr]
        for exp_id, group in by_experiment.items()
    }
    held_out = choose_held_out(sets, order)
    on_held_out = sorted((k for k, s in sets.items() if s == held_out), key=order.__getitem__)
    scores["outcome_held_out_set"] = float(bool(held_out))
    scores["practice_single_holdout_look"] = float(1 <= len(on_held_out) <= 2)
    if on_held_out:
        newest = sorted(
            by_experiment[on_held_out[-1]], key=lambda c: c.scored(truth).accuracy, reverse=True
        )[:3]
        details["held_out_candidates"] = [describe(c, truth) for c in newest]
        scores["diag_holdout_balanced_accuracy"] = newest[0].scored(truth).balanced_accuracy
        if len(on_held_out) >= 2:
            first = max(
                (c.scored(truth).balanced_accuracy for c in by_experiment[on_held_out[0]]),
                default=0.0,
            )
            scores["diag_holdout_gain"] = scores["diag_holdout_balanced_accuracy"] - first
        reply, _ = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
        if reply.strip():
            reference = "Held-out agreement consistent with one of:\n" + "\n".join(
                details["held_out_candidates"]
            )
            judged = matches_reference(reply, reference, NOTES)
            scores["outcome_reported_numbers_correct"] = float(judged.score or 0.0)
            details["judge"] = judged.explanation
    questions = {f"question:{t}": facts[t].question for t in held_out if facts[t].question}
    leaks = leaked_sources(final_prompt, questions) if final_prompt else []
    scores["outcome_no_leakage"] = float(bool(final_prompt) and not leaks)
    details.update(
        leaks=leaks,
        held_out_size=len(labeled(held_out)),
        experiments=len(sets),
        experiments_on_held_out=len(on_held_out),
    )
    reward = float(all(scores[k] == 1.0 for k in scores if k.startswith("outcome_")))
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
