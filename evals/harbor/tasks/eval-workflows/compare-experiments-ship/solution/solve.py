"""Reference solution: compare the two prompts' pass rates, counting every repetition."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from harbor_verifiers.phoenix_api import client, write_answer

DATASET = "support-regression"
CURRENT, CANDIDATE = "prompt-v7", "prompt-v8"
SLICES = ("safety", "billing", "shipping")


def results(experiment_id: str) -> tuple[dict[str, list[bool]], list[tuple[str, int]]]:
    """Returns each example's pass or fail per run, and the errored (example, repetition) pairs."""
    ran = client().experiments.get_experiment(experiment_id=experiment_id)
    score: dict[str, float] = {}
    for evaluation in ran["evaluation_runs"]:
        if evaluation.name == "correct" and evaluation.result:
            score[evaluation.experiment_run_id] = float(evaluation.result.get("score") or 0)
    passed: dict[str, list[bool]] = defaultdict(list)
    errored = []
    for run in sorted(ran["task_runs"], key=lambda run: run["repetition_number"]):
        passed[run["dataset_example_id"]].append(score.get(run["id"], 0.0) >= 1.0)
        if run.get("error"):
            errored.append((run["dataset_example_id"], run["repetition_number"]))
    return passed, errored


class Rates:
    def __init__(self, passed: dict[str, list[bool]], ids: list[str]) -> None:
        runs = [ok for i in ids for ok in passed.get(i, [])]
        self.runs_passed, self.runs = sum(runs), len(runs)
        self.per_run = self.runs_passed / self.runs
        self.cases_reliable = sum(bool(passed.get(i)) and all(passed[i]) for i in ids)
        self.cases = len(ids)


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
    repetitions = {name: experiments[name]["repetitions"] for name in (CURRENT, CANDIDATE)}

    runs = {name: results(experiments[name]["id"]) for name in (CURRENT, CANDIDATE)}
    overall = {name: Rates(runs[name][0], ids) for name in runs}
    slices = {name: {s: Rates(runs[name][0], by_slice[s]) for s in SLICES} for name in runs}
    v7_safety, v8_safety = slices[CURRENT]["safety"], slices[CANDIDATE]["safety"]
    ship = (
        v8_safety.per_run >= v7_safety.per_run
        and overall[CANDIDATE].per_run > overall[CURRENT].per_run
    )

    if ship:
        verdict = (
            "Yes, ship v8. It's at least as good as v7 on the safety cases and better "
            "overall, so it clears your rule."
        )
    else:
        verdict = (
            "No, don't ship v8 yet. It passes more runs overall, but it does worse than v7 "
            "on the safety cases, which your rule doesn't allow."
        )
    reps = " and ".join(sorted({str(n) for n in repetitions.values()}))
    lines = [
        verdict,
        "",
        f"Each experiment ran every example {reps} times, and every run has its own "
        "`correct` evaluation, so these pass rates count every run:",
        "",
    ]

    # One rate per line, so each number has a short quote of its own.
    def summary(name: str, rates: Rates, what: str) -> str:
        return f"- {name} passed {rates.runs_passed} of {rates.runs} {what} ({rates.per_run:.1%})."

    lines += [
        summary("v7", v7_safety, "safety runs"),
        summary("v8", v8_safety, "safety runs"),
        summary("v7", overall[CURRENT], "runs overall"),
        summary("v8", overall[CANDIDATE], "runs overall"),
    ]
    for s in ("billing", "shipping"):
        lines.append(
            f"- On {s} runs, v7 passed {slices[CURRENT][s].runs_passed} and v8 passed "
            f"{slices[CANDIDATE][s].runs_passed} of {slices[CURRENT][s].runs}."
        )
    lines += [
        "",
        "Counting a case only when it passed every repetition gives the same call: "
        f"v7 passed {v7_safety.cases_reliable} of {v7_safety.cases} safety cases every time "
        f"and v8 {v8_safety.cases_reliable}, and overall v7 passed "
        f"{overall[CURRENT].cases_reliable} of {overall[CURRENT].cases} cases every time and "
        f"v8 {overall[CANDIDATE].cases_reliable}.",
    ]

    def failures(name: str, i: str) -> int:
        return sum(not ok for ok in runs[name][0].get(i, []))

    worse = sorted(
        meta[i]["case_id"]
        for i in by_slice["safety"]
        if failures(CANDIDATE, i) > failures(CURRENT, i)
    )
    better = sorted(
        meta[i]["case_id"]
        for i in by_slice["safety"]
        if failures(CANDIDATE, i) < failures(CURRENT, i)
    )
    lines.append("")
    if worse:
        case_ids = {meta[i]["case_id"]: i for i in by_slice["safety"]}
        once = sum(failures(CANDIDATE, case_ids[c]) == 1 for c in worse)
        lines.append(
            f"v8 fails {len(worse)} safety case(s) more often than v7: {', '.join(worse)}. "
            f"In {once} of them it fails only once in {reps} repetitions, so a majority vote "
            "per case or a single repetition would hide those failures. That's why the "
            "rates above count every run."
        )
    else:
        lines.append("v8 doesn't fail any safety case more often than v7.")
    if better:
        lines.append(f"It fails {len(better)} less often than v7: {', '.join(better)}.")
    if ship:
        worse_slices = [
            s
            for s in ("billing", "shipping")
            if slices[CANDIDATE][s].per_run < slices[CURRENT][s].per_run
        ]
        if worse_slices:
            lines.append(
                f"v8 is a little worse on {' and '.join(worse_slices)} questions. Your rule "
                "covers only the safety cases, so that's worth a look after launch but "
                "doesn't block it."
            )
    errors = [
        f"{name} errored on "
        + ", ".join(f"{meta[i]['case_id']} (repetition {rep})" for i, rep in sorted(runs[name][1]))
        for name in runs
        if runs[name][1]
    ]
    safety_errors = any(meta[i]["slice"] == "safety" for name in runs for i, _ in runs[name][1])
    lines.append(
        "Pass rates use the `correct` evaluator on every run, joined to each example's "
        "`slice` metadata. Runs that errored count as failures"
        + (f" ({'; '.join(errors)})" if errors else "")
        + (", and none of them are safety cases." if errors and not safety_errors else ".")
    )
    write_answer("\n".join(lines))


if __name__ == "__main__":
    main()
