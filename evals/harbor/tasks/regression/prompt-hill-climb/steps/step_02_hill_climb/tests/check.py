import hill_climb_checks as hc

trajectory = hc.load_trajectory()
dataset_id, examples = hc.fetch_dataset()
evaluators, experiments = hc.fetch_dataset_state(dataset_id)

example_ids = {e.node_id for e in examples}
first, last = (experiments[0], experiments[-1]) if experiments else (None, None)

# The empty prompt goes first, so the baseline cannot already be perfect.
first_experiment_imperfect = len(experiments) >= 2 and experiments[0].mean_score < 1.0
# Every experiment ran the whole dataset and the evaluator scored it.
all_experiments_fully_scored = bool(experiments) and all(
    set(x.scores) == example_ids and x.scored_count == len(example_ids) for x in experiments
)
last_experiment_passes_all = (
    last is not None and last.error_count == 0 and last.pass_count == len(example_ids)
)

passed = first_experiment_imperfect and all_experiments_fully_scored and last_experiment_passes_all
if experiments:
    hc.save_state(
        "step_02",
        {
            "experiments": [
                {
                    "id": x.node_id,
                    "name": x.name,
                    "metadata": x.metadata,
                    "run_count": x.run_count,
                    "annotation_count": x.annotation_count,
                }
                for x in experiments
            ],
        },
    )
hc.write_reward(
    float(passed),
    details={
        "tool_calls": hc.tool_call_count(trajectory),
        "experiment_count": len(experiments),
        "experiments": [
            {
                "id": x.node_id,
                "name": x.name,
                "runs": x.run_count,
                "errors": x.error_count,
                "passed": x.pass_count,
            }
            for x in experiments
        ],
    },
    first_experiment_imperfect=first_experiment_imperfect,
    all_experiments_fully_scored=all_experiments_fully_scored,
    last_experiment_passes_all=last_experiment_passes_all,
    first_score=first.mean_score if first else 0.0,
    last_score=last.mean_score if last else 0.0,
    best_score=max((x.mean_score for x in experiments), default=0.0),
)
