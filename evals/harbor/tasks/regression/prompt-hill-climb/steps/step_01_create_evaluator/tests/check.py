import json

import hill_climb_checks as hc

from harbor_verifiers import phoenix_api, verify

dataset_id, examples = phoenix_api.dataset_examples(hc.DATASET_NAME)
evaluators = phoenix_api.dataset_evaluators(dataset_id)
experiments = phoenix_api.dataset_experiments(dataset_id)

one_evaluator_attached = len(evaluators) == 1
exact_match_verdicts = {e.name: hc.is_exact_match_evaluator(e, examples) for e in evaluators}
evaluator_is_exact_match = one_evaluator_attached and all(
    ok for ok, _ in exact_match_verdicts.values()
)
no_experiments_yet = not experiments and len(examples) == 28

passed = one_evaluator_attached and evaluator_is_exact_match and no_experiments_yet
details = {
    "experiment_count": len(experiments),
    "example_count": len(examples),
    "evaluators": [
        {"name": e.name, "kind": e.evaluator.kind.value, "builtin": hc.builtin_key(e)}
        for e in evaluators
    ],
    "exact_match_verdicts": {name: detail for name, (_, detail) in exact_match_verdicts.items()},
}
scores = verify.write_reward(
    float(passed),
    details,
    one_evaluator_attached=one_evaluator_attached,
    evaluator_is_exact_match=evaluator_is_exact_match,
    no_experiments_yet=no_experiments_yet,
)
print(json.dumps({**scores, **details}, indent=2, default=str))
