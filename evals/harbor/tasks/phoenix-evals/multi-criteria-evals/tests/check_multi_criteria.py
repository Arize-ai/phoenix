"""Grade the multi-criteria evals task from the experiments left in Phoenix.

`reward` is 1 when one experiment on the dataset ran every example, with task errors on at
most 10% of runs, and every spec line is scored there:

- Each deterministic line (bare query, user scope, refuse when required) has an evaluator
  whose pass or fail values agree with the computed truth on at least 90% of the runs the
  line applies to, in either polarity.
- Each semantic line (answers the question, polite refusal) has an LLM evaluator that scored
  at least 90% of the runs it applies to.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.evals_state import (
    GENERIC_NAMES,
    EvaluatorFit,
    Experiment,
    Run,
    builtin_match,
    dataset_examples,
    dataset_experiments,
    dataset_id,
    evaluator_fits,
    label_values,
)
from harbor_verifiers.verify import write_reward

MIN_FIT = 0.9
MIN_CODE_FIT = 0.95
MAX_TASK_ERRORS = 0.1
MAX_LLM_LABELS = 4

Truth = Callable[[Run], bool]
Applies = Callable[[Run], bool]


def _meta(run: Run, metadata: dict[str, Any]) -> Any:
    return metadata.get(run.example_id, {})


def deterministic_criteria(
    metadata: dict[str, Any],
) -> dict[str, tuple[Applies, Truth]]:
    def allowed(run: Run) -> bool:
        return not sql.should_refuse(run.reference)

    return {
        "bare_read_only_query": (allowed, lambda run: sql.is_bare_read_only_query(run.output)),
        "user_scope": (
            lambda run: allowed(run) and not sql.is_refusal(run.output),
            lambda run: sql.is_scoped_to_user(run.output, _meta(run, metadata)),
        ),
        "refuse_when_required": (
            lambda run: True,
            lambda run: sql.refusal_matches(run.output, run.reference),
        ),
    }


def semantic_criteria(runs: Sequence[Run]) -> dict[str, Applies]:
    refusal_runs = [run for run in runs if sql.is_refusal(run.output)]

    def is_refusal_target(run: Run) -> bool:
        if refusal_runs:
            return sql.is_refusal(run.output)
        return sql.should_refuse(run.reference)

    return {
        "answers_question": lambda run: not sql.should_refuse(run.reference),
        "polite_refusal": is_refusal_target,
    }


def best_fit(fits: Sequence[EvaluatorFit], kind: str | None = None) -> EvaluatorFit | None:
    candidates = [f for f in fits if kind is None or kind in f.kinds]
    return max(candidates, key=lambda f: (f.agreement, f.coverage), default=None)


def pick_experiment(experiments: Sequence[Experiment], n_examples: int) -> Experiment | None:
    """The newest experiment that ran every example and has the most evaluators."""
    complete = [e for e in experiments if len(e.example_ids) >= n_examples]
    return max(complete, key=lambda e: (len(e.evaluator_names()), e.created_at), default=None)


def main() -> None:
    details: dict[str, Any] = {}
    scores: dict[str, float] = {
        "outcome_experiment_complete": 0.0,
        "outcome_spec_covered": 0.0,
        "practice_code_for_deterministic": 0.0,
        "practice_llm_label_sets": 0.0,
        "diag_evaluator_count": 0.0,
        "diag_generic_names": 0.0,
        "diag_builtin_used": 0.0,
        "diag_degenerate_criteria": 0.0,
        "diag_experiment_count": 0.0,
    }
    dataset = dataset_id(sql.DATASET)
    if dataset is None:
        write_reward(0.0, {"reason": "the dataset is missing"}, **scores)
        return
    examples = dataset_examples(dataset)
    metadata = {example["node_id"]: example.get("metadata") or {} for example in examples}
    experiments = [e for e in dataset_experiments(dataset) if e.runs]
    scores["diag_experiment_count"] = float(len(experiments))
    chosen = pick_experiment(experiments, len(examples))
    if chosen is None:
        details["reason"] = "no experiment ran every example"
        write_reward(0.0, details, **scores)
        return
    runs = [run for run in chosen.runs if run.repetition == 1]
    task_errors = sum(bool(run.error) for run in runs) / len(runs)
    scores["outcome_experiment_complete"] = float(task_errors <= MAX_TASK_ERRORS)
    details["experiment"] = {"id": chosen.id, "name": chosen.name, "task_errors": task_errors}

    covered: dict[str, bool] = {}
    code_matched: dict[str, bool] = {}
    degenerate = 0
    for criterion, (applies, truth_of) in deterministic_criteria(metadata).items():
        mask = [applies(run) for run in runs]
        truth = [truth_of(run) for run in runs]
        applicable_truth = [t for t, m in zip(truth, mask) if m]
        if min(applicable_truth.count(True), applicable_truth.count(False)) < 2:
            degenerate += 1
        fits = evaluator_fits(runs, mask, truth)
        best = best_fit(fits)
        best_code = best_fit(fits, "CODE")
        covered[criterion] = bool(best and best.coverage >= MIN_FIT and best.agreement >= MIN_FIT)
        code_matched[criterion] = bool(
            best_code and best_code.coverage >= MIN_FIT and best_code.agreement >= MIN_CODE_FIT
        )
        details[criterion] = {
            "applicable_runs": sum(mask),
            "true_runs": sum(applicable_truth),
            "best": vars(best) if best else None,
            "best_code": vars(best_code) if best_code else None,
        }

    all_names = sorted({e.name for run in runs for e in run.evaluations})
    llm_names = sorted(
        {e.name for run in runs for e in run.evaluations if e.annotator_kind.upper() == "LLM"}
    )
    for criterion, applies in semantic_criteria(runs).items():
        mask = [applies(run) for run in runs]
        fits = [f for f in evaluator_fits(runs, mask, [True] * len(runs)) if "LLM" in f.kinds]
        best = max(fits, key=lambda f: f.coverage, default=None)
        covered[criterion] = bool(best and best.coverage >= MIN_FIT) or not any(mask)
        details[criterion] = {
            "applicable_runs": sum(mask),
            "best_llm": vars(best) if best else None,
        }

    scores["outcome_spec_covered"] = float(all(covered.values()))
    scores["practice_code_for_deterministic"] = float(all(code_matched.values()))
    llm_ok = []
    for name in llm_names:
        evaluations = [e for run in runs for e in run.evaluations if e.name == name]
        errors = sum(bool(e.error) for e in evaluations) / len(evaluations)
        explained = sum(bool(e.explanation) for e in evaluations if not e.error)
        valid = max(1, len(evaluations) - sum(bool(e.error) for e in evaluations))
        llm_ok.append(
            len(label_values(runs, name)) <= MAX_LLM_LABELS
            and errors <= MAX_TASK_ERRORS
            and explained / valid >= MIN_FIT
        )
    scores["practice_llm_label_sets"] = float(bool(llm_ok) and all(llm_ok))
    scores["diag_evaluator_count"] = float(len(all_names))
    scores["diag_generic_names"] = float(sum(bool(GENERIC_NAMES.match(n)) for n in all_names))
    scores["diag_builtin_used"] = float(
        any(builtin_match(n, label_values(runs, n)) for n in all_names)
    )
    scores["diag_degenerate_criteria"] = float(degenerate)
    details["covered"] = covered
    details["code_matched"] = code_matched
    details["evaluators"] = all_names
    reward = float(scores["outcome_experiment_complete"] == 1.0 and all(covered.values()))
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
