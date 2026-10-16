import json

import hill_climb_checks as hc

from harbor_verifiers import llm_judge, phoenix_api, verify
from harbor_verifiers.graphql.__generated__ import ExperimentFields

INSTRUCTION = hc.STEP_INSTRUCTIONS["step_03_compare"]

trajectory = verify.read_trajectory(verify.TRAJECTORY_PATH)
reply = verify.final_reply(trajectory, INSTRUCTION)
started = verify.started_at(trajectory, INSTRUCTION)
dataset_id, examples = phoenix_api.dataset_examples(hc.DATASET_NAME)
evaluators = phoenix_api.dataset_evaluators(dataset_id)
experiments = phoenix_api.dataset_experiments(dataset_id)
examples_by_id = {e["node_id"]: e for e in examples}

first, last = experiments[0], experiments[-1]
first_scores, last_scores = hc.scores(first, evaluators), hc.scores(last, evaluators)
moved = hc.moved_examples(first_scores, last_scores)

# This step is read-only apart from the note, so nothing may be created after it began.
no_new_experiments_or_scores = started is not None and not any(
    hc.changed_after(x, started) for x in experiments
)

# Recording the learning edits the last experiment's description or metadata.
learning_recorded_on_last_experiment = (
    started is not None and last.updated_at >= started and bool(last.description or last.metadata)
)


def describe(experiment: ExperimentFields, scores: hc.Scores) -> str:
    return (
        f"{experiment.name!r} (id {experiment.id}):"
        f" {hc.pass_count(scores)}/{len(hc.first_runs(experiment))} passed"
    )


moved_text = (
    "\n".join(
        f"- example {eid} (metadata {examples_by_id[eid]['metadata']}):"
        f" {hc.question(examples_by_id[eid])!r} first={scores[0]} last={scores[1]}"
        for eid, scores in sorted(moved.items())
        if eid in examples_by_id
    )
    or "(none)"
)
facts = (
    f"FIRST experiment {describe(first, first_scores)}\n"
    f"LAST experiment {describe(last, last_scores)}\n"
    f"EXAMPLES WHOSE SCORE CHANGED ({len(moved)} of {len(examples)}):\n{moved_text}"
)
VERDICT_KEYS = {
    "identifies_both_experiments": (
        "the reply makes clear which experiment is the first and which is the last,"
        " by name, id, or description such as 'the baseline'"
    ),
    "quality_stated": "the reply gives the pass counts or scores of both experiments",
    "quality_matches": "those numbers agree with the facts",
    "cites_moved_examples": (
        "the reply says which examples changed, either by naming specific examples or by"
        " saying that every example changed when the facts show that"
    ),
    "cited_examples_valid": (
        "every example the reply says changed is in the list of changed examples;"
        " when every example changed, any cited example counts"
    ),
    "verdict_given": "the reply says whether the change helped",
}
verdict = llm_judge.judge(
    system=(
        "You grade the final chat reply of an AI assistant asked to compare its first and last "
        "experiments on a dataset and say whether a prompt change helped. You are given the "
        "database facts. Judge only what the reply says against those facts. Examples may be "
        "referred to by their node id, by the id or user_id in their metadata, or by quoting "
        "their question."
    ),
    user=f"DATABASE FACTS:\n{facts}\n\nASSISTANT REPLY:\n<<<\n{reply}\n>>>",
    schema={
        "type": "object",
        "properties": {
            **{key: {"type": "boolean", "description": text} for key, text in VERDICT_KEYS.items()},
            "rationale": {"type": "string", "description": "one sentence"},
        },
        "required": [*VERDICT_KEYS, "rationale"],
    },
)
judge_accepts_comparison = verdict is not None and all(verdict.get(k) is True for k in VERDICT_KEYS)

passed = (
    no_new_experiments_or_scores
    and learning_recorded_on_last_experiment
    and judge_accepts_comparison
)
details = {
    "started_at": started,
    "first": {"id": first.id, "name": first.name, "passed": hc.pass_count(first_scores)},
    "last": {
        "id": last.id,
        "name": last.name,
        "passed": hc.pass_count(last_scores),
        "updated_at": last.updated_at,
    },
    "moved_example_ids": sorted(moved),
    "last_description": last.description,
    "last_metadata": last.metadata,
    "judge": verdict,
}
scores = verify.write_reward(
    float(passed),
    details,
    instruction=INSTRUCTION,
    no_new_experiments_or_scores=no_new_experiments_or_scores,
    learning_recorded_on_last_experiment=learning_recorded_on_last_experiment,
    judge_accepts_comparison=judge_accepts_comparison,
)
print(json.dumps({**scores, **details}, indent=2, default=str))
