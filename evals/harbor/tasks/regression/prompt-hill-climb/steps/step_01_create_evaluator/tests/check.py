import hill_climb_checks as hc

trajectory = hc.load_trajectory()
dataset_id, examples = hc.fetch_dataset()
evaluators, experiments = hc.fetch_dataset_state(dataset_id)

one_evaluator_attached = len(evaluators) == 1
probe_verdicts = {e.name: hc.probe_evaluator(e, examples) for e in evaluators}
evaluator_is_exact_match = one_evaluator_attached and all(ok for ok, _ in probe_verdicts.values())
no_experiments_yet = not experiments and len(examples) == 28

passed = one_evaluator_attached and evaluator_is_exact_match and no_experiments_yet
hc.write_reward(
    float(passed),
    details={
        "tool_calls": hc.tool_call_count(trajectory),
        "experiment_count": len(experiments),
        "example_count": len(examples),
    },
    one_evaluator_attached=one_evaluator_attached,
    evaluator_is_exact_match=evaluator_is_exact_match,
    no_experiments_yet=no_experiments_yet,
    evaluators=[{"name": e.name, "kind": e.kind, "builtin": e.builtin_key} for e in evaluators],
    probe_verdicts={name: detail for name, (_, detail) in probe_verdicts.items()},
)
