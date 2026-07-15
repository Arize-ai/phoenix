"""Parametrized PXI behavioral evals as recording-only Phoenix tests.

Each YAML example becomes one ``@pytest.mark.phoenix`` test item: it runs the
PXI agent once, then scores the single output with every evaluator the dataset
declares via inline ``px.evaluate`` (which records to Phoenix and returns the
result). One ``record_property`` datapoint is emitted per evaluation. The tests
never assert -- ``gate.py`` decides pass/fail from the aggregated artifact.
"""

# ruff: noqa: I001 -- repository import formatter and lint resolver disagree on local `evals`.

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import pytest

from evals.pxi.evaluators import EVALUATORS_BY_NAME
from evals.pxi.harness.agent_task import run_pxi_example
from evals.pxi.harness.datasets import DATASETS_DIR, load_dataset
from evals.pxi.harness.reporting import PASSING_SCORE
from phoenix.client.pytest import evaluate, log_output


@dataclass(frozen=True)
class EvalCase:
    dataset_name: str
    example_id: str
    split: str
    input: dict[str, Any]
    expected: dict[str, Any]
    evaluator_names: tuple[str, ...]


def _load_cases() -> list[Any]:
    cases: list[Any] = []
    for path in sorted(DATASETS_DIR.glob("*.yaml")):
        dataset = load_dataset(path)
        for example in dataset.examples:
            split = str(example["splits"][0])
            case = EvalCase(
                dataset_name=dataset.dataset_name,
                example_id=str(example["id"]),
                split=split,
                input=example["input"],
                expected=example["expected"],
                evaluator_names=tuple(dataset.evaluators),
            )
            cases.append(
                pytest.param(
                    case,
                    # The phoenix marker MUST live here, per-param, not as a
                    # function decorator: get_closest_marker returns the first
                    # phoenix mark in own_markers, and a function-level one would
                    # shadow these dataset kwargs, collapsing every dataset into
                    # one named after the test file. Consequence: repetitions>1
                    # cannot expand here, because the plugin reads the marker for
                    # the repetition axis before parametrization exists -- a
                    # per-example repetitions kwarg would be silently ignored.
                    marks=[
                        pytest.mark.phoenix(dataset=dataset.dataset_name),
                        getattr(pytest.mark, split),
                    ],
                    # Namespaced so example ids stay globally unique across
                    # datasets; the per-dataset prefix is constant, so the
                    # plugin's stable external_id is unique within a dataset.
                    id=f"{path.stem}-{example['id']}",
                )
            )
    return cases


def _result_score(result: Any) -> float | None:
    """Pull the numeric score from an inline ``px.evaluate`` return.

    ``px.evaluate`` hands back the evaluator's raw result. The PXI code
    evaluators are ``phoenix.evals`` evaluators, so that is a one-element list
    of ``Score`` objects; tolerate a bare ``Score``, a dict, or a number too.
    """
    if isinstance(result, (list, tuple)):
        result = result[0] if result else None
    value = getattr(result, "score", None)
    if value is None and isinstance(result, dict):
        value = result.get("score")
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _result_details(result: Any) -> dict[str, Any]:
    """Return JSON-safe evaluator evidence from the first emitted score."""
    if isinstance(result, (list, tuple)):
        result = result[0] if result else None
    details: dict[str, Any] = {"score": _result_score(result)}
    for key in ("label", "explanation", "metadata"):
        value = getattr(result, key, None)
        if value is None and isinstance(result, dict):
            value = result.get(key)
        if value is not None:
            details[key] = value
    return details


@pytest.mark.parametrize("case", _load_cases())
async def test_pxi_eval(
    case: EvalCase,
    docs_mcp_toolset: Any,
    record_property: Any,
    request: Any,
) -> None:
    result = await run_pxi_example(
        case.input,
        stable_example_id=case.example_id,
        docs_mcp_server=docs_mcp_toolset,
    )
    log_output(result)
    nodeid = request.node.nodeid
    # run_pxi_example never raises: a provider or setup failure comes back as a
    # truthy ``error`` string with unassessable output. Scoring that empty
    # output would make an infrastructure error indistinguishable from a real
    # regression, so skip evaluation and emit one placeholder row per evaluator
    # (score None, passed False). Emitting one row per evaluator keeps the
    # infrastructure visible while excluding it from the behavioral denominator.
    task_error = result.get("error")
    for evaluator_name in case.evaluator_names:
        evaluator_error = None
        details: dict[str, Any] = {"score": None}
        if task_error:
            passed = False
        else:
            try:
                eval_result = evaluate(
                    EVALUATORS_BY_NAME[evaluator_name],
                    output=result,
                    expected=case.expected,
                    input=case.input,
                )
                details = _result_details(eval_result)
            except Exception as exc:
                # A code evaluator raising is a defect in the scoring apparatus,
                # not a per-example agent result. Record it as an evaluator_error
                # row instead of letting the exception abort the item: that keeps
                # the crash visible as evidence AND lets the other evaluators on
                # this example still run. It is NOT silently excluded -- gate.py
                # fails the whole gating cell closed (unmeasurable, exit 2) on any
                # evaluator_error, so a broken evaluator can never be masked into a
                # green PASSED by other examples that happened to pass.
                evaluator_error = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
            score = details["score"]
            # Same passing rule reporting.py applies to Phoenix annotations, so
            # the gate and the Phoenix UI agree on which evaluations passed.
            passed = score is not None and score >= PASSING_SCORE
        row = {
            "dataset": case.dataset_name,
            "example_id": case.example_id,
            "nodeid": nodeid,
            "evaluator": evaluator_name,
            "split": case.split,
            **details,
            "passed": passed,
        }
        if task_error:
            row["task_error"] = task_error
        if evaluator_error:
            row["evaluator_error"] = evaluator_error
        record_property("pxi_eval", json.dumps(row))
