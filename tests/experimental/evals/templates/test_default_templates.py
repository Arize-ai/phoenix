from phoenix.experimental.evals.templates.default_templates import (
    CLASSIFICATION_TEMPLATES,
    EvalCriteria,
)


def test_every_eval_criteria_has_an_associated_classification_template() -> None:
    assert set(CLASSIFICATION_TEMPLATES.keys()) == set(EvalCriteria)
