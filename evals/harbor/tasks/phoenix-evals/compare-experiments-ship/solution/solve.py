"""Reference solution: compare `prompt-v7` and `prompt-v8` overall and on each slice.

Reads both experiments' runs and `correct` evaluations from Phoenix and joins them to
the dataset examples' `slice` metadata. A run passes when `correct` scored it 1; a run
that errored or has no evaluation counts as a failure. v8 ships only if it's no worse
than v7 on the safety slice and better overall.
"""

from __future__ import annotations

from typing import Any

from harbor_verifiers.phoenix_api import client, write_answer

DATASET = "support-regression"
CURRENT, CANDIDATE = "prompt-v7", "prompt-v8"
SLICES = ("safety", "billing", "shipping")


def results(name: str, experiments: dict[str, Any]) -> tuple[dict[str, bool], list[str]]:
    """Maps example ID to whether the run passed, and lists the example IDs that errored."""
    ran = client().experiments.get_experiment(experiment_id=experiments[name]["id"])
    score: dict[str, float] = {}
    for evaluation in ran["evaluation_runs"]:
        if evaluation.name == "correct" and evaluation.result:
            score[evaluation.experiment_run_id] = float(evaluation.result.get("score") or 0)
    passed = {
        run["dataset_example_id"]: score.get(run["id"], 0.0) >= 1.0 for run in ran["task_runs"]
    }
    errored = [run["dataset_example_id"] for run in ran["task_runs"] if run.get("error")]
    return passed, errored


def rate(passed: dict[str, bool], ids: list[str]) -> tuple[int, int, float]:
    hits = sum(passed.get(i, False) for i in ids)
    return hits, len(ids), hits / len(ids)


def main() -> None:
    phoenix = client()
    dataset = phoenix.datasets.get_dataset(dataset=DATASET)
    meta: dict[str, dict[str, Any]] = {}
    for example in dataset.examples:
        for key in (example["id"], example.get("node_id")):
            if key:
                meta[key] = dict(example["metadata"])
    ids = sorted({example["id"] for example in dataset.examples})
    by_slice = {s: [i for i in ids if meta[i]["slice"] == s] for s in SLICES}
    experiments = {e["name"]: e for e in phoenix.experiments.list(dataset_id=dataset.id)}

    runs = {name: results(name, experiments) for name in (CURRENT, CANDIDATE)}
    overall = {name: rate(runs[name][0], ids) for name in runs}
    slices = {name: {s: rate(runs[name][0], by_slice[s]) for s in SLICES} for name in runs}
    v7_safety, v8_safety = slices[CURRENT]["safety"][2], slices[CANDIDATE]["safety"][2]
    ship = v8_safety >= v7_safety and overall[CANDIDATE][2] > overall[CURRENT][2]

    def summary(name: str, counts: tuple[int, int, float], what: str) -> str:
        return f"- {name} passed {counts[0]} of {counts[1]} {what} ({counts[2]:.1%})."

    if ship:
        verdict = (
            "Yes, ship v8. It's at least as good as v7 on the safety cases and better "
            "overall, so it clears your rule."
        )
    else:
        verdict = (
            "No, don't ship v8 yet. It passes more cases overall, but it does worse than v7 "
            "on the safety cases, which your rule doesn't allow."
        )
    # One rate per line, so each number has a short quote of its own.
    lines = [
        verdict,
        "",
        summary("v7", slices[CURRENT]["safety"], "safety cases"),
        summary("v8", slices[CANDIDATE]["safety"], "safety cases"),
        summary("v7", overall[CURRENT], "cases overall"),
        summary("v8", overall[CANDIDATE], "cases overall"),
    ]
    for s in ("billing", "shipping"):
        lines.append(
            f"- On {s} cases, v7 passed {slices[CURRENT][s][0]} and v8 passed "
            f"{slices[CANDIDATE][s][0]} of {slices[CURRENT][s][1]}."
        )
    regressions = [
        meta[i]["case_id"]
        for i in by_slice["safety"]
        if runs[CURRENT][0].get(i) and not runs[CANDIDATE][0].get(i)
    ]
    fixes = [
        meta[i]["case_id"]
        for i in by_slice["safety"]
        if runs[CANDIDATE][0].get(i) and not runs[CURRENT][0].get(i)
    ]
    lines.append("")
    if regressions:
        lines.append(
            f"v8 fails {len(regressions)} safety case(s) that v7 passes: "
            f"{', '.join(sorted(regressions))}."
        )
    else:
        lines.append("v8 doesn't fail any safety case that v7 passes.")
    if fixes:
        lines.append(f"It fixes {len(fixes)} that v7 fails: {', '.join(sorted(fixes))}.")
    worse = [s for s in ("billing", "shipping") if slices[CANDIDATE][s][2] < slices[CURRENT][s][2]]
    if ship and worse:
        lines.append(
            f"v8 is a little worse on {' and '.join(worse)} questions. Your rule covers only "
            "the safety cases, so that's worth a look after launch but doesn't block it."
        )
    errors = [
        f"{name} errored on {', '.join(sorted(meta[i]['case_id'] for i in runs[name][1]))}"
        for name in runs
        if runs[name][1]
    ]
    safety_errors = any(meta[i]["slice"] == "safety" for name in runs for i in runs[name][1])
    lines.append(
        "Pass rates use the `correct` evaluator on every example, joined to each example's "
        "`slice` metadata. Runs that errored count as failures"
        + (f" ({'; '.join(errors)})" if errors else "")
        + (", and none of them are safety cases." if errors and not safety_errors else ".")
    )
    write_answer("\n".join(lines))


if __name__ == "__main__":
    main()
