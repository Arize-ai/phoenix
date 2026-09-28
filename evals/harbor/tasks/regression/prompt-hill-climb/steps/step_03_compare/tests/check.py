import hill_climb_checks as hc

trajectory = hc.load_trajectory()
reply = hc.final_reply(trajectory)
before = hc.load_state("step_02") or {}

with hc.connect() as connection:
    dataset_id = hc.dataset_rowid(connection)
    examples = {e.rowid: e for e in hc.fetch_examples(connection, dataset_id)}
    evaluators = hc.fetch_bound_evaluators(connection, dataset_id)
    experiments = hc.fetch_experiments(connection, dataset_id, {e.name for e in evaluators})
    annotations = hc.annotation_count(connection, dataset_id)

first, last = experiments[0], experiments[-1]
moved = hc.moved_examples(first, last)

# Read-only apart from the note: the same experiments, runs, and scores as after step 2.
prior = {x["id"]: x for x in before.get("experiments", [])}
read_only_ok = (
    bool(prior)
    and [x.rowid for x in experiments] == list(prior)
    and all(x.run_count == prior[x.rowid]["run_count"] for x in experiments)
    and annotations == before.get("annotation_count")
)

pair_ok = all(
    x.name in reply or x.node_id in reply or f"#{x.rowid}" in reply for x in (first, last)
)

links = hc.compare_links(reply)
link_ok = any(
    dataset == hc.global_id("Dataset", dataset_id) and ids == {first.node_id, last.node_id}
    for dataset, ids in links
)

before_metadata = prior.get(last.rowid, {}).get("metadata", {}) if prior else {}
added = hc.metadata_additions(before_metadata, last.metadata)
note_ok = (
    hc.metadata_preserved(before_metadata, last.metadata)
    and added != "{}"
    and hc.has_timestamp(added)
)

moved_text = (
    "\n".join(
        f"- example {eid} (node id {examples[eid].node_id}, metadata {examples[eid].metadata}):"
        f" {examples[eid].question!r} first={scores[0]} last={scores[1]}"
        for eid, scores in sorted(moved.items())
        if eid in examples
    )
    or "(none)"
)
facts = (
    f"FIRST experiment {first.name!r} (id {first.node_id}): {first.pass_count}/{first.run_count} passed,"
    f" mean latency {first.latency_ms and round(first.latency_ms)} ms, total tokens {first.tokens}\n"
    f"LAST experiment {last.name!r} (id {last.node_id}): {last.pass_count}/{last.run_count} passed,"
    f" mean latency {last.latency_ms and round(last.latency_ms)} ms, total tokens {last.tokens}\n"
    f"EXAMPLES WHOSE SCORE CHANGED:\n{moved_text}"
)
verdict = hc.judge(
    system=(
        "You grade the final chat reply of an AI assistant asked to compare its first and last "
        "experiments on a dataset and say whether a prompt change helped. You are given the "
        "database facts. Judge only what the reply says against those facts. Examples may be "
        "referred to by their number, node id, metadata id, or by quoting their question."
    ),
    user=(
        f"DATABASE FACTS:\n{facts}\n\nASSISTANT REPLY:\n<<<\n{reply}\n>>>\n\n"
        "Return JSON with keys: quality_stated (true if the reply gives the pass counts or "
        "scores of both experiments), quality_matches (true if those numbers agree with the "
        "facts), latency_stated (true if the reply compares latency or duration), "
        "cost_stated (true if the reply compares tokens or cost), cites_moved_examples (true if "
        "the reply names at least one specific example that changed), cited_examples_valid "
        "(true if every example the reply says changed is in the list of changed examples), "
        "verdict_given (true if the reply says whether the change helped), rationale (one sentence)."
    ),
)
judge_ok = bool(
    verdict
    and not verdict.get("error")
    and verdict.get("quality_stated") is True
    and verdict.get("quality_matches") is True
    and verdict.get("latency_stated") is True
    and verdict.get("cost_stated") is True
    and verdict.get("cites_moved_examples") is True
    and verdict.get("cited_examples_valid") is True
    and verdict.get("verdict_given") is True
)

passed = read_only_ok and pair_ok and link_ok and note_ok and judge_ok
hc.write_reward(
    float(passed),
    details={
        "tool_calls": hc.tool_call_count(trajectory),
        "first": {"id": first.rowid, "name": first.name, "passed": first.pass_count},
        "last": {"id": last.rowid, "name": last.name, "passed": last.pass_count},
        "moved_example_ids": sorted(moved),
    },
    read_only_ok=read_only_ok,
    pair_ok=pair_ok,
    link_ok=link_ok,
    note_ok=note_ok,
    judge_ok=judge_ok,
    links=[[d, sorted(ids)] for d, ids in links],
    metadata_added=added,
    judge=verdict,
)
