from phoenix.experimental.evals.evaluators import EvalCriteria, _get_eval_criteria_name_to_template


def test_get_eval_criteria_name_to_template_returns_dictionary_with_keys_equal_to_enum_values() -> (
    None
):
    eval_criteria_to_template = _get_eval_criteria_name_to_template()
    assert set(eval_criteria_to_template.keys()) == set(
        eval_criteria.value for eval_criteria in EvalCriteria
    ), "The keys of the map derived from the enum must match the values of the enum."
