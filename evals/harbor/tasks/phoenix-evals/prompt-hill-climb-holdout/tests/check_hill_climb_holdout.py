"""Grade the held-out prompt hill-climb from the experiments and prompt left in Phoenix.

Examples are matched by question text, so experiments on a copy of the dataset count.
The held-out set is the most recently used example set that two or more experiments ran
on exactly, with a tuning experiment disjoint from it. `reward` is 1 when:

- the prompt `banking-sql-assistant` is saved and differs from the starting prompt;
- the held-out set has 7 to 21 of the 28 questions, including at least 2 that must be
  refused and 2 that must be answered, at least two experiments ran on exactly that set, and
  at least one experiment ran only on other questions (the tuning);
- the saved prompt quotes no held-out question, `user_id`, or reference query; and
- the final reply's ship decision agrees with the held-out exact-match scores of the first
  and last experiments on that set, which the verifier computes itself.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.evals_state import (
    KeyedExperiment,
    dataset_examples,
    dataset_id,
    keyed_experiments,
    leaked_sources,
    prompt_versions,
)
from harbor_verifiers.llm_judge import matches_reference
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply, write_reward

PROMPT_NAME = "banking-sql-assistant"
START_PROMPT = (Path(__file__).parent / "start_prompt.txt").read_text()
MIN_HELD_OUT, MAX_HELD_OUT, MIN_TUNING = 7, 21, 14


def _normalized(text: str) -> str:
    return " ".join(text.split()).lower()


def exact_match_rate(found: KeyedExperiment, references: dict[str, Any], key_of: Any) -> float:
    runs = [run for run in found.experiment.runs if run.repetition == 1]
    hits = [sql.exact_match(run.output, references[key_of(run)]) for run in runs]
    return sum(hits) / len(hits) if hits else 0.0


def main() -> None:
    scores: dict[str, float] = {
        "outcome_prompt_saved": 0.0,
        "outcome_comparison_on_unseen": 0.0,
        "outcome_no_leakage": 0.0,
        "outcome_recommendation_matches": 0.0,
        "outcome_held_out_has_both_kinds": 0.0,
        "practice_split_sizes": 0.0,
        "practice_split_stratified": 0.0,
        "practice_split_in_phoenix": 0.0,
        "practice_single_test_look": 0.0,
        "practice_no_full_dataset_runs": 0.0,
        "diag_used_existing_splits_as_test": 0.0,
        "diag_experiment_count": 0.0,
    }
    details: dict[str, Any] = {}
    original = dataset_id(sql.DATASET)
    examples = dataset_examples(original) if original else []
    by_key = {sql.question(e["input"]): e for e in examples}
    references = {key: e["output"] for key, e in by_key.items() if key}
    existing_splits: dict[str, frozenset[str]] = {}
    keyed, splits = keyed_experiments(lambda e: sql.question(e["input"]), set(references))
    existing_splits = splits.get(sql.DATASET, {})
    keyed = [k for k in keyed if k.keys]
    scores["diag_experiment_count"] = float(len(keyed))

    versions = prompt_versions(PROMPT_NAME)
    final_prompt = versions[-1].text if versions else ""
    scores["outcome_prompt_saved"] = float(
        bool(final_prompt) and _normalized(final_prompt) != _normalized(START_PROMPT)
    )

    held_out = choose_held_out(keyed)
    on_held_out = [k for k in keyed if k.keys == held_out]
    partial = [k for k in keyed if k.keys & held_out and k.keys != held_out]
    tuning = [k for k in keyed if k.keys and not k.keys & held_out]
    tuning_keys = frozenset().union(*(k.keys for k in tuning)) if tuning else frozenset()
    scores["outcome_comparison_on_unseen"] = float(
        MIN_HELD_OUT <= len(held_out) <= MAX_HELD_OUT and len(on_held_out) >= 2 and bool(tuning)
    )
    scores["practice_split_sizes"] = float(
        len(held_out) >= MIN_HELD_OUT and len(tuning_keys) >= MIN_TUNING
    )
    refusals = sum(sql.should_refuse(references[k]) for k in held_out)
    scores["outcome_held_out_has_both_kinds"] = float(
        refusals >= 2 and len(held_out) - refusals >= 2
    )
    scores["practice_split_stratified"] = float(
        bool(held_out) and 0.3 <= refusals / len(held_out) <= 0.7
    )
    scores["practice_split_in_phoenix"] = float(
        any(held_out == split for s in splits.values() for split in s.values())
    )
    scores["practice_single_test_look"] = float(1 <= len(on_held_out) <= 2)
    scores["practice_no_full_dataset_runs"] = float(bool(keyed) and not partial)
    scores["diag_used_existing_splits_as_test"] = float(
        any(held_out == split for split in existing_splits.values())
    )

    sources: dict[str, str] = {}
    for key in held_out:
        example = by_key[key]
        sources[f"question:{key}"] = key
        sources[f"reference:{key}"] = sql.reference_text(example["output"])
    leaks = leaked_sources(
        final_prompt, {k: v for k, v in sources.items() if k.startswith("question:")}
    )
    leaks += leaked_sources(
        final_prompt, {k: v for k, v in sources.items() if k.startswith("reference:")}, n=10
    )
    leaked_ids = [
        str((by_key[k].get("metadata") or {}).get("user_id"))
        for k in held_out
        if (by_key[k].get("metadata") or {}).get("user_id", "") in final_prompt
    ]
    scores["outcome_no_leakage"] = float(bool(final_prompt) and not leaks and not leaked_ids)
    details["leaks"] = leaks + leaked_ids

    reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
    if len(on_held_out) >= 2 and reply.strip():
        key_of = _key_of_run(on_held_out)
        first = exact_match_rate(on_held_out[0], references, key_of)
        last = exact_match_rate(on_held_out[-1], references, key_of)
        n = len(held_out)
        verdict = "ship" if last > first else "do not ship"
        notes = (
            f"On the {n} held-out questions, the first experiment (the current prompt) scored "
            f"{first:.0%} exact match and the last experiment (the new prompt) scored {last:.0%}. "
            "A reply matches when its recommendation agrees: recommend shipping only if the new "
            "prompt scored higher; otherwise recommend not shipping or say it doesn't beat the "
            "current prompt. Ignore other reasoning in the reply."
        )
        judged = matches_reference(reply, f"Recommendation: {verdict}.", notes)
        scores["outcome_recommendation_matches"] = float(judged.score or 0.0)
        details["held_out_scores"] = {"first": first, "last": last, "n": n}
        details["judge"] = judged.explanation
    details.update(
        held_out_size=len(held_out),
        experiments_on_held_out=len(on_held_out),
        tuning_experiments=len(tuning),
        reply_source=source,
        prompt_versions=len(versions),
    )
    reward = float(
        all(
            scores[k] == 1.0
            for k in (
                "outcome_prompt_saved",
                "outcome_comparison_on_unseen",
                "outcome_no_leakage",
                "outcome_recommendation_matches",
                "outcome_held_out_has_both_kinds",
            )
        )
    )
    write_reward(reward, details, **scores)


def choose_held_out(keyed: list[KeyedExperiment]) -> frozenset[str]:
    """Picks the held-out set: the most recently used example set of a plausible size that
    at least two experiments ran on exactly, with some experiment disjoint from it.
    Falls back to the newest experiment's set."""
    candidates = []
    for keys in {k.keys for k in keyed}:
        exact = [k for k in keyed if k.keys == keys]
        disjoint = any(k.keys and not k.keys & keys for k in keyed)
        if MIN_HELD_OUT <= len(keys) <= MAX_HELD_OUT and len(exact) >= 2 and disjoint:
            candidates.append((max(k.experiment.rowid for k in exact), keys))
    if candidates:
        return max(candidates, key=lambda c: c[0])[1]
    return keyed[-1].keys if keyed else frozenset()


def _key_of_run(found: list[KeyedExperiment]) -> Any:
    """Maps a run to its question key through the examples of the experiment's dataset."""
    lookup: dict[str, str] = {}
    for item in found:
        for run in item.experiment.runs:
            key = sql.question(run.input)
            if key:
                lookup[run.example_id] = key
    return lambda run: lookup[run.example_id]


if __name__ == "__main__":
    main()
