import sys
from pathlib import Path
from typing import Any

TASK = Path(__file__).resolve().parents[3] / "evals/harbor/tasks/regression/prompt-hill-climb"
sys.path.insert(0, str(TASK / "tests"))

import hill_climb_checks as hc  # noqa: E402

from harbor_verifiers.graphql.__generated__ import (  # noqa: E402
    DatasetEvaluatorFields,
    ExperimentFields,
)


def test_step_instructions_open_each_instruction_file() -> None:
    for step, opening in hc.STEP_INSTRUCTIONS.items():
        text = " ".join((TASK / "steps" / step / "instruction.md").read_text().split())
        assert text.startswith(opening), step


def _evaluator(name: str, output_configs: list[dict[str, Any]]) -> DatasetEvaluatorFields:
    return DatasetEvaluatorFields.model_validate(
        {
            "id": "RGF0YXNldEV2YWx1YXRvcjox",
            "name": name,
            "inputMapping": {"pathMapping": {}, "literalMapping": {}},
            "outputConfigs": output_configs,
            "evaluator": {
                "__typename": "CodeEvaluator",
                "id": "Q29kZUV2YWx1YXRvcjox",
                "name": name,
                "kind": "CODE",
                "language": "PYTHON",
                "sourceCode": "def evaluate(output, reference): ...",
                "sandboxConfig": {"id": "U2FuZGJveENvbmZpZzox"},
                "outputConfigs": [],
            },
        }
    )


def _experiment(annotations: list[dict[str, Any]]) -> ExperimentFields:
    return ExperimentFields.model_validate(
        {
            "id": "RXhwZXJpbWVudDox",
            "name": "v2",
            "description": None,
            "metadata": {},
            "createdAt": "2026-10-02T14:30:00+00:00",
            "updatedAt": "2026-10-02T14:30:00+00:00",
            "averageRunLatencyMs": None,
            "costSummary": {"total": {"cost": None}},
            "runs": {
                "edges": [
                    {
                        "node": {
                            "id": "RXhwZXJpbWVudFJ1bjox",
                            "repetitionNumber": 1,
                            "error": None,
                            "example": {"id": "RGF0YXNldEV4YW1wbGU6MQ=="},
                            "annotations": {"edges": [{"node": a} for a in annotations]},
                        }
                    }
                ]
            },
        }
    )


CATEGORICAL = {
    "__typename": "CategoricalAnnotationConfig",
    "name": "exact_match",
    "description": None,
    "optimizationDirection": "MAXIMIZE",
    "values": [{"label": "pass", "score": 1.0}, {"label": "fail", "score": 0.0}],
}


def test_scores_accept_annotations_named_after_the_output_config() -> None:
    annotation = {
        "name": "exact_match",
        "score": 1.0,
        "label": "pass",
        "startTime": "2026-10-02T14:31:00+00:00",
    }
    experiment = _experiment([annotation])
    named_after_config = _evaluator("exact_sql_or_refusal_match", [CATEGORICAL])
    assert hc.annotation_names(named_after_config) == {"exact_sql_or_refusal_match", "exact_match"}
    assert hc.scores(experiment, [named_after_config]) == {"RGF0YXNldEV4YW1wbGU6MQ==": 1.0}
    unrelated = _evaluator("other", [])
    assert hc.scores(experiment, [unrelated]) == {"RGF0YXNldEV4YW1wbGU6MQ==": None}
