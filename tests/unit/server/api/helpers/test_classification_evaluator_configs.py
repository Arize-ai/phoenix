from typing import Callable

import pytest
from pydantic import ValidationError

import phoenix.__generated__.classification_evaluator_configs as configs_module
from phoenix.__generated__.classification_evaluator_configs import (
    ClassificationEvaluatorConfig,
    EvaluatorScope,
    PromptMessage,
)
from phoenix.db.types.evaluators import validate_jsonpath
from phoenix.server.api.helpers.classification_evaluator_configs import (
    get_classification_evaluator_configs,
)
from phoenix.server.session_filters import validate_session_filter_condition
from phoenix.server.trace_filters import validate_trace_filter_condition
from phoenix.trace.dsl.filter import validate_span_filter_condition

_FILTER_VALIDATOR_BY_SCOPE: dict[EvaluatorScope, Callable[[str], None]] = {
    EvaluatorScope.SPAN: validate_span_filter_condition,
    EvaluatorScope.TRACE: validate_trace_filter_condition,
    EvaluatorScope.SESSION: validate_session_filter_condition,
}


@pytest.mark.parametrize(
    "config",
    get_classification_evaluator_configs(gallery_ready=True),
    ids=lambda config: config.name,
)
def test_gallery_defaults_parse_in_the_languages_of_their_scope(
    config: ClassificationEvaluatorConfig,
) -> None:
    assert config.scope is not None and config.inputs is not None
    if config.default_filter_condition is not None:
        _FILTER_VALIDATOR_BY_SCOPE[config.scope](config.default_filter_condition)
    for input_name, path in (config.default_path_mapping or {}).items():
        assert input_name in config.inputs
        validate_jsonpath(path)


def test_default_path_mapping_must_name_declared_inputs() -> None:
    with pytest.raises(ValidationError, match="undeclared inputs"):
        ClassificationEvaluatorConfig.model_validate(
            {
                "name": "test",
                "description": "Test evaluator",
                "optimization_direction": "maximize",
                "messages": [PromptMessage(role="user", content="{{input}}")],
                "choices": {"yes": 1, "no": 0},
                "inputs": {"input": {"description": "Input"}},
                "default_path_mapping": {"context": "output"},
            }
        )


def test_gallery_returns_complete_configs_in_order_without_expanding_templates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def make_config(name: str, *, recommended: bool) -> ClassificationEvaluatorConfig:
        return ClassificationEvaluatorConfig.model_validate(
            {
                "name": name,
                "description": "Test evaluator",
                "optimization_direction": "maximize",
                "messages": [PromptMessage(role="user", content="{{available_tools}}")],
                "choices": {"yes": 1, "no": 0},
                "substitutions": {"available_tools": "available_tools_list"},
                "scope": "span",
                "recommended": recommended,
                "category": "agents",
                "details": "Test details",
                "inputs": {"available_tools": {"description": "Available tools"}},
            }
        )

    recommended = make_config("recommended", recommended=True)
    standard = make_config("standard", recommended=False)
    incomplete = standard.model_copy(update={"name": "incomplete", "inputs": None})
    monkeypatch.setattr(
        configs_module,
        "TEST_RECOMMENDED_CLASSIFICATION_EVALUATOR_CONFIG",
        recommended,
        raising=False,
    )
    monkeypatch.setattr(
        configs_module,
        "TEST_STANDARD_CLASSIFICATION_EVALUATOR_CONFIG",
        standard,
        raising=False,
    )
    monkeypatch.setattr(
        configs_module,
        "TEST_INCOMPLETE_CLASSIFICATION_EVALUATOR_CONFIG",
        incomplete,
        raising=False,
    )

    configs = [
        config
        for config in get_classification_evaluator_configs(gallery_ready=True)
        if config.name in {"recommended", "standard", "incomplete"}
    ]

    assert configs == [recommended, standard]
    assert standard.messages[0].content == "{{available_tools}}"
