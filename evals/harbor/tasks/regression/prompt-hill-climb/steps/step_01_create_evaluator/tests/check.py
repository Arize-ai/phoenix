import hill_climb_checks as hc

trajectory = hc.load_trajectory()

with hc.connect() as connection:
    dataset_id = hc.dataset_rowid(connection)
    examples = hc.fetch_examples(connection, dataset_id)
    evaluators = hc.fetch_bound_evaluators(connection, dataset_id)
    experiments = hc.fetch_experiments(connection, dataset_id, set())

bound_ok = len(evaluators) == 1
probes = {e.name: hc.probe_evaluator(e, examples) for e in evaluators}
probes_ok = bound_ok and all(ok for ok, _ in probes.values())
# The evaluator is the whole step; experiments belong to the next one.
nothing_else_ok = not experiments and len(examples) == 28

passed = bound_ok and probes_ok and nothing_else_ok
hc.write_reward(
    float(passed),
    details={"tool_calls": hc.tool_call_count(trajectory)},
    bound_ok=bound_ok,
    probes_ok=probes_ok,
    nothing_else_ok=nothing_else_ok,
    evaluators=[{"name": e.name, "kind": e.kind, "builtin": e.builtin_key} for e in evaluators],
    probes={name: detail for name, (_, detail) in probes.items()},
    experiment_count=len(experiments),
    example_count=len(examples),
)
