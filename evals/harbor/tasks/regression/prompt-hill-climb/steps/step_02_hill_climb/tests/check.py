import json

import hill_climb_checks as hc

from evals.harbor.verifiers import verify

dataset_id, examples = hc.fetch_dataset()
evaluators = hc.fetch_evaluators(dataset_id)
experiments = hc.fetch_experiments(dataset_id)

example_ids = {e["node_id"] for e in examples}
scores_by_experiment = {x.id: hc.scores(x, evaluators) for x in experiments}
means = [hc.mean_score(scores_by_experiment[x.id]) for x in experiments]
last = experiments[-1] if experiments else None

# The empty prompt goes first, so the baseline cannot already be perfect.
first_experiment_imperfect = len(experiments) >= 2 and means[0] < 1.0
all_experiments_fully_scored = bool(experiments) and all(
    set(scores) == example_ids and hc.scored_count(scores) == len(example_ids)
    for scores in scores_by_experiment.values()
)
last_experiment_passes_all = (
    last is not None
    and hc.error_count(last) == 0
    and hc.pass_count(scores_by_experiment[last.id]) == len(example_ids)
)

passed = first_experiment_imperfect and all_experiments_fully_scored and last_experiment_passes_all
details = {
    "experiment_count": len(experiments),
    "experiments": [
        {
            "id": x.id,
            "name": x.name,
            "runs": len(hc.first_runs(x)),
            "errors": hc.error_count(x),
            "passed": hc.pass_count(scores_by_experiment[x.id]),
        }
        for x in experiments
    ],
}
scores = verify.write_reward(
    float(passed),
    details,
    first_experiment_imperfect=first_experiment_imperfect,
    all_experiments_fully_scored=all_experiments_fully_scored,
    last_experiment_passes_all=last_experiment_passes_all,
    first_score=means[0] if means else 0.0,
    last_score=means[-1] if means else 0.0,
    best_score=max(means, default=0.0),
)
print(json.dumps({**scores, **details}, indent=2, default=str))
