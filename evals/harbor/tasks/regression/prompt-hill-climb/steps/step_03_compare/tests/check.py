import json

import hill_climb_checks as hc

from evals.harbor.verifiers import llm_judge, verify

trajectory = verify.read_trajectory(verify.TRAJECTORY_PATH)
reply = verify.final_reply(trajectory)
started = verify.started_at(trajectory)
dataset_id, examples = hc.fetch_dataset()
evaluators, experiments = hc.fetch_dataset_state(dataset_id)
examples_by_id = {e.node_id: e for e in examples}

first, last = experiments[0], experiments[-1]
moved = hc.moved_examples(first, last)

# This step is read-only apart from the note, so nothing may be created after it began.
no_new_experiments_or_scores = started is not None and not any(
    x.changed_after(started) for x in experiments
)

reply_names_both_experiments = all(
    x.name in reply or x.node_id in reply or f"#{x.rowid}" in reply for x in (first, last)
)

links = hc.compare_links(reply)
reply_links_comparison_view = any(
    dataset == dataset_id and ids == {first.node_id, last.node_id} for dataset, ids in links
)

learning_recorded_on_last_experiment = started is not None and any(
    noted >= started.date() for noted in hc.dates_in(json.dumps(last.metadata, default=str))
)


def describe(experiment: hc.Experiment) -> str:
    latency = f"{experiment.latency_ms:.0f} ms" if experiment.latency_ms is not None else "unknown"
    cost = f"${experiment.cost:.4f}" if experiment.cost is not None else "unknown"
    return (
        f"{experiment.name!r} (id {experiment.node_id}):"
        f" {experiment.pass_count}/{experiment.run_count} passed,"
        f" mean run latency {latency}, total cost {cost}"
    )


moved_text = (
    "\n".join(
        f"- example {eid} (metadata {examples_by_id[eid].metadata}):"
        f" {examples_by_id[eid].question!r} first={scores[0]} last={scores[1]}"
        for eid, scores in sorted(moved.items())
        if eid in examples_by_id
    )
    or "(none)"
)
facts = (
    f"FIRST experiment {describe(first)}\n"
    f"LAST experiment {describe(last)}\n"
    f"EXAMPLES WHOSE SCORE CHANGED:\n{moved_text}"
)
VERDICT_KEYS = {
    "quality_stated": "the reply gives the pass counts or scores of both experiments",
    "quality_matches": "those numbers agree with the facts",
    "latency_stated": "the reply compares latency or duration",
    "cost_stated": "the reply compares cost",
    "cites_moved_examples": "the reply names at least one specific example that changed",
    "cited_examples_valid": "every example the reply says changed is in the list of changed examples",
    "verdict_given": "the reply says whether the change helped",
}
verdict = llm_judge.judge(
    system=(
        "You grade the final chat reply of an AI assistant asked to compare its first and last "
        "experiments on a dataset and say whether a prompt change helped. You are given the "
        "database facts. Judge only what the reply says against those facts. Examples may be "
        "referred to by their node id, metadata id, or by quoting their question."
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
    and reply_names_both_experiments
    and reply_links_comparison_view
    and learning_recorded_on_last_experiment
    and judge_accepts_comparison
)
details = {
    "started_at": started,
    "first": {"id": first.node_id, "name": first.name, "passed": first.pass_count},
    "last": {"id": last.node_id, "name": last.name, "passed": last.pass_count},
    "moved_example_ids": sorted(moved),
    "links": [[d, sorted(ids)] for d, ids in links],
    "last_metadata": last.metadata,
    "judge": verdict,
}
scores = verify.write_reward(
    float(passed),
    details,
    no_new_experiments_or_scores=no_new_experiments_or_scores,
    reply_names_both_experiments=reply_names_both_experiments,
    reply_links_comparison_view=reply_links_comparison_view,
    learning_recorded_on_last_experiment=learning_recorded_on_last_experiment,
    judge_accepts_comparison=judge_accepts_comparison,
)
print(json.dumps({**scores, **details}, indent=2, default=str))
